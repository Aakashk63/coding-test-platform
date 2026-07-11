import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { API_URL } from '../config';
import { 
  FileSpreadsheet, 
  FileText, 
  Award, 
  Download, 
  ExternalLink,
  Users,
  Search,
  Trash2
} from 'lucide-react';

export default function ReportsPage() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialTestId = queryParams.get('testId') || '';

  const [tests, setTests] = useState([]);
  const [selectedTestId, setSelectedTestId] = useState(initialTestId);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedSub, setSelectedSub] = useState(null);
  const [selectedSubLog, setSelectedSubLog] = useState(null);
  const [proctorLogs, setProctorLogs] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [releasing, setReleasing] = useState(false);

  // Fetch tests dropdown
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
        console.error('Failed to load tests list:', error);
      }
    };
    fetchTests();
  }, []);

  // Fetch submissions list when selected test changes
  useEffect(() => {
    if (!selectedTestId) return;

    const fetchSubmissions = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/submissions/admin/test/${selectedTestId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        const data = await res.json();
        if (res.ok) setSubmissions(data);
      } catch (error) {
        console.error('Failed to load submissions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubmissions();
  }, [selectedTestId]);

  // Fetch proctor logs when selected submission changes
  useEffect(() => {
    if (!selectedSub) {
      setProctorLogs([]);
      return;
    }

    const fetchLogs = async () => {
      setModalLoading(true);
      setModalError('');
      try {
        const res = await fetch(`${API_URL}/proctor/admin/test/${selectedTestId}/student/${selectedSub.student._id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        const data = await res.json();
        if (res.ok) {
          setProctorLogs(data.events || []);
          // Save the full log object to check isSuspended state
          setSelectedSubLog(data);
        } else {
          throw new Error(data.error || 'Failed to load proctor logs');
        }
      } catch (err) {
        setModalError(err.message);
      } finally {
        setModalLoading(false);
      }
    };

    fetchLogs();
  }, [selectedSub, selectedTestId]);

  const handleReleaseSuspension = async () => {
    if (!selectedSub || !selectedTestId) return;
    setReleasing(true);
    try {
      const res = await fetch(`${API_URL}/proctor/admin/test/${selectedTestId}/student/${selectedSub.student._id}/resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        alert('Assessment suspension has been successfully released.');
        setSelectedSubLog(prev => prev ? { ...prev, isSuspended: false } : null);
      } else {
        throw new Error(data.error || 'Failed to release suspension.');
      }
    } catch (error) {
      console.error(error);
      alert(error.message || 'Error releasing suspension');
    } finally {
      setReleasing(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedSub(null);
    setSelectedSubLog(null);
  };

  const handleDownloadCSV = () => {
    if (!selectedTestId) return;
    const token = localStorage.getItem('token');
    // Open in window or fetch as file download
    window.open(`${API_URL}/reports/test/${selectedTestId}/csv?token=${token}`, '_blank');
  };

  const handleOpenPrintHTML = () => {
    if (!selectedTestId) return;
    window.open(`${API_URL}/reports/test/${selectedTestId}/html`, '_blank');
  };

  const handleAllowRetest = async (submissionId, studentName) => {
    const confirmed = window.confirm(
      `Are you sure you want to allow a retest for ${studentName}? This will permanently delete their current exam submission, code entries, and proctoring violation logs.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`${API_URL}/submissions/admin/${submissionId}/retest`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to grant retest access.');
      }

      setSubmissions(prev => prev.filter(sub => sub._id !== submissionId));
      alert('Retest access granted. Previous student attempt records have been cleared.');
    } catch (error) {
      console.error('Allow retest error:', error);
      alert(error.message || 'Error connecting to the server to reset attempt.');
    }
  };

  const filteredSubmissions = submissions.filter(
    (sub) =>
      sub.student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.student.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        
        {/* Test selector topbar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/40 p-5 rounded-xl border border-slate-850">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/10 text-blue-400 rounded-lg border border-blue-500/20">
              <Award size={20} />
            </div>
            <div>
              <h2 className="font-bold text-slate-200 text-base">Assessment Scorecards</h2>
              <p className="text-xs text-slate-500 mt-0.5">Filter candidate grades and download summaries</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <select
              value={selectedTestId}
              onChange={(e) => setSelectedTestId(e.target.value)}
              className="bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-slate-200 outline-none text-sm cursor-pointer w-full sm:w-64"
            >
              <option value="" disabled>Select test report...</option>
              {tests.map((test) => (
                <option key={test._id} value={test._id}>{test.title}</option>
              ))}
            </select>

            <div className="flex gap-2">
              <button
                onClick={handleDownloadCSV}
                disabled={!selectedTestId || submissions.length === 0}
                className="bg-slate-900 border border-slate-800 hover:border-slate-750 disabled:opacity-50 text-slate-300 hover:text-white px-4 py-2.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 justify-center"
                title="Download CSV file"
              >
                <Download size={14} />
                <span>CSV</span>
              </button>

              <button
                onClick={handleOpenPrintHTML}
                disabled={!selectedTestId || submissions.length === 0}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 justify-center"
                title="Print assessment overview"
              >
                <ExternalLink size={14} />
                <span>HTML / PDF Report</span>
              </button>
            </div>
          </div>
        </div>

        {/* Submissions table */}
        <div className="glass-panel p-6 rounded-xl border border-slate-800">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Users size={16} className="text-blue-400" />
              <span>Candidates Graded ({filteredSubmissions.length})</span>
            </h3>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 pointer-events-none">
                <Search size={14} />
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search candidate name..."
                className="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-lg py-2 pl-9 pr-4 text-slate-350 outline-none text-xs"
              />
            </div>
          </div>

          {loading ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 shimmer-bg rounded border border-slate-800"></div>
              ))}
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="text-center py-20 text-slate-500 text-sm">
              No submissions found matching filter criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 bg-slate-900/10 text-slate-450 text-[10px] font-bold uppercase tracking-wider">
                    <th className="pb-3 px-4">Candidate</th>
                    <th className="pb-3 px-4">Language</th>
                    <th className="pb-3 px-4">Score</th>
                    <th className="pb-3 px-4">Passed cases</th>
                    <th className="pb-3 px-4">Submission Type</th>
                    <th className="pb-3 px-4">Date</th>
                    <th className="pb-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60 text-xs">
                  {filteredSubmissions.map((sub) => (
                    <tr key={sub._id} className="hover:bg-slate-900/10 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-200">{sub.student.name}</div>
                        <div className="text-[10px] text-slate-500">{sub.student.email}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[10px] uppercase text-blue-400">{sub.language}</td>
                      <td className="py-3.5 px-4 text-emerald-400 font-extrabold text-sm">{sub.score} PTS</td>
                      <td className="py-3.5 px-4 text-slate-300">
                        {sub.passedCases} / {sub.passedCases + sub.failedCases}
                      </td>
                      <td className={`py-3.5 px-4 font-medium ${
                        sub.submittedType === 'NORMAL' ? 'text-slate-450' : 'text-amber-400'
                      }`}>
                        {sub.submittedType}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {new Date(sub.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setSelectedSub(sub)}
                            className="bg-blue-600/10 border border-blue-500/25 hover:bg-blue-600/25 text-blue-400 hover:text-blue-300 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                            title="Review submission details and proctor logs"
                          >
                            <FileText size={12} />
                            <span>Review Logs</span>
                          </button>

                          <button
                            onClick={() => handleAllowRetest(sub._id, sub.student.name)}
                            className="bg-rose-600/10 border border-rose-500/25 hover:bg-rose-600/25 text-rose-450 hover:text-rose-350 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                            title="Allow retest"
                          >
                            <Trash2 size={12} />
                            <span>Allow Retest</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Candidate Detail & Proctoring Inspector Modal */}
      {selectedSub && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex justify-center items-center z-50 p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex justify-between items-start bg-slate-950/30">
              <div>
                <h3 className="text-base font-extrabold text-slate-100">{selectedSub.student.name} Details</h3>
                <p className="text-xs text-slate-500 mt-1">{selectedSub.student.email} • Score: <span className="text-emerald-400 font-bold">{selectedSub.score} PTS</span></p>
              </div>
              <button 
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-200 text-sm font-semibold p-1 hover:bg-slate-850 rounded transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* SECTION 1: Submissions & Answers */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Candidate Code Submissions</h4>
                <div className="space-y-4">
                  {(() => {
                    const testObj = tests.find(t => t._id === selectedTestId);
                    if (!testObj) return <div className="text-xs text-slate-500">No test data.</div>;
                    
                    return testObj.questions.map((q) => {
                      const qIdStr = q._id.toString();
                      const codeMap = selectedSub.code || {};
                      const rawCode = codeMap.get ? codeMap.get(qIdStr) : codeMap[qIdStr];

                      return (
                        <div key={q._id} className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl space-y-2">
                          <span className="text-[10px] font-black text-blue-400 uppercase">{q.title}</span>
                          <pre className="bg-slate-950 border border-slate-900 p-3 rounded font-mono text-[11px] text-emerald-400 overflow-x-auto whitespace-pre-wrap max-h-48 leading-relaxed">
                            {rawCode || 'No solution submitted.'}
                          </pre>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* SECTION 2: AI Proctoring Log with snapshot proof */}
              <div className="border-t border-slate-850 pt-5 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Webcam Security Violations Log</h4>
                  {selectedSubLog && selectedSubLog.isSuspended && (
                    <button
                      onClick={handleReleaseSuspension}
                      disabled={releasing}
                      className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-lg transition shadow-md cursor-pointer"
                    >
                      {releasing ? 'Releasing...' : 'Release Suspension'}
                    </button>
                  )}
                </div>
                
                {modalLoading ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500 italic py-4">
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500"></div>
                    <span>Loading proctoring violation logs & snapshots...</span>
                  </div>
                ) : modalError ? (
                  <div className="text-xs text-rose-450 py-2">{modalError}</div>
                ) : proctorLogs.length === 0 ? (
                  <div className="text-xs text-slate-500 italic py-4 bg-slate-950/20 border border-slate-850/50 rounded-xl text-center">
                    No proctoring violation strikes recorded for this candidate.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {proctorLogs.map((evt, idx) => (
                      <div key={idx} className="bg-slate-950/40 border border-slate-850 p-3.5 rounded-xl flex flex-col justify-between space-y-3">
                        <div className="flex justify-between items-start">
                          <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider">
                            {evt.eventType}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(evt.timestamp).toLocaleTimeString()}
                          </span>
                        </div>

                        {evt.proof && evt.proof.startsWith('data:image/') ? (
                          <div className="aspect-video w-full rounded-lg overflow-hidden border border-slate-850 bg-slate-950 relative group">
                            <img 
                              src={evt.proof} 
                              alt={`${evt.eventType} Proof`} 
                              className="w-full h-full object-cover" 
                            />
                            <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center pointer-events-none">
                              <span className="text-[9px] text-white bg-slate-900 border border-slate-800 px-2 py-1 rounded shadow-md uppercase tracking-wider font-bold">Webcam Snapshot</span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic bg-slate-950/60 p-2.5 rounded border border-slate-900 leading-normal">
                            {evt.proof || 'No description provided.'}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950/60 border-t border-slate-850 flex justify-end">
              <button 
                onClick={handleCloseModal}
                className="bg-slate-900 hover:bg-slate-800 text-slate-350 hover:text-slate-200 px-5 py-2 rounded-lg font-bold text-xs transition cursor-pointer border border-slate-800"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
