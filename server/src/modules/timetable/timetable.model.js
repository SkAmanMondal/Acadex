import mongoose from 'mongoose';

const timetableSchema = new mongoose.Schema(
  {
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      required: [true, 'Batch is required'],
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Subject is required'],
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Teacher is required'],
    },
    classroom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Classroom',
      required: [true, 'Classroom is required'],
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department is required'],
    },
    day: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      required: [true, 'Day of week is required'],
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required (e.g., 09:00)'],
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Please provide time in HH:mm format'],
    },
    endTime: {
      type: String,
      required: [true, 'End time is required (e.g., 10:00)'],
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Please provide time in HH:mm format'],
    },
    semester: {
      type: Number,
      required: true,
    },
    academicYear: {
      type: String,
      default: '2025-2026',
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

// High-speed compound indexes for matrix schedules and collision detection
timetableSchema.index({ batch: 1, day: 1, startTime: 1, isActive: 1 });
timetableSchema.index({ teacher: 1, day: 1, startTime: 1, isActive: 1 });
timetableSchema.index({ classroom: 1, day: 1, startTime: 1, isActive: 1 });
timetableSchema.index({ department: 1, semester: 1 });

// Security & Conflict Verification for Timetable Scheduling
timetableSchema.statics.checkConflict = async function ({
  teacher,
  classroom,
  batch,
  day,
  startTime,
  endTime,
  excludeId = null,
}) {
  const conflicts = [];

  // 1. Time Parameter & Format Validation
  if (!startTime || !endTime) {
    return {
      hasConflict: true,
      conflicts: [{
        aspect: 'Time Window',
        type: 'time',
        title: 'Missing Time Specifications',
        message: 'Both Start Time and End Time are required.',
      }],
      message: 'Both Start Time and End Time are required.',
    };
  }

  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
    return {
      hasConflict: true,
      conflicts: [{
        aspect: 'Time Format',
        type: 'time',
        title: 'Invalid Time Format',
        message: 'Time must be in 24-hour format HH:mm (e.g. 09:00, 14:30).',
      }],
      message: 'Time must be in 24-hour format HH:mm (e.g. 09:00, 14:30).',
    };
  }

  const [sH, sM] = startTime.split(':').map(Number);
  const [eH, eM] = endTime.split(':').map(Number);
  const startMins = sH * 60 + sM;
  const endMins = eH * 60 + eM;

  if (startMins >= endMins) {
    return {
      hasConflict: true,
      conflicts: [{
        aspect: 'Time Order',
        type: 'time',
        title: 'Invalid Time Sequence',
        message: `Start time (${startTime}) must be strictly earlier than End time (${endTime}).`,
      }],
      message: `Start time (${startTime}) must be strictly earlier than End time (${endTime}).`,
    };
  }

  const durationMins = endMins - startMins;
  if (durationMins < 30) {
    return {
      hasConflict: true,
      conflicts: [{
        aspect: 'Slot Duration',
        type: 'duration',
        title: 'Duration Too Short',
        message: `Class duration (${durationMins} minutes) is too short. Minimum duration is 30 minutes.`,
      }],
      message: `Class duration (${durationMins} minutes) is too short. Minimum duration is 30 minutes.`,
    };
  }

  if (durationMins > 240) {
    return {
      hasConflict: true,
      conflicts: [{
        aspect: 'Slot Duration',
        type: 'duration',
        title: 'Duration Too Long',
        message: `Class duration (${Math.round(durationMins / 60)} hours) exceeds the maximum allowed limit of 4 hours.`,
      }],
      message: `Class duration (${Math.round(durationMins / 60)} hours) exceeds the maximum allowed limit of 4 hours.`,
    };
  }

  if (startMins < 7 * 60 || endMins > 21 * 60) {
    return {
      hasConflict: true,
      conflicts: [{
        aspect: 'Campus Hours',
        type: 'operational_hours',
        title: 'Outside Campus Hours',
        message: `Class timing (${startTime} - ${endTime}) falls outside academic operational hours (07:00 to 21:00).`,
      }],
      message: `Class timing (${startTime} - ${endTime}) falls outside academic operational hours (07:00 to 21:00).`,
    };
  }

  if (!day) {
    return {
      hasConflict: true,
      conflicts: [{
        aspect: 'Day of Week',
        type: 'day',
        title: 'Missing Day',
        message: 'Day of week is required.',
      }],
      message: 'Day of week is required.',
    };
  }

  // 2. Overlap Query (startA < endB && endA > startB)
  const query = {
    day,
    isActive: true,
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  // 3. Parallel Database Conflict Checks: Hall/Classroom, Faculty Teacher, Batch
  const [classroomConflict, teacherConflict, batchConflict] = await Promise.all([
    classroom
      ? this.findOne({ ...query, classroom })
          .populate('subject classroom batch teacher', 'name code roomNumber type block')
          .lean()
      : null,
    teacher
      ? this.findOne({ ...query, teacher })
          .populate('subject classroom batch teacher', 'name code roomNumber email')
          .lean()
      : null,
    batch
      ? this.findOne({ ...query, batch })
          .populate('subject classroom batch teacher', 'name code roomNumber')
          .lean()
      : null,
  ]);

  // Hall / Classroom Occupancy Check
  if (classroomConflict) {
    const roomNum = classroomConflict.classroom?.roomNumber || 'Classroom / Hall';
    const roomType = classroomConflict.classroom?.type ? ` (${classroomConflict.classroom.type.replace('_', ' ')})` : '';
    const subName = classroomConflict.subject?.name || classroomConflict.subject?.code || 'another lecture';
    const bName = classroomConflict.batch?.name ? ` with ${classroomConflict.batch.name}` : '';
    conflicts.push({
      aspect: 'Hall / Classroom Occupancy',
      type: 'classroom',
      title: `Hall ${roomNum} is Occupied`,
      message: `Hall / Classroom ${roomNum}${roomType} is already booked for "${subName}"${bName} from ${classroomConflict.startTime} to ${classroomConflict.endTime} on ${day}.`,
      conflictingSlot: {
        id: classroomConflict._id,
        roomNumber: roomNum,
        subject: subName,
        time: `${classroomConflict.startTime} - ${classroomConflict.endTime}`,
        day: classroomConflict.day,
      },
    });
  }

  // Faculty Member Free Check
  if (teacherConflict) {
    const facultyName = teacherConflict.teacher?.name || 'Faculty Member';
    const subName = teacherConflict.subject?.name || teacherConflict.subject?.code || 'another lecture';
    const bName = teacherConflict.batch?.name ? ` for ${teacherConflict.batch.name}` : '';
    const roomNum = teacherConflict.classroom?.roomNumber ? ` in Room ${teacherConflict.classroom.roomNumber}` : '';
    conflicts.push({
      aspect: 'Faculty Availability',
      type: 'teacher',
      title: `Faculty Member ${facultyName} is Busy`,
      message: `Faculty member ${facultyName} is already scheduled to teach "${subName}"${bName}${roomNum} from ${teacherConflict.startTime} to ${teacherConflict.endTime} on ${day}.`,
      conflictingSlot: {
        id: teacherConflict._id,
        teacherName: facultyName,
        subject: subName,
        time: `${teacherConflict.startTime} - ${teacherConflict.endTime}`,
        day: teacherConflict.day,
      },
    });
  }

  // Student Batch Double-Booking Check
  if (batchConflict) {
    const bName = batchConflict.batch?.name || 'Selected Cohort';
    const subName = batchConflict.subject?.name || batchConflict.subject?.code || 'another lecture';
    const facultyName = batchConflict.teacher?.name ? ` with ${batchConflict.teacher.name}` : '';
    const roomNum = batchConflict.classroom?.roomNumber ? ` in Room ${batchConflict.classroom.roomNumber}` : '';
    conflicts.push({
      aspect: 'Student Batch Schedule',
      type: 'batch',
      title: `Batch ${bName} is Double-Booked`,
      message: `Student batch "${bName}" is already scheduled to attend "${subName}"${facultyName}${roomNum} from ${batchConflict.startTime} to ${batchConflict.endTime} on ${day}.`,
      conflictingSlot: {
        id: batchConflict._id,
        batchName: bName,
        subject: subName,
        time: `${batchConflict.startTime} - ${batchConflict.endTime}`,
        day: batchConflict.day,
      },
    });
  }

  if (conflicts.length > 0) {
    return {
      hasConflict: true,
      conflicts,
      message: conflicts.map((c) => c.message).join(' • '),
    };
  }

  return {
    hasConflict: false,
    conflicts: [],
    message: 'All security checks passed: Hall, Faculty, Batch, and Time Window are completely free.',
  };
};

const Timetable = mongoose.model('Timetable', timetableSchema);
export default Timetable;
