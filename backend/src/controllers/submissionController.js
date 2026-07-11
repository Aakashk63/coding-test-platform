import Test from '../models/Test.js';
import Submission from '../models/Submission.js';
import ProctoringLog from '../models/ProctoringLog.js';
import { Queue } from '../config/redis.js';

const codeQueue = new Queue('code_queue');

/**
 * Run student code against visible test cases
 */
export const runCode = async (req, res) => {
  try {
    const { testId, questionId, language, code } = req.body;
    const userId = req.user.id;

    if (!testId || !questionId || !language || !code) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    const question = test.questions.id(questionId);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Add task to code evaluation queue
    const job = await codeQueue.add('run_code', {
      type: 'RUN',
      userId,
      testId,
      questionId,
      language,
      code,
      driverCode: question.starterTemplates ? question.starterTemplates[`${language}_driver`] : '',
      testCases: question.testCases,
    });

    res.status(200).json({
      message: 'Code run queued successfully',
      jobId: job.id,
    });
  } catch (error) {
    console.error('Run code error:', error);
    res.status(500).json({ error: 'Server error queueing code execution' });
  }
};

/**
 * Submit code for a specific question (evaluates against visible + hidden)
 */
export const submitQuestion = async (req, res) => {
  try {
    const { testId, questionId, language, code } = req.body;
    const userId = req.user.id;

    if (!testId || !questionId || !language || !code) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    const question = test.questions.id(questionId);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const job = await codeQueue.add('submit_question', {
      type: 'SUBMIT_QUESTION',
      userId,
      testId,
      questionId,
      language,
      code,
      driverCode: question.starterTemplates ? question.starterTemplates[`${language}_driver`] : '',
      testCases: question.testCases,
    });

    res.status(200).json({
      message: 'Question submission queued successfully',
      jobId: job.id,
    });
  } catch (error) {
    console.error('Submit question error:', error);
    res.status(500).json({ error: 'Server error queueing question submission' });
  }
};

/**
 * Final submission of the entire exam
 */
export const submitExam = async (req, res) => {
  try {
    const { testId, language, code, submittedType } = req.body;
    const userId = req.user.id;

    if (!testId || !language || !code) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    const job = await codeQueue.add('submit_exam', {
      type: 'SUBMIT_EXAM',
      userId,
      testId,
      language,
      code, // Expecting Map of questionId -> code
      submittedType: submittedType || 'NORMAL',
    });

    res.status(200).json({
      message: 'Final exam submission queued successfully',
      jobId: job.id,
    });
  } catch (error) {
    console.error('Submit exam error:', error);
    res.status(500).json({ error: 'Server error queueing exam submission' });
  }
};

/**
 * Admin: Get all submissions for a test
 */
export const getAdminSubmissions = async (req, res) => {
  try {
    const { testId } = req.params;
    const submissions = await Submission.find({ test: testId })
      .populate('student', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json(submissions);
  } catch (error) {
    console.error('Get admin submissions error:', error);
    res.status(500).json({ error: 'Server error retrieving submissions' });
  }
};

/**
 * Student: Get status of a submission
 */
export const getStudentSubmissionStatus = async (req, res) => {
  try {
    const { testId } = req.params;
    const submission = await Submission.findOne({ test: testId, student: req.user.id });

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    res.status(200).json(submission);
  } catch (error) {
    console.error('Get student submission status error:', error);
    res.status(500).json({ error: 'Server error retrieving submission status' });
  }
};

/**
 * Admin: Allow student to retake test (delete submission and proctor logs)
 */
export const allowRetest = async (req, res) => {
  try {
    const { submissionId } = req.params;

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const { student, test } = submission;

    // Delete submission
    await Submission.findByIdAndDelete(submissionId);

    // Delete proctor logs
    await ProctoringLog.deleteMany({ student, test });

    res.status(200).json({ message: 'Retest access granted. Previous records cleared successfully.' });
  } catch (error) {
    console.error('Allow retest error:', error);
    res.status(500).json({ error: 'Server error granting retest access' });
  }
};
