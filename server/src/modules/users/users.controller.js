import User from './user.model.js';
import StudentProfile from './studentProfile.model.js';
import TeacherProfile from './teacherProfile.model.js';
import Department from '../academics/department.model.js';
import Batch from '../academics/batch.model.js';
import Notification from '../notifications/notification.model.js';
import { broadcastEvent } from '../../config/socket.js';
import { sendSuccess, sendError } from '../../utils/response.js';

// ==================== TEACHERS ====================
export const createTeacher = async (req, res) => {
  try {
    const { name, email, password, department, employeeId, designation, qualification, specialization, isHod, isMentor } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return sendError(res, 'A user with this email already exists', 400);
    }

    const existingEmpId = await TeacherProfile.findOne({ employeeId });
    if (existingEmpId) {
      return sendError(res, 'Employee ID already in use', 400);
    }

    const role = isHod ? 'hod' : 'teacher';

    const user = await User.create({
      name,
      email,
      password: password || 'Teacher@123',
      role,
      department,
    });

    const teacherProfile = await TeacherProfile.create({
      user: user._id,
      employeeId,
      department,
      designation: designation || 'Assistant Professor',
      qualification,
      specialization,
      isMentor: Boolean(isMentor),
    });

    // If designated as HOD, update the department's HOD reference
    if (isHod && department) {
      await Department.findByIdAndUpdate(department, { hod: user._id });
    }

    broadcastEvent('teachers_updated', { action: 'create', id: user._id });
    return sendSuccess(res, 'Teacher registered successfully', { user, profile: teacherProfile }, 201);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const getTeachers = async (req, res) => {
  try {
    const query = { role: { $in: ['teacher', 'hod'] }, isActive: true };

    // HODs and Teachers can only view faculty in their department unless elevated admin
    if (['teacher', 'hod'].includes(req.user.role)) {
      query.department = req.user.department;
    } else if (req.query.department) {
      query.department = req.query.department;
    }

    // Filter to only faculty who have authorized mentor privileges enabled
    if (req.query.mentorsOnly === 'true') {
      const mentorProfiles = await TeacherProfile.find({ isMentor: true }).select('user').lean();
      const mentorUserIds = mentorProfiles.map((p) => p.user);
      query._id = { $in: mentorUserIds };
    }

    const teachers = await User.find(query).populate('department', 'name code').select('-password').lean();
    const userIds = teachers.map((t) => t._id);

    const [profiles, menteeCounts, batchesWithMentor] = await Promise.all([
      TeacherProfile.find({ user: { $in: userIds } })
        .populate('assignedSubjects.subject assignedSubjects.batch', 'name code')
        .lean(),
      StudentProfile.aggregate([
        { $match: { mentor: { $in: userIds } } },
        { $group: { _id: '$mentor', count: { $sum: 1 } } },
      ]),
      Batch.find({ mentor: { $in: userIds }, isActive: true }).select('name mentor').lean(),
    ]);

    const profileMap = new Map();
    profiles.forEach((p) => profileMap.set(p.user.toString(), p));

    const menteeCountMap = new Map();
    menteeCounts.forEach((mc) => menteeCountMap.set(mc._id.toString(), mc.count));

    const mentoredBatchMap = new Map();
    batchesWithMentor.forEach((b) => {
      const mId = b.mentor.toString();
      if (!mentoredBatchMap.has(mId)) mentoredBatchMap.set(mId, []);
      mentoredBatchMap.get(mId).push(b.name);
    });

    const result = teachers.map((t) => ({
      ...t,
      profile: profileMap.get(t._id.toString()) || null,
      menteeCount: menteeCountMap.get(t._id.toString()) || 0,
      mentoredBatches: mentoredBatchMap.get(t._id.toString()) || [],
    }));

    return sendSuccess(res, 'Teachers retrieved successfully', result);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const assignTeacherSubjects = async (req, res) => {
  try {
    const { teacherId, subjectId, batchId, semester } = req.body;

    const profile = await TeacherProfile.findOne({ user: teacherId });
    if (!profile) {
      return sendError(res, 'Teacher profile not found', 404);
    }

    // Check if already assigned
    const alreadyAssigned = profile.assignedSubjects.some(
      (a) => a.subject.toString() === subjectId && a.batch.toString() === batchId
    );

    if (alreadyAssigned) {
      return sendError(res, 'Subject and batch already assigned to this teacher', 400);
    }

    profile.assignedSubjects.push({ subject: subjectId, batch: batchId, semester });
    await profile.save();

    return sendSuccess(res, 'Subject assigned successfully', profile);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ==================== STUDENTS ====================
export const createStudent = async (req, res) => {
  try {
    const { name, email, password, department, course, batch, rollNumber, currentSemester, mentor, phone, address } = req.body;

    // HOD scope guard
    if (req.user.role === 'hod' && req.user.department?.toString() !== department?.toString()) {
      return sendError(res, 'HOD can only register students for their own department', 403);
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return sendError(res, 'Email already exists', 400);

    const existingRoll = await StudentProfile.findOne({ rollNumber });
    if (existingRoll) return sendError(res, 'Roll number already exists', 400);

    const user = await User.create({
      name,
      email,
      password: password || 'Student@123',
      role: 'student',
      department,
      phone,
    });

    const studentProfile = await StudentProfile.create({
      user: user._id,
      rollNumber,
      department,
      course,
      batch,
      currentSemester: currentSemester || 1,
      mentor: mentor || null,
      address,
    });

    broadcastEvent('students_updated', { action: 'create', id: user._id });
    return sendSuccess(res, 'Student registered successfully', { user, profile: studentProfile }, 201);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const bulkImportStudents = async (req, res) => {
  try {
    const { students } = req.body; // Array of student objects

    if (!Array.isArray(students) || students.length === 0) {
      return sendError(res, 'Please provide an array of students to import', 400);
    }

    const imported = [];
    const errors = [];

    for (const [idx, item] of students.entries()) {
      try {
        const { name, email, rollNumber, department, course, batch, currentSemester, phone } = item;

        // Check duplicates
        const exists = await User.findOne({ email });
        if (exists) {
          errors.push({ row: idx + 1, email, reason: 'Email already exists' });
          continue;
        }

        const rollExists = await StudentProfile.findOne({ rollNumber });
        if (rollExists) {
          errors.push({ row: idx + 1, rollNumber, reason: 'Roll number already exists' });
          continue;
        }

        const user = await User.create({
          name,
          email,
          password: 'Student@123',
          role: 'student',
          department,
          phone,
        });

        const profile = await StudentProfile.create({
          user: user._id,
          rollNumber,
          department,
          course,
          batch,
          currentSemester: currentSemester || 1,
        });

        imported.push({ email, rollNumber, name });
      } catch (e) {
        errors.push({ row: idx + 1, reason: e.message });
      }
    }

    if (imported.length > 0) {
      broadcastEvent('students_updated', { action: 'bulk_import', count: imported.length });
    }

    return sendSuccess(res, `Bulk import completed: ${imported.length} imported, ${errors.length} failed.`, {
      importedCount: imported.length,
      failedCount: errors.length,
      errors,
    });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const getStudents = async (req, res) => {
  try {
    const query = { role: 'student', isActive: true };

    // Security Scoping: Teachers & Mentors can ONLY access their assigned batches and their full department
    if (['teacher', 'hod'].includes(req.user.role)) {
      const userDept = req.user.department;
      const userId = req.user._id;

      // Find all batches where this teacher is assigned as mentor
      const myMentoredBatches = await Batch.find({ mentor: userId, isActive: true }).select('_id').lean();
      const myBatchIds = myMentoredBatches.map((b) => b._id);

      if (req.query.assignedOnly === 'true' || req.query.myMentees === 'true') {
        const assignedProfiles = await StudentProfile.find({
          $or: [{ mentor: userId }, { batch: { $in: myBatchIds } }],
        }).select('user').lean();
        const assignedUserIds = assignedProfiles.map((p) => p.user);
        query._id = { $in: assignedUserIds };
      } else {
        const allowedProfiles = await StudentProfile.find({
          $or: [
            { department: userDept },
            { mentor: userId },
            { batch: { $in: myBatchIds } },
          ],
        }).select('user').lean();
        const allowedUserIds = allowedProfiles.map((p) => p.user);
        query._id = { $in: allowedUserIds };
      }

      if (req.query.department && req.query.department !== userDept?.toString()) {
        return sendError(res, 'Access denied: You cannot access students from other departments.', 403);
      }
    } else if (req.query.department) {
      query.department = req.query.department;
    }

    const students = await User.find(query).populate('department', 'name code').select('-password').lean();
    const userIds = students.map((s) => s._id);

    const profileQuery = { user: { $in: userIds } };
    if (req.query.batch) profileQuery.batch = req.query.batch;
    if (req.query.course) profileQuery.course = req.query.course;
    if (req.query.mentor) profileQuery.mentor = req.query.mentor;

    const profiles = await StudentProfile.find(profileQuery)
      .populate('course batch department mentor', 'name code rollNumber')
      .lean();

    const profileMap = new Map();
    profiles.forEach((p) => profileMap.set(p.user.toString(), p));

    const result = students
      .filter((s) => profileMap.has(s._id.toString()))
      .map((s) => ({
        ...s,
        profile: profileMap.get(s._id.toString()),
      }));

    return sendSuccess(res, 'Students retrieved successfully', result);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const assignMentor = async (req, res) => {
  try {
    const { studentIds, mentorId, batchId, notifyStudents = true } = req.body;

    if (!mentorId) {
      return sendError(res, 'Please provide a valid mentorId', 400);
    }

    // Verify mentor exists and is faculty
    const mentorUser = await User.findById(mentorId);
    if (!mentorUser || !['teacher', 'hod'].includes(mentorUser.role)) {
      return sendError(res, 'Assigned mentor must be an active teacher or HOD', 400);
    }

    // Enforce mentor privilege check: Faculty MUST be an authorized mentor
    const mentorProfile = await TeacherProfile.findOne({ user: mentorId });
    if (!mentorProfile || !mentorProfile.isMentor) {
      return sendError(
        res,
        `Cannot assign ${mentorUser.name} as mentor: Faculty member does not have mentor privilege enabled. Please designate them as a mentor in Faculty Management first.`,
        400
      );
    }

    let targetStudentUserIds = [];

    if (batchId) {
      // Find all students belonging to this batch
      const batch = await Batch.findById(batchId);
      if (!batch) return sendError(res, 'Batch not found', 404);

      batch.mentor = mentorId;
      await batch.save();

      const batchStudents = await StudentProfile.find({ batch: batchId });
      targetStudentUserIds = batchStudents.map((s) => s.user);

      await StudentProfile.updateMany(
        { batch: batchId },
        { $set: { mentor: mentorId } }
      );
    } else if (Array.isArray(studentIds) && studentIds.length > 0) {
      targetStudentUserIds = studentIds;
      await StudentProfile.updateMany(
        { user: { $in: studentIds } },
        { $set: { mentor: mentorId } }
      );
    } else {
      return sendError(res, 'Please provide either studentIds array or a batchId', 400);
    }

    // Notify students
    if (notifyStudents && targetStudentUserIds.length > 0) {
      const notifs = targetStudentUserIds.map((uId) => ({
        recipient: uId,
        sender: req.user._id,
        title: 'Faculty Mentor Assigned',
        message: `${mentorUser.name} has been assigned as your Faculty Mentor. Reach out for 1-on-1 counseling, attendance, or academic guidance.`,
        type: 'system',
        priority: 'medium',
        link: '/mentorship',
      }));
      await Notification.insertMany(notifs);

      // Notify the mentor
      await Notification.create({
        recipient: mentorId,
        sender: req.user._id,
        title: 'Mentee Cohort Update',
        message: `Admin assigned ${targetStudentUserIds.length} student(s) to your mentorship portfolio.`,
        type: 'system',
        priority: 'high',
        link: '/mentorship',
      });
    }

    broadcastEvent('students_updated', { action: 'assign_mentor', mentorId, count: targetStudentUserIds.length });
    broadcastEvent('mentorship_updated', { mentorId, count: targetStudentUserIds.length });
    if (batchId) broadcastEvent('batch_updated', { batchId });

    return sendSuccess(res, `Assigned ${targetStudentUserIds.length} student(s) to mentor ${mentorUser.name}`);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const toggleTeacherMentor = async (req, res) => {
  try {
    const { id } = req.params;
    const { isMentor } = req.body;

    const teacher = await User.findById(id);
    if (!teacher || !['teacher', 'hod'].includes(teacher.role)) {
      return sendError(res, 'Faculty member not found', 404);
    }

    let profile = await TeacherProfile.findOne({ user: id });
    if (!profile) {
      profile = new TeacherProfile({
        user: id,
        employeeId: 'EMP-' + Date.now().toString().slice(-4),
        department: teacher.department,
      });
    }

    const newStatus = isMentor !== undefined ? Boolean(isMentor) : !profile.isMentor;
    profile.isMentor = newStatus;
    await profile.save();

    return sendSuccess(res, `Faculty mentor status for ${teacher.name} updated to ${newStatus ? 'Authorized Mentor' : 'Standard Faculty'}`, {
      teacherId: id,
      isMentor: newStatus,
      profile,
    });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const updateTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, department, employeeId, designation, qualification, specialization, isMentor, role } = req.body;

    const user = await User.findById(id);
    if (!user) return sendError(res, 'Teacher not found', 404);

    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (department) user.department = department;
    if (role && ['teacher', 'hod'].includes(role)) user.role = role;
    await user.save();

    let profile = await TeacherProfile.findOne({ user: id });
    if (!profile) {
      profile = new TeacherProfile({ user: id, employeeId: employeeId || 'EMP-' + Date.now().toString().slice(-4) });
    }

    if (employeeId) profile.employeeId = employeeId;
    if (department) profile.department = department;
    if (designation) profile.designation = designation;
    if (qualification !== undefined) profile.qualification = qualification;
    if (specialization !== undefined) profile.specialization = specialization;
    if (isMentor !== undefined) profile.isMentor = Boolean(isMentor);
    await profile.save();

    broadcastEvent('teachers_updated', { action: 'update', id });
    return sendSuccess(res, 'Teacher profile updated successfully', { user, profile });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, department, course, batch, rollNumber, currentSemester, mentor } = req.body;

    const user = await User.findById(id);
    if (!user) return sendError(res, 'Student not found', 404);

    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (department) user.department = department;
    await user.save();

    let profile = await StudentProfile.findOne({ user: id });
    if (!profile) {
      profile = new StudentProfile({ user: id, rollNumber: rollNumber || 'ROLL-' + Date.now().toString().slice(-4) });
    }

    if (rollNumber) profile.rollNumber = rollNumber;
    if (department) profile.department = department;
    if (course) profile.course = course;
    if (batch) profile.batch = batch;
    if (currentSemester !== undefined) profile.currentSemester = Number(currentSemester);
    if (mentor !== undefined) {
      if (mentor) {
        const mentorProf = await TeacherProfile.findOne({ user: mentor });
        if (!mentorProf || !mentorProf.isMentor) {
          return sendError(
            res,
            'Selected faculty member does not have mentor privilege enabled. Please designate them as an authorized mentor first.',
            400
          );
        }
      }
      profile.mentor = mentor || null;
    }
    await profile.save();

    broadcastEvent('students_updated', { action: 'update', id });
    broadcastEvent('mentorship_updated', { id });
    return sendSuccess(res, 'Student profile updated successfully', { user, profile });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};
