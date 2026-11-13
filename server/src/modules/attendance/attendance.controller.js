import mongoose from 'mongoose';
import AttendanceSession from './attendanceSession.model.js';
import AttendanceRecord from './attendanceRecord.model.js';
import Timetable from '../timetable/timetable.model.js';
import Batch from '../academics/batch.model.js';
import StudentProfile from '../users/studentProfile.model.js';
import User from '../users/user.model.js';
import DailyClass from '../timetable/dailyClass.model.js';
import { formatDateToYMD, ensureDailyClassesForDate } from '../timetable/dailyClass.controller.js';
import { generateStudentQrToken, verifyStudentQrToken } from '../../utils/qrCrypto.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { emitToUser, emitToSession, broadcastEvent } from '../../config/socket.js';

// ==================== STUDENT QR GENERATOR ====================
export const getMyQrToken = async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return sendError(res, 'Only students can generate personal attendance QR codes', 403);
    }

    const token = generateStudentQrToken(req.user._id.toString());
    return sendSuccess(res, 'Dynamic QR token generated (valid for 60 seconds)', {
      token,
      expiresInSeconds: 60,
      generatedAt: new Date(),
    });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ==================== ATTENDANCE SESSION MANAGEMENT ====================

/**
 * Universal Attendance Finalizer
 * Safely seals the session, generates official 'absent' records for all unscanned students in the cohort,
 * and updates DailyClass status to 'completed' with complete attendance metrics.
 */
export const finalizeAttendanceSession = async (session) => {
  if (!session) return;
  if (['finalized'].includes(session.status)) return;

  session.status = 'finalized';
  session.endedAt = session.endedAt || new Date();
  session.expiresAt = new Date();
  await session.save();

  try {
    const studentProfiles = await StudentProfile.find({ batch: session.batch }).select('user').lean();
    const presentRecords = await AttendanceRecord.find({ session: session._id, status: 'present' }).select('student').lean();
    const presentIds = new Set(presentRecords.map((r) => r.student.toString()));

    const absentDocs = [];
    studentProfiles.forEach((sp) => {
      if (!presentIds.has(sp.user.toString())) {
        absentDocs.push({
          session: session._id,
          student: sp.user,
          batch: session.batch,
          subject: session.subject,
          status: 'absent',
          scannedAt: session.endedAt,
        });
      }
    });

    if (absentDocs.length > 0) {
      await AttendanceRecord.insertMany(absentDocs, { ordered: false }).catch(() => {});
    }

    if (session.dailyClass) {
      const total = studentProfiles.length;
      const present = presentRecords.length;
      const absent = Math.max(0, total - present);
      await DailyClass.findByIdAndUpdate(session.dailyClass, {
        status: 'completed',
        attendanceStats: {
          totalStudents: total,
          presentCount: present,
          absentCount: absent,
          presentPercentage: total > 0 ? Math.round((present / total) * 100) : 0,
        },
      });
      broadcastEvent('daily_class_updated', { dailyClassId: session.dailyClass, status: 'completed' });
    }
  } catch (finalizeErr) {
    console.error('Error finalizing batch absentees & daily class:', finalizeErr.message);
  }
};

