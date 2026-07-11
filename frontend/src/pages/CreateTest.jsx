import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { API_URL } from '../config';
import { Plus, Trash2, Code, FileText, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

export default function CreateTest() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const editId = queryParams.get('edit');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(60);
  const [maxStrikes, setMaxStrikes] = useState(3);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [allowedLanguages, setAllowedLanguages] = useState(['python', 'java']);
  const [questions, setQuestions] = useState([]);
  
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch test details if in edit mode
  React.useEffect(() => {
    if (!editId) return;

    const fetchTestToEdit = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/tests/admin/${editId}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load test details.');
        }

        setTitle(data.title);
        setDescription(data.description || '');
        setDuration(data.duration);
        setMaxStrikes(data.maxStrikes || 3);
        
        // Format ISO dates back to YYYY-MM-DDTHH:MM for local picker
        if (data.startTime) {
          const localStart = new Date(data.startTime);
          const offsetMs = localStart.getTimezoneOffset() * 60 * 1000;
          const adjustedStart = new Date(localStart.getTime() - offsetMs);
          setStartTime(adjustedStart.toISOString().slice(0, 16));
        }
        if (data.endTime) {
          const localEnd = new Date(data.endTime);
          const offsetMs = localEnd.getTimezoneOffset() * 60 * 1000;
          const adjustedEnd = new Date(localEnd.getTime() - offsetMs);
          setEndTime(adjustedEnd.toISOString().slice(0, 16));
        }

        setAllowedLanguages(data.allowedLanguages || ['python', 'java']);
        setQuestions(data.questions || []);
        if (data.questions && data.questions.length > 0) {
          setActiveQuestionIdx(0);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTestToEdit();
  }, [editId]);

  // Defaults starter templates for quick entry
  const defaultPythonStarter = `def solution(nums, target):\n    # Write your logic here\n    pass`;
  const defaultJavaStarter = `class Solution {\n    public int[] solution(int[] nums, int target) {\n        // Write your logic here\n        return new int[]{};\n    }\n}`;

  // Default driver templates for execution wrapper
  const defaultPythonDriver = `import sys\nimport json\nimport inspect\n\n# STUDENT_CODE\n\ndef parse_val(s):\n    s = s.strip()\n    if (s.startswith('"') and s.endswith('"')) or (s.startswith("'") and s.endswith("'")):\n        return s[1:-1]\n    try:\n        return json.loads(s)\n    except Exception:\n        try:\n            if '.' in s:\n                return float(s)\n            return int(s)\n        except Exception:\n            return s\n\nif __name__ == '__main__':\n    lines = sys.stdin.read().splitlines()\n    if 'Solution' in globals():\n        sol = Solution()\n        methods = [m for m in dir(sol) if not m.startswith('_') and callable(getattr(sol, m))]\n        if methods:\n            method_name = methods[0]\n            method = getattr(sol, method_name)\n            sig = inspect.signature(method)\n            num_args = len(sig.parameters)\n            args = [parse_val(line) for line in lines[:num_args]]\n            result = method(*args)\n            print(json.dumps(result))\n        else:\n            print("No methods found in Solution class")\n    else:\n        import types\n        funcs = [name for name, val in globals().items() if isinstance(val, types.FunctionType) and val.__module__ == '__main__' and name != 'parse_val']\n        if funcs:\n            method = globals()[funcs[0]]\n            sig = inspect.signature(method)\n            num_args = len(sig.parameters)\n            args = [parse_val(line) for line in lines[:num_args]]\n            result = method(*args)\n            print(json.dumps(result))`;
  const defaultJavaDriver = `import java.io.*;\nimport java.util.*;\n\n# STUDENT_CODE\n\npublic class Main {\n    public static void main(String[] args) throws Exception {\n        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));\n        List<String> lines = new ArrayList<>();\n        String line;\n        while ((line = reader.readLine()) != null) {\n            lines.add(line.trim());\n        }\n        \n        Solution solver = new Solution();\n        java.lang.reflect.Method targetMethod = null;\n        for (java.lang.reflect.Method m : Solution.class.getDeclaredMethods()) {\n            if (java.lang.reflect.Modifier.isPublic(m.getModifiers()) && !m.getName().equals("main")) {\n                targetMethod = m;\n                break;\n            }\n        }\n        \n        if (targetMethod == null) {\n            throw new RuntimeException("No public method found in Solution class.");\n        }\n        \n        Class<?>[] paramTypes = targetMethod.getParameterTypes();\n        Object[] methodArgs = new Object[paramTypes.length];\n        for (int i = 0; i < paramTypes.length; i++) {\n            if (i < lines.size()) {\n                methodArgs[i] = parseJavaValue(lines.get(i), paramTypes[i]);\n            } else {\n                methodArgs[i] = null;\n            }\n        }\n        \n        Object res = targetMethod.invoke(solver, methodArgs);\n        if (res != null) {\n            if (res.getClass().isArray()) {\n                int len = java.lang.reflect.Array.getLength(res);\n                List<String> elements = new ArrayList<>();\n                for (int j = 0; j < len; j++) {\n                    elements.add(String.valueOf(java.lang.reflect.Array.get(res, j)));\n                }\n                System.out.println("[" + String.join(",", elements) + "]");\n            } else {\n                System.out.println(res);\n            }\n        }\n    }\n    \n    private static Object parseJavaValue(String raw, Class<?> type) {\n        raw = raw.trim();\n        if (type.equals(String.class)) {\n            if (raw.startsWith("\\\"") && raw.endsWith("\\\"")) {\n                return raw.substring(1, raw.length() - 1);\n            }\n            if (raw.startsWith("'") && raw.endsWith("'")) {\n                return raw.substring(1, raw.length() - 1);\n            }\n            return raw;\n        }\n        if (type.equals(int.class) || type.equals(Integer.class)) {\n            return Integer.parseInt(raw);\n        }\n        if (type.equals(double.class) || type.equals(Double.class)) {\n            return Double.parseDouble(raw);\n        }\n        if (type.equals(boolean.class) || type.equals(Boolean.class)) {\n            return Boolean.parseBoolean(raw);\n        }\n        if (type.isArray()) {\n            Class<?> componentType = type.getComponentType();\n            String clean = raw.replaceAll("[\\\\\\\\[\\\\\\\\]]", "").trim();\n            if (clean.isEmpty()) {\n                return java.lang.reflect.Array.newInstance(componentType, 0);\n            }\n            String[] parts = clean.split(",");\n            Object arr = java.lang.reflect.Array.newInstance(componentType, parts.length);\n            for (int j = 0; j < parts.length; j++) {\n                Object val = parseJavaValue(parts[j].trim(), componentType);\n                java.lang.reflect.Array.set(arr, j, val);\n            }\n            return arr;\n        }\n        return raw;\n    }\n}`;

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
      const url = editId ? `${API_URL}/tests/admin/${editId}` : `${API_URL}/tests`;
      const method = editId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          title,
          description,
          duration,
          maxStrikes,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
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
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Strikes Limit</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    required
                    value={maxStrikes}
                    onChange={(e) => setMaxStrikes(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-slate-200 outline-none text-sm"
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
                <span>{loading ? 'Saving Changes...' : (editId ? 'Save Changes' : 'Publish Assessment')}</span>
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
