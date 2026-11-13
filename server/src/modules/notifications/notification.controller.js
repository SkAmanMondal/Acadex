import StudentProfile from '../users/studentProfile.model.js';
import AttendanceRecord from '../attendance/attendanceRecord.model.js';
import AttendanceSession from '../attendance/attendanceSession.model.js';
import Notification from './notification.model.js';
import { sendSuccess, sendError } from '../../utils/response.js';

/**
 * Auto-seeds realistic notifications for newly logged in or empty users
 */
const seedDefaultNotifications = async (userId, role) => {
  const sampleData = {
    student: [
      {
        recipient: userId,
        title: 'Low Attendance Alert',
        message: 'Operating Systems (CS401) attendance is at 72.8%. Maintain min 75% before End-Sem exams.',
        type: 'attendance',
        priority: 'high',
        link: '/attendance/report',
        createdAt: new Date(Date.now() - 1000 * 60 * 25), // 25 mins ago
      },
      {
        recipient: userId,
        title: 'New Assignment Posted',
        message: 'Assignment #2: Distributed Consensus & Raft Protocol has been assigned. Due in 5 days.',
        type: 'assignment',
        priority: 'medium',
        link: '/assignments',
        createdAt: new Date(Date.now() - 1000 * 60 * 120), // 2 hours ago
      },
      {
        recipient: userId,
        title: 'Live Quiz Active',
        message: 'Computer Networks MCQ Quiz 2 is open for submissions today.',
        type: 'quiz',
        priority: 'medium',
        link: '/quizzes',
        createdAt: new Date(Date.now() - 1000 * 60 * 360), // 6 hours ago
      },
      {
        recipient: userId,
        title: 'CIA Marks Published',
        message: 'Database Management Systems internal assessment marks have been verified.',
        type: 'grade',
        priority: 'low',
        link: '/student/results',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
      },
      {
        recipient: userId,
        title: 'Schedule Room Adjustment',
        message: 'Tomorrow’s Artificial Intelligence lecture relocated to Multimedia Hall 2.',
        type: 'timetable',
        priority: 'low',
        link: '/timetables',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30), // 30 hours ago
      },
    ],
    teacher: [
      {
        recipient: userId,
        title: 'Attendance Defaulters Warning',
        message: '7 students in Batch 2022-26 CSE-A fall below the mandatory 75% attendance threshold.',
        type: 'attendance',
        priority: 'high',
        link: '/attendance/report',
        createdAt: new Date(Date.now() - 1000 * 60 * 30),
      },
      {
        recipient: userId,
        title: 'Pending Assignment Submissions',
        message: '14 new student submissions uploaded for "Software Engineering Sprint Plan" awaiting review.',
        type: 'assignment',
        priority: 'medium',
        link: '/assignments',
        createdAt: new Date(Date.now() - 1000 * 60 * 180),
      },
      {
        recipient: userId,
        title: 'Classroom Podium Scanner Ready',
        message: 'Session token generated. Podium PC Kiosk is active for instant contactless scanning.',
        type: 'system',
        priority: 'medium',
        link: '/teacher/scanner',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
      },
      {
        recipient: userId,
        title: 'Timetable Synchronization',
        message: 'Your weekly timetable updated with 18 teaching hours across CSE batches.',
        type: 'timetable',
        priority: 'low',
        link: '/timetables',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
      },
    ],
    hod: [
      {
        recipient: userId,
        title: 'Department Defaulters Alert',
        message: 'Comprehensive attendance report generated. 12 students across 2 batches require intervention.',
        type: 'attendance',
        priority: 'urgent',
        link: '/attendance/report',
        createdAt: new Date(Date.now() - 1000 * 60 * 45),
      },
      {
        recipient: userId,
        title: 'CIA Assessment Approval Needed',
        message: 'Faculty submitted CIA-1 marks for 4 subjects awaiting departmental sign-off.',
        type: 'grade',
        priority: 'high',
        link: '/examinations/internals',
        createdAt: new Date(Date.now() - 1000 * 60 * 150),
      },
      {
        recipient: userId,
        title: 'Faculty Load Distribution',
        message: 'All 6 faculty members assigned with balanced weekly lecture allocations.',
        type: 'timetable',
        priority: 'low',
        link: '/timetables',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26),
      },
    ],
    college_admin: [
      {
        recipient: userId,
        title: 'Master Timetable Synced',
        message: 'Campus-wide timetable compiled with zero classroom and faculty collisions.',
        type: 'timetable',
        priority: 'medium',
        link: '/timetables',
        createdAt: new Date(Date.now() - 1000 * 60 * 20),
      },
      {
        recipient: userId,
        title: 'Student Risk Analytics Ready',
        message: 'AI At-Risk analytics updated: 4 students identified with combined academic and attendance flags.',
        type: 'system',
        priority: 'high',
        link: '/analytics',
        createdAt: new Date(Date.now() - 1000 * 60 * 80),
      },
      {
        recipient: userId,
        title: 'Student Registry Updated',
        message: '38 new student records enrolled with generated biometric and roll numbers.',
        type: 'system',
        priority: 'low',
        link: '/admin/students',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18),
      },
    ],
  };

  const seedList = sampleData[role] || sampleData.teacher || sampleData.student;
  try {
    await Notification.insertMany(seedList);
  } catch (e) {
    console.error('Failed to auto-seed notifications:', e);
  }
};

