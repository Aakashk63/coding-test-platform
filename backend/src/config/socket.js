import { Server } from 'socket.io';

let io = null;
const activeSockets = new Map(); // userId -> socketId
const examSessions = new Map(); // testId:userId -> socketId

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Join room for a specific test (for admins to monitor, or students to receive timer updates)
    socket.on('join_test_room', ({ testId, role, userId, name, email }) => {
      const roomName = `test_${testId}`;
      socket.join(roomName);
      console.log(`🔌 User [${userId}] (${name}) joined room [${roomName}] as [${role}]`);

      if (role === 'STUDENT') {
        examSessions.set(`${testId}:${userId}`, {
          socketId: socket.id,
          name: name || 'Student User',
          email: email || '',
          joinedAt: new Date()
        });
        activeSockets.set(userId, socket.id);

        // Notify admins in the room
        socket.to(roomName).emit('student_joined', {
          userId,
          name,
          email,
          socketId: socket.id,
          timestamp: new Date(),
        });
      } else if (role === 'ADMIN') {
        // Collect currently active students in this room
        const activeStudentsList = [];
        for (const [key, session] of examSessions.entries()) {
          const [sTestId, sUserId] = key.split(':');
          if (sTestId === testId && session) {
            activeStudentsList.push({
              userId: sUserId,
              name: session.name,
              email: session.email,
              joinedAt: session.joinedAt
            });
          }
        }
        socket.emit('active_students', { students: activeStudentsList });
      }
    });

    // Handle student reporting proctoring violation event
    socket.on('report_violation', ({ testId, userId, eventType, proof, name, email }) => {
      const roomName = `test_${testId}`;
      console.log(`⚠️ Violation [${eventType}] by student ${userId} (${name}) in test ${testId}`);

      // Broadcast the violation details to admin monitors in the test room
      socket.to(roomName).emit('student_violation', {
        userId,
        eventType,
        proof,
        name,
        email,
        timestamp: new Date(),
      });
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
      
      // Clean up maps
      for (const [key, session] of examSessions.entries()) {
        if (session && session.socketId === socket.id) {
          const [testId, userId] = key.split(':');
          examSessions.delete(key);
          socket.to(`test_${testId}`).emit('student_left', { userId });
          break;
        }
      }
      for (const [key, value] of activeSockets.entries()) {
        if (value === socket.id) {
          activeSockets.delete(key);
          break;
        }
      }
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io has not been initialized.');
  }
  return io;
};

export const getSocketIdByUserId = (userId) => {
  return activeSockets.get(userId);
};

export const getSocketIdByExamSession = (testId, userId) => {
  const session = examSessions.get(`${testId}:${userId}`);
  return session ? session.socketId : undefined;
};
