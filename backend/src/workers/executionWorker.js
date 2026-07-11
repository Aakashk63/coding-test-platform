import { Worker } from '../config/redis.js';
import { runExecution } from '../services/codeExecutionService.js';
import { getIO, getSocketIdByUserId } from '../config/socket.js';
import Submission from '../models/Submission.js';
import Test from '../models/Test.js';

export const initExecutionWorker = () => {
  const executionWorker = new Worker('code_queue', async (job) => {
    const {
      type, // 'RUN' or 'SUBMIT_QUESTION' or 'SUBMIT_EXAM'
      userId,
      testId,
      questionId,
      language,
      code,
      driverCode,
      testCases,
      submittedType, // 'NORMAL' / 'TIME_EXPIRED' / 'PROCTOR_AUTO_SUBMIT'
    } = job.data;

    console.log(`👷 Processing execution job [${job.id}] | Type: ${type} | User: ${userId} | Test: ${testId}`);

    try {
      let results = [];

      // For RUN and SUBMIT_QUESTION, evaluate code
      if (type === 'RUN' || type === 'SUBMIT_QUESTION') {
        // Filter test cases based on type
        // 'RUN' only runs VISIBLE test cases. 'SUBMIT_QUESTION' runs ALL.
        const targetCases = type === 'RUN' 
          ? testCases.filter(tc => !tc.hidden)
          : testCases;

        let activeDriver = driverCode;
        if (!activeDriver || activeDriver.includes("result = solution(nums, target)") || activeDriver.includes("solver.solution(nums, target)")) {
          if (language === 'python') {
            activeDriver = `import sys\nimport json\nimport inspect\n\ndef parse_val(s):\n    s = s.strip()\n    if (s.startswith('"') and s.endswith('"')) or (s.startswith("'") and s.endswith("'")):\n        return s[1:-1]\n    try:\n        return json.loads(s)\n    except Exception:\n        try:\n            if '.' in s:\n                return float(s)\n            return int(s)\n        except Exception:\n            return s\n\nif __name__ == '__main__':\n    lines = sys.stdin.read().splitlines()\n    if 'Solution' in globals():\n        sol = Solution()\n        methods = [m for m in dir(sol) if not m.startswith('_') and callable(getattr(sol, m))]\n        if methods:\n            method_name = methods[0]\n            method = getattr(sol, method_name)\n            sig = inspect.signature(method)\n            num_args = len(sig.parameters)\n            args = [parse_val(line) for line in lines[:num_args]]\n            result = method(*args)\n            print(json.dumps(result))\n        else:\n            print("No methods found in Solution class")\n    else:\n        import types\n        funcs = [name for name, val in globals().items() if isinstance(val, types.FunctionType) and val.__module__ == '__main__' and name != 'parse_val']\n        if funcs:\n            method = globals()[funcs[0]]\n            sig = inspect.signature(method)\n            num_args = len(sig.parameters)\n            args = [parse_val(line) for line in lines[:num_args]]\n            result = method(*args)\n            print(json.dumps(result))`;
          } else if (language === 'java') {
            activeDriver = `import java.io.*;\nimport java.util.*;\n\npublic class Main {\n    public static void main(String[] args) throws Exception {\n        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));\n        List<String> lines = new ArrayList<>();\n        String line;\n        while ((line = reader.readLine()) != null) {\n            lines.add(line.trim());\n        }\n        \n        Solution solver = new Solution();\n        java.lang.reflect.Method targetMethod = null;\n        for (java.lang.reflect.Method m : Solution.class.getDeclaredMethods()) {\n            if (java.lang.reflect.Modifier.isPublic(m.getModifiers()) && !m.getName().equals("main")) {\n                targetMethod = m;\n                break;\n            }\n        }\n        \n        if (targetMethod == null) {\n            throw new RuntimeException("No public method found in Solution class.");\n        }\n        \n        Class<?>[] paramTypes = targetMethod.getParameterTypes();\n        Object[] methodArgs = new Object[paramTypes.length];\n        for (int i = 0; i < paramTypes.length; i++) {\n            if (i < lines.size()) {\n                methodArgs[i] = parseJavaValue(lines.get(i), paramTypes[i]);\n            } else {\n                methodArgs[i] = null;\n            }\n        }\n        \n        Object res = targetMethod.invoke(solver, methodArgs);\n        if (res != null) {\n            if (res.getClass().isArray()) {\n                int len = java.lang.reflect.Array.getLength(res);\n                List<String> elements = new ArrayList<>();\n                for (int j = 0; j < len; j++) {\n                    elements.add(String.valueOf(java.lang.reflect.Array.get(res, j)));\n                }\n                System.out.println("[" + String.join(",", elements) + "]");\n            } else {\n                System.out.println(res);\n            }\n        }\n    }\n    \n    private static Object parseJavaValue(String raw, Class<?> type) {\n        raw = raw.trim();\n        if (type.equals(String.class)) {\n            if (raw.startsWith("\\\"") && raw.endsWith("\\\"")) {\n                return raw.substring(1, raw.length() - 1);\n            }\n            if (raw.startsWith("'") && raw.endsWith("'")) {\n                return raw.substring(1, raw.length() - 1);\n            }\n            return raw;\n        }\n        if (type.equals(int.class) || type.equals(Integer.class)) {\n            return Integer.parseInt(raw);\n        }\n        if (type.equals(double.class) || type.equals(Double.class)) {\n            return Double.parseDouble(raw);\n        }\n        if (type.equals(boolean.class) || type.equals(Boolean.class)) {\n            return Boolean.parseBoolean(raw);\n        }\n        if (type.isArray()) {\n            Class<?> componentType = type.getComponentType();\n            String clean = raw.replaceAll("[\\\\\\\\[\\\\\\\\]]", "").trim();\n            if (clean.isEmpty()) {\n                return java.lang.reflect.Array.newInstance(componentType, 0);\n            }\n            String[] parts = clean.split(",");\n            Object arr = java.lang.reflect.Array.newInstance(componentType, parts.length);\n            for (int j = 0; j < parts.length; j++) {\n                Object val = parseJavaValue(parts[j].trim(), componentType);\n                java.lang.reflect.Array.set(arr, j, val);\n            }\n            return arr;\n        }\n        return raw;\n    }\n}`;
          }
        }

        results = await runExecution(language, code, activeDriver, targetCases);
      }

      const socketId = getSocketIdByUserId(userId);
      const io = getIO();

      if (type === 'RUN') {
        // Send back RUN results to the student
        if (socketId) {
          io.to(socketId).emit('run_result', {
            jobId: job.id,
            questionId,
            results,
          });
        }
      } else if (type === 'SUBMIT_QUESTION') {
        // Save intermediate question submission or update active submission in MongoDB
        const totalCases = results.length;
        const passedCases = results.filter(r => r.passed).length;
        const failedCases = totalCases - passedCases;

        // Calculate score based on testcase weightage
        let score = 0;
        results.forEach(r => {
          if (r.passed) score += (r.weightage || 10);
        });

        // Try to find existing submission for this test and student
        let submission = await Submission.findOne({ student: userId, test: testId });

        if (!submission) {
          submission = new Submission({
            student: userId,
            test: testId,
            language,
            code: { [questionId]: code },
            questionResults: [{
              questionId,
              code,
              score,
              passedCases,
              failedCases
            }],
            score,
            passedCases,
            failedCases,
            submittedType: 'NORMAL'
          });
        } else {
          // Update code and question results
          submission.language = language;
          submission.code.set(questionId, code);

          const qIdx = submission.questionResults.findIndex(qr => qr.questionId.toString() === questionId);
          if (qIdx >= 0) {
            submission.questionResults[qIdx] = {
              questionId,
              code,
              score,
              passedCases,
              failedCases
            };
          } else {
            submission.questionResults.push({
              questionId,
              code,
              score,
              passedCases,
              failedCases
            });
          }

          // Recalculate aggregates
          let totalScore = 0;
          let totalPassed = 0;
          let totalFailed = 0;
          
          submission.questionResults.forEach(qr => {
            totalScore += qr.score;
            totalPassed += qr.passedCases;
            totalFailed += qr.failedCases;
          });

          submission.score = totalScore;
          submission.passedCases = totalPassed;
          submission.failedCases = totalFailed;
        }

        await submission.save();

        if (socketId) {
          io.to(socketId).emit('submit_question_result', {
            jobId: job.id,
            questionId,
            results,
            score,
            passedCases,
            failedCases,
          });
        }
      } else if (type === 'SUBMIT_EXAM') {
        // Finalize whole exam submission
        // In this case, `code` is an object mapping questionId to code string
        // We grade any questions that haven't been graded yet or summarize the final score.
        let submission = await Submission.findOne({ student: userId, test: testId });
        const test = await Test.findById(testId);

        if (!submission) {
          submission = new Submission({
            student: userId,
            test: testId,
            language,
            code,
            questionResults: [],
            score: 0,
            passedCases: 0,
            failedCases: 0,
            submittedType: submittedType || 'NORMAL'
          });
        } else {
          submission.submittedType = submittedType || 'NORMAL';
        }

        // Grade all questions that are in the exam code mapping
        const finalQuestionResults = [];
        let totalScore = 0;
        let totalPassed = 0;
        let totalFailed = 0;

        for (const question of test.questions) {
          const qIdStr = question._id.toString();
          const studentCode = code[qIdStr] || question.starterTemplates[language] || '';

          // Let's run grading for each question
          const testDriver = question.starterTemplates[`${language}_driver`] || '';
          let activeDriver = testDriver;
          if (!activeDriver || activeDriver.includes("result = solution(nums, target)") || activeDriver.includes("solver.solution(nums, target)")) {
            if (language === 'python') {
              activeDriver = `import sys\nimport json\nimport inspect\n\ndef parse_val(s):\n    s = s.strip()\n    if (s.startswith('"') and s.endswith('"')) or (s.startswith("'") and s.endswith("'")):\n        return s[1:-1]\n    try:\n        return json.loads(s)\n    except Exception:\n        try:\n            if '.' in s:\n                return float(s)\n            return int(s)\n        except Exception:\n            return s\n\nif __name__ == '__main__':\n    lines = sys.stdin.read().splitlines()\n    if 'Solution' in globals():\n        sol = Solution()\n        methods = [m for m in dir(sol) if not m.startswith('_') and callable(getattr(sol, m))]\n        if methods:\n            method_name = methods[0]\n            method = getattr(sol, method_name)\n            sig = inspect.signature(method)\n            num_args = len(sig.parameters)\n            args = [parse_val(line) for line in lines[:num_args]]\n            result = method(*args)\n            print(json.dumps(result))\n        else:\n            print("No methods found in Solution class")\n    else:\n        import types\n        funcs = [name for name, val in globals().items() if isinstance(val, types.FunctionType) and val.__module__ == '__main__' and name != 'parse_val']\n        if funcs:\n            method = globals()[funcs[0]]\n            sig = inspect.signature(method)\n            num_args = len(sig.parameters)\n            args = [parse_val(line) for line in lines[:num_args]]\n            result = method(*args)\n            print(json.dumps(result))`;
            } else if (language === 'java') {
              activeDriver = `import java.io.*;\nimport java.util.*;\n\npublic class Main {\n    public static void main(String[] args) throws Exception {\n        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));\n        List<String> lines = new ArrayList<>();\n        String line;\n        while ((line = reader.readLine()) != null) {\n            lines.add(line.trim());\n        }\n        \n        Solution solver = new Solution();\n        java.lang.reflect.Method targetMethod = null;\n        for (java.lang.reflect.Method m : Solution.class.getDeclaredMethods()) {\n            if (java.lang.reflect.Modifier.isPublic(m.getModifiers()) && !m.getName().equals("main")) {\n                targetMethod = m;\n                break;\n            }\n        }\n        \n        if (targetMethod == null) {\n            throw new RuntimeException("No public method found in Solution class.");\n        }\n        \n        Class<?>[] paramTypes = targetMethod.getParameterTypes();\n        Object[] methodArgs = new Object[paramTypes.length];\n        for (int i = 0; i < paramTypes.length; i++) {\n            if (i < lines.size()) {\n                methodArgs[i] = parseJavaValue(lines.get(i), paramTypes[i]);\n            } else {\n                methodArgs[i] = null;\n            }\n        }\n        \n        Object res = targetMethod.invoke(solver, methodArgs);\n        if (res != null) {\n            if (res.getClass().isArray()) {\n                int len = java.lang.reflect.Array.getLength(res);\n                List<String> elements = new ArrayList<>();\n                for (int j = 0; j < len; j++) {\n                    elements.add(String.valueOf(java.lang.reflect.Array.get(res, j)));\n                }\n                System.out.println("[" + String.join(",", elements) + "]");\n            } else {\n                System.out.println(res);\n            }\n        }\n    }\n    \n    private static Object parseJavaValue(String raw, Class<?> type) {\n        raw = raw.trim();\n        if (type.equals(String.class)) {\n            if (raw.startsWith("\\\"") && raw.endsWith("\\\"")) {\n                return raw.substring(1, raw.length() - 1);\n            }\n            if (raw.startsWith("'") && raw.endsWith("'")) {\n                return raw.substring(1, raw.length() - 1);\n            }\n            return raw;\n        }\n        if (type.equals(int.class) || type.equals(Integer.class)) {\n            return Integer.parseInt(raw);\n        }\n        if (type.equals(double.class) || type.equals(Double.class)) {\n            return Double.parseDouble(raw);\n        }\n        if (type.equals(boolean.class) || type.equals(Boolean.class)) {\n            return Boolean.parseBoolean(raw);\n        }\n        if (type.isArray()) {\n            Class<?> componentType = type.getComponentType();\n            String clean = raw.replaceAll("[\\\\\\\\[\\\\\\\\]]", "").trim();\n            if (clean.isEmpty()) {\n                return java.lang.reflect.Array.newInstance(componentType, 0);\n            }\n            String[] parts = clean.split(",");\n            Object arr = java.lang.reflect.Array.newInstance(componentType, parts.length);\n            for (int j = 0; j < parts.length; j++) {\n                Object val = parseJavaValue(parts[j].trim(), componentType);\n                java.lang.reflect.Array.set(arr, j, val);\n            }\n            return arr;\n        }\n        return raw;\n    }\n}`;
            }
          }

          const qResults = await runExecution(
            language, 
            studentCode, 
            activeDriver, 
            question.testCases
          );

          const passed = qResults.filter(r => r.passed).length;
          const failed = qResults.length - passed;
          let qScore = 0;
          qResults.forEach(r => {
            if (r.passed) qScore += (r.weightage || 10);
          });

          finalQuestionResults.push({
            questionId: question._id,
            code: studentCode,
            score: qScore,
            passedCases: passed,
            failedCases: failed
          });

          totalScore += qScore;
          totalPassed += passed;
          totalFailed += failed;
        }

        submission.questionResults = finalQuestionResults;
        submission.score = totalScore;
        submission.passedCases = totalPassed;
        submission.failedCases = totalFailed;
        
        await submission.save();

        if (socketId) {
          io.to(socketId).emit('submit_exam_result', {
            jobId: job.id,
            status: 'Success',
            score: totalScore,
            submittedType: submission.submittedType,
          });
        }

        // Notify admins of submission in test room
        io.to(`test_${testId}`).emit('student_submitted', {
          userId,
          score: totalScore,
          submittedType: submission.submittedType,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      console.error(`Error processing execution job ${job.id}:`, error);
      const socketId = getSocketIdByUserId(userId);
      if (socketId) {
        getIO().to(socketId).emit('execution_error', {
          jobId: job.id,
          error: 'An internal error occurred during code execution. Please try again.',
        });
      }
    }
  });

  return executionWorker;
};
