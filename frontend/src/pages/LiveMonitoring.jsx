import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import io from 'socket.io-client';
import AdminLayout from '../components/AdminLayout';
import { API_URL, SOCKET_URL } from '../config';
import { 
  Activity, 
  Video, 
  VideoOff, 
  AlertOctagon, 
  UserCheck, 
  CheckCircle,
  FileSpreadsheet,
  ZapOff
} from 'lucide-react';

export default function LiveMonitoring() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialTestId = queryParams.get('testId') || '';

  const [tests, setTests] = useState([]);
  const [selectedTestId, setSelectedTestId] = useState(initialTestId);
  const [candidates, setCandidates] = useState({}); // userId -> candidateData
  const [eventLogs, setEventLogs] = useState([]);
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef(null);

  // 1. Fetch available tests list
  useEffect(() => {
    const fetchTests = async () => {
      try {
        const res = await fetch(`${API_URL}/tests/admin`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        const data = await res.json();
        if (res.ok) {
          setTests(data);
          if (!selectedTestId && data.length > 0) {
            setSelectedTestId(data[0]._id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch tests:', error);
      }
    };
    fetchTests();
  }, []);

  // 2. Connect to Socket.io and join test room
  useEffect(() => {
    if (!selectedTestId) return;

    // Reset current state
    setCandidates({});
    setEventLogs([]);

    // Initialize socket connection
    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      console.log('📡 Connected to live monitoring socket server');
      
      // Join test room as admin
      socket.emit('join_test_room', {
        testId: selectedTestId,
        role: 'ADMIN',
        userId: 'admin_session',
      });
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    // Event listener: Student joined
    socket.on('student_joined', ({ userId, timestamp }) => {
      // Fetch user profile from DB or initialize
      setCandidates((prev) => {
        if (prev[userId]) return prev;
        return {
          ...prev,
          [userId]: {
            userId,
            name: 'Candidate Joining...',
            email: '',
            strikes: 0,
            cameraActive: true,
            status: 'IN_PROGRESS',
            violations: [],
            lastActive: new Date(timestamp),
          },
        };
      });

      // Quick fetch to update profile info
      fetchUserProfile(userId);

      logEvent({
        type: 'JOIN',
        message: 'A candidate has entered the exam lobby.',
        timestamp: new Date(timestamp),
      });
    });

    // Event listener: Student reported violation strike
    socket.on('student_violation', ({ userId, name, email, eventType, proof, strikes, timestamp }) => {
      setCandidates((prev) => {
        const current = prev[userId] || {
          userId,
          name: name || 'Candidate',
          email: email || '',
          violations: [],
        };

        const updatedViolations = [
          ...current.violations,
          { eventType, proof, timestamp: new Date(timestamp) },
        ];

        return {
          ...prev,
          [userId]: {
            ...current,
            name: name || current.name,
            email: email || current.email,
            strikes,
            violations: updatedViolations,
            status: strikes >= 3 ? 'AUTO_SUBMITTED' : 'IN_PROGRESS',
            lastActive: new Date(timestamp),
          },
        };
      });

      logEvent({
        type: 'VIOLATION',
        message: `${name || 'Candidate'} triggered strike [${eventType}]: ${proof}`,
        timestamp: new Date(timestamp),
      });
    });

    // Event listener: Student submitted exam
    socket.on('student_submitted', ({ userId, score, submittedType, timestamp }) => {
      setCandidates((prev) => {
        const current = prev[userId];
        if (!current) return prev;
        return {
          ...prev,
          [userId]: {
            ...current,
            status: submittedType === 'PROCTOR_AUTO_SUBMIT' ? 'AUTO_SUBMITTED' : 'COMPLETED',
            score,
            lastActive: new Date(timestamp),
          },
        };
      });

      logEvent({
        type: 'SUBMISSION',
        message: `Candidate submission received. Type: ${submittedType}`,
        timestamp: new Date(timestamp),
      });
    });

    // Event listener: Student left
    socket.on('student_left', ({ userId }) => {
      setCandidates((prev) => {
        const current = prev[userId];
        if (!current) return prev;
        return {
          ...prev,
          [userId]: {
            ...current,
            cameraActive: false,
          },
        };
      });

      logEvent({
        type: 'LEAVE',
        message: `Candidate webcam feed disconnected.`,
        timestamp: new Date(),
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedTestId]);

  const fetchUserProfile = async (userId) => {
    // Helper to query user details
    try {
      const res = await fetch(`${API_URL}/reports/test/${selectedTestId}/html`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      // We can also query all submissions/logs for the test to seed the monitor page state on initial load!
      if (res.ok) {
        syncLiveStateWithDB();
      }
    } catch (e) {}
  };

  const syncLiveStateWithDB = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Get submissions to see who has already submitted or is active
      const subRes = await fetch(`${API_URL}/submissions/admin/test/${selectedTestId}`, { headers });
      const submissions = await subRes.json();

      if (!subRes.ok) return;

      const loadedCandidates = {};

      for (const sub of submissions) {
        const studentId = sub.student._id;
        
        // Fetch proctor logs for this student
        const proctorRes = await fetch(`${API_URL}/proctor/admin/test/${selectedTestId}/student/${studentId}`, { headers });
        const proctorData = await proctorRes.json();

        const violations = proctorData.events || [];
        const strikes = violations.filter(v => v.eventType !== 'AUTO_SUBMITTED').length;

        loadedCandidates[studentId] = {
          userId: studentId,
          name: sub.student.name,
          email: sub.student.email,
          strikes,
          cameraActive: false, // Default to inactive until socket connections occur
          status: sub.submittedType === 'PROCTOR_AUTO_SUBMIT' ? 'AUTO_SUBMITTED' : 'COMPLETED',
          violations: violations.map(v => ({
            eventType: v.eventType,
            proof: v.proof,
            timestamp: new Date(v.timestamp)
          })),
          score: sub.score,
          lastActive: new Date(sub.createdAt),
        };
      }

      setCandidates(loadedCandidates);
    } catch (e) {
      console.error('Failed to sync initial monitor state:', e);
    }
  };

  useEffect(() => {
    if (selectedTestId) {
      syncLiveStateWithDB();
    }
  }, [selectedTestId]);

  const logEvent = (evt) => {
    setEventLogs((prev) => [evt, ...prev.slice(0, 49)]); // keep last 50 logs
  };

  const candidatesArr = Object.values(candidates);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Test Selector Top Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/40 p-5 rounded-xl border border-slate-850">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/10 text-blue-400 rounded-lg border border-blue-500/20">
              <Activity className="animate-pulse" size={20} />
            </div>
            <div>
              <h2 className="font-bold text-slate-200 text-base">Assessment Live Room</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {socketConnected ? '🛰️ Socket Room Active' : '🔌 Socket Offline'}
              </p>
            </div>
          </div>

          <div className="w-full sm:w-72">
            <select
              value={selectedTestId}
              onChange={(e) => setSelectedTestId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-slate-200 outline-none text-sm cursor-pointer"
            >
              <option value="" disabled>Select test room...</option>
              {tests.map((test) => (
                <option key={test._id} value={test._id}>{test.title} ({test.testId})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Live Dashboard splits */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT: Candidate Cards Grid */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Candidate Monitoring Grid ({candidatesArr.length})</h3>
            
            {candidatesArr.length === 0 ? (
              <div className="text-center py-20 bg-slate-900/10 border border-dashed border-slate-850 rounded-xl">
                <UserCheck size={36} className="text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500 text-sm font-medium">No candidates are currently active in this exam room.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {candidatesArr.map((student) => {
                  const strikeLimit = 3;
                  const isBlocked = student.strikes >= strikeLimit || student.status === 'AUTO_SUBMITTED';

                  return (
                    <div
                      key={student.userId}
                      className={`glass-panel p-5 rounded-xl border relative overflow-hidden transition ${
                        isBlocked
                          ? 'border-rose-500/30 bg-rose-500/5'
                          : student.status === 'COMPLETED'
                          ? 'border-emerald-500/25 bg-emerald-500/5'
                          : student.strikes > 0
                          ? 'border-amber-500/30'
                          : 'border-slate-800'
                      }`}
                    >
                      {/* Top Row: Name and Webcam Status */}
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-bold text-slate-200 text-sm truncate">{student.name}</h4>
                          <span className="text-[10px] text-slate-500 block truncate">{student.email}</span>
                        </div>
                        
                        <div className="flex items-center gap-1.5 bg-slate-950/60 border border-slate-850 px-2 py-1 rounded text-[10px] font-bold">
                          {student.cameraActive ? (
                            <>
                              <Video size={10} className="text-emerald-400" />
                              <span className="text-emerald-400">FEED ON</span>
                            </>
                          ) : (
                            <>
                              <VideoOff size={10} className="text-slate-500" />
                              <span className="text-slate-500">OFFLINE</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Strikes Section */}
                      <div className="mb-4 bg-slate-900/50 p-2.5 rounded-lg border border-slate-850/80">
                        <div className="flex justify-between items-center text-xs mb-1.5">
                          <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Strikes Index</span>
                          <span className={`font-mono font-bold ${student.strikes > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                            {student.strikes} / {strikeLimit}
                          </span>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 rounded-full ${
                              isBlocked ? 'bg-rose-500' : student.strikes === 2 ? 'bg-amber-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${Math.min((student.strikes / strikeLimit) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Bottom Panel Status */}
                      <div className="flex justify-between items-center border-t border-slate-850 pt-3">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Exam Status:</span>
                        
                        <span
                          className={`text-[10px] font-bold uppercase tracking-widest ${
                            isBlocked
                              ? 'text-rose-400'
                              : student.status === 'COMPLETED'
                              ? 'text-emerald-400'
                              : 'text-blue-400 animate-pulse'
                          }`}
                        >
                          {student.status === 'AUTO_SUBMITTED' ? '🚫 Auto Submitted' : student.status === 'COMPLETED' ? '✅ Concluded' : '📝 Code Attempting'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT: Real-time Event Feed Logs */}
          <div className="lg:col-span-1 glass-panel p-6 rounded-xl border border-slate-800 flex flex-col h-[600px]">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-850 pb-3 flex items-center gap-2">
              <FileSpreadsheet size={16} className="text-blue-400" />
              <span>Realtime Security Log</span>
            </h3>

            <div className="flex-1 overflow-y-auto mt-4 space-y-4 pr-1">
              {eventLogs.length === 0 ? (
                <div className="text-center py-20 text-slate-600 text-xs">
                  <ZapOff size={24} className="mx-auto mb-2 text-slate-800" />
                  No events received yet.
                </div>
              ) : (
                eventLogs.map((evt, idx) => (
                  <div key={idx} className="bg-slate-900/40 border border-slate-850/60 p-3 rounded-lg text-xs space-y-1 animate-slideIn">
                    <div className="flex justify-between items-center">
                      <span
                        className={`px-1.5 py-0.5 rounded-[3px] font-black uppercase text-[9px] ${
                          evt.type === 'VIOLATION'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : evt.type === 'SUBMISSION'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-slate-850 text-slate-400'
                        }`}
                      >
                        {evt.type}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {evt.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-slate-350 leading-relaxed">{evt.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </AdminLayout>
  );
}
