import mongoose from 'mongoose';

const examinationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Examination title is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['internal', 'semester'],
      required: true,
    },
    academicYear: {
      type: String,
      required: true,
      default: '2025-2026',
    },
    semester: {
      type: Number,
      required: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Examination = mongoose.model('Examination', examinationSchema);
export default Examination;
