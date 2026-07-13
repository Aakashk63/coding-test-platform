import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import connectDB from './config/db.js';
import { initSocket } from './config/socket.js';
import { initExecutionWorker } from './workers/executionWorker.js';

// Route Imports
import authRoutes from './routes/authRoutes.js';
import testRoutes from './routes/testRoutes.js';
import submissionRoutes from './routes/submissionRoutes.js';
import proctorRoutes from './routes/proctorRoutes.js';
import reportRoutes from './routes/reportRoutes.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Connect Database
connectDB();

// Middlewares
app.use(helmet({
  contentSecurityPolicy: false, // Turn off CSP so frontend can fetch CDN files if needed
}));
app.use(cors({
  origin: '*', // In production, replace with specific frontend URL
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' })); // Support base64 image proof sizes
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/', (req, res) => {
  res.status(200).send("Server is running");
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'codeguard-backend-api' });
});

// Register API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/proctor', proctorRoutes);
app.use('/api/reports', reportRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Initialize Socket.io
initSocket(server);

// Start Queue Workers
const executionWorker = initExecutionWorker();

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 CodeGuard Server running on port ${PORT}`);
});

// Graceful Shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(async () => {
    console.log('HTTP server closed');
    await executionWorker.close();
    process.exit(0);
  });
});
