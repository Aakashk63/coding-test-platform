import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import io from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { API_URL, SOCKET_URL } from '../config';
import { useProctor } from '../hooks/useProctor';
import { 
  Play, 
  Send, 
  Clock, 
  Video, 
  Terminal, 
  AlertTriangle, 
  CheckCircle,
  HelpCircle,
  FileCode
} from 'lucide-react';

export default function StudentExam() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const { getAuthHeaders, user, logout } = useAuth();

  // Test states
  const [test, setTest] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [activeQIdx, setActiveQIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Code state
  const [language, setLanguage] = useState('python');
  const [codeMap, setCodeMap] = useState({}); // questionId -> code

  // Execution states
  const [consoleTab, setConsoleTab] = useState('testcase'); // 'testcase', 'result'
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [execResults, setExecResults] = useState(null);
  const [consoleStdout, setConsoleStdout] = useState('');
  const [consoleStderr, setConsoleStderr] = useState('');
  const [activeCaseIdx, setActiveCaseIdx] = useState(0);
  
  // Timer state
  const [timeLeft, setTimeLeft] = useState(0); // seconds
  const timerRef = useRef(null);

  // Socket
  const [socket, setSocket] = useState(null);

  // Notification Modals
  const [notification, setNotification] = useState(null); // { type, message }
  const [autoSubmitted, setAutoSubmitted] = useState(false);

  const activeQuestion = questions[activeQIdx] || null;
  const currentCode = activeQuestion ? (codeMap[activeQuestion._id] || '') : '';

  // 1. Fetch exam configuration & load student progress
  useEffect(() => {
    const fetchExam = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        // Get test configuration
        const testRes = await fetch(`${API_URL}/tests/student/${testId}`, { headers });
        const testData = await testRes.json();

        if (!testRes.ok) {
          if (testRes.status === 401) {
            logout();
            navigate('/login');
            return;
          }
          throw new Error(testData.error || 'Failed to load exam paper');
        }

        setTest(testData);
        setQuestions(testData.questions);

        // Fetch previous saved submissions if any (recover session)
        const subRes = await fetch(`${API_URL}/submissions/student/test/${testData._id}`, { headers });
        const subData = await subRes.json();

        // Initialize code map
        const initialCodeMap = {};
        
        testData.questions.forEach((q) => {
          // If we had a prior saved code in the DB, load it. Else default starter template.
          const savedCode = subData && subData.code ? subData.code[q._id] : null;
          initialCodeMap[q._id] = savedCode || q.starterTemplates[language] || '';
        });

        setCodeMap(initialCodeMap);

        // Set allowed languages
        if (testData.allowedLanguages && testData.allowedLanguages.length > 0) {
          setLanguage(testData.allowedLanguages[0]);
        }

        // Initialize Timer
        // Timer should ideally check server startedAt. For now, set duration locally
        setTimeLeft(testData.duration * 60);

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchExam();
  }, [testId]);

  // Reset console states when question changes
  useEffect(() => {
    setExecResults(null);
    setConsoleStdout('');
    setConsoleStderr('');
    setConsoleTab('testcase');
    setActiveCaseIdx(0);
  }, [activeQIdx]);

  // 2. Setup Socket.IO for real-time results and proctoring
  useEffect(() => {
    if (!test || !user) return;

    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('📡 Student connected to exam socket room');
      newSocket.emit('join_test_room', {
        testId: test._id,
        role: 'STUDENT',
        userId: user.id,
      });
    });

    // Real-time listener: Run code results
    newSocket.on('run_result', ({ questionId, results }) => {
      setIsRunning(false);
      setExecResults(results);
      setConsoleTab('result');
      setActiveCaseIdx(0);
      
      const compileErr = results.find(r => r.status === 'Compilation Error');
      if (compileErr) {
        setConsoleStderr(compileErr.error);
        setConsoleStdout('');
      } else {
        const errors = results.map(r => r.error).filter(Boolean).join('\n');
        setConsoleStderr(errors);
        setConsoleStdout('');
      }
    });

    // Real-time listener: Submit question results
    newSocket.on('submit_question_result', ({ questionId, score, passedCases, failedCases, results }) => {
      setIsSubmitting(false);
      setExecResults(results);
      setConsoleTab('result');
      setActiveCaseIdx(0);
      
      const compileErr = results.find(r => r.status === 'Compilation Error');
      if (compileErr) {
        setConsoleStderr(compileErr.error);
        setConsoleStdout('');
      } else {
        const errors = results.map(r => r.error).filter(Boolean).join('\n');
        setConsoleStderr(errors);
        setConsoleStdout('');
      }
      showToast('success', `Question saved! Score: ${score} points (${passedCases} passed, ${failedCases} failed)`);
    });

    // Real-time listener: Final exam submission complete
    newSocket.on('submit_exam_result', ({ score, submittedType }) => {
      setIsSubmitting(false);
      setAutoSubmitted(true);
      stopCamera();
      
      showToast('success', `Exam submitted successfully! Final Score: ${score} points.`);
    });

    // Force automatic submission trigger from proctoring
    newSocket.on('force_auto_submit', ({ message }) => {
      setAutoSubmitted(true);
      stopCamera();
      
      setNotification({
        type: 'danger',
        message: message || 'Your exam was automatically submitted due to multiple strikes.',
      });
    });

    return () => {
      newSocket.disconnect();
    };
  }, [test]);

  // 3. Proctoring rules execution via custom hook
  const handleViolationAlert = ({ eventType, strikes }) => {
    setNotification({
      type: 'warning',
      message: `Security violation detected: [${eventType}]. This is strike ${strikes} of 3. Standard assessment rules apply.`,
    });
    
    // Clear notification after 6 seconds
    setTimeout(() => setNotification(null), 6000);
  };

  const {
    videoRef,
    startCamera,
    stopCamera,
    cameraActive,
    strikes,
    modelsLoaded,
  } = useProctor({
    testId: test?._id,
    userId: user?.id,
    socket,
    onViolationTriggered: handleViolationAlert,
    enabled: test !== null && !autoSubmitted,
  });

  // Start camera automatically on load when test object is initialized
  useEffect(() => {
    if (test && !cameraActive && !autoSubmitted) {
      startCamera().catch((err) => {
        setError('Camera and Microphone initialization failed. Access is required to attempt the exam.');
      });
    }
    return () => stopCamera();
  }, [test]);

  // 4. Timer ticking system
  useEffect(() => {
    if (timeLeft <= 0 || autoSubmitted || !test) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleFinalSubmit('TIME_EXPIRED');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [timeLeft, autoSubmitted, test]);

  // Code editor updates
  const handleEditorChange = (value) => {
    if (!activeQuestion) return;
    setCodeMap((prev) => ({
      ...prev,
      [activeQuestion._id]: value,
    }));
  };

  // Sync starter templates on language toggle
  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    if (!activeQuestion) return;
    
    // If student hasn't typed anything for this language, load default starter template
    const currentCode = codeMap[activeQuestion._id];
    const isStarter = activeQuestion.starterTemplates.python === currentCode || 
                      activeQuestion.starterTemplates.java === currentCode || 
                      currentCode === '';
                      
    if (isStarter) {
      setCodeMap((prev) => ({
        ...prev,
        [activeQuestion._id]: activeQuestion.starterTemplates[lang] || '',
      }));
    }
  };

  // Trigger Run Code
  const handleRunCode = async () => {
    if (isRunning || !activeQuestion) return;
    
    setIsRunning(true);
    setConsoleTab('result');
    setConsoleStdout('Compiling and running code against visible test cases...');
    setConsoleStderr('');
    setExecResults(null);

    try {
      const res = await fetch(`${API_URL}/submissions/run`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          testId: test._id,
          questionId: activeQuestion._id,
          language,
          code: currentCode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit code for run');
      }
    } catch (err) {
      setConsoleStderr(err.message);
      setIsRunning(false);
    }
  };

  // Trigger submit question
  const handleSubmitQuestion = async () => {
    if (isSubmitting || !activeQuestion) return;

    setIsSubmitting(true);
    setConsoleTab('result');
    setConsoleStdout('Submitting answer to grading queue...');
    setConsoleStderr('');

    try {
      const res = await fetch(`${API_URL}/submissions/submit-question`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          testId: test._id,
          questionId: activeQuestion._id,
          language,
          code: currentCode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit code');
      }
    } catch (err) {
      setConsoleStderr(err.message);
      setIsSubmitting(false);
    }
  };

  // Final Exam submission trigger
  const handleFinalSubmit = async (type = 'NORMAL') => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/submissions/submit-exam`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          testId: test._id,
          language,
          code: codeMap,
          submittedType: type,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Submission failed');
      }
    } catch (err) {
      showToast('danger', err.message);
      setIsSubmitting(false);
    }
  };

  const showToast = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="text-slate-400 text-sm mt-4">Setting up sandboxed exam terminal...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-6 text-center">
        <AlertTriangle size={48} className="text-rose-500 mb-3" />
        <h1 className="text-xl font-bold text-slate-200">Exam Access Blocked</h1>
        <p className="text-slate-400 max-w-md mt-2 mb-6">{error}</p>
        <button
          onClick={() => navigate('/join')}
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2 rounded-lg transition"
        >
          Return to Lobby
        </button>
      </div>
    );
  }

  if (autoSubmitted) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-6 text-center">
        <CheckCircle size={48} className="text-emerald-500 mb-3 animate-bounce" />
        <h1 className="text-2xl font-black text-slate-200">Exam Terminated</h1>
        <p className="text-slate-400 max-w-md mt-2 mb-6">
          Your answers have been securely submitted to the grading engine. Editing features have been locked.
        </p>
        <button
          onClick={() => navigate('/join')}
          className="bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 font-semibold px-5 py-2 rounded-lg transition"
        >
          Exit Exam
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden select-none">
      
      {/* Top Navbar */}
      <header className="h-16 border-b border-slate-900 flex items-center justify-between px-6 bg-slate-950/60 backdrop-blur shrink-0 z-40">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600/10 text-blue-400 p-2 rounded-lg border border-blue-500/25">
            <FileCode size={20} />
          </div>
          <div>
            <h2 className="font-bold text-slate-200 text-sm truncate max-w-xs">{test?.title}</h2>
            <span className="text-[10px] text-slate-500 font-mono">Exam Session Code: {test?.testId}</span>
          </div>
        </div>

        {/* Timer, Webcam, strikes */}
        <div className="flex items-center gap-5">
          {/* Strikes Counter */}
          <div className="flex items-center gap-1.5 bg-slate-900/60 border border-slate-850 px-2.5 py-1 rounded-lg">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Strikes:</span>
            <span className={`font-mono text-xs font-black ${strikes > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
              {strikes} / 3
            </span>
          </div>

          {/* Clock Timer */}
          <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-850 px-3 py-1.5 rounded-lg text-sm font-semibold">
            <Clock size={16} className={timeLeft < 300 ? 'text-rose-400 animate-pulse' : 'text-blue-400'} />
            <span className={timeLeft < 300 ? 'text-rose-400 font-bold' : 'text-slate-200'}>
              {formatTime(timeLeft)}
            </span>
          </div>

          {/* Final Submit Button */}
          <button
            onClick={() => handleFinalSubmit('NORMAL')}
            disabled={isSubmitting}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg text-xs transition shadow-lg shrink-0 flex items-center gap-1"
          >
            <Send size={12} />
            <span>Submit Exam</span>
          </button>
        </div>
      </header>

      {/* Floating Notifications */}
      {notification && (
        <div className={`fixed bottom-6 right-6 p-4 rounded-xl border z-50 animate-slideUp text-xs font-semibold shadow-2xl max-w-md ${
          notification.type === 'danger'
            ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            : notification.type === 'warning'
            ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Main Split Screen Interface */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT: Problem Description & Test Cases */}
        <div className="w-1/2 flex flex-col border-r border-slate-900 overflow-hidden bg-slate-950/40">
          
          {/* Question Selector Tab strip */}
          <div className="h-11 border-b border-slate-900 flex items-center px-4 gap-2 bg-slate-950/80 shrink-0">
            {questions.map((q, idx) => (
              <button
                key={q._id}
                onClick={() => setActiveQIdx(idx)}
                className={`px-3 py-1 rounded text-xs font-semibold transition ${
                  activeQIdx === idx ? 'bg-slate-900 text-blue-400 border border-slate-800' : 'text-slate-500 hover:text-slate-350'
                }`}
              >
                Question {idx + 1}
              </button>
            ))}
          </div>

          {/* Problem statements body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                activeQuestion?.difficulty === 'Easy' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                activeQuestion?.difficulty === 'Medium' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}>
                {activeQuestion?.difficulty}
              </span>
              <h1 className="text-xl font-black text-slate-200 mt-3">{activeQuestion?.title}</h1>
            </div>

            {/* Description Render */}
            <div 
              className="text-sm text-slate-350 leading-relaxed space-y-3 whitespace-pre-wrap font-sans"
              dangerouslySetInnerHTML={{ __html: activeQuestion?.description }}
            />

            {/* Constraints */}
            {activeQuestion?.constraints && (
              <div className="space-y-2 border-t border-slate-900 pt-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Constraints</h3>
                <pre className="bg-slate-900/60 border border-slate-850 p-3 rounded font-mono text-xs text-slate-400 whitespace-pre-wrap">{activeQuestion.constraints}</pre>
              </div>
            )}

            {/* Visible Testcases */}
            <div className="space-y-4 border-t border-slate-900 pt-4 pb-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <HelpCircle size={14} className="text-blue-400" />
                <span>Visible Examples</span>
              </h3>
              
              <div className="space-y-3">
                {activeQuestion?.testCases.map((tc, tcIdx) => (
                  <div key={tc._id || tcIdx} className="bg-slate-900/30 border border-slate-900 rounded-lg p-4 space-y-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Example {tcIdx + 1}</span>
                    <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                      <div>
                        <span className="text-slate-500 block mb-1">Input:</span>
                        <pre className="bg-slate-950 p-2 rounded text-slate-300 border border-slate-850/60 whitespace-pre-wrap">{tc.input}</pre>
                      </div>
                      <div>
                        <span className="text-slate-500 block mb-1">Expected Output:</span>
                        <pre className="bg-slate-950 p-2 rounded text-slate-300 border border-slate-850/60 whitespace-pre-wrap">{tc.expectedOutput}</pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Monaco Editor & Console Tabs */}
        <div className="w-1/2 flex flex-col overflow-hidden bg-slate-950/80 relative">
          
          {/* Webcam corner overlay */}
          <div className="absolute top-14 right-4 w-28 h-20 bg-slate-950 border border-slate-800 rounded-lg overflow-hidden z-30 shadow-2xl flex items-center justify-center">
            {cameraActive ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            ) : (
              <Video size={16} className="text-rose-500 animate-pulse" />
            )}
          </div>

          {/* Editor Header settings */}
          <div className="h-11 border-b border-slate-900 flex justify-between items-center px-4 bg-slate-950 shrink-0 z-20">
            <div className="flex items-center gap-3">
              <select
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="bg-slate-900 border border-slate-800 focus:border-blue-500 rounded px-2.5 py-1 text-slate-200 outline-none text-xs cursor-pointer font-semibold"
              >
                <option value="python">Python 3</option>
                <option value="java">Java 21</option>
              </select>
            </div>
            
            <div className="text-[10px] text-slate-500 font-mono pr-28">
              {modelsLoaded ? '🧠 AI Proctor Active' : '⚙️ Loading AI...'}
            </div>
          </div>

          {/* Monaco Editor Container */}
          <div className="flex-1 min-h-0 bg-slate-950">
            <Editor
              height="100%"
              language={language === 'python' ? 'python' : 'java'}
              theme="vs-dark"
              value={currentCode}
              onChange={handleEditorChange}
              options={{
                selectOnLineNumbers: true,
                automaticLayout: true,
                tabSize: 4,
                insertSpaces: true,
                bracketPairColorization: { enabled: true },
                autoClosingBrackets: 'always',
                autoClosingQuotes: 'always',
                formatOnType: true,
                fontFamily: 'Fira Code, Source Code Pro, monospace',
                fontSize: 13,
                minimap: { enabled: false }
              }}
            />
          </div>

          {/* Bottom Console Panel */}
          <div className="h-64 border-t border-slate-900 flex flex-col bg-slate-950 shrink-0 z-20">
            {/* Console Header Tabs */}
            <div className="h-10 border-b border-slate-900 flex justify-between items-center px-4 bg-slate-950/80">
              <div className="flex gap-2">
                <button
                  onClick={() => setConsoleTab('testcase')}
                  className={`px-3 py-1 rounded text-xs font-semibold ${
                    consoleTab === 'testcase' ? 'bg-slate-900 text-slate-200 border border-slate-800' : 'text-slate-500 hover:text-slate-400'
                  }`}
                >
                  Testcase
                </button>
                <button
                  onClick={() => setConsoleTab('result')}
                  disabled={!execResults && !isRunning && !isSubmitting}
                  className={`px-3 py-1 rounded text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed ${
                    consoleTab === 'result' ? 'bg-slate-900 text-slate-200 border border-slate-800' : 'text-slate-500 hover:text-slate-400'
                  }`}
                >
                  Result
                </button>
              </div>

              {/* Console Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleRunCode}
                  disabled={isRunning || isSubmitting}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-750 disabled:opacity-40 text-slate-300 hover:text-white font-bold px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1"
                >
                  <Play size={10} />
                  <span>Run Code</span>
                </button>

                <button
                  onClick={handleSubmitQuestion}
                  disabled={isRunning || isSubmitting}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1 shadow-lg"
                >
                  <Send size={10} />
                  <span>Submit Question</span>
                </button>
              </div>
            </div>

            {/* Console Body Area */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-950 font-sans text-xs text-slate-300">
              {consoleTab === 'testcase' && activeQuestion && (
                <div className="space-y-4">
                  {/* Case buttons */}
                  <div className="flex gap-2 border-b border-slate-900 pb-2">
                    {activeQuestion.testCases.filter(tc => !tc.hidden).map((tc, idx) => (
                      <button
                        key={tc._id || idx}
                        type="button"
                        onClick={() => setActiveCaseIdx(idx)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
                          activeCaseIdx === idx
                            ? 'bg-slate-900 border-slate-800 text-blue-400 font-bold'
                            : 'bg-slate-950 border-slate-900 text-slate-500 hover:text-slate-400'
                        }`}
                      >
                        Case {idx + 1}
                      </button>
                    ))}
                  </div>

                  {/* Inputs and expected outputs for selected case */}
                  {activeQuestion.testCases.filter(tc => !tc.hidden)[activeCaseIdx] && (
                    <div className="space-y-3 font-mono">
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Input</div>
                        <pre className="bg-slate-900/60 border border-slate-850 px-3 py-2 rounded text-slate-300 whitespace-pre-wrap">{activeQuestion.testCases.filter(tc => !tc.hidden)[activeCaseIdx].input}</pre>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Expected Output</div>
                        <pre className="bg-slate-900/60 border border-slate-850 px-3 py-2 rounded text-slate-300 whitespace-pre-wrap">{activeQuestion.testCases.filter(tc => !tc.hidden)[activeCaseIdx].expectedOutput}</pre>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {consoleTab === 'result' && (
                <div className="space-y-4">
                  {/* Loading State */}
                  {(isRunning || isSubmitting) && (
                    <div className="flex flex-col items-center justify-center py-6 text-slate-500 italic gap-2 font-mono">
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500"></div>
                      <div>{consoleStdout}</div>
                    </div>
                  )}

                  {/* Compilation/Runtime Error State */}
                  {!(isRunning || isSubmitting) && consoleStderr && (
                    <div className="space-y-2">
                      <div className="text-sm font-bold text-rose-400 flex items-center gap-1.5">
                        <AlertTriangle size={16} />
                        <span>Compilation Error</span>
                      </div>
                      <pre className="bg-rose-950/10 border border-rose-900/30 p-3 rounded font-mono text-rose-300 whitespace-pre-wrap">{consoleStderr}</pre>
                    </div>
                  )}

                  {/* Execution Results State */}
                  {!(isRunning || isSubmitting) && !consoleStderr && execResults && (
                    (() => {
                      const visibleCases = activeQuestion ? activeQuestion.testCases.filter(tc => !tc.hidden) : [];
                      
                      // Check if it was a RUN (visible cases only) or SUBMIT (all cases)
                      const isRunAction = execResults.length === visibleCases.length;
                      const activeTestCase = isRunAction 
                        ? visibleCases[activeCaseIdx] 
                        : activeQuestion?.testCases[activeCaseIdx];

                      // Status aggregates
                      const compileErr = execResults.find(r => r.status === 'Compilation Error');
                      const runtimeErr = execResults.find(r => r.status === 'Runtime Error');
                      const timeoutErr = execResults.find(r => r.status === 'Time Limit Exceeded');
                      const allPassed = execResults.every(r => r.passed);

                      let statusText = 'Wrong Answer';
                      let statusColor = 'text-rose-500';
                      
                      if (compileErr) {
                        statusText = 'Compilation Error';
                        statusColor = 'text-rose-500';
                      } else if (runtimeErr) {
                        statusText = 'Runtime Error';
                        statusColor = 'text-rose-500';
                      } else if (timeoutErr) {
                        statusText = 'Time Limit Exceeded';
                        statusColor = 'text-rose-500';
                      } else if (allPassed) {
                        statusText = 'Accepted';
                        statusColor = 'text-emerald-400';
                      }

                      const activeResult = execResults[activeCaseIdx];

                      return (
                        <div className="space-y-4">
                          {/* Status Header */}
                          <div className="flex justify-between items-center border-b border-slate-900 pb-2.5">
                            <div>
                              <h3 className={`text-base font-black tracking-wide ${statusColor}`}>{statusText}</h3>
                              {activeResult && (
                                <span className="text-[10px] text-slate-500 font-bold font-mono">
                                  Runtime: {activeResult.timeMs || 0} ms
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Case toggles */}
                          <div className="flex flex-wrap gap-2">
                            {execResults.map((res, idx) => (
                              <button
                                key={res.testCaseId || idx}
                                type="button"
                                onClick={() => setActiveCaseIdx(idx)}
                                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition flex items-center gap-1.5 ${
                                  activeCaseIdx === idx
                                    ? 'bg-slate-900 border-slate-800 text-slate-200'
                                    : 'bg-slate-950 border-slate-900 text-slate-500 hover:text-slate-400'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${res.passed ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
                                <span>Case {idx + 1}</span>
                                {res.hidden && <span className="text-[9px] bg-slate-900 border border-slate-800 text-slate-500 px-1 rounded scale-90">Hidden</span>}
                              </button>
                            ))}
                          </div>

                          {/* Case details */}
                          {activeResult && (
                            <div className="space-y-3 font-mono">
                              {/* Stderr / Error display */}
                              {activeResult.error && !activeResult.hidden && (
                                <div>
                                  <div className="text-[10px] text-rose-400 font-bold uppercase tracking-wider mb-1">Runtime Error</div>
                                  <pre className="bg-rose-950/10 border border-rose-900/30 px-3 py-2 rounded text-rose-350 whitespace-pre-wrap">{activeResult.error}</pre>
                                </div>
                              )}

                              {/* Input */}
                              <div>
                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Input</div>
                                <pre className="bg-slate-900/60 border border-slate-850 px-3 py-2 rounded text-slate-350 whitespace-pre-wrap">
                                  {activeResult.hidden ? '[Hidden Test Case]' : (activeTestCase?.input || 'No input')}
                                </pre>
                              </div>

                              {/* Output */}
                              <div>
                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Output</div>
                                <pre className={`border px-3 py-2 rounded whitespace-pre-wrap ${
                                  activeResult.passed 
                                    ? 'bg-slate-900/40 border-slate-850 text-emerald-400' 
                                    : 'bg-rose-950/10 border-rose-900/20 text-rose-400 font-bold'
                                }`}>
                                  {activeResult.hidden ? '[Hidden]' : (activeResult.actualOutput?.trim() || 'No output')}
                                </pre>
                              </div>

                              {/* Expected Output */}
                              <div>
                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Expected</div>
                                <pre className="bg-slate-900/60 border border-slate-850 px-3 py-2 rounded text-slate-350 whitespace-pre-wrap">
                                  {activeResult.hidden ? '[Hidden]' : (activeResult.expectedOutput?.trim() || 'No expected output')}
                                </pre>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
