import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { 
  FileCode, 
  Activity, 
  Users, 
  AlertTriangle, 
  Plus, 
  Calendar, 
  ArrowRight,
  TrendingUp
} from 'lucide-react';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalTests: 0,
    activeTests: 0,
    totalSubmissions: 0,
    suspiciousAttempts: 0,
  });
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        // Fetch stats
        const statsRes = await fetch('http://localhost:5000/api/tests/admin/dashboard', { headers });
        const statsData = await statsRes.json();

        // Fetch tests list
        const testsRes = await fetch('http://localhost:5000/api/tests/admin', { headers });
        const testsData = await testsRes.json();

        if (statsRes.ok) setStats(statsData);
        if (testsRes.ok) setTests(testsData);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const cardItems = [
    {
      title: 'Total Assessments',
      value: stats.totalTests,
      icon: <FileCode className="text-blue-400" size={24} />,
      description: 'Tests generated in workspace',
      glow: 'glow-blue',
    },
    {
      title: 'Active Exams',
      value: stats.activeTests,
      icon: <Activity className="text-emerald-400" size={24} />,
      description: 'Assessments currently running',
      glow: 'glow-blue',
    },
    {
      title: 'Total Submissions',
      value: stats.totalSubmissions,
      icon: <Users className="text-violet-400" size={24} />,
      description: 'Answer packets submitted',
      glow: 'glow-blue',
    },
    {
      title: 'Suspicious Activities',
      value: stats.suspiciousAttempts,
      icon: <AlertTriangle className="text-rose-400" size={24} />,
      description: 'Attempts containing violations',
      glow: 'glow-rose',
    },
  ];

  return (
    <AdminLayout>
      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 shimmer-bg rounded-xl border border-slate-800"></div>
            ))}
          </div>
          <div className="h-96 shimmer-bg rounded-xl border border-slate-800"></div>
        </div>
      ) : (
        <div className="space-y-8 animate-fadeIn">
          {/* Header Action Row */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/40 p-6 rounded-xl border border-slate-850">
            <div>
              <h2 className="text-2xl font-black text-slate-100 flex items-center gap-2">
                Welcome back, Admin <TrendingUp size={20} className="text-blue-400" />
              </h2>
              <p className="text-slate-400 text-sm mt-1">Here is an overview of active exam schedules and proctor metrics.</p>
            </div>
            <Link
              to="/admin/create-test"
              className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg font-bold text-sm transition flex items-center gap-2 shadow-lg hover:shadow-blue-500/10"
            >
              <Plus size={16} />
              <span>Create Test</span>
            </Link>
          </div>

          {/* Aggregate Stat Widgets */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {cardItems.map((card, idx) => (
              <div
                key={idx}
                className={`glass-panel p-6 rounded-xl border border-slate-800 hover:border-slate-700/80 transition-all duration-300 relative overflow-hidden group`}
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{card.title}</span>
                  <div className="p-2 bg-slate-900/60 rounded-lg border border-slate-800">{card.icon}</div>
                </div>
                <div className="text-3xl font-black text-slate-100 mb-1">{card.value}</div>
                <p className="text-xs text-slate-500">{card.description}</p>
                
                {/* Micro hover animation strip */}
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 to-indigo-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
              </div>
            ))}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Recent Assessments List */}
            <div className="lg:col-span-2 glass-panel p-6 rounded-xl border border-slate-800 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                  <FileCode size={20} className="text-blue-400" />
                  <span>Recent Tests</span>
                </h3>
                {tests.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-slate-800 rounded-lg bg-slate-900/10">
                    <p className="text-slate-500 text-sm">No tests found in database.</p>
                    <Link to="/admin/create-test" className="text-blue-400 text-xs font-semibold hover:underline mt-2 inline-block">
                      Create your first test now &rarr;
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800">
                    {tests.slice(0, 5).map((test) => (
                      <div key={test._id} className="py-4 flex justify-between items-center group">
                        <div>
                          <h4 className="font-bold text-slate-200 group-hover:text-blue-400 transition-colors text-sm">
                            {test.title}
                          </h4>
                          <div className="flex gap-4 text-xs text-slate-500 mt-1">
                            <span className="font-mono text-blue-300">{test.testId}</span>
                            <span>{test.questions.length} Questions</span>
                            <span>{test.duration} min</span>
                          </div>
                        </div>
                        <button
                          onClick={() => navigate(`/admin/manage-tests`)}
                          className="p-2 bg-slate-900/60 rounded-lg border border-slate-800 hover:border-blue-500/20 text-slate-400 hover:text-blue-400 transition"
                        >
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {tests.length > 5 && (
                <Link to="/admin/manage-tests" className="text-blue-400 hover:underline text-xs font-semibold mt-4 block text-center">
                  View all assessments &rarr;
                </Link>
              )}
            </div>

            {/* Quick Helper Panel */}
            <div className="glass-panel p-6 rounded-xl border border-slate-800 space-y-6">
              <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                <Calendar size={20} className="text-blue-400" />
                <span>Admin Quick Guide</span>
              </h3>
              
              <div className="space-y-4 text-sm text-slate-400">
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400 text-xs shrink-0 mt-0.5">1</div>
                  <p>Create a test with specific Python/Java questions and test cases.</p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400 text-xs shrink-0 mt-0.5">2</div>
                  <p>Distribute the auto-generated unique Test ID to your student group.</p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400 text-xs shrink-0 mt-0.5">3</div>
                  <p>Watch active candidate streams and webcam strikes on the Live Monitor.</p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400 text-xs shrink-0 mt-0.5">4</div>
                  <p>Download comprehensive PDF and CSV performance scorecards.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
