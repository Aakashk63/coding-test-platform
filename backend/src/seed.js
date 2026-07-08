import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from './models/User.js';
import Test from './models/Test.js';
import Submission from './models/Submission.js';
import ProctoringLog from './models/ProctoringLog.js';

dotenv.config();

const seed = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI env variable is not defined.');
    }
    console.log(`Connecting to database...`);
    await mongoose.connect(mongoUri);
    console.log('📡 Connected to MongoDB Atlas');

    // 1. Clear existing collections
    console.log('Clearing existing data from collections (users, tests, submissions, proctoring)...');
    await User.deleteMany({});
    await Test.deleteMany({});
    await Submission.deleteMany({});
    await ProctoringLog.deleteMany({});
    console.log('✅ Cleared previous database data successfully.');

    // 2. Create seed users
    const salt = await bcrypt.genSalt(10);
    const adminPasswordHash = await bcrypt.hash('123', salt);
    const studentPasswordHash = await bcrypt.hash('123', salt);

    const admin = new User({
      name: 'Admin User',
      email: 'admin@gmail.com',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
    });

    const student = new User({
      name: 'Student User',
      email: 'student@gmail.com',
      passwordHash: studentPasswordHash,
      role: 'STUDENT',
    });

    await admin.save();
    await student.save();
    console.log('✅ Created admin account: admin@gmail.com / 123');
    console.log('✅ Created student account: student@gmail.com / 123');

    console.log('🎉 Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seed();