export const activateSession = async (req, res) => {
  try {
    const { timetableId, dailyClassId, durationMinutes = 10 } = req.body;

    let timetable;
    let dailyClass;
    const todayStr = formatDateToYMD(new Date());

    if (dailyClassId) {
      dailyClass = await DailyClass.findById(dailyClassId)
        .populate('batch subject classroom department teacher originalTeacher timetable');
      if (dailyClass) {
        timetable = dailyClass.timetable;
      }
    }

    if (!timetable && timetableId) {
      timetable = await Timetable.findById(timetableId).populate('batch subject classroom department');
    }

    if (!timetable) {
      return sendError(res, 'Scheduled class slot not found', 404);
    }

    // Materialize and link daily class instance for TODAY
    if (!dailyClass) {
      dailyClass = await DailyClass.findOne({ timetable: timetable._id, date: todayStr });
      if (!dailyClass) {
        await ensureDailyClassesForDate(todayStr, (timetable.department?._id || timetable.department)?.toString());
        dailyClass = await DailyClass.findOne({ timetable: timetable._id, date: todayStr });
      }
    }

    // Ethical & Schedule Integrity Check 1: Day of week verification
    const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDayName = DAYS_OF_WEEK[new Date().getDay()];
    if (timetable.day !== currentDayName && (!dailyClass || dailyClass.date !== todayStr)) {
      return sendError(
        res,
        `Schedule Mismatch: This class is scheduled for ${timetable.day}, but today is ${currentDayName}. You cannot launch attendance for a class scheduled on a different day.`,
        400
      );
    }

    // Ethical & Schedule Integrity Check 2: Check if class was paused for today
    if (dailyClass && dailyClass.status === 'paused') {
      return sendError(
        res,
        `This class has been paused for today: "${dailyClass.pauseReason || 'Paused by Administration'}". Cannot launch attendance.`,
        400
      );
    }

    // Ethical & Schedule Integrity Check 3: Check if attendance for this class was ALREADY completed today
    if (dailyClass && dailyClass.status === 'completed') {
      return sendError(
        res,
        `Attendance for this class has already been completed and finalized for today (${todayStr}). Further adjustments must be made via the official Attendance Audit & Override ledger.`,
        400
      );
    }

    // Role check: Only assigned master teacher OR substitute teacher (or HOD/Admin) can activate the session
    const isAssignedTeacher = timetable.teacher.toString() === req.user._id.toString();
    const isSubstituteTeacher = dailyClass && dailyClass.teacher.toString() === req.user._id.toString();
    const isAuthorizedElevated = ['hod', 'college_admin', 'super_admin'].includes(req.user.role);

    if (!isAssignedTeacher && !isSubstituteTeacher && !isAuthorizedElevated) {
      return sendError(res, 'You are not the designated teacher or substitute for this scheduled class', 403);
    }

    // If teacher already has an open pending/active session for this timetable slot, reuse it
    const existing = await AttendanceSession.findOne({
      timetable: timetable._id,
      status: { $in: ['pending', 'active'] },
    }).populate('subject batch classroom teacher', 'name code roomNumber');

    if (existing) {
      if (existing.status === 'active' && !existing.isOpen()) {
        await finalizeAttendanceSession(existing);
      } else {
        return sendSuccess(res, 'Resumed existing attendance session', existing, 200);
      }
    }

    // Generate unique, readable 6-character session code (alphanumeric, unambiguous)
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let sessionCode = '';
    for (let i = 0; i < 6; i++) {
      sessionCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Create session in PENDING state awaiting podium code entry
    const session = await AttendanceSession.create({
      sessionCode,
      timetable: timetable._id,
      dailyClass: dailyClass ? dailyClass._id : null,
      teacher: req.user._id,
      subject: timetable.subject._id,
      batch: timetable.batch._id,
      classroom: timetable.classroom._id,
      department: timetable.department._id,
      activatedAt: null,
      expiresAt: null,
      status: 'pending',
      durationMinutes: Number(durationMinutes) || 10,
    });

    if (dailyClass) {
      dailyClass.attendanceSession = session._id;
      dailyClass.status = 'in_progress';
      await dailyClass.save();
      broadcastEvent('daily_class_updated', { dailyClassId: dailyClass._id, status: 'in_progress', sessionCode });
    }

    const populated = await AttendanceSession.findById(session._id)
      .populate('subject batch classroom teacher', 'name code roomNumber');

    return sendSuccess(
      res,
      'Attendance session launched. Enter code on classroom podium or open direct scanner.',
      populated,
      201
    );
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const getSessionById = async (req, res) => {
  try {
    const session = await AttendanceSession.findById(req.params.id)
      .populate('subject batch classroom teacher', 'name code roomNumber');

    if (!session) return sendError(res, 'Session not found', 404);

    const remainingSeconds = session.expiresAt
      ? Math.max(0, Math.floor((session.expiresAt - new Date()) / 1000))
      : (session.durationMinutes || 10) * 60;

    return sendSuccess(res, 'Session retrieved', {
      session,
      isOpen: session.isOpen(),
      isPending: session.isPending(),
      remainingSeconds,
    });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ==================== PUBLIC CLASSROOM KIOSK SESSION (NO LOGIN REQUIRED) ====================
export const getKioskSession = async (req, res) => {
  try {
    const { sessionCode } = req.params;
    if (!sessionCode) {
      return sendError(res, 'Please provide session code', 400);
    }

    const cleanCode = sessionCode.toUpperCase().trim();
    const session = await AttendanceSession.findOne({ sessionCode: cleanCode })
      .populate('subject batch classroom teacher', 'name code roomNumber');

    if (!session) {
      return sendError(res, 'Invalid or non-existent classroom session code', 404);
    }

    if (session.status === 'cancelled') {
      return sendError(res, 'This attendance session was cancelled by the instructor', 400);
    }

    if (session.status === 'finalized') {
      return sendError(res, 'This attendance session has already been finalized by the instructor', 400);
    }

    // ACTIVATION AT PODIUM:
    // If session was pending, inputting code in podium officially triggers the clock!
    let justActivated = false;
    if (session.status === 'pending') {
      const activatedAt = new Date();
      const duration = session.durationMinutes || 10;
      const expiresAt = new Date(activatedAt.getTime() + duration * 60 * 1000);

      session.status = 'active';
      session.activatedAt = activatedAt;
      session.expiresAt = expiresAt;
      await session.save();
      justActivated = true;

      // Broadcast real-time live event to teacher's phone & session room
      const livePayload = {
        sessionId: session._id,
        sessionCode: session.sessionCode,
        status: 'active',
        activatedAt: session.activatedAt,
        expiresAt: session.expiresAt,
        durationMinutes: duration,
        remainingSeconds: duration * 60,
        subject: session.subject,
        batch: session.batch,
        classroom: session.classroom,
        teacher: session.teacher,
        totalScanned: session.totalScanned,
        activatedOn: 'podium',
      };

      emitToUser(session.teacher._id || session.teacher, 'attendance_session_live', livePayload);
      emitToSession(session.sessionCode, 'attendance_session_live', livePayload);
    } else if (session.status === 'active' && !session.isOpen()) {
      await finalizeAttendanceSession(session);
      return sendError(res, 'Attendance session has expired (scanning window closed)', 410);
    }

    const remainingSeconds = session.expiresAt
      ? Math.max(0, Math.floor((session.expiresAt - new Date()) / 1000))
      : (session.durationMinutes || 10) * 60;

    return sendSuccess(res, 'Classroom session linked successfully', {
      session: {
        _id: session._id,
        sessionCode: session.sessionCode,
        subject: session.subject,
        batch: session.batch,
        classroom: session.classroom,
        teacher: session.teacher,
        activatedAt: session.activatedAt,
        expiresAt: session.expiresAt,
        totalScanned: session.totalScanned,
        status: session.status,
      },
      remainingSeconds,
      justActivated,
    });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const scanKioskQr = async (req, res) => {
  try {
    const { sessionCode, qrToken } = req.body;

    if (!sessionCode || !qrToken) {
      return sendError(res, 'Session code and QR token are required', 400);
    }

    const session = await AttendanceSession.findOne({ sessionCode: sessionCode.toUpperCase().trim() });
    if (!session) {
      return sendError(res, 'Invalid session code', 404);
    }

    // Backend-enforced 10-minute deadline check
    if (!session.isOpen()) {
      await finalizeAttendanceSession(session);
      return sendError(res, 'Attendance session has expired', 410);
    }

    // Verify student dynamic QR token
    const verification = verifyStudentQrToken(qrToken);
    if (!verification.valid) {
      return sendError(res, verification.reason || 'Invalid QR code', 400);
    }

    const studentUser = await User.findById(verification.studentId);
    if (!studentUser || studentUser.role !== 'student') {
      return sendError(res, 'Invalid student record', 404);
    }

    // Verify student batch eligibility
    const studentProfile = await StudentProfile.findOne({ user: verification.studentId });
    if (!studentProfile || studentProfile.batch.toString() !== session.batch.toString()) {
      return sendError(res, 'Student is not enrolled in the batch attending this class', 403);
    }

    // Record attendance with duplicate check
    try {
      const record = await AttendanceRecord.create({
        session: session._id,
        student: studentUser._id,
        batch: session.batch,
        subject: session.subject,
        status: 'present',
        qrNonce: verification.nonce,
        scannedAt: new Date(),
      });

      session.totalScanned += 1;
      await session.save();

      // Emit live scan event to teacher's phone & kiosk
      const scanPayload = {
        sessionId: session._id,
        sessionCode: session.sessionCode,
        student: {
          _id: studentUser._id,
          name: studentUser.name,
          rollNumber: studentProfile.rollNumber,
        },
        scannedAt: record.scannedAt,
        totalScanned: session.totalScanned,
      };
      emitToUser(session.teacher.toString(), 'attendance_student_scanned', scanPayload);
      emitToSession(session.sessionCode, 'attendance_student_scanned', scanPayload);
      broadcastEvent('attendance_updated', scanPayload);

      return sendSuccess(res, `Attendance marked for ${studentUser.name}`, {
        student: {
          _id: studentUser._id,
          name: studentUser.name,
          rollNumber: studentProfile.rollNumber,
        },
        scannedAt: record.scannedAt,
        totalScanned: session.totalScanned,
      }, 201);
    } catch (dbErr) {
      if (dbErr.code === 11000) {
        return sendError(res, `Already marked: ${studentUser.name} (${studentProfile.rollNumber})`, 409);
      }
      throw dbErr;
    }
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ==================== SCANNING WEBCAM QR (LOGGED IN TEACHER) ====================
export const scanStudentQr = async (req, res) => {
  try {
    const { id: sessionId } = req.params;
    const { qrToken } = req.body;

    if (!qrToken) {
      return sendError(res, 'QR Token is required', 400);
    }

    const session = await AttendanceSession.findById(sessionId);
    if (!session) {
      return sendError(res, 'Attendance session not found', 404);
    }

    // Backend-enforced 10-minute deadline check
    if (!session.isOpen()) {
      await finalizeAttendanceSession(session);
      return sendError(res, 'Attendance session has expired (10-minute scanning window ended)', 410);
    }

    // Verify student dynamic QR token
    const verification = verifyStudentQrToken(qrToken);
    if (!verification.valid) {
      return sendError(res, verification.reason || 'Invalid QR code', 400);
    }

    const studentUser = await User.findById(verification.studentId);
    if (!studentUser || studentUser.role !== 'student') {
      return sendError(res, 'Invalid student record', 404);
    }

    // Verify student batch eligibility
    const studentProfile = await StudentProfile.findOne({ user: verification.studentId });
    if (!studentProfile || studentProfile.batch.toString() !== session.batch.toString()) {
      return sendError(res, 'Student is not enrolled in the batch attending this class', 403);
    }

    // Record attendance with duplicate check
    try {
      const record = await AttendanceRecord.create({
        session: session._id,
        student: studentUser._id,
        batch: session.batch,
        subject: session.subject,
        status: 'present',
        qrNonce: verification.nonce,
        scannedAt: new Date(),
      });

      session.totalScanned += 1;
      await session.save();

      // Emit live scan event to teacher's phone & kiosk
      const scanPayload = {
        sessionId: session._id,
        sessionCode: session.sessionCode,
        student: {
          _id: studentUser._id,
          name: studentUser.name,
          rollNumber: studentProfile.rollNumber,
        },
        scannedAt: record.scannedAt,
        totalScanned: session.totalScanned,
      };
      emitToUser(session.teacher.toString(), 'attendance_student_scanned', scanPayload);
      emitToSession(session.sessionCode, 'attendance_student_scanned', scanPayload);
      broadcastEvent('attendance_updated', scanPayload);

      return sendSuccess(res, `Attendance marked for ${studentUser.name}`, {
        student: {
          _id: studentUser._id,
          name: studentUser.name,
          rollNumber: studentProfile.rollNumber,
        },
        scannedAt: record.scannedAt,
        totalScanned: session.totalScanned,
      }, 201);
    } catch (dbErr) {
      if (dbErr.code === 11000) {
        return sendError(res, `Attendance already marked for ${studentUser.name} (${studentProfile.rollNumber})`, 409);
      }
      throw dbErr;
    }
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const getSessionRecords = async (req, res) => {
  try {
    const records = await AttendanceRecord.find({ session: req.params.id })
      .populate('student', 'name email')
      .sort({ scannedAt: -1 });

    return sendSuccess(res, 'Session attendance records retrieved', records);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ==================== DIRECT SCANNER ACTIVATION (TEACHER PHONE) ====================
export const startDirectTeacherScanner = async (req, res) => {
  try {
    const { id: sessionId } = req.params;
    const session = await AttendanceSession.findById(sessionId)
      .populate('subject batch classroom teacher', 'name code roomNumber');

    if (!session) return sendError(res, 'Attendance session not found', 404);

    const teacherId = session.teacher._id ? session.teacher._id.toString() : session.teacher.toString();
    const isAssignedTeacher = teacherId === req.user._id.toString();
    const isAuthorizedElevated = ['hod', 'college_admin', 'super_admin'].includes(req.user.role);

    if (!isAssignedTeacher && !isAuthorizedElevated) {
      return sendError(res, 'Only the designated instructor can start direct scanner', 403);
    }

    if (session.status === 'pending') {
      const activatedAt = new Date();
      const duration = session.durationMinutes || 10;
      const expiresAt = new Date(activatedAt.getTime() + duration * 60 * 1000);

      session.status = 'active';
      session.activatedAt = activatedAt;
      session.expiresAt = expiresAt;
      await session.save();

      const livePayload = {
        sessionId: session._id,
        sessionCode: session.sessionCode,
        status: 'active',
        activatedAt: session.activatedAt,
        expiresAt: session.expiresAt,
        durationMinutes: duration,
        remainingSeconds: duration * 60,
        subject: session.subject,
        batch: session.batch,
        classroom: session.classroom,
        teacher: session.teacher,
        totalScanned: session.totalScanned,
        activatedOn: 'phone',
      };

      emitToUser(teacherId, 'attendance_session_live', livePayload);
      emitToSession(session.sessionCode, 'attendance_session_live', livePayload);
    }

    const remainingSeconds = session.expiresAt
      ? Math.max(0, Math.floor((session.expiresAt - new Date()) / 1000))
      : (session.durationMinutes || 10) * 60;

    return sendSuccess(res, 'Direct phone scanner started', {
      session,
      remainingSeconds,
    });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ==================== END ATTENDANCE EARLY (FROM TEACHER PHONE ONLY) ====================
export const endSessionEarly = async (req, res) => {
  try {
    const { id: sessionId } = req.params;
    const session = await AttendanceSession.findById(sessionId)
      .populate('subject batch classroom teacher', 'name code roomNumber');

    if (!session) {
      return sendError(res, 'Attendance session not found', 404);
    }

    // Role check: ONLY designated teacher (or HOD/Admin) can end it
    const teacherId = session.teacher._id ? session.teacher._id.toString() : session.teacher.toString();
    const isAssignedTeacher = teacherId === req.user._id.toString();
    const isAuthorizedElevated = ['hod', 'college_admin', 'super_admin'].includes(req.user.role);

    if (!isAssignedTeacher && !isAuthorizedElevated) {
      return sendError(res, 'Only the designated teacher can end this attendance session', 403);
    }

    session.endedByTeacher = true;
    await finalizeAttendanceSession(session);

    const endPayload = {
      sessionId: session._id,
      sessionCode: session.sessionCode,
      status: 'finalized',
      endedByTeacher: true,
      teacherName: req.user.name,
      totalScanned: session.totalScanned,
      endedAt: session.endedAt,
      message: `Attendance ended early by ${req.user.name}. Final marked count: ${session.totalScanned}.`,
    };

    // Broadcast real-time conclusion to podium kiosk and teacher
    emitToSession(session.sessionCode, 'attendance_session_ended', endPayload);
    emitToUser(teacherId, 'attendance_session_ended', endPayload);
    broadcastEvent('attendance_updated', endPayload);
    broadcastEvent('dashboard_refresh', {});

    return sendSuccess(
      res,
      `Attendance session closed successfully. Total present: ${session.totalScanned}`,
      {
        session,
        totalScanned: session.totalScanned,
      }
    );
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ==================== CANCEL PENDING SESSION ====================
export const cancelSession = async (req, res) => {
  try {
    const { id: sessionId } = req.params;
    const session = await AttendanceSession.findById(sessionId);

    if (!session) return sendError(res, 'Attendance session not found', 404);

    const teacherId = session.teacher._id ? session.teacher._id.toString() : session.teacher.toString();
    const isAssignedTeacher = teacherId === req.user._id.toString();
    const isAuthorizedElevated = ['hod', 'college_admin', 'super_admin'].includes(req.user.role);

    if (!isAssignedTeacher && !isAuthorizedElevated) {
      return sendError(res, 'Only the designated teacher can cancel this session', 403);
    }

    session.status = 'cancelled';
    await session.save();

    const cancelPayload = {
      sessionId: session._id,
      sessionCode: session.sessionCode,
      status: 'cancelled',
      teacherName: req.user.name,
    };

    emitToSession(session.sessionCode, 'attendance_session_cancelled', cancelPayload);
    emitToUser(teacherId, 'attendance_session_cancelled', cancelPayload);

    return sendSuccess(res, 'Attendance session cancelled successfully', { sessionId: session._id });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ==================== GET ACTIVE / PENDING SESSION FOR USER ====================
export const getActiveSessionForUser = async (req, res) => {
  try {
    const session = await AttendanceSession.findOne({
      teacher: req.user._id,
      status: { $in: ['pending', 'active'] },
    })
      .sort({ createdAt: -1 })
      .populate('subject batch classroom teacher', 'name code roomNumber');

    if (!session) {
      return sendSuccess(res, 'No active attendance session', { activeSession: null });
    }

    if (session.status === 'active' && !session.isOpen()) {
      await finalizeAttendanceSession(session);
      return sendSuccess(res, 'No active attendance session', { activeSession: null });
    }

    const remainingSeconds = session.expiresAt
      ? Math.max(0, Math.floor((session.expiresAt - new Date()) / 1000))
      : (session.durationMinutes || 10) * 60;

    return sendSuccess(res, 'Active attendance session retrieved', {
      activeSession: session,
      remainingSeconds,
      isPending: session.status === 'pending',
      isLive: session.status === 'active',
    });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ==================== ATTENDANCE ANALYTICS FOR STUDENT ====================
export const getStudentAttendanceAnalytics = async (req, res) => {
  try {
    const studentId = req.params.studentId || req.user._id;

    // Student profile
    const profile = await StudentProfile.findOne({ user: studentId }).populate('batch');
    const batchId = profile?.batch?._id || profile?.batch;

    // Total sessions conducted for this batch
    const totalConducted = batchId
      ? await AttendanceSession.countDocuments({ batch: batchId })
      : 0;

    // Fetch all records for this student
    const records = await AttendanceRecord.find({ student: studentId })
      .populate('subject', 'name code')
      .populate({
        path: 'session',
        populate: { path: 'classroom teacher', select: 'roomNumber name' },
      })
      .sort({ scannedAt: -1 });

    const totalAttended = records.filter((r) => r.status === 'present').length;
    const effectiveConducted = Math.max(totalConducted, totalAttended);
    const overallPercentage = effectiveConducted > 0
      ? Math.round((totalAttended / effectiveConducted) * 100)
      : 100;

    // Aggregate by subject
    const subjectStats = {};

    // Get conducted count per subject for this batch
    const subjectConductedAgg = batchId
      ? await AttendanceSession.aggregate([
          { $match: { batch: batchId } },
          { $group: { _id: '$subject', count: { $sum: 1 } } },
        ])
      : [];

    const conductedMap = {};
    subjectConductedAgg.forEach((item) => {
      conductedMap[item._id.toString()] = item.count;
    });

    records.forEach((r) => {
      const subId = r.subject?._id?.toString() || 'general';
      if (!subjectStats[subId]) {
        const conducted = Math.max(conductedMap[subId] || 0, 1);
        subjectStats[subId] = {
          subjectId: subId,
          subjectName: r.subject?.name || 'Curriculum Subject',
          subjectCode: r.subject?.code || 'GEN',
          attended: 0,
          conducted,
          percentage: 0,
        };
      }
      if (r.status === 'present') {
        subjectStats[subId].attended += 1;
      }
    });

    // Compute subject percentages and recovery targets
    Object.values(subjectStats).forEach((s) => {
      const effCond = Math.max(s.conducted, s.attended);
      s.percentage = effCond > 0 ? Math.round((s.attended / effCond) * 100) : 100;
      s.isDefaulter = s.percentage < 75;
      s.isCritical = s.percentage < 60;
      s.classesNeededTo75 = s.isDefaulter
        ? Math.max(1, Math.ceil(3 * effCond - 4 * s.attended))
        : 0;
    });

    const isDefaulter = overallPercentage < 75;
    const isCritical = overallPercentage < 60;
    const classesNeededTo75 = isDefaulter
      ? Math.max(1, Math.ceil(3 * effectiveConducted - 4 * totalAttended))
      : 0;

    let mentorObj = null;
    if (profile?.mentor) {
      const m = await User.findById(profile.mentor).select('name email');
      if (m) mentorObj = { _id: m._id, name: m.name, email: m.email };
    } else if (profile?.batch?.mentor) {
      const m = await User.findById(profile.batch.mentor).select('name email');
      if (m) mentorObj = { _id: m._id, name: m.name, email: m.email };
    }

    return sendSuccess(res, 'Attendance analytics retrieved', {
      overall: {
        totalAttended,
        totalConducted: effectiveConducted,
        percentage: overallPercentage,
        isDefaulter,
        isCritical,
        classesNeededTo75,
        threshold: 75,
        status: overallPercentage >= 75 ? 'good' : (overallPercentage >= 60 ? 'warning' : 'critical'),
      },
      mentor: mentorObj,
      subjectBreakdown: Object.values(subjectStats),
      recentLogs: records.slice(0, 20).map((r) => ({
        _id: r._id,
        date: r.scannedAt,
        subject: r.subject?.name || 'Class',
        subjectCode: r.subject?.code || '',
        roomNumber: r.session?.classroom?.roomNumber || 'LH',
        teacher: r.session?.teacher?.name || 'Faculty',
        status: r.status,
      })),
    });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ==================== BATCH ATTENDANCE AUDIT REPORT (TEACHER / HOD / ADMIN) ====================
export const getBatchAttendanceReport = async (req, res) => {
  try {
    const { batchId } = req.params;

    const batch = await Batch.findById(batchId).lean();
    if (!batch) {
      return sendError(res, 'Batch not found', 404);
    }

    // Role-based Security Scoping: Teachers & Mentors can ONLY access their assigned batches or their department batches
    if (['teacher', 'hod'].includes(req.user.role)) {
      const isMyDept = batch.department?.toString() === req.user.department?.toString();
      const isMyAssignedBatch = batch.mentor?.toString() === req.user._id.toString();

      if (!isMyDept && !isMyAssignedBatch) {
        return sendError(
          res,
          'Access denied: You can only access attendance reports for your assigned batches or batches within your department.',
          403
        );
      }
    }

    const students = await StudentProfile.find({ batch: batchId })
      .populate('user', 'name email')
      .sort({ rollNumber: 1 });

    const totalSessions = await AttendanceSession.countDocuments({ batch: batchId });

    const report = await Promise.all(
      students.map(async (sp) => {
        const attended = await AttendanceRecord.countDocuments({
          student: sp.user._id,
          batch: batchId,
          status: 'present',
        });
        const effectiveTotal = Math.max(totalSessions, attended);
        const percentage = effectiveTotal > 0 ? Math.round((attended / effectiveTotal) * 100) : 100;

        return {
          studentId: sp.user._id,
          name: sp.user.name,
          rollNumber: sp.rollNumber,
          email: sp.user.email,
          totalConducted: effectiveTotal,
          attended,
          percentage,
          isDefaulter: percentage < 75,
        };
      })
    );

    return sendSuccess(res, 'Batch attendance audit report', {
      totalStudents: students.length,
      totalSessions,
      defaulterCount: report.filter((r) => r.isDefaulter).length,
      report,
    });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ==================== MANUAL ATTENDANCE OVERRIDE & EDIT ====================
export const manualRecordAttendance = async (req, res) => {
  try {
    const { studentId, batchId, subjectId, status } = req.body;
    if (!studentId || !batchId) {
      return sendError(res, 'Student ID and Batch ID are required', 400);
    }

    // Find latest session for this batch
    const sessionQuery = { batch: batchId };
    if (subjectId) sessionQuery.subject = subjectId;
    let session = await AttendanceSession.findOne(sessionQuery).sort({ createdAt: -1 });

    if (!session) {
      const timetable = await Timetable.findOne({ batch: batchId });
      session = await AttendanceSession.create({
        sessionCode: 'MAN' + Math.random().toString(36).substring(2, 6).toUpperCase(),
        timetable: timetable?._id || new mongoose.Types.ObjectId(),
        teacher: req.user._id,
        subject: subjectId || timetable?.subject || new mongoose.Types.ObjectId(),
        batch: batchId,
        classroom: timetable?.classroom || new mongoose.Types.ObjectId(),
        department: timetable?.department || req.user.department || new mongoose.Types.ObjectId(),
        date: new Date(),
        activatedAt: new Date(),
        expiresAt: new Date(Date.now() + 600000),
        status: 'finalized',
        totalScanned: 1,
      });
    }

    const effectiveSubject = subjectId || session.subject;
    const record = await AttendanceRecord.findOneAndUpdate(
      { session: session._id, student: studentId },
      {
        session: session._id,
        student: studentId,
        batch: batchId,
        subject: effectiveSubject,
        status: status || 'present',
        scannedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    broadcastEvent('attendance_updated', record);
    broadcastEvent('dashboard_refresh', {});

    return sendSuccess(res, `Attendance updated to ${status || 'present'} successfully`, record);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const updateAttendanceRecord = async (req, res) => {
  try {
    const { recordId } = req.params;
    const { status } = req.body;

    const record = await AttendanceRecord.findByIdAndUpdate(
      recordId,
      { status },
      { new: true }
    ).populate('student subject', 'name rollNumber code');

    if (!record) {
      return sendError(res, 'Attendance record not found', 404);
    }

    broadcastEvent('attendance_updated', record);
    broadcastEvent('dashboard_refresh', {});

    return sendSuccess(res, `Attendance status updated to ${status}`, record);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const getStudentSessionRecords = async (req, res) => {
  try {
    const { studentId } = req.params;
    const records = await AttendanceRecord.find({ student: studentId })
      .populate('subject', 'name code')
      .populate({
        path: 'session',
        populate: { path: 'teacher classroom', select: 'name roomNumber' },
      })
      .sort({ scannedAt: -1 })
      .limit(100);

    return sendSuccess(res, 'Student attendance session history', records);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};
