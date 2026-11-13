import SupportRequest from './supportRequest.model.js';
import StudentProfile from '../users/studentProfile.model.js';
import Batch from '../academics/batch.model.js';
import AttendanceSession from '../attendance/attendanceSession.model.js';
import AttendanceRecord from '../attendance/attendanceRecord.model.js';
import ExamResult from '../examinations/examResult.model.js';
import { sendSuccess, sendError } from '../../utils/response.js';

export const createSupportRequest = async (req, res) => {
  try {
    const { category, subject, description } = req.body;

    const profile = await StudentProfile.findOne({ user: req.user._id });
    if (!profile || !profile.mentor) {
      return sendError(res, 'No assigned mentor found. Please contact administration.', 400);
    }

    const request = await SupportRequest.create({
      student: req.user._id,
      mentor: profile.mentor,
      category,
      subject,
      description,
      status: 'submitted',
    });

    const populated = await SupportRequest.findById(request._id)
      .populate('student mentor', 'name email');

    return sendSuccess(res, 'Support request submitted to your mentor', populated, 201);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const getMySupportRequests = async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === 'student') {
      filter.student = req.user._id;
    } else {
      // Faculty/Mentor viewing assigned requests
      filter.mentor = req.user._id;
    }

    const requests = await SupportRequest.find(filter)
      .populate('student mentor', 'name email')
      .sort({ createdAt: -1 });

    return sendSuccess(res, 'Support requests retrieved', requests);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const updateSupportRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, mentorNotes, sessionDate } = req.body;

    const request = await SupportRequest.findById(id);
    if (!request) return sendError(res, 'Support request not found', 404);

    if (status) request.status = status;
    if (mentorNotes !== undefined) request.mentorNotes = mentorNotes;
    if (sessionDate !== undefined) request.sessionDate = sessionDate;

    await request.save();

    const populated = await SupportRequest.findById(id).populate('student mentor', 'name email');
    return sendSuccess(res, 'Support request updated', populated);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const deleteSupportRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await SupportRequest.findById(id);
    if (!request) return sendError(res, 'Support request not found', 404);

    const isOwner = request.student?.toString() === req.user._id?.toString();
    const isMentor = request.mentor?.toString() === req.user._id?.toString();
    const isAdmin = ['college_admin', 'super_admin'].includes(req.user.role);

    if (!isOwner && !isMentor && !isAdmin) {
      return sendError(res, 'Not authorized to delete this support request', 403);
    }

    await SupportRequest.findByIdAndDelete(id);
    return sendSuccess(res, 'Support request deleted successfully');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

/**
 * Get all assigned mentees for the logged in faculty mentor
 */
export const getMyMentees = async (req, res) => {
  try {
    const mentorId = req.user._id;

    // Admin sees all students with mentors; faculty sees directly assigned mentees & their mentored batches
    const isElevated = ['college_admin', 'super_admin'].includes(req.user.role);
    let query;
    if (isElevated) {
      query = { mentor: { $ne: null } };
    } else {
      const mentoredBatches = await Batch.find({ mentor: mentorId }).select('_id').lean();
      const mentoredBatchIds = mentoredBatches.map((b) => b._id);
      query = {
        $or: [
          { mentor: mentorId },
          ...(mentoredBatchIds.length > 0 ? [{ batch: { $in: mentoredBatchIds } }] : [])
        ]
      };
    }

    const menteeProfiles = await StudentProfile.find(query)
      .populate('user', 'name email phone avatar')
      .populate('batch department course mentor', 'name code')
      .lean();

    // Enrich with attendance and performance metrics
    const enriched = await Promise.all(
      menteeProfiles.map(async (mp) => {
        const studentId = mp.user?._id;
        if (!studentId) return mp;

        // Attendance stats
        const totalConducted = mp.batch?._id
          ? await AttendanceSession.countDocuments({ batch: mp.batch._id })
          : 0;
        const attended = await AttendanceRecord.countDocuments({
          student: studentId,
          status: 'present',
        });
        const effTotal = Math.max(totalConducted, attended);
        const attendancePct = effTotal > 0 ? Math.round((attended / effTotal) * 100) : 100;

        // Pending support requests count
        const openTickets = await SupportRequest.countDocuments({
          student: studentId,
          status: { $in: ['submitted', 'in_review'] },
        });

        // Exam results average
        const results = await ExamResult.find({ student: studentId }).lean();
        const avgScore = results.length > 0
          ? Math.round(results.reduce((acc, r) => acc + (r.marksObtained / (r.maxMarks || 50)) * 100, 0) / results.length)
          : null;

        return {
          ...mp,
          attendancePct,
          isDefaulter: attendancePct < 75,
          totalConducted: effTotal,
          attended,
          openTickets,
          avgScore,
        };
      })
    );

    return sendSuccess(res, 'Assigned mentees retrieved successfully', enriched);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

/**
 * Document a direct counseling or advisory session with a mentee
 */
export const logMentorshipSession = async (req, res) => {
  try {
    const { studentId, category, subject, description, mentorNotes, sessionDate } = req.body;
    if (!studentId || !description) {
      return sendError(res, 'Student and counseling notes are required', 400);
    }

    const session = await SupportRequest.create({
      student: studentId,
      mentor: req.user._id,
      category: category || 'personal_guidance',
      subject: subject || 'Advisory & Progress Review',
      description,
      mentorNotes: mentorNotes || description,
      status: 'resolved',
      sessionDate: sessionDate ? new Date(sessionDate) : new Date(),
    });

    const populated = await SupportRequest.findById(session._id)
      .populate('student mentor', 'name email');

    return sendSuccess(res, 'Mentorship session documented successfully', populated, 201);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};
