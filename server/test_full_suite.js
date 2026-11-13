// Comprehensive Full Suite Test for Campus360
// Tests all endpoints, role security, business logic, data integrity, and error states.

const BASE_URL = 'http://localhost:5000/api';

const ROLES = {
  admin: { email: 'admin@campus360.edu', password: 'Admin@123' },
  hod: { email: 'hod.cse@campus360.edu', password: 'Teacher@123' },
  mentor: { email: 'mentor@campus360.edu', password: 'Teacher@123' },
  teacher: { email: 'teacher1@campus360.edu', password: 'Teacher@123' },
  student: { email: 'student1@campus360.edu', password: 'Student@123' },
};

const tokens = {};
const userProfiles = {};
const testStats = { total: 0, passed: 0, failed: 0, errors: [] };

function assert(condition, testName, details = '') {
  testStats.total++;
  if (condition) {
    testStats.passed++;
    console.log(`  [PASS] ${testName}`);
  } else {
    testStats.failed++;
    const errMsg = `[FAIL] ${testName} ${details ? '- ' + details : ''}`;
    console.error(`  ${errMsg}`);
    testStats.errors.push(errMsg);
  }
}

async function api(path, options = {}, token = null) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });
  let raw = null;
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    raw = await res.json();
  } else {
    raw = await res.text();
  }
  // Automatically extract payload from Campus360 standard response { success, message, data }
  const data = (raw && typeof raw === 'object' && raw.data !== undefined) ? raw.data : raw;
  return { status: res.status, ok: res.ok, data, raw };
}

