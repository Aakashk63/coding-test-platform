import ProctoringLog from '../models/ProctoringLog.js';
import Submission from '../models/Submission.js';
import Test from '../models/Test.js';
import { redisClient, Queue } from '../config/redis.js';
import { getIO, getSocketIdByUserId } from '../config/socket.js';

/**
 * Record a student proctoring violation strike
 */
export const recordViolation = async (req, res) => {
  try {
    const { testId, eventType, proof, code } = req.body;
    const userId = req.user.id;

    if (!testId || !eventType) {
      return res.status(400).json({ error: 'Test ID and event type are required' });
    }

    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    // 1. Increment strike in Redis/Cache
    const redisKey = `strike:${testId}:${userId}`;
    const strikes = await redisClient.incr(redisKey);

    // Set TTL on Redis strike key for safety (e.g. duration of test + 1 hour)
    await redisClient.set(redisKey, strikes, 'EX', (test.duration * 60) + 3600);

    // 2. Log in MongoDB ProctoringLog
    let log = await ProctoringLog.findOne({ student: userId, test: testId });
    if (!log) {
      log = new ProctoringLog({
        student: userId,
        test: testId,
        events: [],
      });
    }

    log.events.push({
      eventType,
      timestamp: new Date(),
      proof: proof || '',
    });

    await log.save();

    const io = getIO();
    const studentSocketId = getSocketIdByUserId(userId);
    const roomName = `test_${testId}`;

    // 3. Emit real-time violation event to admin monitors
    io.to(roomName).emit('student_violation', {
      userId,
      name: req.user.name,
      email: req.user.email,
      eventType,
      proof,
      strikes,
      timestamp: new Date(),
    });

    // 4. Auto-submission rule: dynamic strikes limit
    const STRIKE_LIMIT = test.maxStrikes !== undefined ? Number(test.maxStrikes) : 3;
    if (strikes >= STRIKE_LIMIT) {
      console.log(`🚨 Student ${userId} reached violation limit (${strikes}/${STRIKE_LIMIT}). Auto-submitting exam.`);

      // Log the auto submit event
      log.events.push({
        eventType: 'AUTO_SUBMITTED',
        timestamp: new Date(),
        proof: `System: Auto-submitted due to ${STRIKE_LIMIT} violation strikes.`,
      });
      await log.save();

      // Trigger socket event to lock student interface immediately
      if (studentSocketId) {
        io.to(studentSocketId).emit('force_auto_submit', {
          reason: 'PROCTOR_AUTO_SUBMIT',
          message: `Your exam has been automatically submitted due to reaching the limit of ${STRIKE_LIMIT} proctoring violations.`,
        });
      }

      // Add exam submission task to the code queue
      const codeQueue = new Queue('code_queue');
      await codeQueue.add('grade_exam', {
        type: 'SUBMIT_EXAM',
        userId,
        testId,
        language: 'python', // Fallback defaults, submission will read current state
        code: code || {}, // Final state of student code
        submittedType: 'PROCTOR_AUTO_SUBMIT',
      });
    }

    res.status(200).json({
      message: 'Violation recorded successfully',
      strikes,
      autoSubmitted: strikes >= STRIKE_LIMIT,
    });
  } catch (error) {
    console.error('Record violation error:', error);
    res.status(500).json({ error: 'Server error recording violation' });
  }
};

/**
 * Get proctoring log details of a student
 */
export const getStudentProctoringLogs = async (req, res) => {
  try {
    const { testId, studentId } = req.params;
    const log = await ProctoringLog.findOne({ test: testId, student: studentId })
      .populate('student', 'name email')
      .populate('test', 'title');

    if (!log) {
      return res.status(200).json({ events: [] });
    }

    res.status(200).json(log);
  } catch (error) {
    console.error('Get student proctoring logs error:', error);
    res.status(500).json({ error: 'Server error retrieving proctoring logs' });
  }
};
