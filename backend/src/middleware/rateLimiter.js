import { redisClient } from '../config/redis.js';

export const codeExecutionLimiter = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Admin users are exempt from rate limiting
  if (req.user.role === 'ADMIN') {
    return next();
  }

  const userId = req.user.id;
  const rateLimitKey = `run:${userId}`;

  try {
    const isLocked = await redisClient.get(rateLimitKey);
    if (isLocked) {
      return res.status(429).json({
        error: 'Too many requests. Please wait 5 seconds before running code again.',
      });
    }

    // Set lock for 5 seconds
    await redisClient.set(rateLimitKey, 'locked', 'EX', 5);
    next();
  } catch (error) {
    console.error('Rate limiter error:', error);
    // On error, let the request proceed so the application is resilient
    next();
  }
};