/**
 * Get current user's notifications and unread counter
 */
export const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const role = req.user.role;

    // Check count
    const totalCount = await Notification.countDocuments({ recipient: userId });
    if (totalCount === 0) {
      await seedDefaultNotifications(userId, role);
    }

    // Dynamic Live Attendance Shortage Alert Generation
    try {
      if (role === 'student') {
        const profile = await StudentProfile.findOne({ user: userId }).populate('batch');
        if (profile?.batch) {
          const totalConducted = await AttendanceSession.countDocuments({ batch: profile.batch._id });
          const attended = await AttendanceRecord.countDocuments({ student: userId, status: 'present' });
          const eff = Math.max(totalConducted, attended);
          if (eff > 0) {
            const pct = Math.round((attended / eff) * 100);
            if (pct < 75) {
              const isCritical = pct < 60;
              const classesNeeded = Math.max(1, Math.ceil(3 * eff - 4 * attended));
              const alertTitle = isCritical
                ? '🚨 Critical Attendance Debarment Alert (<60%)'
                : '⚠️ Attendance Shortage Warning (<75%)';
              const alertMsg = isCritical
                ? `Your overall attendance is ${pct}% (${attended}/${eff} classes), below the critical 60% regulatory cutoff. You must attend the next ${classesNeeded} consecutive classes to reach the mandatory 75% threshold.`
                : `Your overall attendance is ${pct}% (${attended}/${eff} classes). You need 75% for examination eligibility. Attend the next ${classesNeeded} consecutive classes to restore eligibility.`;

              const existingAlert = await Notification.findOne({
                recipient: userId,
                type: 'attendance',
              }).sort({ createdAt: -1 });

              if (existingAlert) {
                existingAlert.title = alertTitle;
                existingAlert.message = alertMsg;
                existingAlert.priority = isCritical ? 'urgent' : 'high';
                existingAlert.link = '/attendance/report';
                await existingAlert.save();
              } else {
                await Notification.create({
                  recipient: userId,
                  title: alertTitle,
                  message: alertMsg,
                  type: 'attendance',
                  priority: isCritical ? 'urgent' : 'high',
                  link: '/attendance/report',
                });
              }
            }
          }
        }
      }
    } catch (attErr) {
      console.error('Error generating attendance alert notification:', attErr);
    }

    const notifications = await Notification.find({ recipient: userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      isRead: false,
    });

    return sendSuccess(res, 'Notifications retrieved successfully', {
      notifications,
      unreadCount,
    });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

/**
 * Mark a single notification as read
 */
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipient: req.user._id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return sendError(res, 'Notification not found or access denied', 404);
    }

    return sendSuccess(res, 'Notification marked as read', notification);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

/**
 * Mark all notifications as read for current user
 */
export const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    return sendSuccess(res, 'All notifications marked as read', { markedAll: true });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

/**
 * Delete a notification
 */
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findOneAndDelete({
      _id: id,
      recipient: req.user._id,
    });

    if (!notification) {
      return sendError(res, 'Notification not found', 404);
    }

    return sendSuccess(res, 'Notification deleted successfully');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

/**
 * Create a new notification (API or programmatic)
 */
export const createNotification = async (req, res) => {
  try {
    const { recipient, title, message, type, priority, link, metadata } = req.body;

    if (!recipient || !title || !message) {
      return sendError(res, 'Recipient, title, and message are required fields', 400);
    }

    const notification = await Notification.create({
      recipient,
      sender: req.user ? req.user._id : null,
      title,
      message,
      type: type || 'system',
      priority: priority || 'medium',
      link: link || '',
      metadata: metadata || {},
    });

    return sendSuccess(res, 'Notification created successfully', notification, 201);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};
