import io from 'socket.io-client';

const API_BASE = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(`Login failed for ${email}: ${data.message}`);
  }
  return { token: data.data.accessToken, user: data.data.user };
}

async function runTests() {
  console.log('\n======================================================');
  console.log('   CAMPUS360 ATTENDANCE SCANNING & PODIUM FLOW TEST');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Authenticate users
    console.log('1. Authenticating Teacher and Student...');
    const teacher = await login('teacher1@campus360.edu', 'Teacher@123');
    const student = await login('student1@campus360.edu', 'Student@123');
    assert(teacher.token && (teacher.user.role === 'teacher' || teacher.user.role === 'hod'), 'Teacher logged in successfully');
    assert(student.token && student.user.role === 'student', 'Student logged in successfully');

    // 2. Fetch scheduled timetable slot for teacher
    console.log('\n2. Retrieving teacher scheduled timetable slots...');
    const ttRes = await fetch(`${API_BASE}/timetable`, {
      headers: { Authorization: `Bearer ${teacher.token}` },
    });
    const ttData = await ttRes.json();
    const mySlots = ttData.data.filter(
      (s) => (s.teacher?._id || s.teacher) === teacher.user._id
    );
    assert(mySlots.length > 0, `Found ${mySlots.length} timetable slot(s) for instructor`);
    const targetSlot = mySlots[0];

    // 3. Connect Teacher Socket
    console.log('\n3. Connecting Teacher Mobile Device Socket...');
    const teacherSocket = io(SOCKET_URL, {
      transports: ['websocket'],
      withCredentials: true,
    });

    await new Promise((resolve) => {
      teacherSocket.on('connect', () => {
        teacherSocket.emit('register_user', teacher.user._id);
        resolve();
      });
    });
    assert(teacherSocket.connected, 'Teacher phone connected via WebSocket and registered');

    // 4. Teacher clicks "Launch Attendance"
    console.log('\n4. Teacher launches attendance (creates pending session with 6-char code)...');
    const launchRes = await fetch(`${API_BASE}/attendance/session/activate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacher.token}`,
      },
      body: JSON.stringify({ timetableId: targetSlot._id }),
    });
    const launchData = await launchRes.json();
    assert(launchData.success === true, 'Attendance session created successfully');
    const session = launchData.data;
    assert(session.sessionCode && session.sessionCode.length === 6, `Generated 6-character code: ${session.sessionCode}`);
    assert(session.status === 'pending', 'Session created in PENDING state awaiting podium code entry');
    assert(session.activatedAt === null, 'Clocks have NOT started yet (activatedAt is null)');

    // Set up teacher socket listeners
    let liveEventReceived = null;
    let studentScannedEventReceived = null;
    let sessionEndedEventReceived = null;

    teacherSocket.on('attendance_session_live', (data) => {
      liveEventReceived = data;
    });
    teacherSocket.on('attendance_student_scanned', (data) => {
      studentScannedEventReceived = data;
    });
    teacherSocket.on('attendance_session_ended', (data) => {
      sessionEndedEventReceived = data;
    });

    // 5. Podium inputs that code -> Clocks start ticking & phone receives LIVE status!
    console.log('\n5. Podium inputs session code -> clocks start ticking & live event emitted...');
    const podiumSocket = io(SOCKET_URL, {
      transports: ['websocket'],
      withCredentials: true,
    });
    await new Promise((resolve) => podiumSocket.on('connect', resolve));
    podiumSocket.emit('join_attendance_session', session.sessionCode);

    let podiumSessionEndedEvent = null;
    podiumSocket.on('attendance_session_ended', (data) => {
      podiumSessionEndedEvent = data;
    });

    // Podium submits code to link session
    const kioskRes = await fetch(`${API_BASE}/attendance/kiosk/session/${session.sessionCode}`);
    const kioskData = await kioskRes.json();
    assert(kioskData.success === true, 'Podium linked session code successfully');
    assert(kioskData.data.session.status === 'active', 'Session transitioned to ACTIVE on podium input');
    assert(kioskData.data.remainingSeconds > 0 && kioskData.data.remainingSeconds <= 600, `Clock started ticking: ${kioskData.data.remainingSeconds}s remaining`);

    // Give socket 500ms to arrive
    await new Promise((r) => setTimeout(r, 600));
    assert(liveEventReceived !== null, 'Teacher mobile phone received real-time attendance_session_live event');
    assert(liveEventReceived?.activatedOn === 'podium', 'Event confirms activation source was podium');

    // 6. Student generates dynamic QR and scans at podium
    console.log('\n6. Student generates QR & scans at podium...');
    const qrRes = await fetch(`${API_BASE}/attendance/student/qr-token`, {
      headers: { Authorization: `Bearer ${student.token}` },
    });
    const qrData = await qrRes.json();
    assert(qrData.success === true && qrData.data.token, 'Student generated dynamic single-use QR token');

    const scanRes = await fetch(`${API_BASE}/attendance/kiosk/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionCode: session.sessionCode,
        qrToken: qrData.data.token,
      }),
    });
    const scanResult = await scanRes.json();
    assert(scanResult.success === true, `Scan accepted at podium: ${scanResult.data?.student?.name}`);
    assert(scanResult.data?.totalScanned === 1, 'Total scanned incremented to 1');

    await new Promise((r) => setTimeout(r, 600));
    assert(studentScannedEventReceived !== null, 'Teacher mobile phone received real-time attendance_student_scanned event');
    assert(studentScannedEventReceived?.student?.name === student.user.name, `Scanned student correctly identified as ${student.user.name}`);

    // 7. Teacher ends session before time from their phone only
    console.log('\n7. Teacher ends session before time from mobile device...');
    const endRes = await fetch(`${API_BASE}/attendance/session/${session._id}/end`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacher.token}` },
    });
    const endData = await endRes.json();
    assert(endData.success === true, 'Session successfully ended from teacher phone');
    assert(endData.data?.session?.status === 'finalized', 'Session status finalized');
    assert(endData.data?.session?.endedByTeacher === true, 'Record flagged as endedByTeacher');

    await new Promise((r) => setTimeout(r, 600));
    assert(podiumSessionEndedEvent !== null, 'Classroom Podium received real-time attendance_session_ended event');
    assert(podiumSessionEndedEvent?.endedByTeacher === true, 'Podium event confirms instructor ended session early');

    // 8. Subsequent scans at podium must be blocked
    console.log('\n8. Verifying closed session blocks further scans...');
    const afterEndKioskRes = await fetch(`${API_BASE}/attendance/kiosk/session/${session.sessionCode}`);
    const afterEndKioskData = await afterEndKioskRes.json();
    assert(afterEndKioskRes.status === 400 && afterEndKioskData.message.includes('finalized'), 'Podium correctly refuses closed/finalized session');

    // 9. Cancellation test
    console.log('\n9. Testing session cancellation before podium entry...');
    const newSessionRes = await fetch(`${API_BASE}/attendance/session/activate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacher.token}`,
      },
      body: JSON.stringify({ timetableId: targetSlot._id }),
    });
    const newSessionData = await newSessionRes.json();
    assert(newSessionData.data?.status === 'pending', 'New session launched in pending state');

    const cancelRes = await fetch(`${API_BASE}/attendance/session/${newSessionData.data._id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacher.token}` },
    });
    const cancelData = await cancelRes.json();
    assert(cancelData.success === true, 'Teacher cancelled pending session successfully');

    const checkCancelRes = await fetch(`${API_BASE}/attendance/kiosk/session/${newSessionData.data.sessionCode}`);
    const checkCancelData = await checkCancelRes.json();
    assert(checkCancelRes.status === 400 && checkCancelData.message.includes('cancelled'), 'Podium rejects cancelled session code');

    teacherSocket.disconnect();
    podiumSocket.disconnect();

    console.log('\n======================================================');
    console.log(`   ATTENDANCE SCANNING FLOW: ${passed}/${passed + failed} Passed (${failed} Failed)`);
    console.log('======================================================\n');

    process.exit(failed === 0 ? 0 : 1);
  } catch (err) {
    console.error('Test suite failed with unexpected error:', err);
    process.exit(1);
  }
}

runTests();
