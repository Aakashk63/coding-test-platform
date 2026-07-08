import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Video, Mic, AlertCircle, Play, Terminal } from 'lucide-react';

export default function StudentJoin() {
  const { getAuthHeaders, apiUrl, logout } = useAuth();
  const navigate = useNavigate();

  const [testId, setTestId] = useState('');
  const [testDetails, setTestDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Permission checks
  const [cameraActive, setCameraActive] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!testId.trim()) return;

    setLoading(true);
    setError('');
    setTestDetails(null);

    try {
      const res = await fetch(`${apiUrl}/tests/verify`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ testId: testId.trim().toUpperCase() }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          logout();
          navigate('/login');
          return;
        }
        throw new Error(data.error || 'Failed to verify Test ID');
      }

      setTestDetails(data.test);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPermissions = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240 },
        audio: true,
      });

      setStream(mediaStream);
      setCameraActive(true);
      setMicActive(true);

      // Play video preview
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Camera/Mic permission refused:', err);
      setError('Permission denied. CodeGuard AI requires active camera and mic streams to start.');
      setCameraActive(false);
      setMicActive(false);
    }
  };

  const handleStartExam = () => {
    if (!cameraActive || !micActive) return;
    
    // Stop temporary preview tracks so exam hook can allocate them again
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    
    navigate(`/exam/${testDetails.testId}`);
  };

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background radial highlights */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-lg glass-panel rounded-2xl border border-slate-800 p-8 z-10 glow-blue">
        
        {/* Logo and title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-2.5 bg-blue-600/10 text-blue-400 rounded-xl border border-blue-500/20 mb-3">
            <ShieldCheck size={26} />
          </div>
          <h2 className="text-2xl font-black text-slate-100 tracking-tight">Candidate Verification Portal</h2>
          <p className="text-xs text-slate-400 mt-1">Enter your exam room code to authorize access</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-lg text-xs mb-6">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: Enter Test Code */}
        {!testDetails ? (
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Test ID Code</label>
              <input
                type="text"
                required
                value={testId}
                onChange={(e) => setTestId(e.target.value)}
                placeholder="E.G., TEST-A83KD9"
                className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-3 text-slate-200 outline-none text-center font-mono font-bold tracking-widest text-sm uppercase placeholder:font-sans placeholder:tracking-normal"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-700 text-white font-bold rounded-lg py-3 transition text-sm flex items-center justify-center gap-2 shadow-lg"
            >
              <span>{loading ? 'Verifying Code...' : 'Verify Test Code'}</span>
            </button>
          </form>
        ) : (
          /* STEP 2: Media Permission Gate */
          <div className="space-y-6 animate-fadeIn">
            {/* Test info display */}
            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-850 text-center">
              <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Test Connected</span>
              <h3 className="text-lg font-bold text-slate-200 mt-1">{testDetails.title}</h3>
              <p className="text-xs text-slate-500 mt-1">Duration Limit: {testDetails.duration} Minutes</p>
            </div>

            {/* Video preview / Status check */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              {/* Webcam viewport */}
              <div className="aspect-video bg-slate-950 border border-slate-850 rounded-lg overflow-hidden relative flex items-center justify-center group shadow-inner">
                {cameraActive ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                ) : (
                  <div className="text-center text-slate-600 space-y-1">
                    <Video size={24} className="mx-auto" />
                    <span className="text-[10px] block">Webcam Feed Inactive</span>
                  </div>
                )}
              </div>

              {/* Status details */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Security Requirements</h4>
                
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${cameraActive ? 'bg-emerald-400' : 'bg-rose-400'}`}></div>
                    <span className="text-slate-350">Webcam stream authorized</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${micActive ? 'bg-emerald-400' : 'bg-rose-400'}`}></div>
                    <span className="text-slate-350">Microphone stream authorized</span>
                  </div>
                </div>

                {!cameraActive && (
                  <button
                    onClick={handleRequestPermissions}
                    className="w-full bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 px-3 py-2 rounded-lg border border-blue-500/25 font-semibold text-xs transition"
                  >
                    Authorize Camera & Mic
                  </button>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-4 border-t border-slate-850 pt-6">
              <button
                onClick={() => setTestDetails(null)}
                className="flex-1 bg-slate-900 border border-slate-800 hover:border-slate-750 text-slate-400 hover:text-slate-200 py-2.5 rounded-lg text-xs font-bold transition"
              >
                Back
              </button>
              
              <button
                onClick={handleStartExam}
                disabled={!cameraActive || !micActive}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg"
              >
                <Play size={12} />
                <span>Begin Assessment</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
