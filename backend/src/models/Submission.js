import mongoose from 'mongoose';

const submissionSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    test: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Test',
      required: true,
    },
    language: {
      type: String,
      required: true,
      enum: ['python', 'java'],
    },
    // Map of question ID (as string) to code content
    code: {
      type: Map,
      of: String,
      default: {},
    },
    // Detailed results per question
    questionResults: [
      {
        questionId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
        },
        code: {
          type: String,
          default: '',
        },
        score: {
          type: Number,
          default: 0,
        },
        passedCases: {
          type: Number,
          default: 0,
        },
        failedCases: {
          type: Number,
          default: 0,
        },
      },
    ],
    score: {
      type: Number,
      default: 0,
    },
    passedCases: {
      type: Number,
      default: 0,
    },
    failedCases: {
      type: Number,
      default: 0,
    },
    submittedType: {
      type: String,
      enum: ['NORMAL', 'TIME_EXPIRED', 'PROCTOR_AUTO_SUBMIT'],
      default: 'NORMAL',
    },
  },
  {
    timestamps: true,
  }
);

const Submission = mongoose.model('Submission', submissionSchema);
export default Submission;
