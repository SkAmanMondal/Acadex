import Department from './department.model.js';
import Course from './course.model.js';
import Batch from './batch.model.js';
import Classroom from './classroom.model.js';
import Subject from './subject.model.js';
import User from '../users/user.model.js';
import StudentProfile from '../users/studentProfile.model.js';
import TeacherProfile from '../users/teacherProfile.model.js';
import Notification from '../notifications/notification.model.js';
import AttendanceSession from '../attendance/attendanceSession.model.js';
import AttendanceRecord from '../attendance/attendanceRecord.model.js';
import DailyClass from '../timetable/dailyClass.model.js';
import { broadcastEvent } from '../../config/socket.js';
import { sendSuccess, sendError } from '../../utils/response.js';

// ==================== DEPARTMENTS ====================
export const getDepartments = async (req, res) => {
  try {
    const departments = await Department.find({ isActive: true }).populate('hod', 'name email').lean();
    return sendSuccess(res, 'Departments retrieved', departments);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const createDepartment = async (req, res) => {
  try {
    const { name, code, description, hod } = req.body;
    const department = await Department.create({ name, code, description, hod: hod || null });
    broadcastEvent('academics_updated', { entity: 'department', action: 'create', data: department });
    return sendSuccess(res, 'Department created', department, 201);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const updateDepartment = async (req, res) => {
  try {
    const { name, code, description, hod, isActive } = req.body;
    const department = await Department.findById(req.params.id);
    if (!department) return sendError(res, 'Department not found', 404);

    if (name) department.name = name;
    if (code) department.code = code;
    if (description !== undefined) department.description = description;
    if (hod !== undefined) department.hod = hod || null;
    if (isActive !== undefined) department.isActive = isActive;

    await department.save();
    broadcastEvent('academics_updated', { entity: 'department', action: 'update', data: department });
    return sendSuccess(res, 'Department updated', department);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ==================== COURSES ====================
export const getCourses = async (req, res) => {
  try {
    const filter = { isActive: true };
    if (['teacher', 'hod'].includes(req.user?.role)) {
      filter.department = req.user.department;
    } else if (req.query.department) {
      filter.department = req.query.department;
    }
    const courses = await Course.find(filter).populate('department', 'name code').lean();
    return sendSuccess(res, 'Courses retrieved', courses);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const createCourse = async (req, res) => {
  try {
    const { name, code, department, durationYears, totalSemesters } = req.body;
    const course = await Course.create({ name, code, department, durationYears, totalSemesters });
    broadcastEvent('academics_updated', { entity: 'course', action: 'create', data: course });
    return sendSuccess(res, 'Course created', course, 201);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const updateCourse = async (req, res) => {
  try {
    const { name, code, department, durationYears, totalSemesters, isActive } = req.body;
    const course = await Course.findById(req.params.id);
    if (!course) return sendError(res, 'Course not found', 404);

    if (name) course.name = name;
    if (code) course.code = code;
    if (department) course.department = department;
    if (durationYears !== undefined) course.durationYears = durationYears;
    if (totalSemesters !== undefined) course.totalSemesters = totalSemesters;
    if (isActive !== undefined) course.isActive = isActive;

    await course.save();
    broadcastEvent('academics_updated', { entity: 'course', action: 'update', data: course });
    return sendSuccess(res, 'Course updated', course);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ==================== BATCHES ====================
export const getBatches = async (req, res) => {
  try {
    const filter = { isActive: true };

    // Security Scoping: Teachers & Mentors can ONLY access their assigned batches and their full department
    if (['teacher', 'hod'].includes(req.user?.role)) {
      const userDept = req.user.department;
      const userId = req.user._id;

      if (req.query.assignedOnly === 'true') {
        filter.mentor = userId;
      } else {
        filter.$or = [
          { department: userDept },
          { mentor: userId },
        ];
      }

      if (req.query.department && req.query.department !== userDept?.toString()) {
        return sendError(res, 'Access denied: You cannot access batches from other departments.', 403);
      }
    } else {
      if (req.query.department) filter.department = req.query.department;
    }

    if (req.query.course) filter.course = req.query.course;
    const batches = await Batch.find(filter)
      .populate('department course', 'name code')
      .populate('mentor', 'name email phone role')
      .lean();
    return sendSuccess(res, 'Batches retrieved', batches);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const createBatch = async (req, res) => {
  try {
    const { name, course, department, startYear, endYear, currentSemester, mentor } = req.body;

    if (mentor) {
      const mentorProfile = await TeacherProfile.findOne({ user: mentor });
      if (!mentorProfile || !mentorProfile.isMentor) {
        return sendError(
          res,
          'Selected faculty member does not have mentor privilege enabled. Please designate them as a mentor in Faculty Management first.',
          400
        );
      }
    }

    const batch = await Batch.create({
      name,
      course,
      department,
      startYear,
      endYear,
      currentSemester,
      mentor: mentor || null,
    });

    const populated = await Batch.findById(batch._id)
      .populate('department course', 'name code')
      .populate('mentor', 'name email phone role')
      .lean();

    broadcastEvent('batch_updated', { entity: 'batch', action: 'create', data: populated });
    broadcastEvent('academics_updated', { entity: 'batch', action: 'create', data: populated });
    return sendSuccess(res, 'Batch created', populated, 201);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const updateBatch = async (req, res) => {
  try {
    const { name, course, department, startYear, endYear, currentSemester, isActive, mentor, updateStudents } = req.body;
    const batch = await Batch.findById(req.params.id);
    if (!batch) return sendError(res, 'Batch not found', 404);

    if (name) batch.name = name;
    if (course) batch.course = course;
    if (department) batch.department = department;
    if (startYear !== undefined) batch.startYear = startYear;
    if (endYear !== undefined) batch.endYear = endYear;
    if (currentSemester !== undefined) batch.currentSemester = currentSemester;
    if (isActive !== undefined) batch.isActive = isActive;

    if (mentor !== undefined) {
      if (mentor) {
        const mentorProfile = await TeacherProfile.findOne({ user: mentor });
        if (!mentorProfile || !mentorProfile.isMentor) {
          return sendError(
            res,
            'Selected faculty member does not have mentor privilege enabled. Please designate them as a mentor in Faculty Management first.',
            400
          );
        }
      }

      batch.mentor = mentor || null;
      if (updateStudents) {
        await StudentProfile.updateMany({ batch: batch._id }, { mentor: mentor || null });
        broadcastEvent('students_updated', { action: 'batch_mentor_sync', batchId: batch._id });
      }
    }

    await batch.save();
    const populated = await Batch.findById(batch._id)
      .populate('department course', 'name code')
      .populate('mentor', 'name email phone role')
      .lean();

    broadcastEvent('batch_updated', { entity: 'batch', action: 'update', data: populated });
    broadcastEvent('academics_updated', { entity: 'batch', action: 'update', data: populated });
    return sendSuccess(res, 'Batch updated', populated);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const assignBatchMentor = async (req, res) => {
  try {
    const { id } = req.params;
    const { mentorId, updateExistingStudents = true, notifyStudents = true } = req.body;

    const batch = await Batch.findById(id);
    if (!batch) return sendError(res, 'Batch not found', 404);

    if (mentorId) {
      const mentorUser = await User.findById(mentorId);
      if (!mentorUser || !['teacher', 'hod'].includes(mentorUser.role)) {
        return sendError(res, 'Assigned mentor must be a valid faculty member (Teacher or HOD)', 400);
      }

      const mentorProfile = await TeacherProfile.findOne({ user: mentorId });
      if (!mentorProfile || !mentorProfile.isMentor) {
        return sendError(
          res,
          'Selected faculty member does not have mentor privilege enabled. Please designate them as an authorized mentor in Faculty Management first.',
          400
        );
      }

      batch.mentor = mentorId;
      await batch.save();

      let affectedStudents = 0;
      if (updateExistingStudents) {
        const studentProfiles = await StudentProfile.find({ batch: batch._id });
        affectedStudents = studentProfiles.length;
        await StudentProfile.updateMany({ batch: batch._id }, { mentor: mentorId });

        if (notifyStudents && studentProfiles.length > 0) {
          const notifs = studentProfiles.map((sp) => ({
            recipient: sp.user,
            sender: req.user._id,
            title: 'Faculty Mentor Assigned',
            message: `${mentorUser.name} has been appointed as your Faculty Mentor for ${batch.name}. Reach out for academic guidance and counseling.`,
            type: 'system',
            priority: 'medium',
            link: '/mentorship',
          }));
          await Notification.insertMany(notifs);
        }
      }

      if (notifyStudents) {
        await Notification.create({
          recipient: mentorId,
          sender: req.user._id,
          title: 'Batch Mentorship Allocation',
          message: `You have been appointed as the Faculty Mentor for ${batch.name} (${affectedStudents} students). You can now monitor their attendance and support requests.`,
          type: 'system',
          priority: 'high',
          link: '/mentorship',
        });
      }

      const populated = await Batch.findById(batch._id)
        .populate('department course', 'name code')
        .populate('mentor', 'name email phone role')
        .lean();

      broadcastEvent('batch_updated', { entity: 'batch', action: 'mentor_assigned', data: populated });
      broadcastEvent('students_updated', { action: 'mentor_assigned', batchId: batch._id });
      broadcastEvent('mentorship_updated', { batchId: batch._id, mentorId });
      return sendSuccess(res, `Assigned ${mentorUser.name} as mentor for ${batch.name} (${affectedStudents} students synced)`, populated);
    } else {
      batch.mentor = null;
      await batch.save();

      if (updateExistingStudents) {
        await StudentProfile.updateMany({ batch: batch._id }, { mentor: null });
        broadcastEvent('students_updated', { action: 'mentor_unassigned', batchId: batch._id });
      }

      const populated = await Batch.findById(batch._id)
        .populate('department course', 'name code')
        .populate('mentor', 'name email phone role')
        .lean();

      broadcastEvent('batch_updated', { entity: 'batch', action: 'mentor_unassigned', data: populated });
      broadcastEvent('mentorship_updated', { batchId: batch._id });
      return sendSuccess(res, `Unassigned mentor from ${batch.name}`, populated);
    }
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ==================== CLASSROOMS ====================
export const getClassrooms = async (req, res) => {
  try {
    const classrooms = await Classroom.find({ isActive: true }).lean();
    return sendSuccess(res, 'Classrooms retrieved', classrooms);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const createClassroom = async (req, res) => {
  try {
    const { roomNumber, block, capacity, type, hasProjector } = req.body;
    const classroom = await Classroom.create({ roomNumber, block, capacity, type, hasProjector });
    broadcastEvent('academics_updated', { entity: 'classroom', action: 'create', data: classroom });
    return sendSuccess(res, 'Classroom created', classroom, 201);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const updateClassroom = async (req, res) => {
  try {
    const { roomNumber, block, capacity, type, hasProjector, isActive } = req.body;
    const classroom = await Classroom.findById(req.params.id);
    if (!classroom) return sendError(res, 'Classroom not found', 404);

    if (roomNumber) classroom.roomNumber = roomNumber;
    if (block) classroom.block = block;
    if (capacity !== undefined) classroom.capacity = capacity;
    if (type) classroom.type = type;
    if (hasProjector !== undefined) classroom.hasProjector = hasProjector;
    if (isActive !== undefined) classroom.isActive = isActive;

    await classroom.save();
    broadcastEvent('academics_updated', { entity: 'classroom', action: 'update', data: classroom });
    return sendSuccess(res, 'Classroom updated', classroom);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ==================== SUBJECTS ====================
export const getSubjects = async (req, res) => {
  try {
    const filter = { isActive: true };
    if (['teacher', 'hod'].includes(req.user?.role)) {
      filter.department = req.user.department;
    } else if (req.query.department) {
      filter.department = req.query.department;
    }
    if (req.query.course) filter.course = req.query.course;
    if (req.query.semester) filter.semester = Number(req.query.semester);
    const subjects = await Subject.find(filter).populate('department course', 'name code').lean();
    return sendSuccess(res, 'Subjects retrieved', subjects);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const createSubject = async (req, res) => {
  try {
    const { name, code, department, course, semester, credits, type } = req.body;
    const subject = await Subject.create({ name, code, department, course, semester, credits, type });
    const populated = await Subject.findById(subject._id).populate('department course', 'name code').lean();
    broadcastEvent('subject_updated', { entity: 'subject', action: 'create', data: populated });
    broadcastEvent('academics_updated', { entity: 'subject', action: 'create', data: populated });
    return sendSuccess(res, 'Subject created', populated, 201);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const updateSubject = async (req, res) => {
  try {
    const { name, code, department, course, semester, credits, type, isActive } = req.body;
    const subject = await Subject.findById(req.params.id);
    if (!subject) return sendError(res, 'Subject not found', 404);

    if (name) subject.name = name;
    if (code) subject.code = code;
    if (department) subject.department = department;
    if (course) subject.course = course;
    if (semester !== undefined) subject.semester = semester;
    if (credits !== undefined) subject.credits = credits;
    if (type) subject.type = type;
    if (isActive !== undefined) subject.isActive = isActive;

    await subject.save();
    const populated = await Subject.findById(subject._id).populate('department course', 'name code').lean();
    broadcastEvent('subject_updated', { entity: 'subject', action: 'update', data: populated });
    broadcastEvent('academics_updated', { entity: 'subject', action: 'update', data: populated });
    return sendSuccess(res, 'Subject updated', populated);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

/**
 * GET /api/academics/student/curriculum
 * Returns comprehensive semester-by-semester course curriculum with per-subject attendance
 * metrics and full day-by-day color-coded attendance calendar ledger.
 */
export const getStudentCurriculumAttendance = async (req, res) => {
  try {
    let studentId = req.user._id;
    if (req.query.studentId && ['teacher', 'hod', 'college_admin', 'super_admin'].includes(req.user.role)) {
      studentId = req.query.studentId;
    }

    const profile = await StudentProfile.findOne({ user: studentId })
      .populate('course department batch')
      .populate('mentor', 'name email phone')
      .lean();

    if (!profile) {
      return sendError(res, 'Student profile not found', 404);
    }

    const studentUser = await User.findById(studentId).select('name email phone avatar').lean();

    const courseId = profile.course?._id;
    const batchId = profile.batch?._id;
    const totalSemesters = profile.course?.totalSemesters || 4;
    const currentSemester = profile.batch?.currentSemester || 1;

    // 1. Fetch all subjects for this course across all semesters
    const courseSubjects = courseId
      ? await Subject.find({ course: courseId, isActive: true })
          .populate('department', 'name code')
          .sort({ semester: 1, code: 1 })
          .lean()
      : [];

    // 2. Fetch all batch sessions conducted
    const batchSessions = batchId
      ? await AttendanceSession.find({ batch: batchId })
          .populate('subject classroom teacher', 'name code roomNumber')
          .sort({ date: 1, createdAt: 1 })
          .lean()
      : [];

    // 3. Fetch all attendance records for this student
    const studentRecords = await AttendanceRecord.find({ student: studentId })
      .populate('subject')
      .lean();

    const presentSessionMap = new Map();
    studentRecords.forEach((r) => {
      if (r.session) {
        presentSessionMap.set(r.session.toString(), r);
      }
    });

    // 4. Fetch daily classes for this batch to capture paused classes
    const dailyClasses = batchId
      ? await DailyClass.find({ batch: batchId })
          .populate('subject classroom teacher originalTeacher', 'name code roomNumber')
          .sort({ date: 1, startTime: 1 })
          .lean()
      : [];

    // 5. Structure by Semester (1 to totalSemesters)
    const semesterData = [];
    for (let sem = 1; sem <= totalSemesters; sem++) {
      const semSubjects = courseSubjects.filter((s) => s.semester === sem);
      let semConducted = 0;
      let semAttended = 0;

      const subjectsWithStats = semSubjects.map((sub) => {
        const subIdStr = sub._id.toString();
        // Sessions conducted for this subject in the batch
        const subSessions = batchSessions.filter((s) => (s.subject?._id || s.subject)?.toString() === subIdStr);
        // Student's present count for this subject
        const subPresentRecords = studentRecords.filter(
          (r) => (r.subject?._id || r.subject)?.toString() === subIdStr && r.status === 'present'
        );

        const conducted = subSessions.length;
        const attended = subPresentRecords.length;
        const effConducted = Math.max(conducted, attended);
        const absent = Math.max(0, effConducted - attended);
        const percentage = effConducted > 0 ? Math.round((attended / effConducted) * 100) : 100;
        const isDefaulter = percentage < 75;
        const isCritical = percentage < 60;
        const classesNeededTo75 = isDefaulter ? Math.max(1, Math.ceil(3 * effConducted - 4 * attended)) : 0;

        semConducted += effConducted;
        semAttended += attended;

        return {
          _id: sub._id,
          name: sub.name,
          code: sub.code,
          credits: sub.credits,
          type: sub.type,
          department: sub.department?.name,
          conducted: effConducted,
          attended,
          absent,
          percentage,
          isDefaulter,
          isCritical,
          classesNeededTo75,
          status: percentage >= 75 ? 'good' : percentage >= 60 ? 'warning' : 'critical',
        };
      });

      const semPercentage = semConducted > 0 ? Math.round((semAttended / semConducted) * 100) : 100;
      const totalCredits = semSubjects.reduce((acc, s) => acc + (s.credits || 0), 0);

      semesterData.push({
        semester: sem,
        isCurrentSemester: sem === currentSemester,
        totalCredits,
        totalSubjects: semSubjects.length,
        overallAttendance: {
          conducted: semConducted,
          attended: semAttended,
          absent: Math.max(0, semConducted - semAttended),
          percentage: semPercentage,
          isDefaulter: semPercentage < 75,
        },
        subjects: subjectsWithStats,
      });
    }

    // 6. Build Comprehensive Calendar Date Map
    // Key: 'YYYY-MM-DD', Value: { date, status, totalClasses, attendedCount, absentCount, pausedCount, classes: [...] }
    const calendarDates = {};

    const toYMD = (d) => {
      if (!d) return null;
      if (typeof d === 'string' && d.length === 10) return d;
      const dateObj = new Date(d);
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    // A. Add from batch sessions
    batchSessions.forEach((session) => {
      const dateKey = toYMD(session.date || session.createdAt);
      if (!dateKey) return;

      if (!calendarDates[dateKey]) {
        calendarDates[dateKey] = {
          date: dateKey,
          totalClasses: 0,
          attendedCount: 0,
          absentCount: 0,
          pausedCount: 0,
          classes: [],
        };
      }

      const rec = presentSessionMap.get(session._id.toString());
      const isPresent = rec && rec.status === 'present';

      calendarDates[dateKey].totalClasses++;
      if (isPresent) calendarDates[dateKey].attendedCount++;
      else calendarDates[dateKey].absentCount++;

      calendarDates[dateKey].classes.push({
        id: session._id,
        subjectId: session.subject?._id,
        subjectName: session.subject?.name || 'Class Lecture',
        subjectCode: session.subject?.code || '',
        roomNumber: session.classroom?.roomNumber || 'Room',
        teacherName: session.teacher?.name || 'Faculty Instructor',
        status: isPresent ? 'present' : 'absent',
        scannedAt: rec?.scannedAt || null,
        durationMinutes: session.durationMinutes || 10,
        sessionCode: session.sessionCode,
      });
    });

    // B. Add from daily classes for paused notices
    dailyClasses.forEach((dc) => {
      const dateKey = dc.date;
      if (!dateKey) return;

      if (!calendarDates[dateKey]) {
        calendarDates[dateKey] = {
          date: dateKey,
          totalClasses: 0,
          attendedCount: 0,
          absentCount: 0,
          pausedCount: 0,
          classes: [],
        };
      }

      if (dc.status === 'paused') {
        calendarDates[dateKey].pausedCount++;
        calendarDates[dateKey].classes.push({
          id: dc._id,
          subjectId: dc.subject?._id,
          subjectName: dc.subject?.name || 'Curriculum Class',
          subjectCode: dc.subject?.code || '',
          roomNumber: dc.classroom?.roomNumber || 'Room',
          teacherName: dc.teacher?.name || 'Faculty',
          status: 'paused',
          pauseReason: dc.pauseReason || 'Class suspended for today',
          time: `${dc.startTime} - ${dc.endTime}`,
        });
      }
    });

    // Compute day overall status for each calendar date
    Object.values(calendarDates).forEach((day) => {
      if (day.pausedCount > 0 && day.totalClasses === 0) {
        day.dayStatus = 'paused';
      } else if (day.totalClasses > 0) {
        if (day.attendedCount === day.totalClasses) {
          day.dayStatus = 'all_present';
        } else if (day.attendedCount > 0) {
          day.dayStatus = 'partial';
        } else {
          day.dayStatus = 'all_absent';
        }
      } else {
        day.dayStatus = 'no_class';
      }
    });

    return sendSuccess(res, 'Student curriculum and attendance ledger retrieved', {
      student: {
        _id: studentId,
        name: studentUser?.name,
        email: studentUser?.email,
        phone: studentUser?.phone,
        rollNumber: profile.rollNumber,
        department: profile.department?.name,
        departmentCode: profile.department?.code,
        course: profile.course?.name,
        courseCode: profile.course?.code,
        batch: profile.batch?.name,
        currentSemester,
        totalSemesters,
        mentor: profile.mentor ? { name: profile.mentor.name, email: profile.mentor.email } : null,
      },
      semesters: semesterData,
      calendarDates,
    });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};