async function run() {
  console.log('====================================================');
  console.log('   CAMPUS360 EXHAUSTIVE FUNCTIONALITY & REGRESSION SUITE');
  console.log('====================================================\n');

  // --- MODULE 1: AUTHENTICATION & SECURITY ---
  console.log('--- 1. Testing Authentication & Role Guarding ---');
  
  // Health
  const healthRes = await api('/health');
  assert(healthRes.status === 200 && healthRes.data?.status === 'healthy', 'API Health Check returns 200 Healthy');

  // Negative auth: Wrong password
  const badAuth = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@campus360.edu', password: 'WrongPassword!999' }),
  });
  assert(badAuth.status === 401, 'Invalid credentials return 401 Unauthorized');

  // Login all roles
  for (const [roleKey, creds] of Object.entries(ROLES)) {
    const loginRes = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify(creds),
    });
    const token = loginRes.data?.accessToken;
    assert(loginRes.status === 200 && token, `Login successful for ${roleKey} (${creds.email})`);
    tokens[roleKey] = token;
    userProfiles[roleKey] = loginRes.data?.user;

    // Verify /api/auth/me
    const meRes = await api('/auth/me', { method: 'GET' }, tokens[roleKey]);
    assert(meRes.status === 200 && meRes.data?.user?.email === creds.email, `/auth/me returns valid session for ${roleKey}`);
  }

  // RBAC Guard: Student trying to create department must fail (403 Forbidden)
  const forbiddenRes = await api('/academics/departments', {
    method: 'POST',
    body: JSON.stringify({ name: 'Hack Dept', code: 'HCK' }),
  }, tokens.student);
  assert(forbiddenRes.status === 403, 'RBAC Guard: Student cannot create department (403 Forbidden)');

  // --- MODULE 2: ACADEMICS & MENTOR ASSIGNMENT ---
  console.log('\n--- 2. Testing Academics & Batch Mentor Allocation ---');

  const deptsRes = await api('/academics/departments', {}, tokens.admin);
  const departments = Array.isArray(deptsRes.data) ? deptsRes.data : deptsRes.data?.departments;
  assert(deptsRes.status === 200 && Array.isArray(departments) && departments.length > 0,
    `Fetch departments returned ${departments?.length} departments`);

  const coursesRes = await api('/academics/courses', {}, tokens.admin);
  const courses = Array.isArray(coursesRes.data) ? coursesRes.data : coursesRes.data?.courses;
  assert(coursesRes.status === 200 && Array.isArray(courses) && courses.length > 0,
    `Fetch courses returned ${courses?.length} courses`);

  const batchesRes = await api('/academics/batches', {}, tokens.admin);
  const batches = Array.isArray(batchesRes.data) ? batchesRes.data : batchesRes.data?.batches;
  assert(batchesRes.status === 200 && Array.isArray(batches) && batches.length > 0,
    `Fetch batches returned ${batches?.length} batches`);

  const classroomsRes = await api('/academics/classrooms', {}, tokens.admin);
  const classrooms = Array.isArray(classroomsRes.data) ? classroomsRes.data : classroomsRes.data?.classrooms;
  assert(classroomsRes.status === 200 && Array.isArray(classrooms) && classrooms.length > 0,
    `Fetch classrooms returned ${classrooms?.length} classrooms`);

  const subjectsRes = await api('/academics/subjects', {}, tokens.admin);
  const subjects = Array.isArray(subjectsRes.data) ? subjectsRes.data : subjectsRes.data?.subjects;
  assert(subjectsRes.status === 200 && Array.isArray(subjects) && subjects.length > 0,
    `Fetch subjects returned ${subjects?.length} subjects`);

  // Test dynamic Batch Mentor Assignment endpoint
  const targetBatch = batches?.[0];
  const targetTeacher = userProfiles.mentor;
  if (targetBatch && targetTeacher) {
    const assignMentorRes = await api(`/academics/batches/${targetBatch._id}/assign-mentor`, {
      method: 'POST',
      body: JSON.stringify({
        mentorId: targetTeacher._id,
        updateExistingStudents: true,
        notifyStudents: true,
      }),
    }, tokens.admin);
    assert(assignMentorRes.status === 200 && (assignMentorRes.data?.mentor || assignMentorRes.data?.batch?.mentor),
      `Admin reassigns batch mentor to ${targetTeacher.name} with student sync`);
  }

  // --- MODULE 3: USER MANAGEMENT & FACULTY MENTOR TOGGLE ---
  console.log('\n--- 3. Testing Users Directory & Mentorship Toggles ---');

  const teachersRes = await api('/users/teachers', {}, tokens.admin);
  const teachers = Array.isArray(teachersRes.data) ? teachersRes.data : teachersRes.data?.teachers;
  assert(teachersRes.status === 200 && Array.isArray(teachers) && teachers.length > 0,
    `Fetch teachers returned ${teachers?.length} faculty members`);

  // Verify menteeCount and mentoredBatches exist on teacher objects
  const firstTeacher = teachers?.[0];
  assert(firstTeacher && typeof firstTeacher.menteeCount === 'number',
    `Teacher profile contains calculated menteeCount (${firstTeacher?.menteeCount})`);

  // Toggle mentor status
  if (firstTeacher) {
    const toggleRes = await api(`/users/teachers/${firstTeacher._id}/toggle-mentor`, {
      method: 'PATCH',
    }, tokens.admin);
    assert(toggleRes.status === 200 && typeof toggleRes.data?.isMentor === 'boolean',
      `Admin toggled mentor designation for ${firstTeacher.name} -> isMentor: ${toggleRes.data?.isMentor}`);
  }

  // Fetch students
  const studentsRes = await api('/users/students?page=1&limit=20', {}, tokens.admin);
  const students = Array.isArray(studentsRes.data) ? studentsRes.data : studentsRes.data?.students;
  assert(studentsRes.status === 200 && Array.isArray(students) && students.length > 0,
    `Fetch students returned ${students?.length} enrolled students`);

  // Verify mentor populating on student profile
  const studentWithMentor = students?.find(s => s.profile?.mentor);
  assert(studentWithMentor !== undefined,
    `Student registry correctly populates assigned mentor (${studentWithMentor?.profile?.mentor?.name})`);

  // --- MODULE 4: TIMETABLE ---
  console.log('\n--- 4. Testing Timetable Engine ---');

  const timetableRes = await api('/timetable', {}, tokens.admin);
  const timetables = Array.isArray(timetableRes.data) ? timetableRes.data : timetableRes.data?.timetables;
  assert(timetableRes.status === 200 && Array.isArray(timetables),
    `Fetch timetable returned ${timetables?.length} periods`);

  if (targetBatch) {
    const batchTimetable = await api(`/timetable?batch=${targetBatch._id}`, {}, tokens.student);
    const batchPeriods = Array.isArray(batchTimetable.data) ? batchTimetable.data : batchTimetable.data?.timetables;
    assert(batchTimetable.status === 200 && Array.isArray(batchPeriods),
      `Fetch batch-filtered timetable returned ${batchPeriods?.length} periods`);
  }

  // --- MODULE 5: ATTENDANCE & KIOSK SCANNING ---
  console.log('\n--- 5. Testing Attendance System & Kiosk Terminal ---');

  // Student fetches their dynamic QR token
  const qrRes = await api('/attendance/student/qr-token', {}, tokens.student);
  assert(qrRes.status === 200 && qrRes.data?.token, 'Student successfully generated dynamic QR attendance token');

  // Teacher activates a session
  let activeSessionId = null;
  const targetTimetableSlot = timetables?.[0];
  let sessionCode = null;

  if (targetTimetableSlot) {
    const activateSessionRes = await api('/attendance/session/activate', {
      method: 'POST',
      body: JSON.stringify({
        timetableId: targetTimetableSlot._id,
      }),
    }, tokens.admin); // Admin is authorized to activate any timetable session

    assert(activateSessionRes.status === 200 || activateSessionRes.status === 201,
      `Activated live classroom attendance session (Code: ${activateSessionRes.data?.session?.sessionCode})`);

    if (activateSessionRes.data?.session) {
      activeSessionId = activateSessionRes.data.session._id;
      sessionCode = activateSessionRes.data.session.sessionCode;
    }
  }

  if (sessionCode) {
    // Public Kiosk query by sessionCode (No login required)
    const kioskSessionRes = await api(`/attendance/kiosk/session/${sessionCode}`, {});
    assert(kioskSessionRes.status === 200 && kioskSessionRes.data?.session?.sessionCode === sessionCode,
      `Classroom Kiosk successfully retrieved live session ${sessionCode} without auth`);

    // Scan student QR via Kiosk terminal
    if (qrRes.data?.token) {
      const kioskScanRes = await api('/attendance/kiosk/scan', {
        method: 'POST',
        body: JSON.stringify({
          sessionCode: sessionCode,
          qrToken: qrRes.data.token,
        }),
      });
      assert(kioskScanRes.status === 200 || kioskScanRes.status === 201 || kioskScanRes.status === 409 /* already marked */,
        `Classroom Kiosk scanned student QR token -> Status: ${kioskScanRes.status}`);
    }

    // Get session records
    const recordsRes = await api(`/attendance/session/${activeSessionId}/records`, {}, tokens.admin);
    const records = Array.isArray(recordsRes.data) ? recordsRes.data : recordsRes.data?.records;
    assert(recordsRes.status === 200 && Array.isArray(records),
      `Fetched session records -> ${records?.length} records present`);
  }

  // Student attendance analytics
  const studentStatsRes = await api('/attendance/student-stats', {}, tokens.student);
  assert(studentStatsRes.status === 200 && typeof studentStatsRes.data?.overall?.percentage !== 'undefined',
    `Student personal attendance stats calculated: ${studentStatsRes.data?.overall?.percentage}%`);

  // Batch attendance report
  if (targetBatch) {
    const batchReportRes = await api(`/attendance/batch-report/${targetBatch._id}`, {}, tokens.admin);
    assert(batchReportRes.status === 200 && Array.isArray(batchReportRes.data?.report),
      `Batch attendance report generated with ${batchReportRes.data?.report?.length} students`);
  }

  // --- MODULE 6: MENTORSHIP & COUNSELING ---
  console.log('\n--- 6. Testing Mentorship, Counseling & Case Notes ---');

  // Mentor checks assigned mentees
  const menteesRes = await api('/mentorship/mentees', {}, tokens.mentor);
  const mentees = Array.isArray(menteesRes.data) ? menteesRes.data : menteesRes.data?.mentees;
  assert(menteesRes.status === 200 && Array.isArray(mentees),
    `Mentor fetched ${mentees?.length} assigned cohort mentees`);

  // Student raises a mentorship support request
  const newReqRes = await api('/mentorship/requests', {
    method: 'POST',
    body: JSON.stringify({
      subject: 'Academic Counseling: Cloud Computing Elective Planning',
      description: 'Requesting guidance regarding second semester cloud certification tracks and career placement opportunities.',
      category: 'subject_difficulty',
    }),
  }, tokens.student);
  assert(newReqRes.status === 201 && newReqRes.data?._id,
    `Student filed mentorship counseling ticket #${newReqRes.data?._id}`);

  const requestId = newReqRes.data?._id;

  // Mentor views requests
  const mentorReqsRes = await api('/mentorship/requests', {}, tokens.mentor);
  const mentorReqs = Array.isArray(mentorReqsRes.data) ? mentorReqsRes.data : mentorReqsRes.data?.requests;
  assert(mentorReqsRes.status === 200 && Array.isArray(mentorReqs),
    `Mentor retrieved ${mentorReqs?.length} support tickets`);

  // Mentor updates support request
  if (requestId) {
    const updateTicketRes = await api(`/mentorship/requests/${requestId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'in_review',
        mentorNotes: 'Meeting scheduled for tomorrow at 3 PM in Faculty Chamber B-204.',
      }),
    }, tokens.mentor);
    assert(updateTicketRes.status === 200 && updateTicketRes.data?.status === 'in_review',
      `Mentor accepted and moved ticket #${requestId} to 'in_review'`);
  }

  // Mentor logs counseling session
  const targetStudentUserId = mentees?.[0]?.user?._id || userProfiles.student._id;
  const logSessionRes = await api('/mentorship/counseling-log', {
    method: 'POST',
    body: JSON.stringify({
      studentId: targetStudentUserId,
      sessionDate: new Date().toISOString(),
      category: 'personal_guidance',
      subject: 'Progress Review and Semester Goals',
      description: 'Reviewed 3rd-semester project milestones and advised on cloud portfolio architecture.',
      mentorNotes: 'Action items: Complete AWS Cloud Practitioner module and submit assignment 2.',
    }),
  }, tokens.mentor);
  assert(logSessionRes.status === 201, `Mentor logged official counseling record with student`);

  // --- MODULE 7: EXAMINATIONS & ACADEMIC TRANSCRIPTS ---
  console.log('\n--- 7. Testing Examinations, CIA Marks & Semester Grade Cards ---');

  const examsRes = await api('/examinations', {}, tokens.student);
  const exams = Array.isArray(examsRes.data) ? examsRes.data : examsRes.data?.examinations;
  assert(examsRes.status === 200 && Array.isArray(exams),
    `Retrieved ${exams?.length} institutional examination schedules`);

  // Teacher enters / updates CIA internal marks
  const internalExam = exams?.find(e => e.type === 'internal') || exams?.[0];
  const targetSubject = subjects?.[0];

  if (internalExam && targetSubject && targetBatch) {
    const markEntryRes = await api('/examinations/internal-marks', {
      method: 'POST',
      body: JSON.stringify({
        examinationId: internalExam._id,
        studentId: userProfiles.student._id,
        subjectId: targetSubject._id,
        batchId: targetBatch._id,
        marksObtained: 42,
        maxMarks: 50,
      }),
    }, tokens.teacher);
    assert(markEntryRes.status === 200,
      `Teacher recorded internal CIA continuous evaluation marks (Obtained: ${markEntryRes.data?.marksObtained}/${markEntryRes.data?.maxMarks})`);
  }

  // Student Official Transcript / Semester Grade Card
  const transcriptRes = await api('/examinations/transcript', {}, tokens.student);
  assert(transcriptRes.status === 200 && transcriptRes.data?.transcriptSummary,
    `Student fetched official transcript (SGPA: ${transcriptRes.data?.transcriptSummary?.sgpa})`);

  // Admin inspects student transcript by ID
  const adminTranscriptRes = await api(`/examinations/transcript/${userProfiles.student._id}`, {}, tokens.admin);
  assert(adminTranscriptRes.status === 200 && adminTranscriptRes.data?.student?.name,
    `Admin inspected student transcript for: ${adminTranscriptRes.data?.student?.name}`);

  // --- MODULE 8: QUIZZES & ASSESSMENTS ---
  console.log('\n--- 8. Testing Interactive Quizzes & Assessments ---');

  const quizzesRes = await api('/quizzes', {}, tokens.student);
  const quizzes = Array.isArray(quizzesRes.data) ? quizzesRes.data : quizzesRes.data?.quizzes;
  assert(quizzesRes.status === 200 && Array.isArray(quizzes),
    `Retrieved ${quizzes?.length} interactive quizzes`);

  // Teacher creates a quiz
  let testQuizId = null;
  if (targetSubject && targetBatch) {
    const createQuizRes = await api('/quizzes', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Cloud Architecture Benchmark Assessment',
        description: 'Auto-verification quiz for cloud fundamentals and distributed system scaling.',
        subject: targetSubject._id,
        batch: targetBatch._id,
        durationMinutes: 15,
        maxAttempts: 2,
        questions: [
          {
            questionText: 'Which AWS service is designed for serverless execution?',
            options: ['Amazon EC2', 'AWS Lambda', 'Amazon RDS', 'Amazon S3'],
            correctOptionIndex: 1,
            points: 10,
          },
          {
            questionText: 'What is the standard HTTP port number?',
            options: ['21', '22', '80', '443'],
            correctOptionIndex: 2,
            points: 10,
          },
        ],
      }),
    }, tokens.teacher);

    testQuizId = createQuizRes.data?._id;
    assert(createQuizRes.status === 201 && testQuizId,
      `Teacher created new assessment quiz #${testQuizId}`);
  }

  // Student takes quiz
  if (testQuizId) {
    const submitQuizRes = await api(`/quizzes/${testQuizId}/submit`, {
      method: 'POST',
      body: JSON.stringify({
        answers: [
          { questionIndex: 0, selectedOptionIndex: 1 },
          { questionIndex: 1, selectedOptionIndex: 2 },
        ],
        timeSpentSeconds: 45,
      }),
    }, tokens.student);
    const score = submitQuizRes.data?.scoreObtained ?? submitQuizRes.data?.score;
    const maxScore = submitQuizRes.data?.maxScore ?? submitQuizRes.data?.totalMarks;
    assert((submitQuizRes.status === 200 || submitQuizRes.status === 201) && score !== undefined,
      `Student submitted quiz attempt -> Score: ${score}/${maxScore}`);

    // Fetch quiz attempts
    const attemptsRes = await api(`/quizzes/${testQuizId}/attempts`, {}, tokens.teacher);
    const attempts = Array.isArray(attemptsRes.data) ? attemptsRes.data : attemptsRes.data?.attempts;
    assert(attemptsRes.status === 200 && Array.isArray(attempts),
      `Teacher fetched ${attempts?.length} quiz attempts`);
  }

  // --- MODULE 9: STUDY MATERIALS & ASSIGNMENTS ---
  console.log('\n--- 9. Testing Course Materials & Assignments ---');

  const materialsRes = await api('/materials', {}, tokens.student);
  const materials = Array.isArray(materialsRes.data) ? materialsRes.data : materialsRes.data?.materials;
  assert(materialsRes.status === 200 && Array.isArray(materials),
    `Student retrieved ${materials?.length} uploaded study materials`);

  const assignmentsRes = await api('/assignments', {}, tokens.student);
  const assignments = Array.isArray(assignmentsRes.data) ? assignmentsRes.data : assignmentsRes.data?.assignments;
  assert(assignmentsRes.status === 200 && Array.isArray(assignments),
    `Student retrieved ${assignments?.length} active coursework assignments`);

  // --- MODULE 10: COMMUNICATION & NOTIFICATIONS ---
  console.log('\n--- 10. Testing Announcements, Messaging & Real-Time Alerts ---');

  // Fetch announcements
  const announcementsRes = await api('/communication/announcements', {}, tokens.student);
  const announcements = Array.isArray(announcementsRes.data) ? announcementsRes.data : announcementsRes.data?.announcements;
  assert(announcementsRes.status === 200 && Array.isArray(announcements),
    `Retrieved ${announcements?.length} institutional announcements`);

  // Admin broadcasts an announcement
  const createAnnRes = await api('/communication/announcements', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Automated Test: Campus Tech Symposium 2026',
      content: 'Annual symposium registrations are now live for all technical branches.',
      scope: 'college',
      priority: 'urgent',
    }),
  }, tokens.admin);
  assert(createAnnRes.status === 201, 'Admin broadcast announcement created successfully');

  // Direct Message between student and mentor
  const sendMsgRes = await api('/communication/messages', {
    method: 'POST',
    body: JSON.stringify({
      recipientId: userProfiles.mentor._id,
      content: 'Good morning Dr. Swaminathan, I have submitted the revised project architecture report.',
    }),
  }, tokens.student);
  assert(sendMsgRes.status === 201, `Student sent direct message to mentor`);

  // Mentor retrieves conversation
  const convRes = await api(`/communication/messages/${userProfiles.student._id}`, {}, tokens.mentor);
  const messages = Array.isArray(convRes.data) ? convRes.data : convRes.data?.messages;
  assert(convRes.status === 200 && Array.isArray(messages),
    `Mentor retrieved conversation history with ${messages?.length} messages`);

  // Notifications
  const notifRes = await api('/notifications', {}, tokens.student);
  assert(notifRes.status === 200 && Array.isArray(notifRes.data?.notifications),
    `Student retrieved ${notifRes.data?.notifications?.length} notifications (Unread: ${notifRes.data?.unreadCount})`);

  // Mark all notifications read
  const markAllRes = await api('/notifications/read-all', { method: 'PATCH' }, tokens.student);
  assert(markAllRes.status === 200, 'Student marked all notifications as read');

  // --- MODULE 11: ANALYTICS & DASHBOARD METRICS ---
  console.log('\n--- 11. Testing Analytics & Cross-Role Metrics ---');

  for (const role of ['admin', 'hod', 'teacher', 'mentor', 'student']) {
    const dashRes = await api('/analytics/dashboard-metrics', {}, tokens[role]);
    assert(dashRes.status === 200 && dashRes.data?.role,
      `Dashboard metrics loaded successfully for role: ${role} (${dashRes.data?.role})`);
  }

  // Academic Risk Indicators (Defaulters & Low performers)
  const riskRes = await api('/analytics/risk-indicators', {}, tokens.admin);
  const risks = Array.isArray(riskRes.data) ? riskRes.data : [];
  assert(riskRes.status === 200 && Array.isArray(risks),
    `Academic Risk Indicators computed: ${risks.length} multi-factor risk profiles`);

  // SUMMARY
  console.log('\n====================================================');
  console.log(`   SUITE COMPLETE: ${testStats.passed}/${testStats.total} Passed (${testStats.failed} Failed)`);
  console.log('====================================================');

  if (testStats.failed > 0) {
    console.error('\nFailures detected:');
    testStats.errors.forEach(e => console.error('  - ' + e));
    process.exit(1);
  } else {
    console.log('\nAll application features verified successfully with 100% pass rate!');
    process.exit(0);
  }
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
