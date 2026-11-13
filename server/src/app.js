import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import path from 'path';

// Import Middleware
import { notFoundHandler, globalErrorHandler } from './middleware/errorHandler.js';

// Import Module Routes
import authRoutes from './modules/auth/auth.routes.js';
import academicsRoutes from './modules/academics/academics.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import timetableRoutes from './modules/timetable/timetable.routes.js';
import attendanceRoutes from './modules/attendance/attendance.routes.js';
import materialsRoutes from './modules/materials/materials.routes.js';
import assignmentsRoutes from './modules/assignments/assignments.routes.js';
import examinationsRoutes from './modules/examinations/examinations.routes.js';
import communicationRoutes from './modules/communication/communication.routes.js';
import mentorshipRoutes from './modules/mentorship/mentorship.routes.js';
import analyticsRoutes from './modules/analytics/analytics.routes.js';
import quizzesRoutes from './modules/assessments/quizzes.routes.js';
import notificationRoutes from './modules/notifications/notification.routes.js';

const app = express();

// High-performance gzip/deflate response compression for large JSON datasets
app.use(compression({
  threshold: 1024, // Compress responses above 1KB
  level: 6,
}));

// Security and utility middlewares
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    frameguard: false, // Allow in-browser document previews from frontend
    contentSecurityPolicy: false, // Allow in-app PDF and resource embedding
  })
);
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map((u) => u.trim())
  : ['http://localhost:5173'];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(null, true); // Permissive fallback for seamless Render hosting
      }
    },
    credentials: true,
  })
);
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Static file serving for uploaded files (handles both local dev and production paths)
app.use('/uploads', express.static(path.resolve('uploads')));
app.use('/uploads', express.static(path.resolve('../uploads')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    platform: 'Acadex Modular Monolith API',
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// Mount Functional Modules
app.use('/api/auth', authRoutes);
app.use('/api/academics', academicsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/materials', materialsRoutes);
app.use('/api/assignments', assignmentsRoutes);
app.use('/api/examinations', examinationsRoutes);
app.use('/api/communication', communicationRoutes);
app.use('/api/mentorship', mentorshipRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/quizzes', quizzesRoutes);
app.use('/api/notifications', notificationRoutes);

// Catch 404 & Global Error Handling
app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;
