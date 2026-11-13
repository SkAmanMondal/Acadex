import DailyClass from './dailyClass.model.js';
import Timetable from './timetable.model.js';
import User from '../users/user.model.js';
import Batch from '../academics/batch.model.js';
import StudentProfile from '../users/studentProfile.model.js';
import AttendanceSession from '../attendance/attendanceSession.model.js';
import AttendanceRecord from '../attendance/attendanceRecord.model.js';
import Notification from '../notifications/notification.model.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { broadcastEvent, emitToUser } from '../../config/socket.js';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Format Date object into YYYY-MM-DD
 */
export const formatDateToYMD = (dateObj = new Date()) => {
  const d = new Date(dateObj);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Helper to ensure DailyClass instances exist for a given date
 * Materializes them from the master weekly Timetable if not already generated.
 */
export const ensureDailyClassesForDate = async (dateStr, departmentId = null) => {
  if (!dateStr) dateStr = formatDateToYMD(new Date());

  const todayStr = formatDateToYMD(new Date());
  // Strictly prevent auto-materialization of future daily classes before 7:00 AM on that day
  if (dateStr > todayStr) {
    return [];
  }

  // Determine the day of week for this date string
  const dateObj = new Date(`${dateStr}T12:00:00Z`);
  const dayName = DAYS_OF_WEEK[dateObj.getUTCDay()];

  // Sunday is usually off, but handle gracefully
  if (dayName === 'Sunday') {
    return [];
  }

  // Check if master timetable slots exist for this day
  const timetableFilter = { day: dayName, isActive: true };
  if (departmentId) timetableFilter.department = departmentId;

  const masterSlots = await Timetable.find(timetableFilter).lean();
  if (masterSlots.length === 0) {
    return [];
  }

  // Find existing daily classes for this date
  const existingDaily = await DailyClass.find({ date: dateStr }).select('timetable').lean();
  const existingTimetableIds = new Set(existingDaily.map((d) => d.timetable.toString()));

  // Identify any slots that have not been instantiated yet for this date
  const missingSlots = masterSlots.filter((slot) => !existingTimetableIds.has(slot._id.toString()));

  if (missingSlots.length > 0) {
    const docsToInsert = missingSlots.map((slot) => ({
      date: dateStr,
      timetable: slot._id,
      day: dayName,
      batch: slot.batch,
      subject: slot.subject,
      classroom: slot.classroom,
      department: slot.department,
      originalTeacher: slot.teacher,
      teacher: slot.teacher,
      isSubstituted: false,
      substitutionReason: null,
      startTime: slot.startTime,
      endTime: slot.endTime,
      semester: slot.semester || 1,
      status: 'scheduled',
      notes: '',
    }));

    try {
      await DailyClass.insertMany(docsToInsert, { ordered: false });
    } catch (bulkErr) {
      // Ignore duplicate key conflicts if concurrent requests ran
      if (bulkErr.code !== 11000) {
        console.error('Error auto-materializing daily classes:', bulkErr.message);
      }
    }
  }

  return masterSlots;
};

/**
 * GET /api/timetable/daily-classes
 * Retrieves daily classes for any date with role-based scoping
 */
export const getDailyClasses = async (req, res) => {
  try {
    const targetDate = req.query.date || formatDateToYMD(new Date());
    const todayStr = formatDateToYMD(new Date());
    const userRole = req.user.role;
    const userDept = (req.user.department?._id || req.user.department)?.toString();

    // Prevent viewing future dates in daily classes view - daily classes lock at 7:00 AM on day of class
    if (targetDate > todayStr) {
      return sendSuccess(
        res,
        `Daily classes for ${targetDate} are locked until 7:00 AM on that day. Future daily classes cannot be accessed early. You can review past days or today's live schedule.`,
        []
      );
    }

    // Materialize daily class instances if they haven't been created yet
    await ensureDailyClassesForDate(targetDate, ['hod', 'teacher'].includes(userRole) ? userDept : null);

    const filter = { date: targetDate };

    // Role-based scoping
    if (userRole === 'student') {
      const studentProfile = await StudentProfile.findOne({ user: req.user._id }).lean();
      if (!studentProfile || !studentProfile.batch) {
        return sendSuccess(res, 'No enrolled batch found for student', []);
      }
      filter.batch = studentProfile.batch;
    } else if (userRole === 'teacher') {
      // Teachers see their assigned or substituted classes
      filter.$or = [{ teacher: req.user._id }, { originalTeacher: req.user._id }];
    } else if (userRole === 'hod') {
      // HODs see ALL classes for their department for the day
      filter.department = userDept;
      if (req.query.batch) filter.batch = req.query.batch;
      if (req.query.teacher) filter.teacher = req.query.teacher;
    } else {
      // Admin (college_admin / super_admin)
      if (req.query.department && req.query.department !== 'all') {
        filter.department = req.query.department;
      }
      if (req.query.batch && req.query.batch !== 'all') {
        filter.batch = req.query.batch;
      }
      if (req.query.teacher && req.query.teacher !== 'all') {
        filter.teacher = req.query.teacher;
      }
    }

    if (req.query.status && req.query.status !== 'all') {
      filter.status = req.query.status;
    }

    const classes = await DailyClass.find(filter)
      .populate('batch', 'name currentSemester startYear endYear')
      .populate('subject', 'name code credits type')
      .populate('classroom', 'roomNumber block capacity type')
      .populate('teacher', 'name email phone avatar role')
      .populate('originalTeacher', 'name email role')
      .populate('substitutedBy pausedBy', 'name role')
      .populate('department', 'name code')
      .populate({
        path: 'attendanceSession',
        select: 'sessionCode status totalScanned expiresAt durationMinutes',
      })
      .sort({ startTime: 1 })
      .lean();

    return sendSuccess(res, `Daily classes for ${targetDate} retrieved successfully`, classes);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

/**
 * PATCH /api/timetable/daily-classes/:id/pause
 * Pause or resume a specific daily class (turned grey in UI)
 */
export const pauseDailyClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { isPaused, reason } = req.body;

    const dailyClass = await DailyClass.findById(id)
      .populate('subject batch teacher department classroom')
      .populate('originalTeacher', 'name email');

    if (!dailyClass) {
      return sendError(res, 'Daily class slot not found', 404);
    }

    // Role check: Admin or Department HOD
    const isElevated = ['college_admin', 'super_admin'].includes(req.user.role);
    const userDept = (req.user.department?._id || req.user.department)?.toString();
    const classDept = (dailyClass.department?._id || dailyClass.department)?.toString();
    const isDeptHod = req.user.role === 'hod' && userDept === classDept;

    if (!isElevated && !isDeptHod) {
      return sendError(res, 'Access denied: Only Admins or Department HODs can pause scheduled classes', 403);
    }

    if (isPaused) {
      dailyClass.status = 'paused';
      dailyClass.pauseReason = reason || 'Class paused by administration for today';
      dailyClass.pausedBy = req.user._id;
      dailyClass.pausedAt = new Date();
    } else {
      dailyClass.status = 'scheduled';
      dailyClass.pauseReason = null;
      dailyClass.pausedBy = null;
      dailyClass.pausedAt = null;
    }

    await dailyClass.save();

    // Broadcast update so every student & teacher UI updates immediately
    const updatePayload = {
      dailyClassId: dailyClass._id,
      date: dailyClass.date,
      status: dailyClass.status,
      pauseReason: dailyClass.pauseReason,
      pausedBy: req.user.name,
      batchId: dailyClass.batch?._id,
      subjectName: dailyClass.subject?.name,
      startTime: dailyClass.startTime,
      endTime: dailyClass.endTime,
    };

    broadcastEvent('daily_class_updated', updatePayload);
    broadcastEvent('timetable_updated', updatePayload);

    // Dispatch institutional notification to enrolled students
    try {
      const studentProfiles = await StudentProfile.find({ batch: dailyClass.batch?._id }).select('user').lean();
      const studentUserIds = studentProfiles.map((sp) => sp.user);

      if (studentUserIds.length > 0) {
        const notifDocs = studentUserIds.map((stId) => ({
          user: stId,
          title: isPaused
            ? `Class Paused: ${dailyClass.subject?.name} (${dailyClass.startTime})`
            : `Class Resumed: ${dailyClass.subject?.name}`,
          message: isPaused
            ? `Today's ${dailyClass.subject?.name} class at ${dailyClass.startTime} has been paused: ${dailyClass.pauseReason}.`
            : `Today's ${dailyClass.subject?.name} class at ${dailyClass.startTime} is now active as scheduled.`,
          type: 'timetable',
          priority: isPaused ? 'high' : 'normal',
          link: '/timetables',
        }));
        await Notification.insertMany(notifDocs);
      }
    } catch (notifErr) {
      console.error('Failed to notify students of class pause:', notifErr.message);
    }

    return sendSuccess(
      res,
      isPaused
        ? `Class paused for today. Displayed in grey with reason: "${dailyClass.pauseReason}"`
        : 'Class resumed successfully as active schedule',
      dailyClass
    );
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

/**
 * PATCH /api/timetable/daily-classes/:id/substitute
 * Assign a substitute faculty member for a specific class instance
 */
export const substituteFaculty = async (req, res) => {
  try {
    const { id } = req.params;
    const { substituteTeacherId, reason } = req.body;

    if (!substituteTeacherId) {
      return sendError(res, 'Please select a substitute faculty member', 400);
    }

    const dailyClass = await DailyClass.findById(id)
      .populate('subject batch teacher department classroom')
      .populate('originalTeacher', 'name email');

    if (!dailyClass) {
      return sendError(res, 'Daily class slot not found', 404);
    }

    // Role check: Admin or Department HOD
    const isElevated = ['college_admin', 'super_admin'].includes(req.user.role);
    const userDept = (req.user.department?._id || req.user.department)?.toString();
    const classDept = (dailyClass.department?._id || dailyClass.department)?.toString();
    const isDeptHod = req.user.role === 'hod' && userDept === classDept;

    if (!isElevated && !isDeptHod) {
      return sendError(res, 'Access denied: Only Admins or Department HODs can assign substitute faculty', 403);
    }

    // Verify substitute teacher
    const substituteUser = await User.findById(substituteTeacherId).select('name email role');
    if (!substituteUser || !['teacher', 'hod'].includes(substituteUser.role)) {
      return sendError(res, 'Substitute must be an active Teacher or HOD', 400);
    }

    dailyClass.teacher = substituteUser._id;
    dailyClass.isSubstituted = true;
    dailyClass.substitutionReason = reason || `Substitute assigned by ${req.user.name}`;
    dailyClass.substitutedBy = req.user._id;
    dailyClass.substitutedAt = new Date();

    // If it was previously paused due to teacher absence, unpause it
    if (dailyClass.status === 'paused') {
      dailyClass.status = 'scheduled';
      dailyClass.pauseReason = null;
    }

    await dailyClass.save();

    const populated = await DailyClass.findById(id)
      .populate('batch subject classroom teacher originalTeacher department substitutedBy')
      .lean();

    const updatePayload = {
      dailyClassId: dailyClass._id,
      date: dailyClass.date,
      teacher: substituteUser.name,
      originalTeacher: dailyClass.originalTeacher?.name,
      isSubstituted: true,
      substitutionReason: dailyClass.substitutionReason,
      batchId: dailyClass.batch?._id,
      subjectName: dailyClass.subject?.name,
      startTime: dailyClass.startTime,
    };

    broadcastEvent('daily_class_updated', updatePayload);
    broadcastEvent('timetable_updated', updatePayload);

    // Notify substitute faculty
    try {
      await Notification.create({
        user: substituteUser._id,
        title: `Substitute Class Assignment: ${dailyClass.subject?.name}`,
        message: `You have been designated to take ${dailyClass.subject?.name} (${dailyClass.batch?.name}) on ${dailyClass.date} at ${dailyClass.startTime} in Room ${dailyClass.classroom?.roomNumber}.`,
        type: 'timetable',
        priority: 'high',
        link: '/timetables',
      });

      // Notify batch students
      const studentProfiles = await StudentProfile.find({ batch: dailyClass.batch?._id }).select('user').lean();
      const studentUserIds = studentProfiles.map((sp) => sp.user);

      if (studentUserIds.length > 0) {
        const notifDocs = studentUserIds.map((stId) => ({
          user: stId,
          title: `Faculty Update: ${dailyClass.subject?.name} (${dailyClass.startTime})`,
          message: `Today's ${dailyClass.subject?.name} class at ${dailyClass.startTime} will be conducted by Prof. ${substituteUser.name} (Substitute).`,
          type: 'timetable',
          priority: 'normal',
          link: '/timetables',
        }));
        await Notification.insertMany(notifDocs);
      }
    } catch (notifErr) {
      console.error('Failed to notify substitute assignment:', notifErr.message);
    }

    return sendSuccess(
      res,
      `Substitute faculty assigned: Prof. ${substituteUser.name} will conduct today's class.`,
      populated
    );
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

/**
 * POST /api/timetable/daily-classes/substitute-day
 * Bulk action for an absent teacher across all their classes for a given day
 */
export const substituteFacultyForDay = async (req, res) => {
  try {
    const { absentTeacherId, substituteTeacherId, date, reason, action = 'substitute' } = req.body;
    const targetDate = date || formatDateToYMD(new Date());

    if (!absentTeacherId) {
      return sendError(res, 'Please provide the absent teacher ID', 400);
    }

    // Role check: Admin or HOD
    const isElevated = ['college_admin', 'super_admin'].includes(req.user.role);
    const isHod = req.user.role === 'hod';
    if (!isElevated && !isHod) {
      return sendError(res, 'Only Administrators or HODs can manage day-wide faculty substitutions', 403);
    }

    // Materialize classes first
    await ensureDailyClassesForDate(targetDate);

    const absentUser = await User.findById(absentTeacherId).select('name email role');
    if (!absentUser) return sendError(res, 'Absent faculty not found', 404);

    const filter = {
      date: targetDate,
      $or: [{ teacher: absentTeacherId }, { originalTeacher: absentTeacherId }],
    };

    if (isHod) {
      filter.department = req.user.department?._id || req.user.department;
    }

    const classesToUpdate = await DailyClass.find(filter);
    if (classesToUpdate.length === 0) {
      return sendSuccess(res, `No scheduled classes found for ${absentUser.name} on ${targetDate}.`, []);
    }

    if (action === 'pause_all') {
      // Pause all classes for this absent faculty
      await DailyClass.updateMany(filter, {
        status: 'paused',
        pauseReason: reason || `Instructor ${absentUser.name} absent for the day`,
        pausedBy: req.user._id,
        pausedAt: new Date(),
      });

      broadcastEvent('daily_class_updated', { date: targetDate, action: 'pause_all', absentTeacher: absentUser.name });
      return sendSuccess(res, `Paused all ${classesToUpdate.length} class(es) for ${absentUser.name} on ${targetDate}.`);
    } else {
      // Substitute all classes
      if (!substituteTeacherId) {
        return sendError(res, 'Please provide a substitute teacher ID', 400);
      }
      const substituteUser = await User.findById(substituteTeacherId).select('name email role');
      if (!substituteUser) return sendError(res, 'Substitute teacher not found', 404);

      await DailyClass.updateMany(filter, {
        teacher: substituteTeacherId,
        isSubstituted: true,
        substitutionReason: reason || `Substitute designated for absent instructor ${absentUser.name}`,
        substitutedBy: req.user._id,
        substitutedAt: new Date(),
        status: 'scheduled',
        pauseReason: null,
      });

      broadcastEvent('daily_class_updated', {
        date: targetDate,
        action: 'substitute_all',
        absentTeacher: absentUser.name,
        substituteTeacher: substituteUser.name,
      });

      return sendSuccess(
        res,
        `Assigned ${substituteUser.name} as substitute for all ${classesToUpdate.length} class(es) of ${absentUser.name} on ${targetDate}.`
      );
    }
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

/**
 * GET /api/timetable/daily-classes/:id/absentees
 * Inspect exact attendance and missed students for a specific class instance
 */
export const getClassAbsentees = async (req, res) => {
  try {
    if (req.user?.role === 'student') {
      return sendError(res, 'Access denied: Students cannot view class attendance rosters', 403);
    }

    const { id } = req.params;
    const dailyClass = await DailyClass.findById(id)
      .populate('batch subject classroom teacher originalTeacher department attendanceSession')
      .lean();

    if (!dailyClass) {
      return sendError(res, 'Daily class slot not found', 404);
    }

    // Find all students currently enrolled in this batch
    const studentProfiles = await StudentProfile.find({ batch: dailyClass.batch?._id })
      .populate('user', 'name email phone avatar')
      .lean();

    const enrolledStudents = studentProfiles.map((sp) => ({
      _id: sp.user?._id,
      name: sp.user?.name || 'Unknown Student',
      email: sp.user?.email,
      rollNumber: sp.rollNumber,
    }));

    let presentRecords = [];
    if (dailyClass.attendanceSession) {
      presentRecords = await AttendanceRecord.find({
        session: dailyClass.attendanceSession._id,
        status: 'present',
      }).lean();
    }

    const presentStudentIds = new Set(presentRecords.map((r) => r.student.toString()));

    const presentStudents = [];
    const absentStudents = [];

    enrolledStudents.forEach((st) => {
      if (presentStudentIds.has(st._id.toString())) {
        const rec = presentRecords.find((r) => r.student.toString() === st._id.toString());
        presentStudents.push({
          ...st,
          scannedAt: rec?.scannedAt || null,
          status: 'present',
        });
      } else {
        absentStudents.push({
          ...st,
          status: 'absent',
        });
      }
    });

    return sendSuccess(res, 'Class attendance & absentee breakdown retrieved', {
      dailyClass,
      totalEnrolled: enrolledStudents.length,
      presentCount: presentStudents.length,
      absentCount: absentStudents.length,
      attendancePercentage:
        enrolledStudents.length > 0 ? Math.round((presentStudents.length / enrolledStudents.length) * 100) : 0,
      presentStudents,
      absentStudents,
    });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

/**
 * GET /api/timetable/daily-classes/missed-classes
 * Historical ledger of all classes missed by a student or batch
 */
export const getMissedClasses = async (req, res) => {
  try {
    const studentId = req.query.studentId || (req.user.role === 'student' ? req.user._id : null);

    if (!studentId) {
      return sendError(res, 'Please specify a studentId', 400);
    }

    const studentProfile = await StudentProfile.findOne({ user: studentId })
      .populate('batch department', 'name code')
      .lean();

    if (!studentProfile || !studentProfile.batch) {
      return sendSuccess(res, 'No batch enrolled', []);
    }

    // Find all finalized or expired attendance sessions for this batch
    const sessions = await AttendanceSession.find({
      batch: studentProfile.batch._id,
      status: { $in: ['finalized', 'expired'] },
    })
      .populate('subject classroom teacher', 'name code roomNumber')
      .sort({ date: -1 })
      .lean();

    const sessionIds = sessions.map((s) => s._id);

    // Find present records for this student
    const presentRecords = await AttendanceRecord.find({
      session: { $in: sessionIds },
      student: studentId,
      status: 'present',
    })
      .select('session scannedAt')
      .lean();

    const presentSessionIds = new Set(presentRecords.map((r) => r.session.toString()));

    // Missed sessions
    const missedClasses = sessions
      .filter((s) => !presentSessionIds.has(s._id.toString()))
      .map((s) => ({
        sessionId: s._id,
        sessionCode: s.sessionCode,
        date: formatDateToYMD(s.date),
        subject: s.subject?.name || 'Class Lecture',
        subjectCode: s.subject?.code,
        teacher: s.teacher?.name || 'Faculty',
        classroom: s.classroom?.roomNumber || 'Room',
        status: 'absent',
      }));

    return sendSuccess(res, `Missed classes retrieved for student (${missedClasses.length} missed)`, {
      totalConducted: sessions.length,
      attended: presentRecords.length,
      missedCount: missedClasses.length,
      attendancePercentage: sessions.length > 0 ? Math.round((presentRecords.length / sessions.length) * 100) : 100,
      missedClasses,
    });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};
