import mongoose from 'mongoose';

const proctoringLogSchema = new mongoose.Schema(
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
    events: [
      {
        eventType: {
          type: String,
          enum: [
            'TAB_SWITCH',
            'WINDOW_BLUR',
            'NO_FACE',
            'MULTIPLE_FACES',
            'PHONE_DETECTED',
            'AUTO_SUBMITTED',
          ],
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        proof: {
          type: String,
          default: '',
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const ProctoringLog = mongoose.model('ProctoringLog', proctoringLogSchema);
export default ProctoringLog;
