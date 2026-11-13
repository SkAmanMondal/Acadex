import mongoose from 'mongoose';

const subjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Subject name is required'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Subject code is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    semester: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
    },
    credits: {
      type: Number,
      required: true,
      default: 4,
    },
    type: {
      type: String,
      enum: ['theory', 'practical', 'elective'],
      default: 'theory',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// High-speed compound indexes for curriculum semester-by-semester queries
subjectSchema.index({ department: 1, course: 1, semester: 1 });
subjectSchema.index({ course: 1, semester: 1 });

const Subject = mongoose.model('Subject', subjectSchema);
export default Subject;
