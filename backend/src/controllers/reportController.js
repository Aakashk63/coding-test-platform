import Submission from '../models/Submission.js';
import Test from '../models/Test.js';
import ProctoringLog from '../models/ProctoringLog.js';

/**
 * Helper: Escapes values for CSV output
 */
const escapeCSV = (val) => {
  if (val === undefined || val === null) return '""';
  let str = String(val);
  str = str.replace(/"/g, '""');
  return `"${str}"`;
};

/**
 * Generate CSV Report for a test
 */
export const downloadCSVReport = async (req, res) => {
  try {
    const { testId } = req.params;

    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    const submissions = await Submission.find({ test: testId })
      .populate('student', 'name email')
      .lean();

    const proctorLogs = await ProctoringLog.find({ test: testId }).lean();

    // Map logs for quick lookups
    const logMap = new Map();
    proctorLogs.forEach((log) => {
      logMap.set(log.student.toString(), log.events || []);
    });

    // CSV Headers
    const headers = [
      'Student Name',
      'Email',
      'Test Name',
      'Language Used',
      'Final Score',
      'Passed Cases',
      'Failed Cases',
      'Submission Type',
      'Total Violations',
      'Submission Time',
    ];

    let csvContent = headers.join(',') + '\n';

    submissions.forEach((sub) => {
      const studentId = sub.student._id.toString();
      const events = logMap.get(studentId) || [];
      const violationsCount = events.filter((e) => e.eventType !== 'AUTO_SUBMITTED').length;

      const row = [
        escapeCSV(sub.student.name),
        escapeCSV(sub.student.email),
        escapeCSV(test.title),
        escapeCSV(sub.language),
        sub.score,
        sub.passedCases,
        sub.failedCases,
        escapeCSV(sub.submittedType),
        violationsCount,
        escapeCSV(new Date(sub.createdAt).toLocaleString()),
      ];
      csvContent += row.join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=codeguard_report_${test.testId}.csv`);
    return res.status(200).send(csvContent);
  } catch (error) {
    console.error('Download CSV report error:', error);
    res.status(500).json({ error: 'Server error generating CSV report' });
  }
};

/**
 * Generate Print-Ready HTML Report (exportable to PDF via browser)
 */
export const getHTMLReport = async (req, res) => {
  try {
    const { testId } = req.params;

    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).send('<h1>Test Not Found</h1>');
    }

    const submissions = await Submission.find({ test: testId })
      .populate('student', 'name email')
      .lean();

    const proctorLogs = await ProctoringLog.find({ test: testId }).lean();
    const logMap = new Map();
    proctorLogs.forEach((log) => {
      logMap.set(log.student.toString(), log.events || []);
    });

    const rows = submissions.map((sub) => {
      const studentId = sub.student._id.toString();
      const events = logMap.get(studentId) || [];
      const violationsCount = events.filter((e) => e.eventType !== 'AUTO_SUBMITTED').length;

      // Extract question answers mapping
      const solutions = [];
      test.questions.forEach((q) => {
        const qIdStr = q._id.toString();
        const codeMap = sub.code || new Map();
        const rawCode = codeMap.get ? codeMap.get(qIdStr) : codeMap[qIdStr];
        solutions.push({
          title: q.title,
          code: rawCode || 'No solution submitted',
        });
      });

      const rawEvents = events || [];

      return {
        name: sub.student.name,
        email: sub.student.email,
        language: sub.language,
        score: sub.score,
        passedCases: sub.passedCases,
        failedCases: sub.failedCases,
        submittedType: sub.submittedType,
        violations: violationsCount,
        violationsList: rawEvents.map(e => ({
          eventType: e.eventType,
          proof: e.proof || '',
          timestamp: new Date(e.timestamp).toLocaleTimeString()
        })),
        time: new Date(sub.createdAt).toLocaleString(),
        solutions,
      };
    });

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeGuard AI Assessment Report - ${test.title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @media print {
      body { background-color: white; color: black; }
      .no-print { display: none; }
      .page-break { page-break-after: always; }
    }
  </style>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen p-8">
  <div class="max-w-6xl mx-auto bg-slate-800 rounded-xl p-8 border border-slate-700 shadow-2xl">
    
    <!-- Title Section -->
    <div class="flex justify-between items-center border-b border-slate-700 pb-6 mb-8">
      <div>
        <h1 class="text-3xl font-extrabold text-blue-400">CodeGuard AI</h1>
        <p class="text-slate-400 text-sm mt-1">Platform Performance Assessment Report</p>
      </div>
      <button onclick="window.print()" class="no-print bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg font-semibold transition shadow-lg">
        Print / Save to PDF
      </button>
    </div>

    <!-- Exam Info Card -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
      <div class="bg-slate-850 p-5 rounded-lg border border-slate-700">
        <span class="text-xs text-slate-400 font-semibold uppercase tracking-wider">Test Details</span>
        <h3 class="text-xl font-bold text-slate-200 mt-1">${test.title}</h3>
        <p class="text-xs text-slate-500 mt-1">ID: ${test.testId}</p>
      </div>
      <div class="bg-slate-850 p-5 rounded-lg border border-slate-700">
        <span class="text-xs text-slate-400 font-semibold uppercase tracking-wider">Duration</span>
        <h3 class="text-xl font-bold text-slate-200 mt-1">${test.duration} Minutes</h3>
        <p class="text-xs text-slate-500 mt-1">Status: Concluded</p>
      </div>
      <div class="bg-slate-850 p-5 rounded-lg border border-slate-700">
        <span class="text-xs text-slate-400 font-semibold uppercase tracking-wider">Submissions</span>
        <h3 class="text-xl font-bold text-slate-200 mt-1">${rows.length} Candidates</h3>
        <p class="text-xs text-slate-500 mt-1">Total Questions: ${test.questions.length}</p>
      </div>
    </div>

    <!-- Summary Table -->
    <h2 class="text-xl font-bold text-slate-200 mb-4">Candidate Performance Overview</h2>
    <div class="overflow-x-auto mb-12">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="border-b border-slate-700 bg-slate-750 text-slate-300 font-semibold text-sm">
            <th class="py-3 px-4">Candidate</th>
            <th class="py-3 px-4">Language</th>
            <th class="py-3 px-4">Score</th>
            <th class="py-3 px-4">Passed Cases</th>
            <th class="py-3 px-4">Violations</th>
            <th class="py-3 px-4">Submission Reason</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-700/50 text-sm">
          ${rows.map(r => `
            <tr class="hover:bg-slate-750/30">
              <td class="py-4 px-4">
                <div class="font-bold text-slate-200">${r.name}</div>
                <div class="text-xs text-slate-400">${r.email}</div>
              </td>
              <td class="py-4 px-4 font-mono text-xs uppercase text-blue-300">${r.language}</td>
              <td class="py-4 px-4 font-semibold text-emerald-400 text-lg">${r.score}</td>
              <td class="py-4 px-4 text-slate-300">${r.passedCases} / ${r.passedCases + r.failedCases}</td>
              <td class="py-4 px-4">
                <span class="px-2 py-0.5 rounded text-xs font-semibold ${r.violations > 0 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-slate-700 text-slate-400'}">
                  ${r.violations} Strikes
                </span>
              </td>
              <td class="py-4 px-4 text-xs font-medium ${r.submittedType === 'NORMAL' ? 'text-slate-400' : 'text-amber-400'}">
                ${r.submittedType}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Candidate Detailed Code Submissions (Print Breaks) -->
    <h2 class="text-xl font-bold text-slate-200 mb-6 border-t border-slate-700 pt-8 no-print">Detailed Candidate Code Submissions</h2>
    
    ${rows.map((r, index) => `
      <div class="page-break border border-slate-700 rounded-lg p-6 bg-slate-850 mb-8">
        <div class="flex justify-between items-start border-b border-slate-750 pb-4 mb-4">
          <div>
            <h3 class="text-lg font-bold text-blue-300">${r.name} (${r.email})</h3>
            <p class="text-xs text-slate-400 mt-1">Submitted at ${r.time} • Language: <span class="uppercase">${r.language}</span></p>
          </div>
          <div class="text-right">
            <span class="text-2xl font-black text-emerald-400">${r.score} PTS</span>
            <div class="text-xs text-slate-400 mt-1">Violations: ${r.violations} strikes</div>
          </div>
        </div>

        <div class="space-y-6 mb-6">
          ${r.solutions.map(sol => `
            <div>
              <h4 class="text-sm font-semibold text-slate-300 mb-2">Question: ${sol.title}</h4>
              <pre class="bg-slate-900 border border-slate-800 text-emerald-300 p-4 rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap">${sol.code}</pre>
            </div>
          `).join('')}
        </div>

        ${r.violationsList && r.violationsList.length > 0 ? `
          <div class="border-t border-slate-700/60 pt-4">
            <h4 class="text-sm font-semibold text-slate-300 mb-3">Security Violation Log</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              ${r.violationsList.map(v => `
                <div class="bg-slate-900 border border-slate-800 p-3 rounded-lg text-xs space-y-2">
                  <div class="flex justify-between items-center">
                    <span class="px-1.5 py-0.5 rounded font-black text-[9px] bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      ${v.eventType}
                    </span>
                    <span class="text-[10px] text-slate-500 font-mono">${v.timestamp}</span>
                  </div>
                  ${v.proof && v.proof.startsWith('data:image/') ? `
                    <div class="relative w-full rounded border border-slate-800 overflow-hidden bg-slate-950 flex items-center justify-center p-1">
                      <img src="${v.proof}" alt="Proof" class="w-full h-auto max-h-32 object-contain" />
                    </div>
                  ` : `
                    <p class="text-slate-400 text-[10px] italic leading-tight">${v.proof || 'No description'}</p>
                  `}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `).join('')}

  </div>
</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
  } catch (error) {
    console.error('Get HTML report error:', error);
    res.status(500).send('<h1>Internal Server Error Generating Report</h1>');
  }
};
