import { sendError } from '../utils/response.js';

export const notFoundHandler = (req, res, next) => {
  return sendError(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
};

export const globalErrorHandler = (err, req, res, next) => {
  console.error('[Unhandled Error]:', err);

  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((el) => el.message);
    return sendError(res, 'Validation error', 400, errors);
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return sendError(res, `Duplicate entry for ${field}. Value already exists.`, 409);
  }

  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 'Invalid token. Authorization failed.', 401);
  }

  if (err.name === 'TokenExpiredError') {
    return sendError(res, 'Token has expired. Please re-authenticate.', 401);
  }

  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : (process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message);

  return sendError(res, message, statusCode);
};
