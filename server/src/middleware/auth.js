import jwt from 'jsonwebtoken';
import { sendError } from '../utils/response.js';
import User from '../modules/users/user.model.js';

/**
 * Authentication Middleware:
 * Validates JWT access token and attaches user object to request.
 */
export const authenticate = async (req, res, next) => {
  try {
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return sendError(res, 'Access denied. No authentication token provided.', 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'campus360_super_secret_jwt_access_key_2026');
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return sendError(res, 'User session invalid. Account not found.', 401);
    }

    if (!user.isActive) {
      return sendError(res, 'Account is deactivated. Please contact the administrator.', 403);
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return sendError(res, 'Session token expired. Please log in again.', 401);
    }
    return sendError(res, 'Invalid token authorization.', 401);
  }
};

/**
 * Hierarchical Role-Based Access Control (RBAC):
 * Supports role inheritance:
 * - 'hod' inherently possesses all capabilities of 'teacher'
 * - 'college_admin' possesses administrative rights across all departments
 * - 'super_admin' possesses platform-level rights
 */
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Unauthenticated user.', 401);
    }

    const userRole = req.user.role;

    // Direct match
    if (allowedRoles.includes(userRole)) {
      return next();
    }

    // Role inheritance: HOD automatically satisfies 'teacher' requirement
    if (allowedRoles.includes('teacher') && userRole === 'hod') {
      return next();
    }

    // College Admin satisfies read/oversight on teacher and hod scopes where allowed
    if (allowedRoles.includes('college_admin') && userRole === 'super_admin') {
      return next();
    }

    return sendError(
      res,
      `Forbidden: Role '${userRole}' does not have sufficient permission for this resource.`,
      403
    );
  };
};

/**
 * Resource-level guard: Ensures teacher or HOD only accesses their assigned department
 */
export const requireDepartmentScope = (req, res, next) => {
  if (req.user.role === 'super_admin' || req.user.role === 'college_admin') {
    return next();
  }

  const userDept = req.user.department ? req.user.department.toString() : null;
  const targetDept = req.params.departmentId || req.body.department || req.query.department;

  if (targetDept && userDept && targetDept !== userDept) {
    return sendError(res, 'Access denied: You cannot access or modify resources of another department.', 403);
  }

  next();
};
