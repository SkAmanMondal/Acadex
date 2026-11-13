import mongoose from 'mongoose';

const dailyClassSchema = new mongoose.Schema(
  {
    date: {
      type: String, // Normalized YYYY-MM-DD format (e.g. '2026-11-12')
      required: [true, 'Date string in YYYY-MM-DD format is required'],
      index: true,
    },
    timetable: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Timetable',
      required: true,
      index: true,
    },
    day: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      required: true,
    },
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      required: true,
      index: true,
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
      index: true,
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
      index: true,
    },
    // The master faculty member assigned on the weekly base schedule
    originalTeacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // The faculty member actually taking the class today (may be substitute)
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Substitution tracking
    isSubstituted: {
      type: Boolean,
      default: false,
    },
    substitutionReason: {
      type: String,
      default: null,
    },
    substitutedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    substitutedAt: {
      type: Date,
      default: null,
    },
    // Timing & Semester
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    semester: {
      type: Number,
      required: true,
    },
    // Operational Class Status:
    // 'scheduled' -> Active normal class scheduled for today
    // 'paused'    -> Class paused / not held today ("grey kind of" in UI)
    // 'in_progress' -> Live QR attendance currently open
    // 'completed' -> Class conducted & finalized
    status: {
      type: String,
      enum: ['scheduled', 'paused', 'in_progress', 'completed'],
      default: 'scheduled',
      index: true,
    },
    pauseReason: {
      type: String,
      default: null,
    },
    pausedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    pausedAt: {
      type: Date,
      default: null,
    },
    // Linked live attendance session
    attendanceSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AttendanceSession',
      default: null,
    },
    // Summary attendance statistics for historical inspection
    attendanceStats: {
      totalStudents: { type: Number, default: 0 },
      presentCount: { type: Number, default: 0 },
      absentCount: { type: Number, default: 0 },
      presentPercentage: { type: Number, default: 0 },
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// High-speed compound indexes for daily scheduling queries
dailyClassSchema.index({ date: 1, department: 1, status: 1 });
dailyClassSchema.index({ date: 1, batch: 1 });
dailyClassSchema.index({ date: 1, teacher: 1 });
dailyClassSchema.index({ date: 1, timetable: 1 }, { unique: true });

const DailyClass = mongoose.model('DailyClass', dailyClassSchema);
export default DailyClass;
