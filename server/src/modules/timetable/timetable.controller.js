import Timetable from './timetable.model.js';
import Batch from '../academics/batch.model.js';
import Subject from '../academics/subject.model.js';
import StudentProfile from '../users/studentProfile.model.js';
import { broadcastEvent } from '../../config/socket.js';
import { sendSuccess, sendError } from '../../utils/response.js';

export const createTimetableEntry = async (req, res) => {
  try {
    const { batch, subject, teacher, classroom, department, day, startTime, endTime, semester, academicYear } = req.body;

    if (!batch || !subject || !teacher || !classroom || !day || !startTime || !endTime) {
      return sendError(
        res,
        'All scheduling fields (Batch, Subject, Faculty Teacher, Hall/Classroom, Day, Start Time, and End Time) are required.',
        400
      );
    }

    // Atomic conflict verification across all aspects: Hall/Classroom, Faculty, Batch, Time Window
    const conflictResult = await Timetable.checkConflict({
      teacher,
      classroom,
      batch,
      day,
      startTime,
      endTime,
    });

    if (conflictResult.hasConflict) {
      return sendError(res, conflictResult.message, 409, { conflicts: conflictResult.conflicts });
    }

    // Auto-resolve department and semester if omitted
    let effectiveDept = department;
    let effectiveSem = semester;
    if (!effectiveDept || effectiveSem === undefined || effectiveSem === null) {
      const batchDoc = await Batch.findById(batch).lean();
      if (batchDoc) {
        if (!effectiveDept) effectiveDept = batchDoc.department;
        if (effectiveSem === undefined || effectiveSem === null) effectiveSem = batchDoc.currentSemester || 1;
      }
    }

    const entry = await Timetable.create({
      batch,
      subject,
      teacher,
      classroom,
      department: effectiveDept,
      day,
      startTime,
      endTime,
      semester: effectiveSem || 1,
      academicYear: academicYear || '2025-2026',
    });

    const populated = await Timetable.findById(entry._id)
      .populate('batch subject teacher classroom department', 'name code roomNumber')
      .lean();

    broadcastEvent('timetable_updated', { action: 'create', data: populated });
    return sendSuccess(res, 'Timetable scheduled successfully without conflicts', populated, 201);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const getTimetables = async (req, res) => {
  try {
    const filter = { isActive: true };

    if (['teacher', 'hod'].includes(req.user?.role)) {
      const userDept = req.user.department;
      const userId = req.user._id;

      // Teachers & Mentors can ONLY access their full department schedule OR slots where they teach
      filter.$or = [
        { department: userDept },
        { teacher: userId },
      ];

      // Block access to other departments
      if (req.query.department && req.query.department !== 'all') {
        if (req.query.department !== userDept?.toString()) {
          return sendError(res, 'Access denied: You cannot view timetables for other departments.', 403);
        }
      }

      if (req.query.batch && req.query.batch !== 'all') filter.batch = req.query.batch;
      if (req.query.teacher && req.query.teacher !== 'all') filter.teacher = req.query.teacher;
      if (req.query.day && req.query.day !== 'all') filter.day = req.query.day;

      // If standard teacher view without explicit filter, show their personal teaching slots
      if (req.user?.role === 'teacher' && !req.query.batch && !req.query.teacher && req.query.all !== 'true') {
        filter.teacher = userId;
        delete filter.$or;
      }
    } else {
      if (req.query.batch && req.query.batch !== 'all') filter.batch = req.query.batch;
      if (req.query.teacher && req.query.teacher !== 'all') filter.teacher = req.query.teacher;
      if (req.query.department && req.query.department !== 'all') filter.department = req.query.department;
      if (req.query.day && req.query.day !== 'all') filter.day = req.query.day;
    }

    // If student is requesting their cohort schedule by default
    if (req.user?.role === 'student' && !req.query.batch && req.query.all !== 'true') {
      const studentProfile = await StudentProfile.findOne({ user: req.user._id });
      if (studentProfile?.batch) {
        filter.batch = studentProfile.batch;
      }
    }

    const schedule = await Timetable.find(filter)
      .populate('batch subject teacher classroom department', 'name code roomNumber email')
      .sort({ day: 1, startTime: 1 })
      .lean();

    return sendSuccess(res, 'Timetable schedule retrieved', schedule);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const updateTimetableEntry = async (req, res) => {
  try {
    const { batch, subject, teacher, classroom, department, day, startTime, endTime, semester, academicYear, isActive } = req.body;

    const existing = await Timetable.findById(req.params.id);
    if (!existing) return sendError(res, 'Schedule entry not found', 404);

    const checkBatch = batch || existing.batch;
    const checkSubject = subject || existing.subject;
    const checkTeacher = teacher || existing.teacher;
    const checkClassroom = classroom || existing.classroom;
    const checkDay = day || existing.day;
    const checkStartTime = startTime || existing.startTime;
    const checkEndTime = endTime || existing.endTime;

    // Atomic conflict verification excluding current id
    const conflictResult = await Timetable.checkConflict({
      teacher: checkTeacher,
      classroom: checkClassroom,
      batch: checkBatch,
      day: checkDay,
      startTime: checkStartTime,
      endTime: checkEndTime,
      excludeId: existing._id,
    });

    if (conflictResult.hasConflict) {
      return sendError(res, conflictResult.message, 409, { conflicts: conflictResult.conflicts });
    }

    if (batch) existing.batch = batch;
    if (subject) existing.subject = subject;
    if (teacher) existing.teacher = teacher;
    if (classroom) existing.classroom = classroom;
    if (department) existing.department = department;
    if (day) existing.day = day;
    if (startTime) existing.startTime = startTime;
    if (endTime) existing.endTime = endTime;
    if (semester !== undefined) existing.semester = semester;
    if (academicYear) existing.academicYear = academicYear;
    if (isActive !== undefined) existing.isActive = isActive;

    await existing.save();

    const populated = await Timetable.findById(existing._id)
      .populate('batch subject teacher classroom department', 'name code roomNumber')
      .lean();

    broadcastEvent('timetable_updated', { action: 'update', data: populated });
    return sendSuccess(res, 'Timetable updated successfully without conflicts', populated);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

/**
 * Pre-validation check endpoint: verify if hall, faculty, batch, and time are free
 * without committing to database
 */
export const validateTimetableSlot = async (req, res) => {
  try {
    const { teacher, classroom, batch, day, startTime, endTime, excludeId } = req.body;
    const conflictResult = await Timetable.checkConflict({
      teacher,
      classroom,
      batch,
      day,
      startTime,
      endTime,
      excludeId: excludeId || null,
    });

    return sendSuccess(res, conflictResult.message, conflictResult);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const deleteTimetableEntry = async (req, res) => {
  try {
    const entry = await Timetable.findByIdAndDelete(req.params.id);
    if (!entry) return sendError(res, 'Schedule entry not found', 404);
    broadcastEvent('timetable_updated', { action: 'delete', id: req.params.id });
    return sendSuccess(res, 'Timetable entry removed successfully');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};
