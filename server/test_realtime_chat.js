// Real-Time Socket.io Chat, Typing & Online Presence Verification Script
import { io } from 'socket.io-client';

const API_URL = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

const testStats = { total: 0, passed: 0, failed: 0 };

function assert(condition, testName, details = '') {
  testStats.total++;
  if (condition) {
    testStats.passed++;
    console.log(`  [PASS] ${testName}`);
  } else {
    testStats.failed++;
    console.error(`  [FAIL] ${testName} ${details ? '- ' + details : ''}`);
  }
}

async function login(email, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  return { token: data.data.accessToken, user: data.data.user };
}

async function run() {
  console.log('====================================================');
  console.log('   CAMPUS360 REAL-TIME CHAT & PRESENCE VERIFICATION');
  console.log('====================================================\n');

  // 1. Authenticate two users: Student and Mentor
  console.log('1. Authenticating test users...');
  const student = await login('student1@campus360.edu', 'Student@123');
  const mentor = await login('mentor@campus360.edu', 'Teacher@123');

  assert(student.token && student.user?._id, 'Student authenticated successfully');
  assert(mentor.token && mentor.user?._id, 'Mentor authenticated successfully');

  const studentId = student.user._id.toString();
  const mentorId = mentor.user._id.toString();

  // 2. Connect Sockets for both users
  console.log('\n2. Connecting WebSockets for Student and Mentor...');
  const socketStudent = io(SOCKET_URL, { transports: ['websocket'] });
  const socketMentor = io(SOCKET_URL, { transports: ['websocket'] });

  await new Promise((resolve) => {
    let connectedCount = 0;
    const check = () => {
      connectedCount++;
      if (connectedCount === 2) resolve();
    };
    socketStudent.on('connect', check);
    socketMentor.on('connect', check);
  });

  assert(socketStudent.connected, 'Student socket connected to server');
  assert(socketMentor.connected, 'Mentor socket connected to server');

  // 3. Register user IDs
  console.log('\n3. Testing User Presence Registration...');
  socketStudent.emit('register_user', studentId);
  socketMentor.emit('register_user', mentorId);

  // Wait for online_users_update
  const onlineUsers = await new Promise((resolve) => {
    socketStudent.on('online_users_update', (users) => {
      if (users.includes(studentId) && users.includes(mentorId)) {
        resolve(users);
      }
    });
  });

  assert(onlineUsers.includes(studentId) && onlineUsers.includes(mentorId),
    `Both Student (${studentId}) and Mentor (${mentorId}) broadcasted as ONLINE`);

  // Verify REST endpoint /api/communication/online-users
  const onlineRes = await fetch(`${API_URL}/communication/online-users`, {
    headers: { Authorization: `Bearer ${student.token}` },
  });
  const onlineData = await onlineRes.json();
  assert(onlineData.data.includes(studentId) && onlineData.data.includes(mentorId),
    'GET /api/communication/online-users reports active presence accurately');

  // 4. Test Typing Indicator Events
  console.log('\n4. Testing Real-Time Typing Indicators...');
  
  // Student starts typing to mentor
  const typingPromise = new Promise((resolve) => {
    socketMentor.on('user_typing', (data) => {
      resolve(data);
    });
  });

  socketStudent.emit('typing_start', {
    recipientId: mentorId,
    senderName: student.user.name,
  });

  const typingData = await typingPromise;
  assert(typingData.userId === studentId && typingData.senderName === student.user.name,
    `Mentor received live 'user_typing' event from ${typingData.senderName}`);

  // Student stops typing
  const stopTypingPromise = new Promise((resolve) => {
    socketMentor.on('user_stop_typing', (data) => {
      resolve(data);
    });
  });

  socketStudent.emit('typing_stop', { recipientId: mentorId });
  const stopData = await stopTypingPromise;
  assert(stopData.userId === studentId,
    `Mentor received live 'user_stop_typing' event for ${stopData.userId}`);

  // 5. Test Real-Time Message Delivery
  console.log('\n5. Testing Instant Message Dispatch & Receipt...');

  const incomingMessagePromise = new Promise((resolve) => {
    socketMentor.on('receive_message', (msg) => {
      resolve(msg);
    });
  });

  const testContent = `Automated Real-Time Test Message #${Date.now()}`;
  const sendRes = await fetch(`${API_URL}/communication/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${student.token}`,
    },
    body: JSON.stringify({
      recipientId: mentorId,
      content: testContent,
    }),
  });
  const sendData = await sendRes.json();
  assert(sendRes.status === 201 && sendData.data.content === testContent,
    'Message persisted to database via REST endpoint');

  const liveMessage = await incomingMessagePromise;
  assert(liveMessage.content === testContent && liveMessage.sender?._id?.toString() === studentId,
    `Mentor received message instantly via WebSocket without polling: "${liveMessage.content}"`);

  // 6. Test Disconnect Presence Update
  console.log('\n6. Testing Offline Status Transition...');
  const offlinePromise = new Promise((resolve) => {
    socketMentor.on('user_status_change', (change) => {
      if (change.userId === studentId && change.isOnline === false) {
        resolve(change);
      }
    });
  });

  socketStudent.disconnect();
  const offlineData = await offlinePromise;
  assert(offlineData.isOnline === false,
    `Student disconnect broadcasted immediately as offline (isOnline: false)`);

  socketMentor.disconnect();

  console.log('\n====================================================');
  console.log(`   REAL-TIME SUITE: ${testStats.passed}/${testStats.total} Passed (${testStats.failed} Failed)`);
  console.log('====================================================');

  if (testStats.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
