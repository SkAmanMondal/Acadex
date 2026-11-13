import Assignment from './assignment.model.js';
import Submission from './submission.model.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { broadcastEvent } from '../../config/socket.js';
import { uploadMemory, uploadToStorage, deleteFromStorage } from '../../services/storage.service.js';

// Export upload middleware powered by memory storage (Cloudinary stream + local fallback)
export const uploadAssignmentFile = uploadMemory;

export const createAssignment = async (req, res) => {
  try {
    const { title, description, subject, batch, deadline, maxMarks } = req.body;
    let attachmentUrl = null;
    let cloudinaryPublicId = null;
    let storageType = 'local';

    if (req.file) {
      const uploaded = await uploadToStorage(req.file, 'assignments');
      attachmentUrl = uploaded.fileUrl;
      cloudinaryPublicId = uploaded.cloudinaryPublicId;
      storageType = uploaded.storageType;
    }

    const assignment = await Assignment.create({
      title,
      description,
      subject,
      batch,
      deadline,
      maxMarks: Number(maxMarks) || 100,
      attachmentUrl,
      cloudinaryPublicId,
      storageType,
      teacher: req.user._id,
    });

    const populated = await Assignment.findById(assignment._id).populate('subject batch teacher', 'name code email');
    broadcastEvent('assignments_updated', populated);
    broadcastEvent('dashboard_refresh', {});

    return sendSuccess(res, 'Assignment created', populated, 201);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const getAssignments = async (req, res) => {
  try {
    const filter = {};
    if (req.query.batch) filter.batch = req.query.batch;
    if (req.query.subject) filter.subject = req.query.subject;
    if (req.query.teacher) filter.teacher = req.query.teacher;

    const assignments = await Assignment.find(filter)
      .populate('subject batch teacher', 'name code email')
      .sort({ deadline: 1 })
      .lean();

    return sendSuccess(res, 'Assignments retrieved', assignments);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const updateAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { title, description, subject, batch, deadline, maxMarks } = req.body;

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) return sendError(res, 'Assignment not found', 404);

    if (req.user.role === 'teacher' && assignment.teacher.toString() !== req.user._id.toString()) {
      return sendError(res, 'Unauthorized to edit this assignment', 403);
    }

    if (title) assignment.title = title;
    if (description !== undefined) assignment.description = description;
    if (subject) assignment.subject = subject;
    if (batch) assignment.batch = batch;
    if (deadline) assignment.deadline = deadline;
    if (maxMarks !== undefined) assignment.maxMarks = Number(maxMarks);

    if (req.file) {
      if (assignment.attachmentUrl) {
        await deleteFromStorage(assignment.attachmentUrl, assignment.cloudinaryPublicId);
      }
      const uploaded = await uploadToStorage(req.file, 'assignments');
      assignment.attachmentUrl = uploaded.fileUrl;
      assignment.cloudinaryPublicId = uploaded.cloudinaryPublicId;
      assignment.storageType = uploaded.storageType;
    }

    await assignment.save();
    const populated = await Assignment.findById(assignment._id).populate('subject batch teacher', 'name code email');

    broadcastEvent('assignments_updated', populated);
    broadcastEvent('dashboard_refresh', {});

    return sendSuccess(res, 'Assignment updated successfully', populated);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const deleteAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) return sendError(res, 'Assignment not found', 404);

    if (req.user.role === 'teacher' && assignment.teacher.toString() !== req.user._id.toString()) {
      return sendError(res, 'Unauthorized to delete this assignment', 403);
    }

    if (assignment.attachmentUrl) {
      await deleteFromStorage(assignment.attachmentUrl, assignment.cloudinaryPublicId);
    }

    const submissions = await Submission.find({ assignment: assignmentId });
    for (const sub of submissions) {
      if (sub.fileUrl) {
        await deleteFromStorage(sub.fileUrl, sub.cloudinaryPublicId);
      }
    }

    await Assignment.findByIdAndDelete(assignmentId);
    await Submission.deleteMany({ assignment: assignmentId });

    broadcastEvent('assignments_updated', { id: assignmentId, deleted: true });
    broadcastEvent('dashboard_refresh', {});

    return sendSuccess(res, 'Assignment and associated submissions removed');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const submitAssignment = async (req, res) => {
  try {
    if (!req.file) {
      return sendError(res, 'Please upload your assignment solution file', 400);
    }

    const { assignmentId } = req.params;
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) return sendError(res, 'Assignment not found', 404);

    const isLate = new Date() > new Date(assignment.deadline);

    // Delete existing submission file if re-submitting
    const existingSubmission = await Submission.findOne({ assignment: assignmentId, student: req.user._id });
    if (existingSubmission?.fileUrl) {
      await deleteFromStorage(existingSubmission.fileUrl, existingSubmission.cloudinaryPublicId);
    }

    const uploaded = await uploadToStorage(req.file, 'assignments');

    const submission = await Submission.findOneAndUpdate(
      { assignment: assignmentId, student: req.user._id },
      {
        fileUrl: uploaded.fileUrl,
        fileName: req.file.originalname,
        cloudinaryPublicId: uploaded.cloudinaryPublicId,
        storageType: uploaded.storageType,
        submittedAt: new Date(),
        isLate,
        status: 'submitted',
      },
      { upsert: true, new: true }
    );

    broadcastEvent('assignments_updated', submission);
    broadcastEvent('dashboard_refresh', {});

    return sendSuccess(res, 'Assignment submitted successfully', submission, 201);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const gradeSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { marksObtained, feedback } = req.body;

    const submission = await Submission.findByIdAndUpdate(
      submissionId,
      {
        marksObtained: Number(marksObtained),
        feedback,
        status: 'graded',
      },
      { new: true }
    );

    if (!submission) return sendError(res, 'Submission not found', 404);

    broadcastEvent('assignments_updated', submission);
    broadcastEvent('marks_updated', submission);
    broadcastEvent('dashboard_refresh', {});

    return sendSuccess(res, 'Submission evaluated', submission);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const getSubmissionsForAssignment = async (req, res) => {
  try {
    const submissions = await Submission.find({ assignment: req.params.assignmentId })
      .populate('student', 'name email')
      .sort({ submittedAt: -1 })
      .lean();

    return sendSuccess(res, 'Submissions retrieved', submissions);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};
