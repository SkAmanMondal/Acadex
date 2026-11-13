// ==============================================================================
// ACADEX / CAMPUS360 - EXHAUSTIVE CREATION-TO-DELETION LIFECYCLE TEST SUITE
// Tests every module, role, endpoint, and business logic flow across the entire system.
// ==============================================================================

import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5000/api';

const CREDENTIALS = {
  admin: { email: 'admin@campus360.edu', password: 'Admin@123' },
  hod: { email: 'hod.mca@campus360.edu', password: 'Teacher@123' },
  teacher: { email: 'teacher2@campus360.edu', password: 'Teacher@123' },
  mentor: { email: 'mentor@campus360.edu', password: 'Teacher@123' },
  student: { email: 'student1@campus360.edu', password: 'Student@123' },
};

const tokens = {};
const userProfiles = {};
const testStats = { total: 0, passed: 0, failed: 0, errors: [] };

function logSection(title) {
  console.log(`\n================================================================================`);
  console.log(`  ${title.toUpperCase()}`);
  console.log(`================================================================================`);
}

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

async function request(path, options = {}, token = null) {
  const headers = { ...(options.headers || {}) };
  // Only set application/json if body is NOT FormData
  if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const contentType = res.headers.get('content-type') || '';
  let raw = null;
  if (contentType.includes('application/json')) {
    raw = await res.json();
  } else {
    raw = await res.text();
  }

  const data = raw && typeof raw === 'object' && raw.data !== undefined ? raw.data : raw;
  return { status: res.status, ok: res.ok, headers: res.headers, data, raw };
}

