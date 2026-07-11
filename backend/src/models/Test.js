import mongoose from 'mongoose';

const testCaseSchema = new mongoose.Schema({
  input: {
    type: String,
    default: '',
  },
  expectedOutput: {
    type: String,
    required: true,
  },
  hidden: {
    type: Boolean,
    default: false,
  },
  weightage: {
    type: Number,
    default: 10,
  },
});

const questionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },
  difficulty: {
    type: String,
    enum: ['Easy', 'Medium', 'Hard'],
    default: 'Easy',
  },
  inputExplanation: {
    type: String,
    default: '',
  },
  outputExplanation: {
    type: String,
    default: '',
  },
  constraints: {
    type: String,
    default: '',
  },
  starterTemplates: {
    python: {
      type: String,
      default: '',
    },
    java: {
      type: String,
      default: '',
    },
    python_driver: {
      type: String,
      default: '',
    },
    java_driver: {
      type: String,
      default: '',
    },
  },
  testCases: [testCaseSchema],
});

const testSchema = new mongoose.Schema(
  {
    testId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    duration: {
      type: Number, // in minutes
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    allowedLanguages: {
      type: [String],
      enum: ['python', 'java'],
      default: ['python', 'java'],
    },
    questions: [questionSchema],
    maxStrikes: {
      type: Number,
      default: 3,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Test = mongoose.model('Test', testSchema);
export default Test;
