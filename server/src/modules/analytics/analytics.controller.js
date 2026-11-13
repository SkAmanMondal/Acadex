import User from '../users/user.model.js';
import StudentProfile from '../users/studentProfile.model.js';
import AttendanceRecord from '../attendance/attendanceRecord.model.js';
import AttendanceSession from '../attendance/attendanceSession.model.js';
import ExamResult from '../examinations/examResult.model.js';
import Submission from '../assignments/submission.model.js';
import Assignment from '../assignments/assignment.model.js';
import SupportRequest from '../mentorship/supportRequest.model.js';
import Department from '../academics/department.model.js';
import Course from '../academics/course.model.js';
import Batch from '../academics/batch.model.js';
import Timetable from '../timetable/timetable.model.js';
import DailyClass from '../timetable/dailyClass.model.js';
import { ensureDailyClassesForDate, formatDateToYMD } from '../timetable/dailyClass.controller.js';
import Material from '../materials/material.model.js';
import Quiz from '../assessments/quiz.model.js';
import QuizAttempt from '../assessments/quizAttempt.model.js';
import { sendSuccess, sendError } from '../../utils/response.js';

/**
 * Multi-factor explainable academic risk intelligence engine
 */
export const getAcademicRiskIndicators = async (req, res) => {
  try {
    const studentFilter = { role: 'student', isActive: true };

    if (req.user.role === 'hod') {
      studentFilter.department = req.user.department;
    } else if (req.query.department) {
      studentFilter.department = req.query.department;
    }

    const students = await User.find(studentFilter).select('name email department phone');
    const studentIds = students.map((s) => s._id);

    const profiles = await StudentProfile.find({ user: { $in: studentIds } })
      .populate('course batch department mentor', 'name code rollNumber');

    const profileMap = new Map();
    profiles.forEach((p) => profileMap.set(p.user.toString(), p));

    // For faculty mentors viewing assigned mentees
    let targetStudents = students;
    if (req.query.onlyMentees === 'true' && ['teacher', 'hod'].includes(req.user.role)) {
      targetStudents = students.filter((s) => {
        const p = profileMap.get(s._id.toString());
        return p?.mentor?.toString() === req.user._id.toString();
      });
    }

    const riskReports = [];

    for (const student of targetStudents) {
      const profile = profileMap.get(student._id.toString());
      if (!profile) continue;

      const factors = [];
      let riskScore = 0;

      // 1. Attendance Evaluation
      const totalBatchSessions = await AttendanceSession.countDocuments({ batch: profile.batch, status: { $ne: 'active' } });
      const studentAttended = await AttendanceRecord.countDocuments({ student: student._id, status: 'present' });

      if (totalBatchSessions > 0) {
        const attendancePercentage = Math.round((studentAttended / totalBatchSessions) * 100);
        if (attendancePercentage < 75) {
          riskScore += (75 - attendancePercentage) > 20 ? 35 : 20;
          factors.push({
            dimension: 'Attendance',
            severity: attendancePercentage < 60 ? 'critical' : 'warning',
            message: `Attendance is ${attendancePercentage}% (${studentAttended}/${totalBatchSessions} classes attended), which is below the mandatory 75% threshold.`,
          });
        }
      }

      // 2. Examination Performance Evaluation
      const results = await ExamResult.find({ student: student._id }).populate('subject', 'name');
      for (const res of results) {
        const pct = (res.marksObtained / res.maxMarks) * 100;
        if (pct < 40) {
          riskScore += 25;
          factors.push({
            dimension: 'Examination',
            severity: 'critical',
            message: `Scored ${res.marksObtained}/${res.maxMarks} (${Math.round(pct)}%) in ${res.subject?.name || 'Subject'}, falling below the passing benchmark.`,
          });
        }
      }

      // 3. Assignment Compliance Evaluation
      const batchAssignments = await Assignment.find({ batch: profile.batch });
      const completedSubmissions = await Submission.countDocuments({ student: student._id });
      const missingCount = Math.max(0, batchAssignments.length - completedSubmissions);

      if (missingCount > 0) {
        riskScore += missingCount * 10;
        factors.push({
          dimension: 'Assignments',
          severity: missingCount > 2 ? 'critical' : 'warning',
          message: `${missingCount} pending/unsubmitted assignment(s) detected for current semester coursework.`,
        });
      }

      // 4. Mentorship Support Backlog
      const unresolvedRequests = await SupportRequest.countDocuments({
        student: student._id,
        status: { $in: ['submitted', 'in_review'] },
      });

      if (unresolvedRequests > 0) {
        riskScore += 10;
        factors.push({
          dimension: 'Mentorship',
          severity: 'warning',
          message: `${unresolvedRequests} unresolved academic support request(s) awaiting follow-up.`,
        });
      }

      // Determine Overall Level
      let riskLevel = 'normal';
      if (riskScore >= 40) riskLevel = 'high';
      else if (riskScore >= 20) riskLevel = 'moderate';

      if (factors.length > 0) {
        riskReports.push({
          student: {
            _id: student._id,
            name: student.name,
            email: student.email,
            rollNumber: profile.rollNumber,
            batch: profile.batch?.name,
            mentor: profile.mentor?.name || 'Unassigned',
          },
          riskLevel,
          riskScore,
          factors,
        });
      }
    }

    // Sort by most critical risk first
    riskReports.sort((a, b) => b.riskScore - a.riskScore);

    return sendSuccess(res, 'Academic risk indicators evaluated', riskReports);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

let lastEnsuredDate = null;
let lastEnsuredTimestamp = 0;

const throttleEnsureDailyClasses = async (todayStr) => {
  const now = Date.now();
  if (lastEnsuredDate === todayStr && now - lastEnsuredTimestamp < 5 * 60 * 1000) {
    return;
  }
  lastEnsuredDate = todayStr;
  lastEnsuredTimestamp = now;
  await ensureDailyClassesForDate(todayStr).catch(() => {});
};

let adminMetricsCache = null;
let adminMetricsCacheTime = 0;

/**
 * Tailored, role-specific real-time dashboard metrics (High Performance Cached & Lean)
 */
export const getDashboardMetrics = async (req, res) => {
  try {
    const role = req.user.role;
    const userId = req.user._id;

    // 1. ADMIN DASHBOARD METRICS
    if (role === 'college_admin' || role === 'super_admin') {
      const now = Date.now();
      if (adminMetricsCache && now - adminMetricsCacheTime < 15 * 1000) {
        return sendSuccess(res, 'Admin overview metrics (cached)', adminMetricsCache);
      }

      const [
        totalStudents,
        totalTeachers,
        totalDepartments,
        totalCourses,
        totalBatches,
        totalMaterials,
        totalQuizzes,
        totalAssignments,
        activeAttendanceSessions,
      ] = await Promise.all([
        User.countDocuments({ role: 'student', isActive: true }),
        User.countDocuments({ role: { $in: ['teacher', 'hod'] }, isActive: true }),
        Department.countDocuments({}),
        Course.countDocuments({}),
        Batch.countDocuments({}),
        Material.countDocuments({}),
        Quiz.countDocuments({}),
        Assignment.countDocuments({}),
        AttendanceSession.countDocuments({ status: 'active' }),
      ]);

      const adminPayload = {
        role: 'college_admin',
        totalStudents,
        totalTeachers,
        totalDepartments,
        totalCourses,
        totalBatches,
        totalMaterials,
        totalQuizzes,
        totalAssignments,
        activeAttendanceSessions,
      };

      adminMetricsCache = adminPayload;
      adminMetricsCacheTime = now;

      return sendSuccess(res, 'Admin overview metrics', adminPayload);
    }

    const todayStr = formatDateToYMD(new Date());
    await throttleEnsureDailyClasses(todayStr);

    // 2. HOD DASHBOARD METRICS
    if (role === 'hod') {
      const deptId = req.user.department;
      const [
        deptStudents,
        deptFaculty,
        deptCourses,
        deptBatches,
        deptTimetableSlots,
        deptMaterials,
        activeSession,
        todayDepartmentClasses,
        myTeachingClasses,
      ] = await Promise.all([
        User.countDocuments({ role: 'student', department: deptId }),
        User.countDocuments({ role: { $in: ['teacher', 'hod'] }, department: deptId }),
        Course.countDocuments({ department: deptId }),
        Batch.countDocuments({ department: deptId }),
        Timetable.countDocuments({ department: deptId }),
        Material.countDocuments({ department: deptId }),
        AttendanceSession.findOne({ teacher: userId, status: { $in: ['active', 'pending'] } })
          .sort({ createdAt: -1 })
          .populate('subject batch classroom', 'name code roomNumber')
          .lean(),
        DailyClass.find({ date: todayStr, department: deptId })
          .populate('subject batch classroom teacher originalTeacher', 'name code roomNumber')
          .sort({ startTime: 1 })
          .lean(),
        DailyClass.find({ date: todayStr, teacher: userId })
          .populate('subject batch classroom teacher originalTeacher', 'name code roomNumber')
          .sort({ startTime: 1 })
          .lean(),
      ]);

      // Calculate department attendance shortage defaulters count (< 75%)
      let deptDefaultersCount = 0;
      try {
        const deptBatchesList = await Batch.find({ department: deptId }).select('_id').lean();
        const deptBatchIds = deptBatchesList.map((b) => b._id);
        const deptProfiles = await StudentProfile.find({ batch: { $in: deptBatchIds } }).select('user batch').lean();
        if (deptProfiles.length > 0) {
          const batchSessionsAgg = await AttendanceSession.aggregate([
            { $match: { batch: { $in: deptBatchIds } } },
            { $group: { _id: '$batch', count: { $sum: 1 } } },
          ]);
          const sessionCountMap = new Map();
          batchSessionsAgg.forEach((b) => sessionCountMap.set(b._id.toString(), b.count));

          const studentIds = deptProfiles.map((p) => p.user);
          const recordsAgg = await AttendanceRecord.aggregate([
            { $match: { student: { $in: studentIds }, status: 'present' } },
            { $group: { _id: '$student', count: { $sum: 1 } } },
          ]);
          const recordCountMap = new Map();
          recordsAgg.forEach((r) => recordCountMap.set(r._id.toString(), r.count));

          for (const p of deptProfiles) {
            const totalSessions = sessionCountMap.get(p.batch?.toString()) || 0;
            if (totalSessions > 0) {
              const attendedCount = recordCountMap.get(p.user?.toString()) || 0;
              const eff = Math.max(totalSessions, attendedCount);
              if ((attendedCount / eff) * 100 < 75) {
                deptDefaultersCount++;
              }
            }
          }
        }
      } catch (err) {
        console.error('Error calculating HOD defaulters count:', err);
      }

      return sendSuccess(res, 'HOD overview metrics', {
        role: 'hod',
        deptStudents,
        deptFaculty,
        deptCourses,
        deptBatches,
        deptTimetableSlots,
        deptMaterials,
        deptDefaultersCount,
        activeSession: activeSession || null,
        todayDepartmentClasses,
        todaySlots: myTeachingClasses,
      });
    }

    // 3. TEACHER DASHBOARD METRICS
    if (role === 'teacher') {
      const [
        myTimetableSlots,
        myMaterials,
        myAssignments,
        myQuizzes,
        myMentees,
        unreviewedSubmissions,
        activeSession,
        myDailyClasses,
      ] = await Promise.all([
        Timetable.find({ teacher: userId }).select('subject batch classroom startTime endTime day').populate('subject batch classroom', 'name code roomNumber').lean(),
        Material.countDocuments({ teacher: userId }),
        Assignment.countDocuments({ teacher: userId }),
        Quiz.countDocuments({ createdBy: userId }),
        StudentProfile.countDocuments({ mentor: userId }),
        Submission.countDocuments({ status: 'submitted' }),
        AttendanceSession.findOne({ teacher: userId, status: { $in: ['active', 'pending'] } })
          .sort({ createdAt: -1 })
          .populate('subject batch classroom', 'name code roomNumber')
          .lean(),
        DailyClass.find({ date: todayStr, teacher: userId })
          .select('subject batch classroom teacher originalTeacher startTime endTime status isSubstituted pauseReason')
          .populate('subject batch classroom teacher originalTeacher', 'name code roomNumber')
          .sort({ startTime: 1 })
          .lean(),
      ]);

      // Calculate attendance defaulters count among teacher's mentees (< 75%)
      let menteeDefaultersCount = 0;
      try {
        const menteeProfiles = await StudentProfile.find({ mentor: userId }).select('user batch').lean();
        if (menteeProfiles.length > 0) {
          const menteeBatchIds = [...new Set(menteeProfiles.map((p) => p.batch?.toString()).filter(Boolean))];
          const batchSessionsAgg = await AttendanceSession.aggregate([
            { $match: { batch: { $in: menteeBatchIds } } },
            { $group: { _id: '$batch', count: { $sum: 1 } } },
          ]);
          const sessionCountMap = new Map();
          batchSessionsAgg.forEach((b) => sessionCountMap.set(b._id.toString(), b.count));

          const studentIds = menteeProfiles.map((p) => p.user);
          const recordsAgg = await AttendanceRecord.aggregate([
            { $match: { student: { $in: studentIds }, status: 'present' } },
            { $group: { _id: '$student', count: { $sum: 1 } } },
          ]);
          const recordCountMap = new Map();
          recordsAgg.forEach((r) => recordCountMap.set(r._id.toString(), r.count));

          for (const p of menteeProfiles) {
            const totalSessions = sessionCountMap.get(p.batch?.toString()) || 0;
            if (totalSessions > 0) {
              const attendedCount = recordCountMap.get(p.user?.toString()) || 0;
              const eff = Math.max(totalSessions, attendedCount);
              if ((attendedCount / eff) * 100 < 75) {
                menteeDefaultersCount++;
              }
            }
          }
        }
      } catch (err) {
        console.error('Error calculating teacher mentee defaulters:', err);
      }

      return sendSuccess(res, 'Teacher overview metrics', {
        role: 'teacher',
        totalSlots: myTimetableSlots.length,
        todaySlots: myDailyClasses.length > 0 ? myDailyClasses : myTimetableSlots,
        totalMaterials: myMaterials,
        totalAssignments: myAssignments,
        totalQuizzes: myQuizzes,
        totalMentees: myMentees,
        menteeDefaultersCount,
        pendingGrades: unreviewedSubmissions,
        activeSession: activeSession || null,
      });
    }

    // 4. STUDENT DASHBOARD METRICS (High Performance: countDocuments & lean projection)
    if (role === 'student') {
      const profile = await StudentProfile.findOne({ user: userId })
        .select('rollNumber batch course department mentor')
        .populate('batch course department mentor', 'name code email')
        .lean();

      const batchId = profile?.batch?._id || profile?.batch;

      const [
        attended,
        totalBatchSessions,
        todaySlotsMaster,
        todayDailyClasses,
        availableQuizzes,
        pendingAssignments,
        recentSubmissions,
      ] = await Promise.all([
        AttendanceRecord.countDocuments({ student: userId, status: 'present' }),
        batchId ? AttendanceSession.countDocuments({ batch: batchId }) : 0,
        batchId ? Timetable.find({ batch: batchId }).select('subject classroom teacher startTime endTime day').populate('subject classroom teacher', 'name code roomNumber').lean() : [],
        batchId
          ? DailyClass.find({ date: todayStr, batch: batchId })
              .select('subject classroom teacher originalTeacher startTime endTime status isSubstituted pauseReason')
              .populate('subject classroom teacher originalTeacher', 'name code roomNumber')
              .sort({ startTime: 1 })
              .lean()
          : [],
        batchId ? Quiz.find({ batch: batchId, isPublished: true }).select('title description duration subject deadline totalMarks').populate('subject', 'name code').limit(5).lean() : [],
        batchId ? Assignment.find({ batch: batchId }).select('title dueDate subject maxMarks').populate('subject', 'name code').limit(5).lean() : [],
        Submission.find({ student: userId }).select('assignment status').lean(),
      ]);

      const effectiveConducted = Math.max(totalBatchSessions, attended);
      const attendancePercent = effectiveConducted > 0 ? Math.round((attended / effectiveConducted) * 100) : 100;
      const isDefaulter = attendancePercent < 75;
      const isCritical = attendancePercent < 60;
      const classesNeededTo75 = isDefaulter ? Math.max(1, Math.ceil(3 * effectiveConducted - 4 * attended)) : 0;
      const status = attendancePercent >= 75 ? 'good' : (attendancePercent >= 60 ? 'warning' : 'critical');

      // Recover mentor from batch if missing on profile
      let mentorObj = profile?.mentor ? { _id: profile.mentor._id, name: profile.mentor.name, email: profile.mentor.email } : null;
      if (!mentorObj && profile?.batch?.mentor) {
        const batchMentor = await User.findById(profile.batch.mentor).select('name email').lean();
        if (batchMentor) {
          mentorObj = { _id: batchMentor._id, name: batchMentor.name, email: batchMentor.email };
        }
      }

      const submittedAssignIds = new Set(recentSubmissions.map((s) => s.assignment?.toString()));
      const uncompletedAssignments = pendingAssignments.filter((a) => !submittedAssignIds.has(a._id.toString()));

      return sendSuccess(res, 'Student overview metrics', {
        role: 'student',
        profile: {
          rollNumber: profile?.rollNumber,
          batchName: profile?.batch?.name,
          courseName: profile?.course?.name,
          mentor: mentorObj,
        },
        attendance: {
          attended,
          conducted: effectiveConducted,
          percentage: attendancePercent,
          isDefaulter,
          isCritical,
          classesNeededTo75,
          threshold: 75,
          status,
        },
        todaySlots: todayDailyClasses.length > 0 ? todayDailyClasses : todaySlotsMaster,
        availableQuizzes: availableQuizzes.slice(0, 3),
        pendingAssignments: uncompletedAssignments.slice(0, 3),
      });
    }

    return sendSuccess(res, 'Default metrics', {});
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};
