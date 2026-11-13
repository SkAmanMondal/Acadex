import Announcement from './announcement.model.js';
import Message from './message.model.js';
import User from '../users/user.model.js';
import StudentProfile from '../users/studentProfile.model.js';
import TeacherProfile from '../users/teacherProfile.model.js';
import Department from '../academics/department.model.js';
import Batch from '../academics/batch.model.js';
import Subject from '../academics/subject.model.js';
import Notification from '../notifications/notification.model.js';
import Timetable from '../timetable/timetable.model.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { emitToUser, broadcastEvent, getOnlineUserIds, isUserInChatWith } from '../../config/socket.js';

// ==================== BROADCAST TARGETS METADATA ====================
export const getBroadcastTargets = async (req, res) => {
  try {
    const role = req.user.role;
    const isAdmin = ['college_admin', 'super_admin'].includes(role);
    const isHod = role === 'hod';
    const isTeacher = role === 'teacher';

    if (isAdmin) {
      const [departments, batches, subjects] = await Promise.all([
        Department.find({ isActive: true }).select('name code').sort({ name: 1 }),
        Batch.find({ isActive: true }).select('name code department').populate('department', 'name code').sort({ name: 1 }),
        Subject.find({ isActive: true }).select('name code department semester').populate('department', 'name code').sort({ name: 1 }),
      ]);

      return sendSuccess(res, 'Admin broadcast targets', {
        role,
        allowedScopes: [
          { value: 'college', label: 'Entire College (All Faculty, Staff & Students)' },
          { value: 'department', label: 'Specific Department' },
          { value: 'batch', label: 'Specific Student Batch / Cohort' },
          { value: 'subject', label: 'Specific Academic Subject' },
        ],
        departments,
        batches,
        subjects,
      });
    }

    if (isHod) {
      const userDeptId = req.user.department?._id || req.user.department;
      const [dept, batches, subjects] = await Promise.all([
        Department.findById(userDeptId).select('name code'),
        Batch.find({ department: userDeptId, isActive: true }).select('name code').sort({ name: 1 }),
        Subject.find({ department: userDeptId, isActive: true }).select('name code semester').sort({ name: 1 }),
      ]);

      return sendSuccess(res, 'HOD broadcast targets', {
        role,
        allowedScopes: [
          { value: 'department', label: `My Department (${dept?.name || 'Department'})` },
          { value: 'batch', label: 'Department Batch / Cohort' },
          { value: 'subject', label: 'Department Subject' },
        ],
        department: dept,
        departments: dept ? [dept] : [],
        batches,
        subjects,
      });
    }

    if (isTeacher) {
      const userDeptId = req.user.department?._id || req.user.department;
      const dept = await Department.findById(userDeptId).select('name code');

      // Find teacher assigned subjects and batches from Timetable and Profile
      const teacherSlots = await Timetable.find({ teacher: req.user._id, isActive: true })
        .populate('subject', 'name code')
        .populate('batch', 'name');

      const subjectMap = new Map();
      const batchMap = new Map();

      teacherSlots.forEach((slot) => {
        if (slot.subject && slot.subject._id) {
          subjectMap.set(slot.subject._id.toString(), slot.subject);
        }
        if (slot.batch && slot.batch._id) {
          batchMap.set(slot.batch._id.toString(), slot.batch);
        }
      });

      // Also check TeacherProfile
      const profile = await TeacherProfile.findOne({ user: req.user._id })
        .populate('assignedSubjects.subject', 'name code')
        .populate('assignedSubjects.batch', 'name');

      if (profile?.assignedSubjects) {
        profile.assignedSubjects.forEach((as) => {
          if (as.subject && as.subject._id) {
            subjectMap.set(as.subject._id.toString(), as.subject);
          }
          if (as.batch && as.batch._id) {
            batchMap.set(as.batch._id.toString(), as.batch);
          }
        });
      }

      const subjects = Array.from(subjectMap.values());
      const batches = Array.from(batchMap.values());

      return sendSuccess(res, 'Teacher broadcast targets', {
        role,
        allowedScopes: [
          { value: 'department', label: `My Department (${dept?.name || 'Department'})` },
          { value: 'subject', label: 'My Assigned Subject' },
          { value: 'batch', label: 'My Assigned Batch' },
        ],
        department: dept,
        departments: dept ? [dept] : [],
        subjects,
        batches,
      });
    }

    return sendError(res, 'Students cannot broadcast announcements', 403);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ==================== ANNOUNCEMENTS ====================
export const createAnnouncement = async (req, res) => {
  try {
    const { title, content, scope, department, batch, subject, priority } = req.body;

    if (!title?.trim() || !content?.trim()) {
      return sendError(res, 'Announcement title and content are required', 400);
    }

    const role = req.user.role;
    const isAdmin = ['college_admin', 'super_admin'].includes(role);
    const isHod = role === 'hod';
    const isTeacher = role === 'teacher';

    if (!isAdmin && !isHod && !isTeacher) {
      return sendError(res, 'Access denied: You do not have permission to broadcast announcements.', 403);
    }

    let targetDepartment = null;
    let targetBatch = null;
    let targetSubject = null;

    // 1. College-wide scope: strictly Admin only
    if (scope === 'college') {
      if (!isAdmin) {
        return sendError(
          res,
          'Access denied: Only College Administrators can broadcast announcements to the entire college.',
          403
        );
      }
    }
    // 2. Department scope: Admin can choose any; Teachers & HODs strictly restricted to their own department
    else if (scope === 'department') {
      if (isAdmin) {
        if (!department) {
          return sendError(res, 'Please select a target department for department-scoped broadcast.', 400);
        }
        targetDepartment = department;
      } else {
        const userDeptId = req.user.department?._id || req.user.department;
        if (!userDeptId) {
          return sendError(res, 'You cannot broadcast to a department because your account has no assigned department.', 403);
        }
        if (department && department.toString() !== userDeptId.toString()) {
          return sendError(res, 'Access denied: Faculty members and HODs can only broadcast announcements to their own department.', 403);
        }
        targetDepartment = userDeptId;
      }
    }
    // 3. Subject scope: Teachers restricted to their assigned subjects; HODs to department subjects
    else if (scope === 'subject') {
      if (!subject) {
        return sendError(res, 'Please select a target subject for subject-scoped broadcast.', 400);
      }
      targetSubject = subject;

      if (isTeacher) {
        const hasSlot = await Timetable.findOne({ teacher: req.user._id, subject, isActive: true });
        const hasProfile = await TeacherProfile.findOne({ user: req.user._id, 'assignedSubjects.subject': subject });
        if (!hasSlot && !hasProfile) {
          return sendError(res, 'Access denied: You can only broadcast announcements to subjects assigned to you.', 403);
        }
        targetDepartment = req.user.department?._id || req.user.department;
      } else if (isHod) {
        const userDeptId = req.user.department?._id || req.user.department;
        const subjDoc = await Subject.findOne({ _id: subject, department: userDeptId });
        if (!subjDoc) {
          return sendError(res, 'Access denied: You can only broadcast to subjects belonging to your department.', 403);
        }
        targetDepartment = userDeptId;
      } else if (isAdmin) {
        const subjDoc = await Subject.findById(subject);
        targetDepartment = subjDoc?.department || department || null;
      }

      if (batch) targetBatch = batch;
    }
    // 4. Batch scope: Teachers restricted to batches they teach; HODs to department batches
    else if (scope === 'batch') {
      if (!batch) {
        return sendError(res, 'Please select a target batch for batch-scoped broadcast.', 400);
      }
      targetBatch = batch;

      if (isTeacher) {
        const hasSlot = await Timetable.findOne({ teacher: req.user._id, batch, isActive: true });
        const hasProfile = await TeacherProfile.findOne({ user: req.user._id, 'assignedSubjects.batch': batch });
        if (!hasSlot && !hasProfile) {
          return sendError(res, 'Access denied: You can only broadcast to batches assigned to your schedule.', 403);
        }
        targetDepartment = req.user.department?._id || req.user.department;
      } else if (isHod) {
        const userDeptId = req.user.department?._id || req.user.department;
        const batchDoc = await Batch.findOne({ _id: batch, department: userDeptId });
        if (!batchDoc) {
          return sendError(res, 'Access denied: You can only broadcast to batches belonging to your department.', 403);
        }
        targetDepartment = userDeptId;
      } else if (isAdmin) {
        const batchDoc = await Batch.findById(batch);
        targetDepartment = batchDoc?.department || department || null;
      }
    } else {
      return sendError(res, `Invalid broadcast scope: ${scope}`, 400);
    }

    const announcement = await Announcement.create({
      title: title.trim(),
      content: content.trim(),
      scope,
      department: targetDepartment,
      batch: targetBatch,
      subject: targetSubject,
      priority: priority || 'normal',
      author: req.user._id,
    });

    const populated = await Announcement.findById(announcement._id)
      .populate('author', 'name email role')
      .populate('department', 'name code')
      .populate('batch', 'name')
      .populate('subject', 'name code');

    // Asynchronously dispatch notifications and socket events to intended audience
    try {
      const recipientIds = new Set();

      if (scope === 'college') {
        const allUsers = await User.find({ _id: { $ne: req.user._id }, isActive: { $ne: false } }).select('_id');
        allUsers.forEach((u) => recipientIds.add(u._id.toString()));
      } else if (scope === 'department' && targetDepartment) {
        const deptStaff = await User.find({ department: targetDepartment, _id: { $ne: req.user._id } }).select('_id');
        deptStaff.forEach((u) => recipientIds.add(u._id.toString()));
        const deptStudents = await StudentProfile.find({ department: targetDepartment }).distinct('user');
        deptStudents.forEach((uid) => {
          if (uid && uid.toString() !== req.user._id.toString()) recipientIds.add(uid.toString());
        });
      } else if (scope === 'batch' && targetBatch) {
        const batchStudents = await StudentProfile.find({ batch: targetBatch }).distinct('user');
        batchStudents.forEach((uid) => {
          if (uid && uid.toString() !== req.user._id.toString()) recipientIds.add(uid.toString());
        });
      } else if (scope === 'subject' && targetSubject) {
        const subjectBatches = await Timetable.find({ subject: targetSubject }).distinct('batch');
        if (subjectBatches.length > 0) {
          const students = await StudentProfile.find({ batch: { $in: subjectBatches } }).distinct('user');
          students.forEach((uid) => {
            if (uid && uid.toString() !== req.user._id.toString()) recipientIds.add(uid.toString());
          });
        }
      }

      if (recipientIds.size > 0) {
        const notifDocs = Array.from(recipientIds).map((recId) => ({
          recipient: recId,
          sender: req.user._id,
          title: `Notice: ${title.trim()}`,
          message: content.trim().length > 140 ? `${content.trim().slice(0, 137)}...` : content.trim(),
          type: 'announcement',
          priority: priority === 'urgent' ? 'urgent' : 'medium',
          link: '/announcements',
          metadata: { announcementId: announcement._id, scope },
        }));
        await Notification.insertMany(notifDocs);

        // Notify online users via socket
        recipientIds.forEach((recId) => {
          emitToUser(recId, 'new_notification', {
            title: `Notice: ${title.trim()}`,
            message: content.trim(),
            type: 'announcement',
            priority,
            link: '/announcements',
          });
        });
      }

      // Broadcast new announcement to active pages
      broadcastEvent('new_announcement', populated);
      broadcastEvent('dashboard_refresh', {});
    } catch (notifErr) {
      console.error('Failed to dispatch notification alerts for announcement:', notifErr);
    }

    return sendSuccess(res, 'Announcement broadcasted successfully', populated, 201);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const getAnnouncements = async (req, res) => {
  try {
    const role = req.user.role;
    const isAdmin = ['college_admin', 'super_admin'].includes(role);

    let filter = {};

    if (isAdmin) {
      // Admins see all announcements
      filter = {};
    } else if (role === 'student') {
      const profile = await StudentProfile.findOne({ user: req.user._id });
      const orConditions = [{ scope: 'college' }];

      const userDept = profile?.department || req.user.department;
      if (userDept) {
        orConditions.push({ scope: 'department', department: userDept });
      }

      if (profile?.batch) {
        orConditions.push({ scope: 'batch', batch: profile.batch });

        // Find subjects scheduled for this batch
        const batchSubjects = await Timetable.find({ batch: profile.batch }).distinct('subject');
        if (batchSubjects.length > 0) {
          orConditions.push({ scope: 'subject', subject: { $in: batchSubjects } });
        }
      }

      filter = { $or: orConditions };
    } else {
      // Teacher or HOD
      const userDept = req.user.department?._id || req.user.department;
      const orConditions = [
        { scope: 'college' },
        { author: req.user._id },
      ];

      if (userDept) {
        orConditions.push({ scope: 'department', department: userDept });
      }

      // Teacher's assigned subjects and batches
      const teacherSlots = await Timetable.find({ teacher: req.user._id }).select('subject batch');
      const teacherSubjectIds = teacherSlots.map((s) => s.subject).filter(Boolean);
      const teacherBatchIds = teacherSlots.map((s) => s.batch).filter(Boolean);

      const profile = await TeacherProfile.findOne({ user: req.user._id });
      if (profile?.assignedSubjects) {
        profile.assignedSubjects.forEach((as) => {
          if (as.subject) teacherSubjectIds.push(as.subject);
          if (as.batch) teacherBatchIds.push(as.batch);
        });
      }

      if (teacherSubjectIds.length > 0) {
        orConditions.push({ scope: 'subject', subject: { $in: teacherSubjectIds } });
      }
      if (teacherBatchIds.length > 0) {
        orConditions.push({ scope: 'batch', batch: { $in: teacherBatchIds } });
      }

      filter = { $or: orConditions };
    }

    const announcements = await Announcement.find(filter)
      .populate('author', 'name email role')
      .populate('department', 'name code')
      .populate('batch', 'name')
      .populate('subject', 'name code')
      .sort({ createdAt: -1 });

    return sendSuccess(res, 'Announcements retrieved', announcements);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ==================== DIRECT MESSAGING CONTACTS ====================
export const getContacts = async (req, res) => {
  try {
    let contacts = [];

    if (req.user.role === 'student') {
      // Find student profile with mentor, batch, and department
      const profile = await StudentProfile.findOne({ user: req.user._id })
        .populate('mentor', 'name email role department')
        .populate('batch')
        .populate('department', 'name code');

      const studentDeptId = profile?.department?._id || profile?.department || req.user.department;
      const contactUserIds = new Set();
      const contactsList = [];

      // 1. Assigned Academic Mentor (always prioritized at top)
      let mentorDoc = profile?.mentor;
      if (!mentorDoc && profile?.batch) {
        const batchDoc = await Batch.findById(profile.batch._id || profile.batch).populate('mentor', 'name email role department');
        if (batchDoc?.mentor) {
          mentorDoc = batchDoc.mentor;
          StudentProfile.findByIdAndUpdate(profile._id, { mentor: batchDoc.mentor._id }).exec();
        }
      }
      if (!mentorDoc && studentDeptId) {
        const fallbackMentor = await User.findOne({
          role: { $in: ['teacher', 'hod'] },
          department: studentDeptId,
          isActive: true,
        }).select('name email role department');
        if (fallbackMentor) {
          mentorDoc = fallbackMentor;
          StudentProfile.findByIdAndUpdate(profile._id, { mentor: fallbackMentor._id }).exec();
        }
      }

      if (mentorDoc) {
        contactUserIds.add(mentorDoc._id.toString());
        contactsList.push({
          _id: mentorDoc._id,
          name: mentorDoc.name,
          email: mentorDoc.email,
          role: 'mentor',
          isMentor: true,
          relationship: '⭐ Assigned Academic Mentor',
          department: mentorDoc.department,
        });
      }

      // 2. Department HOD (Head of Department)
      if (studentDeptId) {
        const hods = await User.find({
          role: 'hod',
          department: studentDeptId,
          isActive: true,
        }).select('name email role department').lean();

        hods.forEach((h) => {
          if (!contactUserIds.has(h._id.toString())) {
            contactUserIds.add(h._id.toString());
            contactsList.push({
              _id: h._id,
              name: h.name,
              email: h.email,
              role: 'hod',
              isHod: true,
              relationship: 'Head of Department (HOD)',
              department: h.department,
            });
          }
        });
      }

      // 3. ALL Teachers of the Student's Department (No limit)
      if (studentDeptId) {
        const deptTeachers = await User.find({
          role: 'teacher',
          department: studentDeptId,
          isActive: true,
        }).select('name email role department').sort({ name: 1 }).lean();

        deptTeachers.forEach((t) => {
          if (!contactUserIds.has(t._id.toString())) {
            contactUserIds.add(t._id.toString());
            contactsList.push({
              _id: t._id,
              name: t.name,
              email: t.email,
              role: 'teacher',
              relationship: 'Department Faculty',
              department: t.department,
            });
          }
        });
      }

      // 4. Batch Course Instructors (Any faculty teaching their batch, including inter-dept or visiting)
      if (profile?.batch) {
        const slots = await Timetable.find({ batch: profile.batch._id || profile.batch, isActive: true })
          .populate('teacher', 'name email role department')
          .lean();

        slots.forEach((s) => {
          if (s.teacher && !contactUserIds.has(s.teacher._id.toString())) {
            contactUserIds.add(s.teacher._id.toString());
            contactsList.push({
              _id: s.teacher._id,
              name: s.teacher.name,
              email: s.teacher.email,
              role: s.teacher.role || 'teacher',
              relationship: 'Course Instructor',
              department: s.teacher.department,
            });
          }
        });
      }

      // 5. Fallback: If student has no department set, provide all college HODs and teachers
      if (contactsList.length === 0) {
        const allFaculty = await User.find({
          role: { $in: ['teacher', 'hod'] },
          isActive: true,
        }).select('name email role department').lean();

        allFaculty.forEach((f) => {
          if (!contactUserIds.has(f._id.toString())) {
            contactUserIds.add(f._id.toString());
            contactsList.push({
              _id: f._id,
              name: f.name,
              email: f.email,
              role: f.role,
              relationship: f.role === 'hod' ? 'Head of Department (HOD)' : 'Faculty Member',
              department: f.department,
            });
          }
        });
      }

      contacts = contactsList;
    } else if (['teacher', 'hod'].includes(req.user.role)) {
      const contactUserIds = new Set();
      const contactsList = [];

      // 1. Any User Who Has an Active Chat History with this Faculty Member (Never drop an incoming message!)
      const [incomingSenders, outgoingRecipients] = await Promise.all([
        Message.distinct('sender', { recipient: req.user._id }),
        Message.distinct('recipient', { sender: req.user._id }),
      ]);
      const chatPartnerIds = [...new Set([...incomingSenders, ...outgoingRecipients].map((id) => id.toString()))];

      if (chatPartnerIds.length > 0) {
        const chatUsers = await User.find({
          _id: { $in: chatPartnerIds, $ne: req.user._id },
          isActive: true,
        }).select('name email role department').lean();

        chatUsers.forEach((u) => {
          const uId = u._id.toString();
          if (!contactUserIds.has(uId)) {
            contactUserIds.add(uId);
            contactsList.push({
              ...u,
              relationship:
                u.role === 'student'
                  ? 'Student Inquirer'
                  : u.role === 'hod'
                  ? 'Head of Department'
                  : u.role === 'teacher'
                  ? 'Faculty Colleague'
                  : 'College Staff',
            });
          }
        });
      }

      // 2. All Assigned Mentees (Batches mentored or direct mentee assignments in StudentProfile)
      const mentoredBatches = await Batch.find({ mentor: req.user._id, isActive: true }).select('_id name');
      const mentoredBatchIds = mentoredBatches.map((b) => b._id);
      const batchNameMap = new Map();
      mentoredBatches.forEach((b) => batchNameMap.set(b._id.toString(), b.name));

      const menteeProfiles = await StudentProfile.find({
        $or: [
          { mentor: req.user._id },
          ...(mentoredBatchIds.length > 0 ? [{ batch: { $in: mentoredBatchIds } }] : []),
        ],
      })
        .populate('user', 'name email role department')
        .populate('batch', 'name code')
        .lean();

      menteeProfiles.forEach((sp) => {
        if (sp.user) {
          const uId = sp.user._id.toString();
          const batchName = sp.batch?.name || (sp.batch ? batchNameMap.get(sp.batch.toString()) : null);
          const relTitle = batchName ? `⭐ Mentee (${batchName})` : '⭐ Assigned Mentee';

          if (!contactUserIds.has(uId)) {
            contactUserIds.add(uId);
            contactsList.push({
              _id: sp.user._id,
              name: sp.user.name,
              email: sp.user.email,
              role: 'student',
              isMentee: true,
              relationship: relTitle,
              department: sp.user.department,
            });
          } else {
            // If already in list from chat history, upgrade status to Assigned Mentee
            const existing = contactsList.find((c) => c._id.toString() === uId);
            if (existing) {
              existing.isMentee = true;
              existing.relationship = relTitle;
            }
          }
        }
      });

      // 3. Students from Batches Taught by this Teacher
      const teachingSlots = await Timetable.find({ teacher: req.user._id, isActive: true })
        .populate('batch', 'name')
        .lean();
      const taughtBatchIds = [...new Set(teachingSlots.map((t) => t.batch?._id || t.batch).filter(Boolean))];

      if (taughtBatchIds.length > 0) {
        const classStudents = await StudentProfile.find({ batch: { $in: taughtBatchIds } })
          .populate('user', 'name email role department')
          .populate('batch', 'name')
          .lean();

        classStudents.forEach((sp) => {
          if (sp.user) {
            const uId = sp.user._id.toString();
            if (!contactUserIds.has(uId)) {
              contactUserIds.add(uId);
              contactsList.push({
                _id: sp.user._id,
                name: sp.user.name,
                email: sp.user.email,
                role: 'student',
                relationship: `Class Student (${sp.batch?.name || 'Course'})`,
                department: sp.user.department,
              });
            }
          }
        });
      }

      // 4. Students in Teacher's Department
      const teacherDeptId = req.user.department?._id || req.user.department;
      if (teacherDeptId) {
        const deptStudents = await User.find({
          role: 'student',
          department: teacherDeptId,
          isActive: true,
        }).select('name email role department').sort({ name: 1 }).limit(40).lean();

        deptStudents.forEach((st) => {
          const uId = st._id.toString();
          if (!contactUserIds.has(uId)) {
            contactUserIds.add(uId);
            contactsList.push({
              _id: st._id,
              name: st.name,
              email: st.email,
              role: 'student',
              relationship: 'Department Student',
              department: st.department,
            });
          }
        });
      }

      // 5. Faculty Colleagues, HODs, and College Administrators
      const [facultyMembers, admins] = await Promise.all([
        User.find({
          role: { $in: ['teacher', 'hod'] },
          _id: { $ne: req.user._id },
          isActive: true,
        }).select('name email role department').sort({ name: 1 }).lean(),
        User.find({
          role: { $in: ['college_admin', 'super_admin'] },
          _id: { $ne: req.user._id },
          isActive: true,
        }).select('name email role').lean(),
      ]);

      facultyMembers.forEach((f) => {
        const uId = f._id.toString();
        if (!contactUserIds.has(uId)) {
          contactUserIds.add(uId);
          contactsList.push({
            _id: f._id,
            name: f.name,
            email: f.email,
            role: f.role,
            isHod: f.role === 'hod',
            relationship: f.role === 'hod' ? 'Head of Department (HOD)' : 'Faculty Colleague',
            department: f.department,
          });
        }
      });

      admins.forEach((a) => {
        const uId = a._id.toString();
        if (!contactUserIds.has(uId)) {
          contactUserIds.add(uId);
          contactsList.push({
            _id: a._id,
            name: a.name,
            email: a.email,
            role: a.role,
            relationship: 'College Administrator',
          });
        }
      });

      contacts = contactsList;
    } else {
      // College Admin can message everyone (include anyone with chat history plus faculty and students)
      const [incomingSenders, outgoingRecipients] = await Promise.all([
        Message.distinct('sender', { recipient: req.user._id }),
        Message.distinct('recipient', { sender: req.user._id }),
      ]);
      const chatPartnerIds = [...new Set([...incomingSenders, ...outgoingRecipients].map((id) => id.toString()))];

      const users = await User.find({
        $or: [
          { _id: { $in: chatPartnerIds } },
          { _id: { $ne: req.user._id } },
        ],
        isActive: true,
      })
        .select('name email role department')
        .limit(60);

      contacts = users.map((u) => ({
        ...u.toObject(),
        relationship: u.role.toUpperCase(),
      }));
    }

    // Enrich contacts with unread counts, latest message snippet/timestamp, and pin status
    const [unreadAgg, lastMessagesAgg, currentUserDoc] = await Promise.all([
      Message.aggregate([
        {
          $match: {
            recipient: req.user._id,
            read: false,
          },
        },
        {
          $group: {
            _id: '$sender',
            count: { $sum: 1 },
          },
        },
      ]),
      Message.aggregate([
        {
          $match: {
            $or: [{ sender: req.user._id }, { recipient: req.user._id }],
          },
        },
        {
          $sort: { createdAt: -1 },
        },
        {
          $project: {
            content: 1,
            createdAt: 1,
            sender: 1,
            recipient: 1,
            read: 1,
            otherUser: {
              $cond: {
                if: { $eq: ['$sender', req.user._id] },
                then: '$recipient',
                else: '$sender',
              },
            },
          },
        },
        {
          $group: {
            _id: '$otherUser',
            content: { $first: '$content' },
            createdAt: { $first: '$createdAt' },
            sender: { $first: '$sender' },
            read: { $first: '$read' },
          },
        },
      ]),
      User.findById(req.user._id).select('pinnedContacts').lean(),
    ]);

    const unreadMap = new Map();
    unreadAgg.forEach((u) => unreadMap.set(u._id.toString(), u.count));

    const lastMessageMap = new Map();
    lastMessagesAgg.forEach((lm) => {
      lastMessageMap.set(lm._id.toString(), {
        content: lm.content,
        createdAt: lm.createdAt,
        sender: lm.sender,
        isMine: lm.sender.toString() === req.user._id.toString(),
        read: lm.read,
      });
    });

    const pinnedSet = new Set((currentUserDoc?.pinnedContacts || []).map((id) => id.toString()));

    const enrichedContacts = contacts.map((c) => {
      const cId = c._id.toString();
      const unreadCount = unreadMap.get(cId) || 0;
      const lastMessage = lastMessageMap.get(cId) || null;
      const isPinned = pinnedSet.has(cId);

      return {
        ...c,
        unreadCount,
        lastMessage,
        isPinned,
      };
    });

    // Intelligent Sorting:
    // 1. Pinned contacts always float to top
    // 2. Contacts with unread messages prioritized
    // 3. Contacts with recent messages sorted by latest activity
    // 4. Mentors & Mentees prioritized
    // 5. HODs, then alphabetical name
    enrichedContacts.sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }
      const hasUnreadA = (a.unreadCount || 0) > 0;
      const hasUnreadB = (b.unreadCount || 0) > 0;
      if (hasUnreadA !== hasUnreadB) {
        return hasUnreadA ? -1 : 1;
      }
      const timeA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const timeB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
      if (timeA !== timeB && (timeA > 0 || timeB > 0)) {
        return timeB - timeA;
      }
      if (a.isMentor && !b.isMentor) return -1;
      if (!a.isMentor && b.isMentor) return 1;
      if (a.isMentee && !b.isMentee) return -1;
      if (!a.isMentee && b.isMentee) return 1;
      if (a.isHod && !b.isHod) return -1;
      if (!a.isHod && b.isHod) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });

    return sendSuccess(res, 'Authorized contacts retrieved', enrichedContacts);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ==================== PIN / UNPIN CONTACT ====================
export const togglePinContact = async (req, res) => {
  try {
    const { contactId } = req.params;
    if (!contactId) {
      return sendError(res, 'Contact ID is required', 400);
    }

    const currentUser = await User.findById(req.user._id);
    if (!currentUser) {
      return sendError(res, 'User not found', 404);
    }

    const currentPins = (currentUser.pinnedContacts || []).map((id) => id.toString());
    const isCurrentlyPinned = currentPins.includes(contactId.toString());

    let updatedPins;
    if (isCurrentlyPinned) {
      updatedPins = currentPins.filter((id) => id !== contactId.toString());
    } else {
      updatedPins = [...currentPins, contactId];
    }

    currentUser.pinnedContacts = updatedPins;
    await currentUser.save();

    return sendSuccess(res, isCurrentlyPinned ? 'Contact unpinned' : 'Contact pinned to top', {
      isPinned: !isCurrentlyPinned,
      pinnedContacts: updatedPins,
    });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ==================== MARK CONVERSATION READ / UNREAD ====================
export const markConversationRead = async (req, res) => {
  try {
    const { otherUserId } = req.params;
    if (!otherUserId) {
      return sendError(res, 'Target user ID is required', 400);
    }

    const updateResult = await Message.updateMany(
      { sender: otherUserId, recipient: req.user._id, read: false },
      { $set: { read: true } }
    );

    if (updateResult.modifiedCount > 0) {
      emitToUser(otherUserId, 'conversation_read', { readerId: req.user._id });
    }

    return sendSuccess(res, 'Conversation marked as read', {
      markedCount: updateResult.modifiedCount,
    });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const markConversationUnread = async (req, res) => {
  try {
    const { otherUserId } = req.params;
    if (!otherUserId) {
      return sendError(res, 'Target user ID is required', 400);
    }

    // Find the latest message received from otherUserId
    const lastIncoming = await Message.findOne({
      sender: otherUserId,
      recipient: req.user._id,
    }).sort({ createdAt: -1 });

    if (lastIncoming) {
      lastIncoming.read = false;
      await lastIncoming.save();
    } else {
      // Fallback: mark the latest message between them as unread
      const lastAny = await Message.findOne({
        $or: [
          { sender: otherUserId, recipient: req.user._id },
          { sender: req.user._id, recipient: otherUserId },
        ],
      }).sort({ createdAt: -1 });

      if (lastAny) {
        lastAny.read = false;
        await lastAny.save();
      }
    }

    return sendSuccess(res, 'Conversation marked as unread');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ==================== DIRECT MESSAGING ====================
export const sendMessage = async (req, res) => {
  try {
    const { recipientId, content } = req.body;

    if (!recipientId || !content?.trim()) {
      return sendError(res, 'Recipient and message content are required', 400);
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) return sendError(res, 'Recipient not found', 404);

    // Rule: Students cannot message other students
    if (req.user.role === 'student' && recipient.role === 'student') {
      return sendError(res, 'Student-to-student direct messaging is disabled by institutional policy', 403);
    }

    const recipientInChat = isUserInChatWith(recipientId, req.user._id);

    const message = await Message.create({
      sender: req.user._id,
      recipient: recipientId,
      content: content.trim(),
      read: recipientInChat,
    });

    const populated = await Message.findById(message._id)
      .populate('sender recipient', 'name email role');

    // Real-time instant delivery via Socket.io
    emitToUser(recipientId, 'receive_message', populated);
    emitToUser(req.user._id, 'message_sent', populated);

    if (recipientInChat) {
      emitToUser(req.user._id, 'conversation_read', { readerId: recipientId });
    }

    return sendSuccess(res, 'Message delivered', populated, 201);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const getConversation = async (req, res) => {
  try {
    const { otherUserId } = req.params;

    // Mark incoming unread messages as read first
    const updateResult = await Message.updateMany(
      { sender: otherUserId, recipient: req.user._id, read: false },
      { $set: { read: true } }
    );

    // If any messages were marked read, notify the sender in real-time
    if (updateResult.modifiedCount > 0) {
      emitToUser(otherUserId, 'conversation_read', { readerId: req.user._id });
    }

    const messages = await Message.find({
      $or: [
        { sender: req.user._id, recipient: otherUserId },
        { sender: otherUserId, recipient: req.user._id },
      ],
    })
      .populate('sender recipient', 'name email role')
      .sort({ createdAt: 1 });

    return sendSuccess(res, 'Conversation retrieved', messages);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const getOnlineUsers = async (req, res) => {
  try {
    return sendSuccess(res, 'Active online users retrieved', getOnlineUserIds());
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};
