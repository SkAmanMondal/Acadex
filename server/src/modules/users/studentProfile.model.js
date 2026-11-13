import mongoose from 'mongoose';

const studentProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    rollNumber: {
      type: String,
      required: [true, 'Roll number is required'],
      unique: true,
      trim: true,
    },
    registrationNumber: {
      type: String,
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
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      required: true,
    },
    currentSemester: {
      type: Number,
      required: true,
      default: 1,
    },
    mentor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    guardianName: {
      type: String,
      trim: true,
    },
    guardianPhone: {
      type: String,
      trim: true,
    },
    bloodGroup: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    academicStatus: {
      type: String,
      enum: ['active', 'promoted', 'graduated', 'suspended', 'dropped'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

// High-speed compound indexes for large student cohorts & fast lookups
studentProfileSchema.index({ batch: 1, currentSemester: 1 });
studentProfileSchema.index({ department: 1, batch: 1 });
studentProfileSchema.index({ mentor: 1 });
studentProfileSchema.index({ course: 1, currentSemester: 1 });

const StudentProfile = mongoose.model('StudentProfile', studentProfileSchema);
export default StudentProfile;
