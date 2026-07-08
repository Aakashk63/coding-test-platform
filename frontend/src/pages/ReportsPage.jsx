import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { 
  FileSpreadsheet, 
  FileText, 
  Award, 
  Download, 
  ExternalLink,
  Users,
  Search
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

  // Fetch tests dropdown
  useEffect(() => {
    const fetchTests = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/tests/admin', {
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
        const res = await fetch(`http://localhost:5000/api/submissions/admin/test/${selectedTestId}`, {
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

  const handleDownloadCSV = () => {
    if (!selectedTestId) return;
    const token = localStorage.getItem('token');
    // Open in window or fetch as file download
    window.open(`http://localhost:5000/api/reports/test/${selectedTestId}/csv?token=${token}`, '_blank');
  };

  const handleOpenPrintHTML = () => {
    if (!selectedTestId) return;
    window.open(`http://localhost:5000/api/reports/test/${selectedTestId}/html`, '_blank');
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </AdminLayout>
  );
}
