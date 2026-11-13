import mongoose from 'mongoose';

const supportRequestSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    mentor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    category: {
      type: String,
      enum: ['subject_difficulty', 'attendance_concern', 'exam_preparation', 'personal_guidance', 'other'],
      required: true,
      default: 'subject_difficulty',
    },
    subject: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      required: [true, 'Please explain your concern'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['submitted', 'in_review', 'responded', 'resolved'],
      default: 'submitted',
    },
    mentorNotes: {
      type: String,
      default: '',
    },
    sessionDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const SupportRequest = mongoose.model('SupportRequest', supportRequestSchema);
export default SupportRequest;
