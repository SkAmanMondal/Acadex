import http from 'http';
import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import { connectDB } from './config/db.js';
import { initSocket } from './config/socket.js';
import { initDailyScheduler } from './utils/scheduler.js';
import { isCloudinaryConfigured } from './config/cloudinary.js';

const PORT = process.env.PORT || 5000;

// Start Server after connecting to Database
const startServer = async () => {
  try {
    await connectDB();

    const httpServer = http.createServer(app);
    initSocket(httpServer);
    await initDailyScheduler();

    httpServer.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`   Acadex Modular Monolith API Server Online      `);
      console.log(`   Mode: ${process.env.NODE_ENV || 'development'}`);
      console.log(`   Listening at: http://localhost:${PORT}`);
      console.log(`   Health Check: http://localhost:${PORT}/api/health`);
      console.log(`   WebSocket: Real-time Socket.io Engine Online   `);
      console.log(`   Storage: ${isCloudinaryConfigured ? `Cloudinary CDN (${process.env.CLOUDINARY_CLOUD_NAME})` : 'Local Disk Fallback (uploads/)'}`);
      console.log(`====================================================`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
