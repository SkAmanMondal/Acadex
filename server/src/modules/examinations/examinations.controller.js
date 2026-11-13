import Examination from './examination.model.js';
import ExamResult from './examResult.model.js';
import User from '../users/user.model.js';
import StudentProfile from '../users/studentProfile.model.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { broadcastEvent } from '../../config/socket.js';

export const createExamination = async (req, res) => {
  try {
    const { title, type, academicYear, semester, department, startDate, endDate } = req.body;
    const exam = await Examination.create({
      title,
      type,
      academicYear,
      semester,
      department,
      startDate,
      endDate,
    });
    return sendSuccess(res, 'Examination scheduled', exam, 201);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const deleteExamination = async (req, res) => {
  try {
    const { id } = req.params;
    const exam = await Examination.findByIdAndDelete(id);
    if (!exam) return sendError(res, 'Examination not found', 404);
    await ExamResult.deleteMany({ examination: id });
    return sendSuccess(res, 'Examination deleted successfully');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const getExaminations = async (req, res) => {
  try {
    const filter = {};
    if (req.query.department) filter.department = req.query.department;
    if (req.query.type) filter.type = req.query.type;

    const exams = await Examination.find(filter).populate('department', 'name code');
    return sendSuccess(res, 'Examinations retrieved', exams);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

/**
 * Teacher enters or updates internal examination marks
 */
export const enterInternalMarks = async (req, res) => {
  try {
    const { examinationId, studentId, subjectId, batchId, marksObtained, maxMarks } = req.body;

    const exam = await Examination.findById(examinationId);
    if (!exam || exam.type !== 'internal') {
      return sendError(res, 'Invalid examination or not an internal assessment', 400);
    }

    const result = await ExamResult.findOneAndUpdate(
      { examination: examinationId, student: studentId, subject: subjectId },
      {
        batch: batchId,
        type: 'internal',
        marksObtained: Number(marksObtained),
        maxMarks: Number(maxMarks) || 50,
        enteredBy: req.user._id,
      },
      { upsert: true, new: true }
    );

    broadcastEvent('marks_updated', { examinationId, studentId, subjectId, batchId, marksObtained });
    broadcastEvent('dashboard_refresh', {});

    return sendSuccess(res, 'Internal marks recorded successfully', result);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

/**
 * College Admin enters or publishes official semester results
 */
export const enterSemesterMarks = async (req, res) => {
  try {
    const { examinationId, studentId, subjectId, batchId, marksObtained, maxMarks, grade } = req.body;

    const exam = await Examination.findById(examinationId);
    if (!exam || exam.type !== 'semester') {
      return sendError(res, 'Invalid examination or not a semester examination', 400);
    }

    const result = await ExamResult.findOneAndUpdate(
      { examination: examinationId, student: studentId, subject: subjectId },
      {
        batch: batchId,
        type: 'semester',
        marksObtained: Number(marksObtained),
        maxMarks: Number(maxMarks) || 100,
        grade,
        enteredBy: req.user._id,
      },
      { upsert: true, new: true }
    );

    broadcastEvent('marks_updated', { examinationId, studentId, subjectId, batchId, marksObtained, grade });
    broadcastEvent('dashboard_refresh', {});

    return sendSuccess(res, 'Official semester marks recorded', result);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const getStudentResults = async (req, res) => {
  try {
    const studentId = req.params.studentId || req.user._id;

    const results = await ExamResult.find({ student: studentId })
      .populate('examination subject enteredBy', 'title type name code email credits')
      .sort({ createdAt: -1 })
      .lean();

    return sendSuccess(res, 'Academic marks retrieved', results);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const updateExamResult = async (req, res) => {
  try {
    const { id } = req.params;
    const { marksObtained, maxMarks, grade } = req.body;

    const result = await ExamResult.findById(id);
    if (!result) return sendError(res, 'Exam record not found', 404);

    if (marksObtained !== undefined) result.marksObtained = Number(marksObtained);
    if (maxMarks !== undefined) result.maxMarks = Number(maxMarks);
    if (grade) result.grade = grade;
    result.enteredBy = req.user._id;

    await result.save();
    const populated = await ExamResult.findById(id).populate('examination subject enteredBy', 'title type name code email');

    broadcastEvent('marks_updated', { id, result: populated });
    broadcastEvent('dashboard_refresh', {});

    return sendSuccess(res, 'Exam result updated successfully', populated);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const deleteExamResult = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await ExamResult.findByIdAndDelete(id);
    if (!result) return sendError(res, 'Exam record not found', 404);

    broadcastEvent('marks_updated', { id, deleted: true });
    broadcastEvent('dashboard_refresh', {});

    return sendSuccess(res, 'Exam record removed successfully');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

/**
 * Generate official comprehensive academic transcript / grade card
 */
export const getStudentTranscript = async (req, res) => {
  try {
    const studentId = req.params.studentId || req.user._id;

    const [user, profile, results] = await Promise.all([
      User.findById(studentId).populate('department', 'name code'),
      StudentProfile.findOne({ user: studentId }).populate('batch course department mentor'),
      ExamResult.find({ student: studentId }).populate('examination subject', 'title type name code credits semester'),
    ]);

    if (!user) return sendError(res, 'Student not found', 404);

    // Group marks by subject
    const subjectMap = {};
    results.forEach((r) => {
      const subId = r.subject?._id?.toString();
      if (!subId) return;

      if (!subjectMap[subId]) {
        subjectMap[subId] = {
          subjectId: subId,
          name: r.subject.name,
          code: r.subject.code,
          credits: r.subject.credits || 4,
          internalMarks: null,
          semesterMarks: null,
        };
      }

      if (r.type === 'internal') {
        subjectMap[subId].internalMarks = {
          obtained: r.marksObtained,
          max: r.maxMarks,
          percentage: Math.round((r.marksObtained / r.maxMarks) * 100),
        };
      } else if (r.type === 'semester') {
        subjectMap[subId].semesterMarks = {
          obtained: r.marksObtained,
          max: r.maxMarks,
          percentage: Math.round((r.marksObtained / r.maxMarks) * 100),
          grade: r.grade,
        };
      }
    });

    // Compute grades & SGPA
    let totalCreditPoints = 0;
    let totalCredits = 0;
    let hasBacklog = false;

    const subjectsSummary = Object.values(subjectMap).map((s) => {
      const intObt = s.internalMarks?.obtained ?? 0;
      const intMax = s.internalMarks?.max ?? 50;
      const semObt = s.semesterMarks?.obtained ?? 0;
      const semMax = s.semesterMarks?.max ?? 100;

      const totalObtained = intObt + semObt;
      const totalMax = intMax + semMax;
      const overallPercent = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;

      let grade = 'F';
      let gradePoint = 0;

      if (overallPercent >= 90) { grade = 'O'; gradePoint = 10; }
      else if (overallPercent >= 80) { grade = 'A+'; gradePoint = 9; }
      else if (overallPercent >= 70) { grade = 'A'; gradePoint = 8; }
      else if (overallPercent >= 60) { grade = 'B+'; gradePoint = 7; }
      else if (overallPercent >= 50) { grade = 'B'; gradePoint = 6; }
      else if (overallPercent >= 40) { grade = 'C'; gradePoint = 5; }
      else { grade = 'F'; gradePoint = 0; hasBacklog = true; }

      const creditPoints = gradePoint * s.credits;
      totalCreditPoints += creditPoints;
      totalCredits += s.credits;

      return {
        ...s,
        totalObtained,
        totalMax,
        overallPercent,
        grade,
        gradePoint,
        creditPoints,
      };
    });

    const sgpa = totalCredits > 0 ? Math.round((totalCreditPoints / totalCredits) * 100) / 100 : 0;
    const finalResult = hasBacklog
      ? 'Academic Backlog (Supplementary Required)'
      : sgpa >= 8.5
      ? 'First Class with Distinction'
      : sgpa >= 6.5
      ? 'First Class'
      : 'Pass';

    return sendSuccess(res, 'Official student grade card generated', {
      student: {
        _id: user._id,
        name: user.name,
        email: user.email,
        rollNumber: profile?.rollNumber || 'N/A',
        enrollmentNumber: profile?.enrollmentNumber || 'N/A',
        department: profile?.department?.name || user.department?.name || 'Computer Applications',
        course: profile?.course?.name || 'Master of Computer Applications',
        batch: profile?.batch?.name || 'Batch 2024-2026',
        currentSemester: profile?.currentSemester || 3,
      },
      subjects: subjectsSummary,
      transcriptSummary: {
        totalCredits,
        totalCreditPoints,
        sgpa,
        percentageEquivalent: Math.round(sgpa * 9.5 * 10) / 10,
        resultStatus: finalResult,
        hasBacklog,
      },
    });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};
