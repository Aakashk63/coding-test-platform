import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { API_URL } from '../config';
import { FileCode, Calendar, Copy, Check, Eye, Trash2, ArrowRight, Play, BarChart2 } from 'lucide-react';


export default function ManageTests() {
  const navigate = useNavigate();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    const fetchTests = async () => {
      try {
        const res = await fetch(`${API_URL}/tests/admin`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });
        const data = await res.json();
        if (res.ok) setTests(data);
      } catch (error) {
        console.error('Failed to load tests:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTests();
  }, []);

  const handleCopyLink = (testId) => {
    const examUrl = `${window.location.origin}/exam/${testId}`;
    navigator.clipboard.writeText(examUrl);
    setCopiedId(testId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <AdminLayout>
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 shimmer-bg rounded-xl border border-slate-800"></div>
          ))}
        </div>
      ) : tests.length === 0 ? (
        <div className="text-center py-20 bg-slate-900/10 border border-dashed border-slate-800 rounded-xl">
          <FileCode size={48} className="text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-350">No Assessments Created</h3>
          <p className="text-slate-500 text-sm mt-1 mb-6">Create a test schedule and start inviting candidates.</p>
          <button
            onClick={() => navigate('/admin/create-test')}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2.5 rounded-lg text-sm transition"
          >
            Create Your First Test
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {tests.map((test) => {
            const now = new Date();
            const start = new Date(test.startTime);
            const end = new Date(test.endTime);
            const isActive = now >= start && now <= end;
            const isCompleted = now > end;

            return (
              <div
                key={test._id}
                className="glass-panel p-6 rounded-xl border border-slate-800 hover:border-slate-700/80 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
              >
                {/* Info Column */}
                <div className="space-y-3 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-bold text-slate-200 truncate">{test.title}</h3>
                    
                    {/* Status Badge */}
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border ${
                        isActive
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : isCompleted
                          ? 'bg-slate-800 border-slate-750 text-slate-500'
                          : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                      }`}
                    >
                      {isActive ? 'Active Now' : isCompleted ? 'Concluded' : 'Scheduled'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-1">{test.description || 'No description provided.'}</p>

                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500 font-medium">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={14} />
                      <span>
                        {start.toLocaleString()} - {end.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      Questions: <span className="text-slate-300 font-semibold">{test.questions.length}</span>
                    </div>
                    <div>
                      Duration: <span className="text-slate-300 font-semibold">{test.duration} minutes</span>
                    </div>
                    <div>
                      Unique ID: <span className="text-blue-400 font-mono font-bold select-all">{test.testId}</span>
                    </div>
                  </div>
                </div>

                {/* Actions Row */}
                <div className="flex flex-wrap gap-3 items-center shrink-0 w-full md:w-auto border-t border-slate-850 pt-4 md:border-t-0 md:pt-0">
                  {/* Copy Link */}
                  <button
                    onClick={() => handleCopyLink(test.testId)}
                    className="p-2.5 bg-slate-900 border border-slate-800 hover:border-slate-750 text-slate-400 hover:text-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0"
                    title="Copy student exam invite link"
                  >
                    {copiedId === test.testId ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    <span>{copiedId === test.testId ? 'Copied!' : 'Copy Invite Link'}</span>
                  </button>

                  {/* Monitor Control */}
                  <button
                    onClick={() => navigate(`/admin/monitoring?testId=${test._id}`)}
                    className="p-2.5 bg-blue-600/15 border border-blue-500/25 hover:bg-blue-600/25 text-blue-400 hover:text-blue-300 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0"
                  >
                    <Play size={14} />
                    <span>Live Monitor</span>
                  </button>

                  {/* Reports Control */}
                  <button
                    onClick={() => navigate(`/admin/reports?testId=${test._id}`)}
                    className="p-2.5 bg-slate-900 border border-slate-800 hover:border-slate-750 text-slate-400 hover:text-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0"
                  >
                    <BarChart2 size={14} />
                    <span>Reports</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}
