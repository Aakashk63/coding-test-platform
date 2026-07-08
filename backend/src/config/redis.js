import dotenv from 'dotenv';
import Redis from 'ioredis';
import { Queue as BullQueue, Worker as BullWorker } from 'bullmq';
import { EventEmitter } from 'events';

dotenv.config();

const useRedis = process.env.USE_REDIS === 'true';
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

let redisClient;
let Queue;
let Worker;

// Custom Mock Redis Implementation for local development fallback
class MockRedis {
  constructor() {
    this.store = {};
    console.log('⚡ CodeGuard DB: Using local in-memory cache fallback.');
  }

  async get(key) {
    return this.store[key] || null;
  }

  async set(key, value, mode, duration) {
    this.store[key] = String(value);
    if (mode === 'EX' && duration) {
      setTimeout(() => {
        delete this.store[key];
      }, duration * 1000);
    } else if (mode === 'PX' && duration) {
      setTimeout(() => {
        delete this.store[key];
      }, duration);
    }
    return 'OK';
  }

  async del(key) {
    const exists = key in this.store;
    delete this.store[key];
    return exists ? 1 : 0;
  }

  async incr(key) {
    const current = parseInt(this.store[key] || '0', 10);
    const updated = current + 1;
    this.store[key] = String(updated);
    return updated;
  }

  async keys(pattern) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Object.keys(this.store).filter((k) => regex.test(k));
  }
}

// Custom Mock Queue/Worker implementation matching BullMQ programming API
const mockEmitter = new EventEmitter();

class MockQueue {
  constructor(name) {
    this.name = name;
    console.log(`⚡ CodeGuard Queue: Initialized mock queue [${name}]`);
  }

  async add(jobName, data) {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const job = {
      id: jobId,
      name: jobName,
      data,
      timestamp: Date.now(),
      updateProgress: async (value) => {
        job.progress = value;
      },
    };
    // Defer execution slightly to mimic background process
    setImmediate(() => {
      mockEmitter.emit(`job:${this.name}`, job);
    });
    return job;
  }
}

class MockWorker {
  constructor(name, processor) {
    this.name = name;
    this.processor = processor;
    this.active = true;

    this.handler = async (job) => {
      if (!this.active) return;
      try {
        await this.processor(job);
      } catch (err) {
        console.error(`Error in mock worker processing job ${job.id}:`, err);
      }
    };

    mockEmitter.on(`job:${name}`, this.handler);
    console.log(`⚡ CodeGuard Queue: Initialized mock worker for [${name}]`);
  }

  async close() {
    this.active = false;
    mockEmitter.off(`job:${this.name}`, this.handler);
  }
}

if (useRedis) {
  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      showFriendlyErrorStack: true,
    });

    redisClient.on('error', (err) => {
      console.warn('⚠️ Redis connection error. Falling back to Mock Redis.', err.message);
      redisClient = new MockRedis();
      Queue = MockQueue;
      Worker = MockWorker;
    });

    Queue = class extends BullQueue {
      constructor(name) {
        super(name, { connection: redisClient });
      }
    };

    Worker = class extends BullWorker {
      constructor(name, processor) {
        super(name, processor, { connection: redisClient });
      }
    };

    console.log('📡 Redis Client and BullMQ connected successfully.');
  } catch (error) {
    console.error('Failed to initialize Redis client. Falling back to Mock.', error);
    redisClient = new MockRedis();
    Queue = MockQueue;
    Worker = MockWorker;
  }
} else {
  redisClient = new MockRedis();
  Queue = MockQueue;
  Worker = MockWorker;
}

export { redisClient, Queue, Worker };
