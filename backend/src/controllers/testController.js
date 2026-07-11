import Test from '../models/Test.js';
import Submission from '../models/Submission.js';
import ProctoringLog from '../models/ProctoringLog.js';

/**
 * Generates a unique Test ID: TEST-XXXXXX
 */
const generateUniqueTestId = async () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let isUnique = false;
  let testId = '';

  while (!isUnique) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    testId = `TEST-${code}`;
    const existing = await Test.findOne({ testId });
    if (!existing) {
      isUnique = true;
    }
  }
  return testId;
};

/**
 * Admin: Create a new test
 */
export const createTest = async (req, res) => {
  try {
    const { title, description, duration, startTime, endTime, allowedLanguages, questions, maxStrikes } = req.body;

    if (!title || !duration || !startTime || !endTime) {
      return res.status(400).json({ error: 'Title, duration, startTime, and endTime are required' });
    }

    const testId = await generateUniqueTestId();

    const newTest = new Test({
      testId,
      title,
      description,
      duration: Number(duration),
      maxStrikes: maxStrikes !== undefined ? Number(maxStrikes) : 3,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      allowedLanguages: allowedLanguages || ['python', 'java'],
      questions: questions || [],
      createdBy: req.user.id,
    });

    await newTest.save();
    res.status(201).json({ message: 'Test created successfully', test: newTest });
  } catch (error) {
    console.error('Create test error:', error);
    res.status(500).json({ error: 'Server error during test creation' });
  }
};

/**
 * Admin: Get all created tests
 */
export const getAdminTests = async (req, res) => {
  try {
    const tests = await Test.find({ createdBy: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json(tests);
  } catch (error) {
    console.error('Get admin tests error:', error);
    res.status(500).json({ error: 'Server error retrieving tests' });
  }
};

/**
 * Admin: Get test details (including hidden test cases)
 */
export const getAdminTestById = async (req, res) => {
  try {
    const { id } = req.params;
    const test = await Test.findOne({ _id: id, createdBy: req.user.id });

    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    res.status(200).json(test);
  } catch (error) {
    console.error('Get admin test by ID error:', error);
    res.status(500).json({ error: 'Server error retrieving test' });
  }
};

/**
 * Student: Verify Test ID eligibility
 */
export const verifyTestId = async (req, res) => {
  try {
    const { testId } = req.body;
    if (!testId) {
      return res.status(400).json({ error: 'Test ID is required' });
    }

    const test = await Test.findOne({ testId });
    if (!test) {
      return res.status(404).json({ error: 'Invalid Test ID. Test does not exist.' });
    }

    const now = new Date();
    if (now < new Date(test.startTime)) {
      return res.status(400).json({ 
        error: `Test has not started yet. It begins at ${new Date(test.startTime).toLocaleString()}.` 
      });
    }
    if (now > new Date(test.endTime)) {
      return res.status(400).json({ error: 'Test has already ended.' });
    }

    // Check if student already submitted this exam
    const existingSubmission = await Submission.findOne({ 
      student: req.user.id, 
      test: test._id 
    });

    if (existingSubmission) {
      return res.status(400).json({ error: 'You have already submitted this test.' });
    }

    res.status(200).json({ 
      message: 'Test access verified.',
      test: {
        id: test._id,
        testId: test.testId,
        title: test.title,
        duration: test.duration,
      }
    });
  } catch (error) {
    console.error('Verify Test ID error:', error);
    res.status(500).json({ error: 'Server error verifying Test ID' });
  }
};

/**
 * Student: Get test details for exam (strictly strip hidden test cases)
 */
export const getStudentTestById = async (req, res) => {
  try {
    const { id } = req.params;
    const test = await Test.findOne({ testId: id }).lean();

    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    // Double-check end time validity
    const now = new Date();
    if (now > new Date(test.endTime)) {
      return res.status(403).json({ error: 'Access denied: Test has already ended.' });
    }

    // Strip hidden test cases from each question to prevent source leaks
    const cleanQuestions = test.questions.map((question) => {
      const publicCases = (question.testCases || [])
        .filter((tc) => !tc.hidden)
        .map((tc) => ({
          _id: tc._id,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          weightage: tc.weightage,
        }));

      return {
        _id: question._id,
        title: question.title,
        description: question.description,
        difficulty: question.difficulty,
        inputExplanation: question.inputExplanation,
        outputExplanation: question.outputExplanation,
        constraints: question.constraints,
        starterTemplates: question.starterTemplates,
        testCases: publicCases,
      };
    });

    test.questions = cleanQuestions;
    res.status(200).json(test);
  } catch (error) {
    console.error('Get student test error:', error);
    res.status(500).json({ error: 'Server error loading exam paper' });
  }
};

/**
 * Admin: Get dashboard overview statistics
 */
export const getDashboardStats = async (req, res) => {
  try {
    const adminId = req.user.id;
    const now = new Date();

    // 1. Total tests created by this admin
    const totalTests = await Test.countDocuments({ createdBy: adminId });

    // 2. Active tests (currently open)
    const activeTests = await Test.countDocuments({
      createdBy: adminId,
      startTime: { $lte: now },
      endTime: { $gte: now },
    });

    // 3. Total submissions across all tests of this admin
    const tests = await Test.find({ createdBy: adminId }).select('_id');
    const testIds = tests.map((t) => t._id);

    const totalSubmissions = await Submission.countDocuments({ test: { $in: testIds } });

    // 4. Suspicious attempts (students with >= 1 proctoring violation)
    const suspiciousCount = await ProctoringLog.countDocuments({
      test: { $in: testIds },
      events: { $exists: true, $not: { $size: 0 } },
    });

    res.status(200).json({
      totalTests,
      activeTests,
      totalSubmissions,
      suspiciousAttempts: suspiciousCount,
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Server error retrieving dashboard statistics' });
  }
};

/**
 * Admin: Delete a test and its related database entries
 */
export const deleteTest = async (req, res) => {
  try {
    const { id } = req.params;
    const test = await Test.findOneAndDelete({ _id: id, createdBy: req.user.id });

    if (!test) {
      return res.status(404).json({ error: 'Test not found or unauthorized' });
    }

    // Clean up related submissions and proctoring logs
    await Submission.deleteMany({ test: id });
    await ProctoringLog.deleteMany({ test: id });

    res.status(200).json({ message: 'Test deleted successfully' });
  } catch (error) {
    console.error('Delete test error:', error);
    res.status(500).json({ error: 'Server error deleting test' });
  }
};

/**
 * Admin: Update an existing test schedule and parameters
 */
export const updateTest = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, duration, startTime, endTime, allowedLanguages, questions, maxStrikes } = req.body;

    if (!title || !duration || !startTime || !endTime) {
      return res.status(400).json({ error: 'Title, duration, startTime, and endTime are required' });
    }

    const test = await Test.findOneAndUpdate(
      { _id: id, createdBy: req.user.id },
      {
        title,
        description,
        duration: Number(duration),
        maxStrikes: maxStrikes !== undefined ? Number(maxStrikes) : 3,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        allowedLanguages: allowedLanguages || ['python', 'java'],
        questions: questions || [],
      },
      { new: true }
    );

    if (!test) {
      return res.status(404).json({ error: 'Test not found or unauthorized' });
    }

    res.status(200).json({ message: 'Test updated successfully', test });
  } catch (error) {
    console.error('Update test error:', error);
    res.status(500).json({ error: 'Server error updating test' });
  }
};

