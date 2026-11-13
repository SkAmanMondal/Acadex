import mongoose from 'mongoose';

const attendanceSessionSchema = new mongoose.Schema(
  {
    sessionCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    timetable: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Timetable',
      required: true,
    },
    dailyClass: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DailyClass',
      default: null,
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
    },
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      required: true,
    },
    classroom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Classroom',
      required: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    activatedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    durationMinutes: {
      type: Number,
      default: 10,
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'finalized', 'cancelled', 'expired'],
      default: 'pending',
    },
    endedByTeacher: {
      type: Boolean,
      default: false,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    totalScanned: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// High-speed compound indexes for session lookups and reporting
attendanceSessionSchema.index({ batch: 1, date: -1 });
attendanceSessionSchema.index({ teacher: 1, date: -1 });
attendanceSessionSchema.index({ department: 1, date: -1 });
attendanceSessionSchema.index({ status: 1 });

// Method to verify if session is currently active
attendanceSessionSchema.methods.isOpen = function () {
  return this.status === 'active' && Boolean(this.expiresAt) && new Date() < this.expiresAt;
};

// Method to verify if session is pending podium activation
attendanceSessionSchema.methods.isPending = function () {
  return this.status === 'pending';
};

const AttendanceSession = mongoose.model('AttendanceSession', attendanceSessionSchema);
export default AttendanceSession;
