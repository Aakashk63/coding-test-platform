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

        results = await runExecution(language, code, driverCode, targetCases);
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
          const qResults = await runExecution(
            language, 
            studentCode, 
            question.starterTemplates[`${language}_driver`] || '', // Custom driver code if exists
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
