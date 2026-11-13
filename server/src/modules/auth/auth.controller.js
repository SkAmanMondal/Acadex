import jwt from 'jsonwebtoken';
import User from '../users/user.model.js';
import StudentProfile from '../users/studentProfile.model.js';
import TeacherProfile from '../users/teacherProfile.model.js';
import { sendSuccess, sendError } from '../../utils/response.js';

// Helper to generate access & refresh tokens
const generateTokens = (user) => {
  const payload = { id: user._id, role: user.role, email: user.email };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET || 'campus360_super_secret_jwt_access_key_2026', {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET || 'campus360_super_secret_jwt_refresh_key_2026', {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
  return { accessToken, refreshToken };
};

/**
 * @route POST /api/auth/login
 * @desc Authenticate user & return tokens
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, 'Please provide both email and password', 400);
    }

    const user = await User.findOne({ email }).select('+password').populate('department');
    if (!user) {
      return sendError(res, 'Invalid credentials', 401);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return sendError(res, 'Invalid credentials', 401);
    }

    if (!user.isActive) {
      return sendError(res, 'Your account has been deactivated. Please contact administration.', 403);
    }

    user.lastLogin = new Date();
    await user.save();

    const { accessToken, refreshToken } = generateTokens(user);

    // Fetch role-specific profile details
    let profile = null;
    if (user.role === 'student') {
      profile = await StudentProfile.findOne({ user: user._id })
        .populate('course batch department mentor', 'name code rollNumber');
    } else if (user.role === 'teacher' || user.role === 'hod') {
      profile = await TeacherProfile.findOne({ user: user._id })
        .populate('assignedSubjects.subject assignedSubjects.batch', 'name code');
    }

    const userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      phone: user.phone,
      avatar: user.avatar,
      isMentor: profile?.isMentor || false,
      profile,
    };

    return sendSuccess(res, 'Login successful', { user: userData, accessToken, refreshToken });
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

/**
 * @route GET /api/auth/me
 * @desc Get currently authenticated user session
 */
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('department');
    let profile = null;

    if (user.role === 'student') {
      profile = await StudentProfile.findOne({ user: user._id })
        .populate('course batch department mentor', 'name code rollNumber');
    } else if (user.role === 'teacher' || user.role === 'hod') {
      profile = await TeacherProfile.findOne({ user: user._id })
        .populate('assignedSubjects.subject assignedSubjects.batch', 'name code');
    }

    const userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      phone: user.phone,
      avatar: user.avatar,
      isMentor: profile?.isMentor || false,
      profile,
    };

    return sendSuccess(res, 'Session profile loaded', { user: userData });
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

/**
 * @route POST /api/auth/bootstrap-admin
 * @desc Setup initial Super Admin or College Admin if database has no admins
 */
export const bootstrapAdmin = async (req, res) => {
  try {
    const existingAdmin = await User.findOne({ role: { $in: ['super_admin', 'college_admin'] } });
    if (existingAdmin) {
      return sendError(res, 'Admin already bootstrapped. Please log in using existing admin credentials.', 400);
    }

    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return sendError(res, 'Please provide name, email, and password for the admin account.', 400);
    }

    const admin = await User.create({
      name,
      email,
      password,
      role: 'college_admin',
    });

    const { accessToken, refreshToken } = generateTokens(admin);

    return sendSuccess(res, 'College Administrator created successfully', {
      user: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
      accessToken,
      refreshToken,
    }, 201);
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

/**
 * @route GET /api/auth/directory
 * @desc Public directory of all institutional credentials with roles, departments & batch info
 */
export const getLoginDirectory = async (req, res) => {
  try {
    const users = await User.find({ isActive: true })
      .select('name email role department phone')
      .populate('department', 'name code')
      .sort({ role: 1, name: 1 })
      .lean();

    const teacherProfiles = await TeacherProfile.find({})
      .select('user designation employeeId isMentor qualification')
      .lean();
    const teacherMap = new Map();
    teacherProfiles.forEach((tp) => teacherMap.set(tp.user.toString(), tp));

    const studentProfiles = await StudentProfile.find({})
      .select('user rollNumber batch mentor')
      .populate('batch', 'name currentSemester course startYear endYear')
      .populate('mentor', 'name email')
      .lean();
    const studentMap = new Map();
    studentProfiles.forEach((sp) => studentMap.set(sp.user.toString(), sp));

    const directory = users.map((u) => {
      const isTeacher = ['teacher', 'hod'].includes(u.role);
      const isStudent = u.role === 'student';
      const teacherInfo = isTeacher ? teacherMap.get(u._id.toString()) : null;
      const studentInfo = isStudent ? studentMap.get(u._id.toString()) : null;

      let passwordHint = 'Admin@123';
      if (['teacher', 'hod'].includes(u.role)) passwordHint = 'Teacher@123';
      if (u.role === 'student') passwordHint = 'Student@123';

      return {
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        department: u.department
          ? { _id: u.department._id, name: u.department.name, code: u.department.code }
          : null,
        designation:
          teacherInfo?.designation ||
          (u.role === 'hod'
            ? 'Head of Department'
            : u.role === 'college_admin'
            ? 'College Administrator'
            : null),
        isMentor: Boolean(teacherInfo?.isMentor),
        employeeId: teacherInfo?.employeeId || null,
        rollNumber: studentInfo?.rollNumber || null,
        batch: studentInfo?.batch
          ? {
              _id: studentInfo.batch._id,
              name: studentInfo.batch.name,
              currentSemester: studentInfo.batch.currentSemester,
            }
          : null,
        mentor: studentInfo?.mentor ? { name: studentInfo.mentor.name } : null,
        passwordHint,
      };
    });

    return sendSuccess(res, 'Institutional login directory retrieved', directory);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};