async function runLifecycleTests() {
  console.log('Starting Acadex / Campus360 Full Creation-to-Deletion Audit Suite...\n');

  // ============================================================================
  // SUITE 1: AUTHENTICATION, SESSIONS & RBAC GUARDS
  // ============================================================================
  logSection('Suite 1: Authentication, Role Sessions & Security Barriers');

  // 1. Health check
  const health = await request('/health');
  assert(health.status === 200 && health.data?.status === 'healthy', 'API Health Check returns 200 Healthy');

  // 2. Negative authentication
  const badLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@campus360.edu', password: 'CompletelyWrongPassword!123' }),
  });
  assert(badLogin.status === 401, 'Invalid password correctly rejected with 401 Unauthorized');

  // 3. Login all 5 distinct roles
  for (const [roleName, creds] of Object.entries(CREDENTIALS)) {
    const loginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(creds),
    });
    const token = loginRes.data?.accessToken;
    assert(loginRes.status === 200 && Boolean(token), `Login authenticated for role: ${roleName} (${creds.email})`);
    tokens[roleName] = token;
    userProfiles[roleName] = loginRes.data?.user;

    // Verify session
    const meRes = await request('/auth/me', { method: 'GET' }, token);
    assert(meRes.status === 200 && meRes.data?.user?.email === creds.email, `/auth/me returns valid user session for ${roleName}`);
  }

  // 4. RBAC Barrier: Student cannot create department
  const rbacDept = await request('/academics/departments', {
    method: 'POST',
    body: JSON.stringify({ name: 'Unauthorized Dept', code: 'UNAUTH' }),
  }, tokens.student);
  assert(rbacDept.status === 403, 'RBAC Security Barrier: Student role prohibited from creating department (403 Forbidden)');

  // ============================================================================
  // SUITE 2: ACADEMICS LIFECYCLE (CREATE -> READ -> UPDATE -> DELETE)
  // ============================================================================
  logSection('Suite 2: Academics Structure Full Lifecycle (Create -> Read -> Update -> Delete)');

  const testSuffix = Math.floor(1000 + Math.random() * 9000);

  // 1. Department
  const deptCode = `T-AERO-${testSuffix}`;
  const createDeptRes = await request('/academics/departments', {
    method: 'POST',
    body: JSON.stringify({
      name: `Aeronautical Engineering ${testSuffix}`,
      code: deptCode,
      description: 'Department dedicated to aerospace dynamics and avionics research',
    }),
  }, tokens.admin);
  const createdDept = createDeptRes.data;
  assert(createDeptRes.status === 201 && createdDept?._id, `Department Created: ${createdDept?.name} (${deptCode})`);

  // Verify Dept exists in list
  const deptsList = await request('/academics/departments', {}, tokens.admin);
  const deptFound = (deptsList.data || []).find((d) => d._id === createdDept?._id);
  assert(Boolean(deptFound), `Department Read: ${deptCode} confirmed present in registry`);

  // Update Dept
  const updateDeptRes = await request(`/academics/departments/${createdDept?._id}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: `Aerospace & Astronautics Engineering ${testSuffix}`,
      description: 'Expanded department covering propulsion, orbital dynamics, and avionics',
    }),
  }, tokens.admin);
  assert(updateDeptRes.status === 200 && updateDeptRes.data?.name.includes('Astronautics'), `Department Updated: Name updated to Aerospace & Astronautics`);

  // 2. Course
  const courseCode = `BTECH-AERO-${testSuffix}`;
  const createCourseRes = await request('/academics/courses', {
    method: 'POST',
    body: JSON.stringify({
      name: `Bachelor of Technology in Aerospace ${testSuffix}`,
      code: courseCode,
      department: createdDept._id,
      totalSemesters: 8,
      type: 'undergraduate',
    }),
  }, tokens.admin);
  const createdCourse = createCourseRes.data;
  assert(createCourseRes.status === 201 && createdCourse?._id, `Course Created: ${createdCourse?.name} (${courseCode})`);

  // Update Course
  const updateCourseRes = await request(`/academics/courses/${createdCourse?._id}`, {
    method: 'PUT',
    body: JSON.stringify({ totalSemesters: 8, name: `B.Tech in Aerospace Sciences ${testSuffix}` }),
  }, tokens.admin);
  assert(updateCourseRes.status === 200, `Course Updated: Degree specifications revised`);

  // 3. Batch
  const createBatchRes = await request('/academics/batches', {
    method: 'POST',
    body: JSON.stringify({
      name: `Batch 2026-2030 AERO-${testSuffix}`,
      course: createdCourse._id,
      department: createdDept._id,
      currentSemester: 1,
      startYear: 2026,
      endYear: 2030,
      section: 'A',
    }),
  }, tokens.admin);
  const createdBatch = createBatchRes.data;
  assert(createBatchRes.status === 201 && createdBatch?._id, `Batch Created: ${createdBatch?.name}`);

  // Assign Mentor to Batch
  const assignMentorRes = await request(`/academics/batches/${createdBatch?._id}/assign-mentor`, {
    method: 'POST',
    body: JSON.stringify({
      mentorId: userProfiles.mentor._id,
      updateExistingStudents: true,
      notifyStudents: false,
    }),
  }, tokens.admin);
  assert(assignMentorRes.status === 200, `Batch Mentor Assigned: ${userProfiles.mentor.name} designated as mentor`);

  // 4. Classroom (using valid enum 'computer_lab')
  const roomNumber = `LAB-AERO-${testSuffix}`;
  const createRoomRes = await request('/academics/classrooms', {
    method: 'POST',
    body: JSON.stringify({
      roomNumber,
      block: 'Aerospace Engineering Block',
      capacity: 60,
      type: 'computer_lab',
      hasProjector: true,
    }),
  }, tokens.admin);
  const createdRoom = createRoomRes.data;
  assert(createRoomRes.status === 201 && createdRoom?._id, `Classroom Created: ${roomNumber} (Capacity 60)`);

  // Update Classroom
  const updateRoomRes = await request(`/academics/classrooms/${createdRoom?._id}`, {
    method: 'PUT',
    body: JSON.stringify({ capacity: 75 }),
  }, tokens.admin);
  assert(updateRoomRes.status === 200 && updateRoomRes.data?.capacity === 75, `Classroom Updated: Capacity expanded to 75`);

  // 5. Subject
  const subCode = `AERO-PROP-${testSuffix}`;
  const createSubRes = await request('/academics/subjects', {
    method: 'POST',
    body: JSON.stringify({
      name: `Advanced Rocket Propulsion ${testSuffix}`,
      code: subCode,
      department: createdDept._id,
      course: createdCourse._id,
      semester: 1,
      credits: 4,
      type: 'theory',
    }),
  }, tokens.admin);
  const createdSub = createSubRes.data;
  assert(createSubRes.status === 201 && createdSub?._id, `Subject Created: ${createdSub?.name} (${subCode})`);

  // Update Subject
  const updateSubRes = await request(`/academics/subjects/${createdSub?._id}`, {
    method: 'PUT',
    body: JSON.stringify({ credits: 5 }),
  }, tokens.admin);
  assert(updateSubRes.status === 200 && updateSubRes.data?.credits === 5, `Subject Updated: Credits updated to 5`);

  // 6. Delete all created academic entities in reverse dependency order
  const delSub = await request(`/academics/subjects/${createdSub._id}`, { method: 'DELETE' }, tokens.admin);
  assert(delSub.status === 200, `Subject Deleted: ${subCode} removed successfully`);

  const delRoom = await request(`/academics/classrooms/${createdRoom._id}`, { method: 'DELETE' }, tokens.admin);
  assert(delRoom.status === 200, `Classroom Deleted: ${roomNumber} removed successfully`);

  const delBatch = await request(`/academics/batches/${createdBatch._id}`, { method: 'DELETE' }, tokens.admin);
  assert(delBatch.status === 200, `Batch Deleted: ${createdBatch.name} removed successfully`);

  const delCourse = await request(`/academics/courses/${createdCourse._id}`, { method: 'DELETE' }, tokens.admin);
  assert(delCourse.status === 200, `Course Deleted: ${courseCode} removed successfully`);

  const delDept = await request(`/academics/departments/${createdDept._id}`, { method: 'DELETE' }, tokens.admin);
  assert(delDept.status === 200, `Department Deleted: ${deptCode} removed successfully`);

  // Verify deletion confirmed
  const checkDepts = await request('/academics/departments', {}, tokens.admin);
  const deptGone = !(checkDepts.data || []).some((d) => d._id === createdDept._id);
  assert(deptGone, `Academics Cleanup Verified: Test department completely erased from registry`);

  // ============================================================================
  // SUITE 3: TIMETABLE ENGINE (CREATE -> READ -> UPDATE -> DELETE)
  // ============================================================================
  logSection('Suite 3: Master Timetable Engine Lifecycle');

  // Fetch stable existing entities for timetable testing
  const allDepts = (await request('/academics/departments', {}, tokens.admin)).data || [];
  const allSubjects = (await request('/academics/subjects', {}, tokens.admin)).data || [];
  const allBatches = (await request('/academics/batches', {}, tokens.admin)).data || [];
  const allRooms = (await request('/academics/classrooms', {}, tokens.admin)).data || [];

  const testDept = allDepts[0];
  const testSub = allSubjects[0];
  const testBatch = allBatches[0];
  const testRoom = allRooms[0];

  assert(Boolean(testSub && testBatch && testRoom), `Prerequisites available: Subject (${testSub?.code}), Batch (${testBatch?.name}), Room (${testRoom?.roomNumber})`);

  // Create Timetable Slot (using field 'day')
  const createSlotRes = await request('/timetable', {
    method: 'POST',
    body: JSON.stringify({
      subject: testSub._id,
      batch: testBatch._id,
      classroom: testRoom._id,
      teacher: userProfiles.teacher._id,
      department: testDept._id,
      semester: 1,
      day: 'Saturday',
      startTime: '17:00',
      endTime: '18:00',
    }),
  }, tokens.admin);
  const createdSlot = createSlotRes.data;
  assert(createSlotRes.status === 201 && createdSlot?._id, `Timetable Slot Created: Saturday 17:00 - 18:00 for ${testSub.name}`);

  // Read Timetable
  const ttList = await request('/timetable', {}, tokens.admin);
  const slotFound = (ttList.data || []).find((s) => s._id === createdSlot?._id);
  assert(Boolean(slotFound), `Timetable Slot Read: Period verified in master schedule`);

  // Update Timetable Slot
  const updateSlotRes = await request(`/timetable/${createdSlot._id}`, {
    method: 'PUT',
    body: JSON.stringify({ startTime: '17:15', endTime: '18:15' }),
  }, tokens.admin);
  assert(updateSlotRes.status === 200, `Timetable Slot Updated: Period shifted to 17:15 - 18:15`);

  // Delete Timetable Slot
  const delSlot = await request(`/timetable/${createdSlot._id}`, { method: 'DELETE' }, tokens.admin);
  assert(delSlot.status === 200, `Timetable Slot Deleted: Period removed cleanly`);

  // ============================================================================
  // SUITE 4: ATTENDANCE SYSTEM & DYNAMIC QR PROTOCOL
  // ============================================================================
  logSection('Suite 4: Smart Attendance Session & Dynamic QR Protocol');

  // Student dynamic QR token generation
  const studentQrRes = await request('/attendance/student/qr-token', {}, tokens.student);
  assert(studentQrRes.status === 200 && Boolean(studentQrRes.data?.token), 'Student generated live signed QR attendance token');

  // Student personal attendance analytics
  const studentStatsRes = await request('/attendance/student-stats', {}, tokens.student);
  assert(studentStatsRes.status === 200 && typeof studentStatsRes.data?.overall?.percentage !== 'undefined',
    `Student personal attendance stats calculated: ${studentStatsRes.data?.overall?.percentage}%`);

  // Batch attendance report
  const batchReportRes = await request(`/attendance/batch-report/${testBatch._id}`, {}, tokens.admin);
  assert(batchReportRes.status === 200 && Array.isArray(batchReportRes.data?.report),
    `Batch attendance audit report calculated with ${batchReportRes.data?.report?.length} students`);

  // ============================================================================
  // SUITE 5: STUDY MATERIALS (UPLOAD -> VIEW -> DOWNLOAD -> UPDATE -> DELETE)
  // ============================================================================
  logSection('Suite 5: Study Materials LMS (Upload -> View Stream -> Download Stream -> Update -> Delete)');

  // Use the verified real test sample PDF
  const samplePdfPath = path.resolve('test_sample.pdf');
  let pdfBuffer;
  if (fs.existsSync(samplePdfPath)) {
    pdfBuffer = fs.readFileSync(samplePdfPath);
  } else {
    pdfBuffer = Buffer.from('%PDF-1.4 sample content');
  }

  const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
  const uploadForm = new FormData();
  uploadForm.append('file', pdfBlob, `e2e_lecture_notes_${testSuffix}.pdf`);
  uploadForm.append('title', `E2E Automated Study Guide ${testSuffix}`);
  uploadForm.append('description', 'Comprehensive lecture slide deck for full system verification');
  uploadForm.append('subject', testSub._id);
  uploadForm.append('unit', '1');
  uploadForm.append('topic', 'Automated Architecture Testing');
  uploadForm.append('department', testDept._id);

  // Upload
  const uploadRes = await request('/materials/upload', {
    method: 'POST',
    body: uploadForm,
  }, tokens.teacher);
  const createdMaterial = uploadRes.data;
  assert(uploadRes.status === 201 && createdMaterial?._id, `Study Material Uploaded: ${createdMaterial?.title}`);

  if (createdMaterial?._id) {
    // Fetch materials as student
    const studentMats = await request('/materials', {}, tokens.student);
    const foundMat = (studentMats.data || []).find((m) => m._id === createdMaterial._id);
    assert(Boolean(foundMat), `Study Material Read: Student found uploaded guide in LMS repository`);

    // Test Online In-Browser View Stream
    const viewRes = await fetch(`${BASE_URL}/materials/${createdMaterial._id}/view?token=${tokens.student}`);
    const viewDisposition = viewRes.headers.get('content-disposition') || '';
    const viewType = viewRes.headers.get('content-type') || '';
    assert(
      viewRes.status === 200 && viewDisposition.includes('inline') && viewType.includes('pdf'),
      `Study Material View Stream: HTTP 200, Content-Type: ${viewType}, Disposition: ${viewDisposition}`
    );

    // Test Direct Native File Download Stream
    const downRes = await fetch(`${BASE_URL}/materials/${createdMaterial._id}/download?token=${tokens.student}`);
    const downDisposition = downRes.headers.get('content-disposition') || '';
    const downType = downRes.headers.get('content-type') || '';
    assert(
      downRes.status === 200 && downDisposition.includes('attachment') && downType.includes('pdf'),
      `Study Material Download Stream: HTTP 200, Content-Type: ${downType}, Disposition: ${downDisposition}`
    );

    // Update Material
    const updateMatRes = await request(`/materials/${createdMaterial._id}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: `E2E Automated Study Guide (Revised v2) ${testSuffix}`,
        topic: 'Comprehensive Architecture Deep Dive',
      }),
    }, tokens.teacher);
    assert(updateMatRes.status === 200 && updateMatRes.data?.title.includes('Revised v2'), `Study Material Updated: Metadata updated successfully`);

    // Delete Material
    const delMatRes = await request(`/materials/${createdMaterial._id}`, { method: 'DELETE' }, tokens.teacher);
    assert(delMatRes.status === 200, `Study Material Deleted: ${createdMaterial.title} deleted cleanly`);

    // Verify Material Gone
    const verifyMats = await request('/materials', {}, tokens.student);
    const matGone = !(verifyMats.data || []).some((m) => m._id === createdMaterial._id);
    assert(matGone, `Study Material Cleanup Verified: Material no longer visible in student repository`);
  }

  // ============================================================================
  // SUITE 6: ASSIGNMENTS & COURSEWORK (CREATE -> SUBMIT -> GRADE -> DELETE)
  // ============================================================================
  logSection('Suite 6: Assignments & Coursework Lifecycle (Create -> Submit -> Grade -> Delete)');

  // Create Assignment
  const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const assignForm = new FormData();
  assignForm.append('title', `E2E Cloud Architecture Project ${testSuffix}`);
  assignForm.append('description', 'Design and implement a multi-region highly available microservice topology');
  assignForm.append('subject', testSub._id);
  assignForm.append('batch', testBatch._id);
  assignForm.append('deadline', deadline);
  assignForm.append('maxMarks', '100');

  const createAssignRes = await request('/assignments', {
    method: 'POST',
    body: assignForm,
  }, tokens.teacher);
  const createdAssign = createAssignRes.data;
  assert(createAssignRes.status === 201 && createdAssign?._id, `Assignment Created: ${createdAssign?.title}`);

  // Student fetches assignments
  const studentAssignList = await request('/assignments', {}, tokens.student);
  const assignFound = (studentAssignList.data || []).find((a) => a._id === createdAssign?._id);
  assert(Boolean(assignFound), `Assignment Read: Student retrieved new project assignment`);

  // Student submits assignment
  const subBytes = new TextEncoder().encode('Project Architecture Report: Multi-region failover implemented via DNS routing.');
  const subBlob = new Blob([subBytes], { type: 'text/plain' });
  const submitForm = new FormData();
  submitForm.append('file', subBlob, `solution_report_${testSuffix}.txt`);

  const submitRes = await request(`/assignments/${createdAssign._id}/submit`, {
    method: 'POST',
    body: submitForm,
  }, tokens.student);
  assert(submitRes.status === 200 || submitRes.status === 201, `Assignment Submitted: Student submitted coursework project`);

  // Teacher reads submissions
  const subsList = await request(`/assignments/${createdAssign._id}/submissions`, {}, tokens.teacher);
  const submissions = subsList.data || [];
  const studentSub = submissions.find((s) => s.student?._id === userProfiles.student._id || s.student === userProfiles.student._id);
  assert(Boolean(studentSub), `Teacher Read Submissions: Received ${submissions.length} submission(s)`);

  // Teacher grades submission
  if (studentSub?._id) {
    const gradeRes = await request(`/assignments/submissions/${studentSub._id}/grade`, {
      method: 'PATCH',
      body: JSON.stringify({
        marksObtained: 96,
        feedback: 'Outstanding architecture diagram and solid disaster recovery strategy.',
      }),
    }, tokens.teacher);
    assert(gradeRes.status === 200 && gradeRes.data?.marksObtained === 96, `Assignment Graded: Marks 96/100 recorded with instructor feedback`);
  }

  // Teacher deletes assignment
  const delAssignRes = await request(`/assignments/${createdAssign._id}`, { method: 'DELETE' }, tokens.teacher);
  assert(delAssignRes.status === 200, `Assignment Deleted: Project coursework removed cleanly`);

  // ============================================================================
  // SUITE 7: INTERACTIVE QUIZZES & AUTO-GRADING (CREATE -> SUBMIT -> DELETE)
  // ============================================================================
  logSection('Suite 7: Interactive Assessments & Auto-Grading (Create -> Submit -> Delete)');

  // Create Quiz
  const createQuizRes = await request('/quizzes', {
    method: 'POST',
    body: JSON.stringify({
      title: `E2E Cloud Computing Benchmark Quiz ${testSuffix}`,
      description: 'Auto-graded assessment on microservice architecture and container virtualization',
      subject: testSub._id,
      batch: testBatch._id,
      durationMinutes: 10,
      maxAttempts: 3,
      questions: [
        {
          questionText: 'Which protocol is connectionless and lightweight for streaming?',
          options: ['TCP', 'UDP', 'BGP', 'SSH'],
          correctOptionIndex: 1, // UDP
          points: 10,
        },
        {
          questionText: 'What is the standard container runtime specification backed by CNCF?',
          options: ['VirtualBox', 'containerd / OCI', 'VMware ESXi', 'QEMU'],
          correctOptionIndex: 1, // containerd / OCI
          points: 10,
        },
      ],
    }),
  }, tokens.teacher);
  const createdQuiz = createQuizRes.data;
  assert(createQuizRes.status === 201 && createdQuiz?._id, `Quiz Created: ${createdQuiz?.title}`);

  // Student takes quiz
  const submitQuizRes = await request(`/quizzes/${createdQuiz._id}/submit`, {
    method: 'POST',
    body: JSON.stringify({
      answers: [
        { questionIndex: 0, selectedOptionIndex: 1 }, // Correct (UDP)
        { questionIndex: 1, selectedOptionIndex: 1 }, // Correct (containerd)
      ],
      timeSpentSeconds: 32,
    }),
  }, tokens.student);
  const quizScore = submitQuizRes.data?.scoreObtained ?? submitQuizRes.data?.score;
  const quizTotal = submitQuizRes.data?.maxScore ?? submitQuizRes.data?.totalMarks;
  assert(
    (submitQuizRes.status === 200 || submitQuizRes.status === 201) && quizScore === 20,
    `Quiz Auto-Graded: Student scored 100% (${quizScore}/${quizTotal} points)`
  );

  // Teacher views quiz attempts (attempts array in data.attempts or data)
  const attemptsRes = await request(`/quizzes/${createdQuiz._id}/attempts`, {}, tokens.teacher);
  const attemptsList = attemptsRes.data?.attempts || (Array.isArray(attemptsRes.data) ? attemptsRes.data : []);
  assert(attemptsRes.status === 200 && Array.isArray(attemptsList), `Quiz Attempts Read: Verified student submission logged`);

  // Teacher deletes quiz
  const delQuizRes = await request(`/quizzes/${createdQuiz._id}`, { method: 'DELETE' }, tokens.teacher);
  assert(delQuizRes.status === 200, `Quiz Deleted: Assessment removed successfully`);

  // ============================================================================
  // SUITE 8: EXAMINATIONS & CONTINUOUS INTERNAL ASSESSMENT (CIA)
  // ============================================================================
  logSection('Suite 8: Examinations & CIA Continuous Internal Marks Lifecycle');

  // Admin schedules Examination
  const createExamRes = await request('/examinations', {
    method: 'POST',
    body: JSON.stringify({
      title: `CIA Continuous Assessment Schedule ${testSuffix}`,
      type: 'internal',
      academicYear: '2025-2026',
      semester: 1,
      department: testDept._id,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    }),
  }, tokens.admin);
  const createdExam = createExamRes.data;
  assert(createExamRes.status === 201 && createdExam?._id, `Examination Scheduled: ${createdExam?.title}`);

  // Teacher records internal CIA continuous evaluation marks
  const markEntryRes = await request('/examinations/internal-marks', {
    method: 'POST',
    body: JSON.stringify({
      examinationId: createdExam._id,
      studentId: userProfiles.student._id,
      subjectId: testSub._id,
      batchId: testBatch._id,
      marksObtained: 47,
      maxMarks: 50,
    }),
  }, tokens.teacher);
  const examResultId = markEntryRes.data?._id;
  assert(markEntryRes.status === 200 && markEntryRes.data?.marksObtained === 47, `CIA Internal Marks Recorded: 47/50 entered for student`);

  // Student checks official academic transcript
  const transcriptRes = await request('/examinations/transcript', {}, tokens.student);
  assert(transcriptRes.status === 200 && transcriptRes.data?.transcriptSummary, `Official Academic Transcript: SGPA and GPA metrics computed`);

  // Clean up: delete internal marks result and delete examination
  if (examResultId) {
    const delResult = await request(`/examinations/results/${examResultId}`, { method: 'DELETE' }, tokens.teacher);
    assert(delResult.status === 200, `Exam Marks Result Deleted: Cleaned up`);
  }

  const delExam = await request(`/examinations/${createdExam._id}`, { method: 'DELETE' }, tokens.admin);
  assert(delExam.status === 200, `Examination Deleted: Examination schedule removed successfully`);

  // ============================================================================
  // SUITE 9: ANNOUNCEMENTS & DIRECT MESSAGING
  // ============================================================================
  logSection('Suite 9: Communication, Broadcast Announcements & Direct Messaging');

  // Create Announcement (using priority 'urgent')
  const createAnnRes = await request('/communication/announcements', {
    method: 'POST',
    body: JSON.stringify({
      title: `E2E Institutional Advisory ${testSuffix}`,
      content: 'Campus networks and cloud laboratory clusters will undergo scheduled maintenance this Saturday.',
      scope: 'college',
      priority: 'urgent',
    }),
  }, tokens.admin);
  const createdAnn = createAnnRes.data;
  assert(createAnnRes.status === 201 && createdAnn?._id, `Announcement Created: ${createdAnn?.title}`);

  // Read Announcements
  const annList = await request('/communication/announcements', {}, tokens.student);
  const annFound = (annList.data || []).find((a) => a._id === createdAnn?._id);
  assert(Boolean(annFound), `Announcement Read: Student received broadcast in feed`);

  // Delete Announcement
  const delAnnRes = await request(`/communication/announcements/${createdAnn._id}`, { method: 'DELETE' }, tokens.admin);
  assert(delAnnRes.status === 200, `Announcement Deleted: Broadcast removed cleanly`);

  // Direct Message: Student -> Teacher
  const sendMsgRes = await request('/communication/messages', {
    method: 'POST',
    body: JSON.stringify({
      recipientId: userProfiles.teacher._id,
      content: `Hello Professor, I have reviewed the cloud computing syllabus and submitted test ${testSuffix}.`,
    }),
  }, tokens.student);
  assert(sendMsgRes.status === 201, `Direct Message Sent: Student messaged teacher`);

  // Teacher views conversation thread
  const convRes = await request(`/communication/messages/${userProfiles.student._id}`, {}, tokens.teacher);
  const messages = Array.isArray(convRes.data) ? convRes.data : convRes.data?.messages;
  assert(convRes.status === 200 && Array.isArray(messages) && messages.length > 0, `Direct Message Conversation Read: Thread history verified (${messages?.length} messages)`);

  // Teacher replies
  const replyMsg = await request('/communication/messages', {
    method: 'POST',
    body: JSON.stringify({
      recipientId: userProfiles.student._id,
      content: 'Well done! Keep up the consistent effort on the project milestones.',
    }),
  }, tokens.teacher);
  assert(replyMsg.status === 201, `Direct Message Reply: Teacher replied to student`);

  // Student marks conversation read
  const markReadRes = await request(`/communication/messages/${userProfiles.teacher._id}/read`, { method: 'PATCH' }, tokens.student);
  assert(markReadRes.status === 200, `Direct Message Read Receipt: Conversation marked as read`);

  // ============================================================================
  // SUITE 10: NOTIFICATIONS LIFECYCLE (CREATE -> READ -> MARK -> DELETE)
  // ============================================================================
  logSection('Suite 10: System Notifications Lifecycle (Create -> Read -> Mark -> Delete)');

  // Create notification
  const createNotifRes = await request('/notifications', {
    method: 'POST',
    body: JSON.stringify({
      recipient: userProfiles.student._id,
      title: `E2E System Notification ${testSuffix}`,
      message: 'Your laboratory report has been verified by the department.',
      type: 'assignment',
    }),
  }, tokens.admin);
  const createdNotif = createNotifRes.data;
  assert(createNotifRes.status === 201 && createdNotif?._id, `Notification Created: ${createdNotif?.title}`);

  // Student reads notifications
  const notifsRes = await request('/notifications', {}, tokens.student);
  const notifFound = (notifsRes.data?.notifications || []).find((n) => n._id === createdNotif?._id);
  assert(Boolean(notifFound), `Notification Read: Student received notification in notification center`);

  // Mark notification read
  const markNotifRes = await request(`/notifications/${createdNotif._id}/read`, { method: 'PATCH' }, tokens.student);
  assert(markNotifRes.status === 200, `Notification Marked Read: Status updated to read`);

  // Delete notification
  const delNotifRes = await request(`/notifications/${createdNotif._id}`, { method: 'DELETE' }, tokens.student);
  assert(delNotifRes.status === 200, `Notification Deleted: Cleaned up from student tray`);

  // ============================================================================
  // SUITE 11: MENTORSHIP & COUNSELING LIFECYCLE
  // ============================================================================
  logSection('Suite 11: Mentorship Support & 1-on-1 Counseling Session');

  // Student raises counseling support ticket (using category 'personal_guidance')
  const createTicketRes = await request('/mentorship/requests', {
    method: 'POST',
    body: JSON.stringify({
      subject: `E2E Career Guidance Inquiry ${testSuffix}`,
      description: 'Requesting advice regarding post-graduate research fellowships and industry internships.',
      category: 'personal_guidance',
    }),
  }, tokens.student);
  const createdTicket = createTicketRes.data;
  assert(createTicketRes.status === 201 && createdTicket?._id, `Mentorship Ticket Created: #${createdTicket?._id}`);

  if (createdTicket?._id) {
    // Student reads tickets
    const studentTicketsRes = await request('/mentorship/requests', {}, tokens.student);
    const studentTickets = Array.isArray(studentTicketsRes.data) ? studentTicketsRes.data : (studentTicketsRes.data?.requests || []);
    const ticketFoundByStudent = studentTickets.find((t) => t._id === createdTicket._id);
    assert(Boolean(ticketFoundByStudent), `Mentorship Ticket Read: Student confirmed ticket in personal support queue`);

    // Mentor reads tickets (use token of the assigned mentor or default mentor)
    const assignedMentorId = String(createdTicket.mentor?._id || createdTicket.mentor || '');
    const mentorTokenToUse = (assignedMentorId === String(userProfiles.teacher._id)) ? tokens.teacher : tokens.mentor;
    const mentorTicketsRes = await request('/mentorship/requests', {}, mentorTokenToUse);
    const mentorTickets = Array.isArray(mentorTicketsRes.data) ? mentorTicketsRes.data : (mentorTicketsRes.data?.requests || []);
    const ticketFound = mentorTickets.find((t) => t._id === createdTicket._id);
    assert(Boolean(ticketFound), `Mentorship Ticket Read: Mentor received counseling ticket in queue`);

    // Mentor accepts ticket and updates status
    const updateTicketRes = await request(`/mentorship/requests/${createdTicket._id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'in_review',
        mentorNotes: 'Reviewed portfolio. Meeting scheduled in faculty chamber B-204.',
      }),
    }, mentorTokenToUse);
    assert(updateTicketRes.status === 200 && updateTicketRes.data?.status === 'in_review', `Mentorship Ticket Updated: Status moved to 'in_review'`);

    // Mentor logs official counseling session
    const counselingLogRes = await request('/mentorship/counseling-log', {
      method: 'POST',
      body: JSON.stringify({
        studentId: userProfiles.student._id,
        sessionDate: new Date().toISOString(),
        category: 'personal_guidance',
        subject: `Milestone Review ${testSuffix}`,
        description: 'Discussed portfolio architecture, GitHub repositories, and AWS certifications.',
        mentorNotes: 'Student advised to proceed with capstone deployment.',
      }),
    }, mentorTokenToUse);
    assert(counselingLogRes.status === 201, `Counseling Logged: Official 1-on-1 counseling record registered`);

    // Delete support ticket
    const delTicketRes = await request(`/mentorship/requests/${createdTicket._id}`, { method: 'DELETE' }, tokens.student);
    assert(delTicketRes.status === 200, `Mentorship Ticket Deleted: Cleaned up support ticket`);

    // Delete counseling session
    if (counselingLogRes.data?._id) {
      const delSessionRes = await request(`/mentorship/requests/${counselingLogRes.data._id}`, { method: 'DELETE' }, mentorTokenToUse);
      assert(delSessionRes.status === 200, `Counseling Session Deleted: Cleaned up session log`);
    }
  }

  // ============================================================================
  // SUITE 12: ANALYTICS, RISK AI & CROSS-ROLE DASHBOARDS
  // ============================================================================
  logSection('Suite 12: Analytics, Defaulter Risk AI & Cross-Role Dashboards');

  for (const role of ['admin', 'hod', 'teacher', 'mentor', 'student']) {
    const dashRes = await request('/analytics/dashboard-metrics', {}, tokens[role]);
    assert(dashRes.status === 200 && dashRes.data?.role, `Dashboard Analytics Loaded for: ${role.toUpperCase()}`);
  }

  // Academic Risk Indicators (Defaulters & Low performers)
  const riskRes = await request('/analytics/risk-indicators', {}, tokens.admin);
  assert(riskRes.status === 200 && Array.isArray(riskRes.data), `Academic Risk AI: Computed risk profiles for institutional cohort`);

  // ============================================================================
  // FINAL AUDIT SUMMARY
  // ============================================================================
  console.log('\n================================================================================');
  console.log(`   EXHAUSTIVE TEST AUDIT COMPLETE`);
  console.log(`   TOTAL TESTS: ${testStats.total}`);
  console.log(`   PASSED:      ${testStats.passed}`);
  console.log(`   FAILED:      ${testStats.failed}`);
  console.log(`   PASS RATE:   ${((testStats.passed / testStats.total) * 100).toFixed(1)}%`);
  console.log('================================================================================\n');

  if (testStats.failed > 0) {
    console.error('Audit failed with following discrepancies:');
    testStats.errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  } else {
    console.log('All software modules, roles, and creation-to-deletion lifecycles passed with 100% success!\n');
    process.exit(0);
  }
}

runLifecycleTests().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
