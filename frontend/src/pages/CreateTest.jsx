import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { API_URL } from '../config';
import { Plus, Trash2, Code, FileText, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

export default function CreateTest() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(60);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [allowedLanguages, setAllowedLanguages] = useState(['python', 'java']);
  const [questions, setQuestions] = useState([]);
  
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Defaults starter templates for quick entry
  const defaultPythonStarter = `def solution(nums, target):\n    # Write your logic here\n    pass`;
  const defaultJavaStarter = `class Solution {\n    public int[] solution(int[] nums, int target) {\n        // Write your logic here\n        return new int[]{};\n    }\n}`;

  // Default driver templates for execution wrapper
  const defaultPythonDriver = `import sys\nimport json\n\n# STUDENT_CODE\n\nif __name__ == '__main__':\n    lines = sys.stdin.read().splitlines()\n    if len(lines) >= 2:\n        nums = json.loads(lines[0])\n        target = int(lines[1])\n        result = solution(nums, target)\n        print(json.dumps(result))`;
  const defaultJavaDriver = `import java.io.*;\nimport java.util.*;\n\n# STUDENT_CODE\n\npublic class Main {\n    public static void main(String[] args) throws Exception {\n        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));\n        String l1 = reader.readLine();\n        String l2 = reader.readLine();\n        if (l1 == null || l2 == null) return;\n        \n        l1 = l1.trim().replaceAll("[\\[\\]]", "");\n        String[] parts = l1.split(",");\n        int[] nums = new int[parts.length];\n        for(int i=0; i<parts.length; i++){\n            nums[i] = Integer.parseInt(parts[i].trim());\n        }\n        int target = Integer.parseInt(l2.trim());\n        Solution solver = new Solution();\n        int[] res = solver.solution(nums, target);\n        System.out.println(Arrays.toString(res).replace(" ", ""));\n    }\n}`;

  const addQuestion = () => {
    const newQ = {
      title: 'New Coding Question',
      description: 'Write problem statement here...',
      difficulty: 'Easy',
      inputExplanation: '',
      outputExplanation: '',
      constraints: '',
      starterTemplates: {
        python: defaultPythonStarter,
        java: defaultJavaStarter,
        python_driver: defaultPythonDriver,
        java_driver: defaultJavaDriver
      },
      testCases: [
        { input: '[2,7,11,15]\n9', expectedOutput: '[0,1]', hidden: false, weightage: 10 },
        { input: '[3,2,4]\n6', expectedOutput: '[1,2]', hidden: true, weightage: 10 }
      ]
    };
    setQuestions([...questions, newQ]);
    setActiveQuestionIdx(questions.length);
  };

  const removeQuestion = (idx) => {
    const updated = questions.filter((_, i) => i !== idx);
    setQuestions(updated);
    if (activeQuestionIdx === idx) {
      setActiveQuestionIdx(updated.length > 0 ? 0 : null);
    } else if (activeQuestionIdx > idx) {
      setActiveQuestionIdx(activeQuestionIdx - 1);
    }
  };

  const updateQuestionField = (field, val) => {
    const updated = [...questions];
    updated[activeQuestionIdx][field] = val;
    setQuestions(updated);
  };

  const updateStarterTemplate = (lang, val) => {
    const updated = [...questions];
    updated[activeQuestionIdx].starterTemplates[lang] = val;
    setQuestions(updated);
  };

  const addTestCase = () => {
    const updated = [...questions];
    updated[activeQuestionIdx].testCases.push({
      input: '',
      expectedOutput: '',
      hidden: false,
      weightage: 10
    });
    setQuestions(updated);
  };

  const removeTestCase = (tcIdx) => {
    const updated = [...questions];
    updated[activeQuestionIdx].testCases = updated[activeQuestionIdx].testCases.filter((_, i) => i !== tcIdx);
    setQuestions(updated);
  };

  const updateTestCaseField = (tcIdx, field, val) => {
    const updated = [...questions];
    updated[activeQuestionIdx].testCases[tcIdx][field] = val;
    setQuestions(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !startTime || !endTime) {
      setError('Please fill in all assessment settings.');
      return;
    }
    if (questions.length === 0) {
      setError('Please add at least one question to the exam.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/tests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          title,
          description,
          duration,
          startTime,
          endTime,
          allowedLanguages,
          questions,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create assessment.');
      }

      navigate('/admin/manage-tests');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT: Assessment Metadata Settings */}
          <div className="space-y-6 lg:col-span-1">
            <div className="glass-panel p-6 rounded-xl border border-slate-800 space-y-5">
              <h3 className="text-lg font-bold text-slate-200 border-b border-slate-850 pb-3 flex items-center gap-2">
                <FileText size={18} className="text-blue-400" />
                <span>Test Parameters</span>
              </h3>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Test Name</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-slate-200 outline-none text-sm"
                  placeholder="E.g., Algorithm Challenge Alpha"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-slate-200 outline-none text-sm h-24 resize-none"
                  placeholder="E.g., Internal developer placement test..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Duration (min)</label>
                  <input
                    type="number"
                    required
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-slate-200 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 font-mono text-slate-500">Strikes Limit</label>
                  <input
                    type="text"
                    disabled
                    value="3 (Strict)"
                    className="w-full bg-slate-900/50 border border-slate-850 text-slate-500 rounded-lg p-2.5 text-sm cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Start Time</label>
                <input
                  type="datetime-local"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-slate-200 outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">End Time</label>
                <input
                  type="datetime-local"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-slate-200 outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Runtimes Allowed</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={allowedLanguages.includes('python')}
                      onChange={(e) => {
                        if (e.target.checked) setAllowedLanguages([...allowedLanguages, 'python']);
                        else setAllowedLanguages(allowedLanguages.filter(l => l !== 'python'));
                      }}
                      className="rounded bg-slate-900 border-slate-800 text-blue-500 focus:ring-0"
                    />
                    <span>Python</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={allowedLanguages.includes('java')}
                      onChange={(e) => {
                        if (e.target.checked) setAllowedLanguages([...allowedLanguages, 'java']);
                        else setAllowedLanguages(allowedLanguages.filter(l => l !== 'java'));
                      }}
                      className="rounded bg-slate-900 border-slate-800 text-blue-500 focus:ring-0"
                    />
                    <span>Java</span>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-700 text-white font-bold rounded-lg py-3 transition shadow-lg text-sm flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={16} />
                <span>{loading ? 'Creating Assessment...' : 'Publish Assessment'}</span>
              </button>
            </div>
          </div>

          {/* RIGHT: Questions Builder Area */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Questions List Sidebar Header */}
            <div className="glass-panel p-6 rounded-xl border border-slate-800">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                  <Code size={18} className="text-blue-400" />
                  <span>Exam Questions ({questions.length})</span>
                </h3>
                <button
                  type="button"
                  onClick={addQuestion}
                  className="bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 px-3 py-1.5 rounded-lg border border-blue-500/25 text-xs font-bold transition flex items-center gap-1"
                >
                  <Plus size={14} />
                  <span>Add Question</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {questions.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveQuestionIdx(idx)}
                    className={`px-3 py-2 rounded-lg border text-xs font-semibold transition flex items-center gap-2 ${
                      activeQuestionIdx === idx
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span>Q{idx + 1}: {q.title.substring(0, 15)}</span>
                    <Trash2
                      size={12}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeQuestion(idx);
                      }}
                      className="text-slate-500 hover:text-rose-400 cursor-pointer"
                    />
                  </button>
                ))}
              </div>

              {activeQuestionIdx === null ? (
                <div className="text-center py-12 border border-dashed border-slate-800 rounded-lg text-slate-500 text-sm">
                  Click 'Add Question' above to insert a coding challenge.
                </div>
              ) : (
                <div className="space-y-6 border-t border-slate-850 pt-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Question Title</label>
                      <input
                        type="text"
                        required
                        value={questions[activeQuestionIdx].title}
                        onChange={(e) => updateQuestionField('title', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-slate-200 outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Difficulty</label>
                      <select
                        value={questions[activeQuestionIdx].difficulty}
                        onChange={(e) => updateQuestionField('difficulty', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-slate-200 outline-none text-sm"
                      >
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Problem Statement (HTML/Text)</label>
                    <textarea
                      required
                      value={questions[activeQuestionIdx].description}
                      onChange={(e) => updateQuestionField('description', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-slate-200 outline-none text-sm h-32 resize-y"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Input Spec</label>
                      <textarea
                        value={questions[activeQuestionIdx].inputExplanation}
                        onChange={(e) => updateQuestionField('inputExplanation', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-slate-200 outline-none text-xs h-20 resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Output Spec</label>
                      <textarea
                        value={questions[activeQuestionIdx].outputExplanation}
                        onChange={(e) => updateQuestionField('outputExplanation', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-slate-200 outline-none text-xs h-20 resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Constraints</label>
                      <textarea
                        value={questions[activeQuestionIdx].constraints}
                        onChange={(e) => updateQuestionField('constraints', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-slate-200 outline-none text-xs h-20 resize-none"
                      />
                    </div>
                  </div>

                  {/* Starter & Driver Codes */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-850 pb-2">Code Templates</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Python Starter code</label>
                        <textarea
                          value={questions[activeQuestionIdx].starterTemplates.python}
                          onChange={(e) => updateStarterTemplate('python', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 text-emerald-400 p-2.5 rounded-lg font-mono text-[11px] h-32 outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Java Starter code</label>
                        <textarea
                          value={questions[activeQuestionIdx].starterTemplates.java}
                          onChange={(e) => updateStarterTemplate('java', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 text-emerald-400 p-2.5 rounded-lg font-mono text-[11px] h-32 outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Test Cases */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Test Cases Engine</h4>
                      <button
                        type="button"
                        onClick={addTestCase}
                        className="text-xs text-blue-400 hover:underline font-bold"
                      >
                        + Add Test Case
                      </button>
                    </div>

                    <div className="space-y-3">
                      {questions[activeQuestionIdx].testCases.map((tc, tcIdx) => (
                        <div key={tcIdx} className="bg-slate-900/50 p-4 rounded-xl border border-slate-850 flex flex-col md:flex-row gap-4 items-start md:items-center">
                          <div className="flex-1 space-y-3 w-full">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] text-slate-500 font-bold mb-1">Stdin Input</label>
                                <textarea
                                  value={tc.input}
                                  onChange={(e) => updateTestCaseField(tcIdx, 'input', e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-850 text-slate-300 p-2 rounded text-xs font-mono h-12 outline-none resize-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-500 font-bold mb-1">Stdout Expected</label>
                                <textarea
                                  value={tc.expectedOutput}
                                  onChange={(e) => updateTestCaseField(tcIdx, 'expectedOutput', e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-850 text-slate-300 p-2 rounded text-xs font-mono h-12 outline-none resize-none"
                                />
                              </div>
                            </div>
                            <div className="flex justify-between items-center">
                              <label className="flex items-center gap-2 text-xs text-slate-400">
                                <input
                                  type="checkbox"
                                  checked={tc.hidden}
                                  onChange={(e) => updateTestCaseField(tcIdx, 'hidden', e.target.checked)}
                                  className="rounded bg-slate-900 border-slate-800 text-blue-500 focus:ring-0"
                                />
                                <span>Hidden Test Case</span>
                              </label>
                              
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-500 font-bold">Weightage:</span>
                                <input
                                  type="number"
                                  value={tc.weightage}
                                  onChange={(e) => updateTestCaseField(tcIdx, 'weightage', Number(e.target.value))}
                                  className="w-12 bg-slate-950 border border-slate-850 text-slate-300 px-1 py-0.5 rounded text-xs text-center outline-none"
                                />
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeTestCase(tcIdx)}
                            className="text-rose-400 hover:text-rose-300 p-2 bg-rose-500/5 hover:bg-rose-500/10 rounded-lg border border-transparent hover:border-rose-500/20 self-center transition shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
        </form>
      </div>
    </AdminLayout>
  );
}
