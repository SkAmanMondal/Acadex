import express from 'express';
import {
  createAnnouncement,
  getAnnouncements,
  deleteAnnouncement,
  getBroadcastTargets,
  sendMessage,
  getConversation,
  getContacts,
  getOnlineUsers,
  togglePinContact,
  markConversationRead,
  markConversationUnread,
} from './communication.controller.js';
import { authenticate, authorizeRoles } from '../../middleware/auth.js';

const router = express.Router();

// Announcements
router.get('/announcements', authenticate, getAnnouncements);
router.post('/announcements', authenticate, authorizeRoles('college_admin', 'super_admin', 'hod', 'teacher'), createAnnouncement);
router.delete('/announcements/:id', authenticate, authorizeRoles('college_admin', 'super_admin', 'hod', 'teacher'), deleteAnnouncement);
router.get('/broadcast-targets', authenticate, authorizeRoles('college_admin', 'super_admin', 'hod', 'teacher'), getBroadcastTargets);

// Direct Messages
router.get('/contacts', authenticate, getContacts);
router.post('/contacts/:contactId/pin', authenticate, togglePinContact);
router.get('/online-users', authenticate, getOnlineUsers);
router.post('/messages', authenticate, sendMessage);
router.get('/messages/:otherUserId', authenticate, getConversation);
router.patch('/messages/:otherUserId/read', authenticate, markConversationRead);
router.patch('/messages/:otherUserId/unread', authenticate, markConversationUnread);

export default router;
