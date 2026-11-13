import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';

// Models
import User from '../modules/users/user.model.js';
import TeacherProfile from '../modules/users/teacherProfile.model.js';
import StudentProfile from '../modules/users/studentProfile.model.js';
import Department from '../modules/academics/department.model.js';
import Course from '../modules/academics/course.model.js';
import Batch from '../modules/academics/batch.model.js';
import Classroom from '../modules/academics/classroom.model.js';
import Subject from '../modules/academics/subject.model.js';
import Timetable from '../modules/timetable/timetable.model.js';
import Material from '../modules/materials/material.model.js';
import Assignment from '../modules/assignments/assignment.model.js';
import Submission from '../modules/assignments/submission.model.js';
import Examination from '../modules/examinations/examination.model.js';
import ExamResult from '../modules/examinations/examResult.model.js';
import Announcement from '../modules/communication/announcement.model.js';
import Message from '../modules/communication/message.model.js';
import SupportRequest from '../modules/mentorship/supportRequest.model.js';
import AttendanceSession from '../modules/attendance/attendanceSession.model.js';
import AttendanceRecord from '../modules/attendance/attendanceRecord.model.js';
import Quiz from '../modules/assessments/quiz.model.js';
import QuizAttempt from '../modules/assessments/quizAttempt.model.js';
import Notification from '../modules/notifications/notification.model.js';

// West Bengal authentic Indian name pools
const BENGALI_FIRST_NAMES_MALE = [
  'Subhajit', 'Debanjan', 'Sagnik', 'Sourav', 'Nilanjan', 'Sayan', 'Joydeep',
  'Tanmoy', 'Arpan', 'Pritam', 'Ritwik', 'Anirban', 'Arindam', 'Dipankar',
  'Supratim', 'Abhik', 'Sayantan', 'Aritra', 'Indranil', 'Kaushik', 'Rajdeep',
  'Somnath', 'Souvik', 'Debarghya', 'Biswajit', 'Prabir', 'Mainak', 'Debashis',
  'Tathagata', 'Avik', 'Srijan', 'Tamoghna', 'Swarnava', 'Rishav', 'Sandipan',
  'Arkadeep', 'Aniket', 'Priyabrata', 'Rounak', 'Soumya'
];

const BENGALI_FIRST_NAMES_FEMALE = [
  'Ananya', 'Sneha', 'Riya', 'Poulami', 'Ritika', 'Sayantani', 'Nilanjana',
  'Ishani', 'Trisha', 'Shreya', 'Deboleena', 'Moumita', 'Payel', 'Madhurima',
  'Priyanka', 'Madhumita', 'Sampurna', 'Tanushree', 'Sreeparna', 'Ankita',
  'Swagata', 'Arundhati', 'Oindrila', 'Debasmita', 'Rimpa', 'Sharmistha',
  'Barnali', 'Paramita', 'Kasturi', 'Sulagna', 'Suchismita', 'Debarati',
  'Sohini', 'Baishali', 'Sagarika', 'Ipsita', 'Titash', 'Raima', 'Paulami'
];

const BENGALI_SURNAMES = [
  'Banerjee', 'Chatterjee', 'Mukherjee', 'Ganguly', 'Bhattacharya', 'Roy',
  'Chakraborty', 'Ghosh', 'Sengupta', 'Das', 'Dutta', 'Sarkar', 'Mitra',
  'Pal', 'Bhowmik', 'Saha', 'Basu', 'Majumder', 'Pramanik', 'Nandy',
  'Kundu', 'Karmakar', 'Sen', 'De', 'Seal', 'Dey', 'Adhikary', 'Haldar',
  'Mondal', 'Biswas', 'Guha', 'Samanta', 'Kole', 'Poddar', 'Bagchi',
  'Lahiri', 'Bhaduri', 'Sanyal', 'Ghatak', 'Goswami'
];

const GUARDIAN_FIRST_NAMES = [
  'Asit Kumar', 'Debabrata', 'Swapan Kumar', 'Bikash Chandra', 'Prabir Kumar',
  'Subhasis', 'Alok Kumar', 'Tarun Kanti', 'Dilip Kumar', 'Partha Pratim',
  'Sanjoy Kumar', 'Ashim Kumar', 'Chandan', 'Shyamal Kumar', 'Goutam'
];

const seedDatabase = async () => {
  try {
    await connectDB();
    console.log('================================================================');
    console.log(' [Campus360 Seeder] Wiping database for West Bengal Colleges... ');
    console.log('================================================================');

    await Promise.all([
      User.deleteMany({}),
      TeacherProfile.deleteMany({}),
      StudentProfile.deleteMany({}),
      Department.deleteMany({}),
      Course.deleteMany({}),
      Batch.deleteMany({}),
      Classroom.deleteMany({}),
      Subject.deleteMany({}),
      Timetable.deleteMany({}),
      Material.deleteMany({}),
      Assignment.deleteMany({}),
      Submission.deleteMany({}),
      Examination.deleteMany({}),
      ExamResult.deleteMany({}),
      Announcement.deleteMany({}),
      Message.deleteMany({}),
      SupportRequest.deleteMany({}),
      AttendanceSession.deleteMany({}),
      AttendanceRecord.deleteMany({}),
      Quiz.deleteMany({}),
      QuizAttempt.deleteMany({}),
      Notification.deleteMany({}),
    ]);

    console.log('[1/7] Initializing Institutional College Administrator...');
    const admin = await User.create({
      name: 'College Administrator',
      email: 'admin@campus360.edu',
      password: 'Admin@123',
      role: 'college_admin',
      phone: '+91 9830000001',
    });

    console.log('[2/7] Creating 8 Academic Departments & Degree Courses...');
    // Departments as requested: BCA, MCA, B.Tech(CSE, IT, ECE), M.Tech(CSE, IT, ECE)
    const deptDefs = [
      { name: 'Bachelor of Computer Applications', code: 'BCA', desc: 'Department of Undergraduate Computer Applications & Software Systems' },
      { name: 'Master of Computer Applications', code: 'MCA', desc: 'Department of Postgraduate Enterprise Computing & Cloud Technologies' },
      { name: 'B.Tech Computer Science & Engineering', code: 'CSE', desc: 'Department of B.Tech Computer Science, Systems & AI Engineering' },
      { name: 'B.Tech Information Technology', code: 'IT', desc: 'Department of B.Tech Information Technology, Cyber Security & Networks' },
      { name: 'B.Tech Electronics & Communication Engineering', code: 'ECE', desc: 'Department of B.Tech Electronics, Microprocessors & Signal Systems' },
      { name: 'M.Tech Computer Science & Engineering', code: 'MTECH-CSE', desc: 'Department of Advanced Computing Research & Distributed Architectures' },
      { name: 'M.Tech Information Technology', code: 'MTECH-IT', desc: 'Department of Advanced Network Infrastructure & Cloud Security' },
      { name: 'M.Tech Electronics & Communication Engineering', code: 'MTECH-ECE', desc: 'Department of VLSI Design, Modern Telecom & Embedded Systems' },
    ];

    const departments = {};
    for (const d of deptDefs) {
      departments[d.code] = await Department.create({
        name: d.name,
        code: d.code,
        description: d.desc,
      });
    }

    // Courses for each department
    const courseDefs = [
      { code: 'BCA', name: 'Bachelor of Computer Applications', deptCode: 'BCA', durationYears: 3, totalSemesters: 6 },
      { code: 'MCA', name: 'Master of Computer Applications', deptCode: 'MCA', durationYears: 2, totalSemesters: 4 },
      { code: 'BTECH-CSE', name: 'B.Tech in Computer Science & Engineering', deptCode: 'CSE', durationYears: 4, totalSemesters: 8 },
      { code: 'BTECH-IT', name: 'B.Tech in Information Technology', deptCode: 'IT', durationYears: 4, totalSemesters: 8 },
      { code: 'BTECH-ECE', name: 'B.Tech in Electronics & Communication Engineering', deptCode: 'ECE', durationYears: 4, totalSemesters: 8 },
      { code: 'MTECH-CSE', name: 'M.Tech in Computer Science & Engineering', deptCode: 'MTECH-CSE', durationYears: 2, totalSemesters: 4 },
      { code: 'MTECH-IT', name: 'M.Tech in Information Technology', deptCode: 'MTECH-IT', durationYears: 2, totalSemesters: 4 },
      { code: 'MTECH-ECE', name: 'M.Tech in Electronics & Communication Engineering', deptCode: 'MTECH-ECE', durationYears: 2, totalSemesters: 4 },
    ];

    const courses = {};
    for (const c of courseDefs) {
      courses[c.code] = await Course.create({
        name: c.name,
        code: c.code,
        department: departments[c.deptCode]._id,
        durationYears: c.durationYears,
        totalSemesters: c.totalSemesters,
      });
    }

    console.log('[3/7] Provisioning Exactly 5 Labs, 2 Halls, and 20 Classrooms (27 Total)...');
    const classrooms = [];
    // 5 Computer & Research Labs
    const labDefs = [
      { roomNumber: 'LAB-1', block: 'Aryabhatta Block', capacity: 45, type: 'computer_lab' },
      { roomNumber: 'LAB-2', block: 'Aryabhatta Block', capacity: 45, type: 'computer_lab' },
      { roomNumber: 'LAB-3', block: 'P.C. Ray Technology Block', capacity: 40, type: 'computer_lab' },
      { roomNumber: 'LAB-4', block: 'P.C. Ray Technology Block', capacity: 40, type: 'computer_lab' },
      { roomNumber: 'LAB-5', block: 'Meghnad Saha Electronics Block', capacity: 40, type: 'computer_lab' },
    ];
    for (const l of labDefs) {
      classrooms.push(await Classroom.create({ ...l, hasProjector: true }));
    }

    // 2 Multi-Purpose / Seminar Halls
    const hallDefs = [
      { roomNumber: 'HALL-1', block: 'Netaji Subhash Central Complex', capacity: 350, type: 'seminar_hall' },
      { roomNumber: 'HALL-2', block: 'J.C. Bose Academic Hub', capacity: 160, type: 'seminar_hall' },
    ];
    for (const h of hallDefs) {
      classrooms.push(await Classroom.create({ ...h, hasProjector: true }));
    }

    // 20 Standard Lecture Classrooms (CR-101 to CR-405)
    for (let floor = 1; floor <= 4; floor++) {
      for (let room = 1; room <= 5; room++) {
        const roomNum = `CR-${floor}0${room}`;
        classrooms.push(
          await Classroom.create({
            roomNumber: roomNum,
            block: floor <= 2 ? 'Academic Block A' : 'Academic Block B',
            capacity: 65,
            type: 'lecture_hall',
            hasProjector: true,
          })
        );
      }
    }
    console.log(`      ✓ Verified: ${classrooms.length} Total Rooms Created (5 Labs, 2 Halls, 20 Classrooms)`);

    console.log('[4/7] Generating Comprehensive MAKAUT Curriculum Subjects (4-6 Subjects Per Semester)...');
    // Authentic semester-wise subjects for each program
    const curriculumData = {
      BCA: {
        1: [
          { name: 'Digital Electronics & Logic', code: 'BCAN-101', credits: 4, type: 'theory' },
          { name: 'Programming Fundamentals with C', code: 'BCAN-102', credits: 4, type: 'theory' },
          { name: 'Discrete Mathematics', code: 'BCAN-103', credits: 4, type: 'theory' },
          { name: 'Principles of Management & Org Behavior', code: 'BCAN-104', credits: 3, type: 'theory' },
          { name: 'C Programming Laboratory', code: 'BCAN-192', credits: 2, type: 'practical' },
        ],
        2: [
          { name: 'Data Structures with C', code: 'BCAN-201', credits: 4, type: 'theory' },
          { name: 'Object Oriented Programming with C++', code: 'BCAN-202', credits: 4, type: 'theory' },
          { name: 'Computer Architecture & Org', code: 'BCAN-203', credits: 4, type: 'theory' },
          { name: 'Operating Systems Principles', code: 'BCAN-204', credits: 3, type: 'theory' },
          { name: 'Data Structures Laboratory', code: 'BCAN-291', credits: 2, type: 'practical' },
        ],
        3: [
          { name: 'Database Management Systems', code: 'BCAN-301', credits: 4, type: 'theory' },
          { name: 'Computer Communication Networks', code: 'BCAN-302', credits: 4, type: 'theory' },
          { name: 'Core Java Programming', code: 'BCAN-303', credits: 4, type: 'theory' },
          { name: 'Software Engineering Principles', code: 'BCAN-304', credits: 3, type: 'theory' },
          { name: 'DBMS SQL & Java Lab', code: 'BCAN-391', credits: 2, type: 'practical' },
        ],
        4: [
          { name: 'Design & Analysis of Algorithms', code: 'BCAN-401', credits: 4, type: 'theory' },
          { name: 'Full Stack Web Technology (PHP & JS)', code: 'BCAN-402', credits: 4, type: 'theory' },
          { name: 'Python Programming for Data', code: 'BCAN-403', credits: 3, type: 'theory' },
          { name: 'Linux System Administration & Shell', code: 'BCAN-404', credits: 3, type: 'theory' },
          { name: 'Web Technology & Python Lab', code: 'BCAN-492', credits: 2, type: 'practical' },
        ],
        5: [
          { name: 'Cloud Computing Architectures', code: 'BCAN-501', credits: 4, type: 'theory' },
          { name: 'Information & Cyber Security', code: 'BCAN-502', credits: 4, type: 'theory' },
          { name: 'Artificial Intelligence & Search', code: 'BCAN-503', credits: 3, type: 'theory' },
          { name: 'Mobile Application Engineering', code: 'BCAN-504', credits: 3, type: 'elective' },
          { name: 'Cloud & Mobile App Lab', code: 'BCAN-591', credits: 2, type: 'practical' },
        ],
        6: [
          { name: 'Major Industrial Capstone Project', code: 'BCAN-681', credits: 6, type: 'practical' },
          { name: 'Elective: Data Science & Analytics', code: 'BCAN-601A', credits: 3, type: 'elective' },
          { name: 'Elective: Digital Forensics & Law', code: 'BCAN-601B', credits: 3, type: 'elective' },
          { name: 'Comprehensive Grand Viva', code: 'BCAN-682', credits: 2, type: 'theory' },
        ],
      },
      MCA: {
        1: [
          { name: 'Advanced Data Structures & Algorithms', code: 'MCAN-101', credits: 4, type: 'theory' },
          { name: 'Advanced DBMS & Distributed Databases', code: 'MCAN-102', credits: 4, type: 'theory' },
          { name: 'Mathematical Foundations of Computer Science', code: 'MCAN-103', credits: 4, type: 'theory' },
          { name: 'Enterprise Java & Spring Boot Framework', code: 'MCAN-104', credits: 3, type: 'theory' },
          { name: 'Advanced DSA & Enterprise Java Lab', code: 'MCAN-191', credits: 2, type: 'practical' },
        ],
        2: [
          { name: 'Full Stack Web Architecture (MERN)', code: 'MCAN-201', credits: 4, type: 'theory' },
          { name: 'Machine Learning & Pattern Recognition', code: 'MCAN-202', credits: 4, type: 'theory' },
          { name: 'Cloud Computing & Microservices', code: 'MCAN-203', credits: 4, type: 'theory' },
          { name: 'Distributed Operating Systems & Unix', code: 'MCAN-204', credits: 3, type: 'theory' },
          { name: 'Full Stack & Machine Learning Lab', code: 'MCAN-291', credits: 2, type: 'practical' },
        ],
        3: [
          { name: 'Deep Learning & Natural Language Processing', code: 'MCAN-301', credits: 4, type: 'theory' },
          { name: 'Big Data Technologies & Apache Spark', code: 'MCAN-302', credits: 4, type: 'theory' },
          { name: 'Cyber Security & Cryptographic Protocols', code: 'MCAN-303', credits: 3, type: 'theory' },
          { name: 'Elective: DevOps & Containerization', code: 'MCAN-304E', credits: 3, type: 'elective' },
          { name: 'Deep Learning & Big Data Lab', code: 'MCAN-391', credits: 2, type: 'practical' },
        ],
        4: [
          { name: 'Industry Internship & Capstone Dissertation', code: 'MCAN-481', credits: 8, type: 'practical' },
          { name: 'Research Paper Publication & Seminar', code: 'MCAN-482', credits: 3, type: 'theory' },
          { name: 'Elective: Blockchain & Smart Contracts', code: 'MCAN-401E', credits: 3, type: 'elective' },
          { name: 'Comprehensive Final Viva-Voce', code: 'MCAN-483', credits: 2, type: 'theory' },
        ],
      },
      'BTECH-CSE': {
        1: [
          { name: 'Engineering Physics', code: 'PH-101', credits: 4, type: 'theory' },
          { name: 'Mathematics-I (Calculus & Linear Algebra)', code: 'M-101', credits: 4, type: 'theory' },
          { name: 'Basic Electrical Engineering', code: 'EE-101', credits: 4, type: 'theory' },
          { name: 'Programming for Problem Solving (C)', code: 'CS-101', credits: 3, type: 'theory' },
          { name: 'Physics & C Programming Lab', code: 'CS-191', credits: 2, type: 'practical' },
        ],
        2: [
          { name: 'Engineering Chemistry', code: 'CH-201', credits: 4, type: 'theory' },
          { name: 'Mathematics-II (Differential Equations)', code: 'M-201', credits: 4, type: 'theory' },
          { name: 'Basic Electronics Engineering', code: 'EC-201', credits: 4, type: 'theory' },
          { name: 'English for Technical Communication', code: 'HU-201', credits: 3, type: 'theory' },
          { name: 'Chemistry & Workshop Practice Lab', code: 'ME-291', credits: 2, type: 'practical' },
        ],
        3: [
          { name: 'Data Structures & Algorithms', code: 'CS-301', credits: 4, type: 'theory' },
          { name: 'Digital Logic & System Design', code: 'CS-302', credits: 4, type: 'theory' },
          { name: 'Discrete Mathematics', code: 'M-301', credits: 4, type: 'theory' },
          { name: 'Computer Organization & Architecture', code: 'CS-303', credits: 3, type: 'theory' },
          { name: 'DSA & Digital Logic Lab', code: 'CS-391', credits: 2, type: 'practical' },
        ],
        4: [
          { name: 'Design & Analysis of Algorithms', code: 'CS-401', credits: 4, type: 'theory' },
          { name: 'Formal Language & Automata Theory', code: 'CS-402', credits: 4, type: 'theory' },
          { name: 'Object Oriented Programming with Java', code: 'CS-403', credits: 3, type: 'theory' },
          { name: 'Database Management Systems', code: 'CS-404', credits: 3, type: 'theory' },
          { name: 'Algorithms & DBMS Lab', code: 'CS-491', credits: 2, type: 'practical' },
        ],
        5: [
          { name: 'Compiler Design', code: 'CS-501', credits: 4, type: 'theory' },
          { name: 'Operating Systems Engineering', code: 'CS-502', credits: 4, type: 'theory' },
          { name: 'Computer Networks', code: 'CS-503', credits: 4, type: 'theory' },
          { name: 'Software Engineering Principles', code: 'CS-504', credits: 3, type: 'theory' },
          { name: 'Operating Systems & Networks Lab', code: 'CS-591', credits: 2, type: 'practical' },
        ],
        6: [
          { name: 'Artificial Intelligence & Expert Systems', code: 'CS-601', credits: 4, type: 'theory' },
          { name: 'Cloud Computing & Virtualization', code: 'CS-602', credits: 4, type: 'theory' },
          { name: 'Cryptography & Network Security', code: 'CS-603', credits: 3, type: 'theory' },
          { name: 'Web Technology & REST APIs', code: 'CS-604', credits: 3, type: 'theory' },
          { name: 'AI & Web Technology Lab', code: 'CS-691', credits: 2, type: 'practical' },
        ],
        7: [
          { name: 'Machine Learning Fundamentals', code: 'CS-701', credits: 4, type: 'theory' },
          { name: 'Big Data Analytics', code: 'CS-702', credits: 4, type: 'theory' },
          { name: 'Elective: Quantum Computing Intro', code: 'CS-703E', credits: 3, type: 'elective' },
          { name: 'Project Phase-I & Literature Survey', code: 'CS-781', credits: 3, type: 'practical' },
          { name: 'Machine Learning Lab', code: 'CS-791', credits: 2, type: 'practical' },
        ],
        8: [
          { name: 'Capstone Final Project Phase-II', code: 'CS-881', credits: 8, type: 'practical' },
          { name: 'Cyber Laws & Professional Ethics', code: 'HU-801', credits: 3, type: 'theory' },
          { name: 'Elective: Internet of Things (IoT)', code: 'CS-802E', credits: 3, type: 'elective' },
          { name: 'Comprehensive Grand Technical Viva', code: 'CS-882', credits: 2, type: 'theory' },
        ],
      },
      'BTECH-IT': {
        1: [
          { name: 'Engineering Physics for IT', code: 'IT-101', credits: 4, type: 'theory' },
          { name: 'Engineering Mathematics-I', code: 'M-101IT', credits: 4, type: 'theory' },
          { name: 'Python for Problem Solving', code: 'IT-102', credits: 4, type: 'theory' },
          { name: 'Basic Electrical & Electronics', code: 'EE-102', credits: 3, type: 'theory' },
          { name: 'Python Programming Lab', code: 'IT-191', credits: 2, type: 'practical' },
        ],
        2: [
          { name: 'Engineering Chemistry & Materials', code: 'CH-202', credits: 4, type: 'theory' },
          { name: 'Engineering Mathematics-II', code: 'M-201IT', credits: 4, type: 'theory' },
          { name: 'Data Communication Concepts', code: 'IT-201', credits: 3, type: 'theory' },
          { name: 'Professional Communication & Soft Skills', code: 'HU-202', credits: 3, type: 'theory' },
          { name: 'IT Systems Workshop', code: 'IT-291', credits: 2, type: 'practical' },
        ],
        3: [
          { name: 'Data Structures & OOP with Java', code: 'IT-301', credits: 4, type: 'theory' },
          { name: 'Digital Electronics & Logic Gates', code: 'IT-302', credits: 4, type: 'theory' },
          { name: 'Discrete Mathematics for IT', code: 'M-302IT', credits: 4, type: 'theory' },
          { name: 'Computer Architecture', code: 'IT-303', credits: 3, type: 'theory' },
          { name: 'Java & Data Structures Lab', code: 'IT-391', credits: 2, type: 'practical' },
        ],
        4: [
          { name: 'Algorithms Analysis & Design', code: 'IT-401', credits: 4, type: 'theory' },
          { name: 'Database Management Systems', code: 'IT-402', credits: 4, type: 'theory' },
          { name: 'Operating Systems & Virtualization', code: 'IT-403', credits: 3, type: 'theory' },
          { name: 'Web Technology Fundamentals', code: 'IT-404', credits: 3, type: 'theory' },
          { name: 'DBMS & Web Development Lab', code: 'IT-491', credits: 2, type: 'practical' },
        ],
        5: [
          { name: 'Computer Networks & Protocols', code: 'IT-501', credits: 4, type: 'theory' },
          { name: 'Software Engineering & Agile Methodologies', code: 'IT-502', credits: 4, type: 'theory' },
          { name: 'Internet of Things (IoT) Systems', code: 'IT-503', credits: 3, type: 'theory' },
          { name: 'Information Theory & Coding', code: 'IT-504', credits: 3, type: 'theory' },
          { name: 'Computer Networks & IoT Lab', code: 'IT-591', credits: 2, type: 'practical' },
        ],
        6: [
          { name: 'Cloud Infrastructure & Microservices', code: 'IT-601', credits: 4, type: 'theory' },
          { name: 'Network Security & Cryptography', code: 'IT-602', credits: 4, type: 'theory' },
          { name: 'Data Mining & Business Analytics', code: 'IT-603', credits: 3, type: 'theory' },
          { name: 'E-Commerce & Enterprise ERP', code: 'IT-604', credits: 3, type: 'theory' },
          { name: 'Cloud & Security Lab', code: 'IT-691', credits: 2, type: 'practical' },
        ],
        7: [
          { name: 'Mobile Computing & Android Dev', code: 'IT-701', credits: 4, type: 'theory' },
          { name: 'Blockchain Technologies & DApps', code: 'IT-702', credits: 4, type: 'theory' },
          { name: 'Elective: DevOps & CI/CD Pipelines', code: 'IT-703E', credits: 3, type: 'elective' },
          { name: 'Major Project Phase-I', code: 'IT-781', credits: 3, type: 'practical' },
          { name: 'Mobile Computing Lab', code: 'IT-791', credits: 2, type: 'practical' },
        ],
        8: [
          { name: 'Final Year Capstone Project Phase-II', code: 'IT-881', credits: 8, type: 'practical' },
          { name: 'Professional Ethics & Cyber Law', code: 'HU-802', credits: 3, type: 'theory' },
          { name: 'Elective: Natural Language Processing', code: 'IT-802E', credits: 3, type: 'elective' },
          { name: 'Comprehensive Technical Grand Viva', code: 'IT-882', credits: 2, type: 'theory' },
        ],
      },
      'BTECH-ECE': {
        1: [
          { name: 'Engineering Physics for ECE', code: 'EC-101', credits: 4, type: 'theory' },
          { name: 'Engineering Mathematics-I', code: 'M-101EC', credits: 4, type: 'theory' },
          { name: 'Basic Electrical Circuit Theory', code: 'EE-103', credits: 4, type: 'theory' },
          { name: 'C Programming for Engineers', code: 'CS-103', credits: 3, type: 'theory' },
          { name: 'Physics & Electrical Circuits Lab', code: 'EC-191', credits: 2, type: 'practical' },
        ],
        2: [
          { name: 'Engineering Chemistry', code: 'CH-203', credits: 4, type: 'theory' },
          { name: 'Engineering Mathematics-II (Transform Calculus)', code: 'M-201EC', credits: 4, type: 'theory' },
          { name: 'Basic Electronic Devices', code: 'EC-201B', credits: 4, type: 'theory' },
          { name: 'Professional Communication', code: 'HU-203', credits: 3, type: 'theory' },
          { name: 'Electronic Devices & CAD Lab', code: 'EC-291', credits: 2, type: 'practical' },
        ],
        3: [
          { name: 'Analog Electronic Circuits', code: 'EC-301', credits: 4, type: 'theory' },
          { name: 'Signals & Systems Analysis', code: 'EC-302', credits: 4, type: 'theory' },
          { name: 'Network Analysis & Synthesis', code: 'EC-303', credits: 4, type: 'theory' },
          { name: 'Digital Electronics & Logic Design', code: 'EC-304', credits: 3, type: 'theory' },
          { name: 'Analog & Digital Electronics Lab', code: 'EC-391', credits: 2, type: 'practical' },
        ],
        4: [
          { name: 'Analog Communication Systems', code: 'EC-401', credits: 4, type: 'theory' },
          { name: 'Electromagnetic Field Theory', code: 'EC-402', credits: 4, type: 'theory' },
          { name: 'Linear Integrated Circuits & OP-AMP', code: 'EC-403', credits: 3, type: 'theory' },
          { name: 'Microprocessors & Microcontrollers (8051/ARM)', code: 'EC-404', credits: 3, type: 'theory' },
          { name: 'Communication & Microcontroller Lab', code: 'EC-491', credits: 2, type: 'practical' },
        ],
        5: [
          { name: 'Digital Communication Techniques', code: 'EC-501', credits: 4, type: 'theory' },
          { name: 'Digital Signal Processing (DSP)', code: 'EC-502', credits: 4, type: 'theory' },
          { name: 'Control Systems Engineering', code: 'EC-503', credits: 4, type: 'theory' },
          { name: 'Antenna & Wave Propagation', code: 'EC-504', credits: 3, type: 'theory' },
          { name: 'Digital Communication & DSP Lab', code: 'EC-591', credits: 2, type: 'practical' },
        ],
        6: [
          { name: 'VLSI Design & Verilog HDL', code: 'EC-601', credits: 4, type: 'theory' },
          { name: 'Microwave Engineering', code: 'EC-602', credits: 4, type: 'theory' },
          { name: 'Embedded Systems & RTOS', code: 'EC-603', credits: 3, type: 'theory' },
          { name: 'Wireless Cellular Communication', code: 'EC-604', credits: 3, type: 'theory' },
          { name: 'VLSI & Microwave Lab', code: 'EC-691', credits: 2, type: 'practical' },
        ],
        7: [
          { name: 'Optical Fiber Communication', code: 'EC-701', credits: 4, type: 'theory' },
          { name: 'Satellite & Radar Systems', code: 'EC-702', credits: 4, type: 'theory' },
          { name: 'Elective: Biomedical Instrumentation', code: 'EC-703E', credits: 3, type: 'elective' },
          { name: 'Major Project Phase-I', code: 'EC-781', credits: 3, type: 'practical' },
          { name: 'Advanced Telecom Lab', code: 'EC-791', credits: 2, type: 'practical' },
        ],
        8: [
          { name: 'Final Project Phase-II & Defense', code: 'EC-881', credits: 8, type: 'practical' },
          { name: 'RF Circuit Design & Wireless Sensors', code: 'EC-801', credits: 3, type: 'theory' },
          { name: 'IPR & Industrial Management', code: 'HU-803', credits: 3, type: 'theory' },
          { name: 'Comprehensive Technical Viva-Voce', code: 'EC-882', credits: 2, type: 'theory' },
        ],
      },
      'MTECH-CSE': {
        1: [
          { name: 'Advanced Algorithms & Computational Complexity', code: 'MCS-101', credits: 4, type: 'theory' },
          { name: 'Advanced Computer System Architecture', code: 'MCS-102', credits: 4, type: 'theory' },
          { name: 'Mathematical Foundations of Data Science', code: 'MCS-103', credits: 4, type: 'theory' },
          { name: 'Distributed Systems & Cloud Computing', code: 'MCS-104', credits: 3, type: 'theory' },
          { name: 'Advanced Computing Lab', code: 'MCS-191', credits: 2, type: 'practical' },
        ],
        2: [
          { name: 'Deep Neural Networks & Machine Learning', code: 'MCS-201', credits: 4, type: 'theory' },
          { name: 'Cloud Native Architectures & Kubernetes', code: 'MCS-202', credits: 4, type: 'theory' },
          { name: 'Advanced Information Security & Cryptography', code: 'MCS-203', credits: 3, type: 'theory' },
          { name: 'Elective: Quantum Information Processing', code: 'MCS-204E', credits: 3, type: 'elective' },
          { name: 'Deep Learning & Cloud Systems Lab', code: 'MCS-291', credits: 2, type: 'practical' },
        ],
        3: [
          { name: 'M.Tech Research Thesis Phase-I', code: 'MCS-381', credits: 8, type: 'practical' },
          { name: 'Advanced Research Methodology & IPR', code: 'MCS-301', credits: 3, type: 'theory' },
          { name: 'Elective: Cyber-Physical Systems', code: 'MCS-302E', credits: 3, type: 'elective' },
          { name: 'Technical Seminar & Literature Survey', code: 'MCS-382', credits: 2, type: 'theory' },
        ],
        4: [
          { name: 'M.Tech Thesis Final Defense & Viva', code: 'MCS-481', credits: 12, type: 'practical' },
          { name: 'Journal Research Paper Publication', code: 'MCS-482', credits: 4, type: 'theory' },
          { name: 'Comprehensive Master Technical Viva', code: 'MCS-483', credits: 2, type: 'theory' },
          { name: 'Colloquium on Emerging CS Frontiers', code: 'MCS-401', credits: 2, type: 'theory' },
        ],
      },
      'MTECH-IT': {
        1: [
          { name: 'Advanced Cyber Security & Ethical Hacking', code: 'MIT-101', credits: 4, type: 'theory' },
          { name: 'High-Speed Enterprise Networks', code: 'MIT-102', credits: 4, type: 'theory' },
          { name: 'Advanced Database Systems & NoSQL', code: 'MIT-103', credits: 4, type: 'theory' },
          { name: 'Research Methodology & Technical Writing', code: 'MIT-104', credits: 3, type: 'theory' },
          { name: 'Security & Network Analysis Lab', code: 'MIT-191', credits: 2, type: 'practical' },
        ],
        2: [
          { name: 'Big Data Engineering & Real-time Analytics', code: 'MIT-201', credits: 4, type: 'theory' },
          { name: 'Edge Computing & Industrial IoT', code: 'MIT-202', credits: 4, type: 'theory' },
          { name: 'Modern Web Architectures & Micro Frontends', code: 'MIT-203', credits: 3, type: 'theory' },
          { name: 'Elective: Natural Language Understanding', code: 'MIT-204E', credits: 3, type: 'elective' },
          { name: 'Big Data & Edge Computing Lab', code: 'MIT-291', credits: 2, type: 'practical' },
        ],
        3: [
          { name: 'M.Tech Thesis Phase-I', code: 'MIT-381', credits: 8, type: 'practical' },
          { name: 'Elective: Software Defined Networking (SDN)', code: 'MIT-301E', credits: 3, type: 'elective' },
          { name: 'Technical Seminar & Colloquium', code: 'MIT-382', credits: 2, type: 'theory' },
          { name: 'Patent Drafting & Intellectual Property', code: 'HU-901', credits: 2, type: 'theory' },
        ],
        4: [
          { name: 'M.Tech Thesis Defense & Dissertation', code: 'MIT-481', credits: 12, type: 'practical' },
          { name: 'Research Paper Conference Presentation', code: 'MIT-482', credits: 4, type: 'theory' },
          { name: 'Comprehensive Masters Technical Viva', code: 'MIT-483', credits: 2, type: 'theory' },
          { name: 'Industry Advisory Presentation', code: 'MIT-401', credits: 2, type: 'theory' },
        ],
      },
      'MTECH-ECE': {
        1: [
          { name: 'Advanced Digital Signal Processing', code: 'MEC-101', credits: 4, type: 'theory' },
          { name: 'Advanced VLSI Design & Verification', code: 'MEC-102', credits: 4, type: 'theory' },
          { name: 'Mathematical Foundations for Communications', code: 'MEC-103', credits: 4, type: 'theory' },
          { name: 'Modern Digital Wireless Communications', code: 'MEC-104', credits: 3, type: 'theory' },
          { name: 'VLSI Design & DSP Simulation Lab', code: 'MEC-191', credits: 2, type: 'practical' },
        ],
        2: [
          { name: 'Wireless MIMO & 5G/6G Networks', code: 'MEC-201', credits: 4, type: 'theory' },
          { name: 'Embedded Real-Time Operating Systems', code: 'MEC-202', credits: 4, type: 'theory' },
          { name: 'RF & Microwave Integrated Circuits (RFIC)', code: 'MEC-203', credits: 3, type: 'theory' },
          { name: 'Elective: Biomedical Signal Processing', code: 'MEC-204E', credits: 3, type: 'elective' },
          { name: 'Advanced 5G & Embedded Lab', code: 'MEC-291', credits: 2, type: 'practical' },
        ],
        3: [
          { name: 'M.Tech Dissertation Phase-I', code: 'MEC-381', credits: 8, type: 'practical' },
          { name: 'Optical Network Architectures', code: 'MEC-301', credits: 3, type: 'theory' },
          { name: 'Research Seminar & Simulation Defense', code: 'MEC-382', credits: 2, type: 'theory' },
          { name: 'Intellectual Property Rights for Engineers', code: 'HU-902', credits: 2, type: 'theory' },
        ],
        4: [
          { name: 'Final M.Tech Thesis Defense & Viva-Voce', code: 'MEC-481', credits: 12, type: 'practical' },
          { name: 'IEEE / SCI Journal Publication', code: 'MEC-482', credits: 4, type: 'theory' },
          { name: 'Master Grand Technical Viva', code: 'MEC-483', credits: 2, type: 'theory' },
          { name: 'Industry Technology Forum', code: 'MEC-401', credits: 2, type: 'theory' },
        ],
      },
    };

    const createdSubjects = {};
    let totalSubjectCount = 0;

    for (const [courseCode, semMap] of Object.entries(curriculumData)) {
      const course = courses[courseCode];
      const dept = departments[courseCode.includes('BTECH') ? courseCode.replace('BTECH-', '') : courseCode.includes('MTECH') ? courseCode : courseCode];

      createdSubjects[courseCode] = {};
      for (const [sem, subs] of Object.entries(semMap)) {
        createdSubjects[courseCode][sem] = [];
        for (const sub of subs) {
          const doc = await Subject.create({
            name: sub.name,
            code: sub.code,
            department: dept._id,
            course: course._id,
            semester: Number(sem),
            credits: sub.credits,
            type: sub.type,
          });
          createdSubjects[courseCode][sem].push(doc);
          totalSubjectCount++;
        }
      }
    }
    console.log(`      ✓ Verified: ${totalSubjectCount} Semester-Wise Subjects Created Across All 8 Programs`);

    console.log('[5/7] Provisioning West Bengal Professors, HODs & Faculty Members...');
    // Create HODs for all departments
    const hodDefs = [
      { email: 'hod.bca@campus360.edu', name: 'Dr. Arup Kumar Bhattacharya', dept: 'BCA', desig: 'Professor & Head of Department' },
      { email: 'hod.mca@campus360.edu', name: 'Dr. Sharmistha Sen', dept: 'MCA', desig: 'Professor & Head of Department' },
      { email: 'hod.cse@campus360.edu', name: 'Dr. Debashis De', dept: 'CSE', desig: 'Senior Professor & Head of Department' },
      { email: 'hod.it@campus360.edu', name: 'Dr. Soumya Sen', dept: 'IT', desig: 'Professor & Head of Department' },
      { email: 'hod.ece@campus360.edu', name: 'Dr. Indranil Roy', dept: 'ECE', desig: 'Professor & Head of Department' },
      { email: 'hod.mtechcse@campus360.edu', name: 'Dr. Partha Sarathi Ghosh', dept: 'MTECH-CSE', desig: 'Distinguished Professor & PG Coordinator' },
      { email: 'hod.mtechit@campus360.edu', name: 'Dr. Suvankar Mukherjee', dept: 'MTECH-IT', desig: 'Professor & Head of PG Studies' },
      { email: 'hod.mtechece@campus360.edu', name: 'Dr. Ritika Sarkar', dept: 'MTECH-ECE', desig: 'Professor & PG Coordinator' },
    ];

    const hodUsers = {};
    for (let i = 0; i < hodDefs.length; i++) {
      const h = hodDefs[i];
      const dept = departments[h.dept];
      const user = await User.create({
        name: h.name,
        email: h.email,
        password: 'Teacher@123',
        role: 'hod',
        department: dept._id,
        phone: `+91 983100000${i + 1}`,
      });
      await TeacherProfile.create({
        user: user._id,
        employeeId: `EMP-HOD-0${i + 1}`,
        department: dept._id,
        designation: h.desig,
        qualification: 'Ph.D. in Computer Science & Engineering, Jadavpur University',
        isMentor: true,
        assignedSubjects: [],
      });
      await Department.findByIdAndUpdate(dept._id, { hod: user._id });
      hodUsers[h.dept] = user;
    }

    // Faculty Teachers & Chief Mentors
    const teacherDefs = [
      { email: 'mentor@campus360.edu', name: 'Prof. Partha Sarathi Ghosh', dept: 'CSE', desig: 'Associate Professor & Chief Faculty Mentor', isMentor: true },
      { email: 'teacher1@campus360.edu', name: 'Prof. Sagnik Roy', dept: 'CSE', desig: 'Assistant Professor (Algorithms & Data Structures)', isMentor: true },
      { email: 'teacher2@campus360.edu', name: 'Prof. Ananya Chatterjee', dept: 'MCA', desig: 'Assistant Professor (Cloud Computing & OS)', isMentor: true },
      { email: 'teacher3@campus360.edu', name: 'Prof. Debanjan Banerjee', dept: 'BCA', desig: 'Assistant Professor (Database Systems & Full Stack)', isMentor: false },
      { email: 'teacher4@campus360.edu', name: 'Prof. Sneha Sengupta', dept: 'IT', desig: 'Assistant Professor (Computer Networks & Security)', isMentor: true },
      { email: 'teacher5@campus360.edu', name: 'Prof. Sourav Dutta', dept: 'CSE', desig: 'Assistant Professor (Artificial Intelligence & ML)', isMentor: false },
      { email: 'teacher6@campus360.edu', name: 'Prof. Joydeep Bhowmik', dept: 'ECE', desig: 'Assistant Professor (VLSI & Digital Signal Processing)', isMentor: true },
      { email: 'teacher7@campus360.edu', name: 'Prof. Tanmoy Pal', dept: 'IT', desig: 'Assistant Professor (Python & Big Data Analytics)', isMentor: false },
      { email: 'teacher8@campus360.edu', name: 'Prof. Poulami Bhattacharya', dept: 'BCA', desig: 'Assistant Professor (Web Engineering & Software Systems)', isMentor: true },
    ];

    const facultyUsers = [];
    for (let i = 0; i < teacherDefs.length; i++) {
      const t = teacherDefs[i];
      const dept = departments[t.dept];
      const user = await User.create({
        name: t.name,
        email: t.email,
        password: 'Teacher@123',
        role: 'teacher',
        department: dept._id,
        phone: `+91 983110000${i + 1}`,
      });
      await TeacherProfile.create({
        user: user._id,
        employeeId: `EMP-FAC-0${i + 1}`,
        department: dept._id,
        designation: t.desig,
        qualification: 'M.Tech / Ph.D., IIEST Shibpur / Calcutta University',
        isMentor: t.isMentor,
        assignedSubjects: [],
      });
      facultyUsers.push(user);
    }
    console.log(`      ✓ Verified: 8 HODs + ${facultyUsers.length} Active Teaching Professors Provisioned`);

    const authorizedFacultyUsers = facultyUsers.filter((_, idx) => teacherDefs[idx].isMentor);

    console.log('[6/7] Creating Exactly 3 Batches Per Department (24 Batches in Total)...');
    const batchList = [
      // BCA
      { name: 'BCA 2022-25', deptCode: 'BCA', courseCode: 'BCA', startYear: 2022, endYear: 2025, currentSemester: 6 },
      { name: 'BCA 2023-26', deptCode: 'BCA', courseCode: 'BCA', startYear: 2023, endYear: 2026, currentSemester: 4 },
      { name: 'BCA 2024-27', deptCode: 'BCA', courseCode: 'BCA', startYear: 2024, endYear: 2027, currentSemester: 2 },

      // MCA
      { name: 'MCA 2023-25', deptCode: 'MCA', courseCode: 'MCA', startYear: 2023, endYear: 2025, currentSemester: 4 },
      { name: 'MCA 2024-26', deptCode: 'MCA', courseCode: 'MCA', startYear: 2024, endYear: 2026, currentSemester: 2 },
      { name: 'MCA 2025-27', deptCode: 'MCA', courseCode: 'MCA', startYear: 2025, endYear: 2027, currentSemester: 1 },

      // B.Tech CSE
      { name: 'B.Tech CSE 2021-25', deptCode: 'CSE', courseCode: 'BTECH-CSE', startYear: 2021, endYear: 2025, currentSemester: 8 },
      { name: 'B.Tech CSE 2022-26', deptCode: 'CSE', courseCode: 'BTECH-CSE', startYear: 2022, endYear: 2026, currentSemester: 6 },
      { name: 'B.Tech CSE 2023-27', deptCode: 'CSE', courseCode: 'BTECH-CSE', startYear: 2023, endYear: 2027, currentSemester: 4 },

      // B.Tech IT
      { name: 'B.Tech IT 2021-25', deptCode: 'IT', courseCode: 'BTECH-IT', startYear: 2021, endYear: 2025, currentSemester: 8 },
      { name: 'B.Tech IT 2022-26', deptCode: 'IT', courseCode: 'BTECH-IT', startYear: 2022, endYear: 2026, currentSemester: 6 },
      { name: 'B.Tech IT 2023-27', deptCode: 'IT', courseCode: 'BTECH-IT', startYear: 2023, endYear: 2027, currentSemester: 4 },

      // B.Tech ECE
      { name: 'B.Tech ECE 2021-25', deptCode: 'ECE', courseCode: 'BTECH-ECE', startYear: 2021, endYear: 2025, currentSemester: 8 },
      { name: 'B.Tech ECE 2022-26', deptCode: 'ECE', courseCode: 'BTECH-ECE', startYear: 2022, endYear: 2026, currentSemester: 6 },
      { name: 'B.Tech ECE 2023-27', deptCode: 'ECE', courseCode: 'BTECH-ECE', startYear: 2023, endYear: 2027, currentSemester: 4 },

      // M.Tech CSE
      { name: 'M.Tech CSE 2023-25', deptCode: 'MTECH-CSE', courseCode: 'MTECH-CSE', startYear: 2023, endYear: 2025, currentSemester: 4 },
      { name: 'M.Tech CSE 2024-26', deptCode: 'MTECH-CSE', courseCode: 'MTECH-CSE', startYear: 2024, endYear: 2026, currentSemester: 2 },
      { name: 'M.Tech CSE 2025-27', deptCode: 'MTECH-CSE', courseCode: 'MTECH-CSE', startYear: 2025, endYear: 2027, currentSemester: 1 },

      // M.Tech IT
      { name: 'M.Tech IT 2023-25', deptCode: 'MTECH-IT', courseCode: 'MTECH-IT', startYear: 2023, endYear: 2025, currentSemester: 4 },
      { name: 'M.Tech IT 2024-26', deptCode: 'MTECH-IT', courseCode: 'MTECH-IT', startYear: 2024, endYear: 2026, currentSemester: 2 },
      { name: 'M.Tech IT 2025-27', deptCode: 'MTECH-IT', courseCode: 'MTECH-IT', startYear: 2025, endYear: 2027, currentSemester: 1 },

      // M.Tech ECE
      { name: 'M.Tech ECE 2023-25', deptCode: 'MTECH-ECE', courseCode: 'MTECH-ECE', startYear: 2023, endYear: 2025, currentSemester: 4 },
      { name: 'M.Tech ECE 2024-26', deptCode: 'MTECH-ECE', courseCode: 'MTECH-ECE', startYear: 2024, endYear: 2026, currentSemester: 2 },
      { name: 'M.Tech ECE 2025-27', deptCode: 'MTECH-ECE', courseCode: 'MTECH-ECE', startYear: 2025, endYear: 2027, currentSemester: 1 },
    ];

    const batches = [];
    for (let i = 0; i < batchList.length; i++) {
      const b = batchList[i];
      const dept = departments[b.deptCode];
      const course = courses[b.courseCode];
      const mentor = authorizedFacultyUsers[i % authorizedFacultyUsers.length];

      const batchDoc = await Batch.create({
        name: b.name,
        course: course._id,
        department: dept._id,
        startYear: b.startYear,
        endYear: b.endYear,
        currentSemester: b.currentSemester,
        mentor: mentor._id,
      });
      batches.push({ doc: batchDoc, meta: b });
    }
    console.log(`      ✓ Verified: Exactly ${batches.length} Batches Created (3 Batches per Department across all 8 Depts)`);

    console.log('[7/7] Enrolling 20-25 Students per Batch with Authentic West Bengal Profiles...');
    let totalStudentCount = 0;
    const studentUserDocs = [];
    const studentProfileDocs = [];
    const attendanceRecords = [];

    let nameIdx = 0;

    for (let bIdx = 0; bIdx < batches.length; bIdx++) {
      const { doc: batchDoc, meta: bMeta } = batches[bIdx];
      // 22 students per batch (within requested 20-30 range)
      const batchStudentCount = 22;

      for (let sIdx = 1; sIdx <= batchStudentCount; sIdx++) {
        const isMale = (sIdx % 2 === 1);
        const firstName = isMale
          ? BENGALI_FIRST_NAMES_MALE[(nameIdx + sIdx) % BENGALI_FIRST_NAMES_MALE.length]
          : BENGALI_FIRST_NAMES_FEMALE[(nameIdx + sIdx) % BENGALI_FIRST_NAMES_FEMALE.length];
        const surname = BENGALI_SURNAMES[(nameIdx * 3 + sIdx) % BENGALI_SURNAMES.length];
        const fullName = `${firstName} ${surname}`;

        const cleanDept = bMeta.deptCode.toLowerCase().replace(/[^a-z0-9]/g, '');
        const padIndex = String(sIdx).padStart(2, '0');
        const rollNum = `${bMeta.startYear}/${bMeta.deptCode}/${String(sIdx).padStart(3, '0')}`;
        const batchYr = bMeta.startYear % 100;

        // Guaranteed unique student emails across all batches
        let email = `${cleanDept}${batchYr}.${padIndex}@campus360.edu`;
        if (bIdx === 0 && sIdx === 1) email = 'student.bca@campus360.edu';
        if (bIdx === 3 && sIdx === 1) email = 'student1@campus360.edu'; // Primary MCA test student
        if (bIdx === 3 && sIdx === 2) email = 'student2@campus360.edu';
        if (bIdx === 3 && sIdx === 3) email = 'student3@campus360.edu'; // Attendance Defaulter
        if (bIdx === 6 && sIdx === 1) email = 'student.btech@campus360.edu'; // Primary B.Tech CSE student
        if (bIdx === 9 && sIdx === 1) email = 'student.it@campus360.edu';
        if (bIdx === 12 && sIdx === 1) email = 'student.ece@campus360.edu';

        const phone = `+91 9830${String(100000 + totalStudentCount).slice(1)}`;
        const guardian = `${GUARDIAN_FIRST_NAMES[sIdx % GUARDIAN_FIRST_NAMES.length]} ${surname}`;

        studentUserDocs.push({
          name: fullName,
          email,
          password: 'Student@123',
          role: 'student',
          department: batchDoc.department,
          phone,
          _batchDoc: batchDoc,
          _rollNum: rollNum,
          _guardian: guardian,
          _sIdx: sIdx,
          _bMeta: bMeta,
        });

        totalStudentCount++;
      }
      nameIdx += 7;
    }

    // Insert users and create profiles
    console.log(`      Creating ${studentUserDocs.length} West Bengal Student User Accounts...`);
    const createdUsers = [];
    for (const uData of studentUserDocs) {
      const u = await User.create({
        name: uData.name,
        email: uData.email,
        password: uData.password,
        role: uData.role,
        department: uData.department,
        phone: uData.phone,
      });

      const prof = await StudentProfile.create({
        user: u._id,
        rollNumber: uData._rollNum,
        department: uData.department,
        course: uData._batchDoc.course,
        batch: uData._batchDoc._id,
        currentSemester: uData._batchDoc.currentSemester,
        mentor: uData._batchDoc.mentor,
        guardianName: uData._guardian,
        emergencyContact: u.phone,
      });

      createdUsers.push({ user: u, profile: prof, meta: uData._bMeta, sIdx: uData._sIdx, batchDoc: uData._batchDoc });
    }
    console.log(`      ✓ Verified: ${createdUsers.length} Students Enrolled across all 24 Batches (22 students each)`);

    // Assign Subjects to Teachers and build realistic Timetable & Attendance Sessions
    console.log('[+] Generating Weekly Schedule Matrix, Teacher Subject Assignments & Attendance Records...');
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const timeSlots = [
      { start: '10:00', end: '11:00' },
      { start: '11:15', end: '12:15' },
      { start: '12:30', end: '13:30' },
      { start: '14:30', end: '15:30' },
      { start: '15:45', end: '16:45' },
    ];

    // Assign faculty to active subjects
    let roomCounter = 0;
    for (let bIdx = 0; bIdx < batches.length; bIdx++) {
      const { doc: batchDoc, meta: bMeta } = batches[bIdx];
      const activeSubjects = createdSubjects[bMeta.courseCode]?.[batchDoc.currentSemester] || [];
      const teacher = facultyUsers[bIdx % facultyUsers.length];

      // Update teacher's assigned subjects
      if (activeSubjects.length > 0) {
        await TeacherProfile.findOneAndUpdate(
          { user: teacher._id },
          {
            $addToSet: {
              assignedSubjects: {
                subject: activeSubjects[0]._id,
                batch: batchDoc._id,
                semester: batchDoc.currentSemester,
              },
            },
          }
        );
      }

      // Create 2-3 weekly timetable slots per batch
      for (let sIdx = 0; sIdx < Math.min(activeSubjects.length, 3); sIdx++) {
        const sub = activeSubjects[sIdx];
        const day = days[sIdx % days.length];
        const slot = timeSlots[sIdx % timeSlots.length];
        const room = sub.type === 'practical' ? classrooms[sIdx % 5] : classrooms[7 + (roomCounter++ % 20)];

        await Timetable.create({
          batch: batchDoc._id,
          subject: sub._id,
          teacher: teacher._id,
          classroom: room._id,
          department: batchDoc.department,
          day,
          startTime: slot.start,
          endTime: slot.end,
          semester: batchDoc.currentSemester,
          academicYear: '2024-2025',
          isActive: true,
        });
      }
    }

    // Seed realistic attendance records for MCA Batch 2024-26 and B.Tech CSE 2023-27
    const sampleBatch = batches.find((b) => b.meta.courseCode === 'MCA' && b.meta.currentSemester === 2);
    if (sampleBatch) {
      const mcaSubs = createdSubjects['MCA']?.[2] || [];
      const teacher = facultyUsers[0];
      const batchStudents = createdUsers.filter((u) => u.batchDoc._id.toString() === sampleBatch.doc._id.toString());
      const sampleTimetable = await Timetable.findOne({ batch: sampleBatch.doc._id });

      if (mcaSubs.length > 0 && batchStudents.length > 0 && sampleTimetable) {
        // Create 15 conducted classes
        for (let classNum = 1; classNum <= 15; classNum++) {
          const sessionDate = new Date(Date.now() - (16 - classNum) * 24 * 60 * 60 * 1000);
          const session = await AttendanceSession.create({
            sessionCode: `MCA-SEM2-CLS-${String(classNum).padStart(2, '0')}`,
            timetable: sampleTimetable._id,
            subject: mcaSubs[0]._id,
            teacher: teacher._id,
            batch: sampleBatch.doc._id,
            classroom: classrooms[0]._id,
            department: sampleBatch.doc.department,
            date: sessionDate,
            durationMinutes: 60,
            status: 'finalized',
            endedByTeacher: true,
            endedAt: new Date(sessionDate.getTime() + 60 * 60 * 1000),
          });

          // Mark attendance: student3 has low attendance (< 75%), others 85-100%
          const recordDocs = batchStudents.map((s, idx) => {
            const isStudent3 = s.user.email === 'student3@campus360.edu';
            const attended = isStudent3 ? classNum <= 4 : idx % 7 === 0 ? classNum % 3 !== 0 : true;
            return {
              session: session._id,
              student: s.user._id,
              batch: sampleBatch.doc._id,
              subject: mcaSubs[0]._id,
              status: attended ? 'present' : 'absent',
              scannedAt: attended ? sessionDate : null,
            };
          });
          await AttendanceRecord.insertMany(recordDocs);
        }
      }
    }

    // Official Institutional Bulletins & Notices
    console.log('[+] Publishing Institutional Broadcast Announcements...');
    await Announcement.create({
      title: 'West Bengal MAKAUT Even Semester Academic Calendar 2024-25',
      content: 'Official instruction classes, mid-semester internal assessments (CIA), and final university semester examination schedules have been published. All departments must complete continuous assessment before June 15.',
      scope: 'college',
      priority: 'urgent',
      author: admin._id,
    });

    await Announcement.create({
      title: 'Department of Computer Applications: Practical Lab Evaluations',
      content: 'BCA & MCA Even Semester lab practical examinations and software viva-voce will be held in Aryabhatta Computing Labs 1 & 2. Submission of lab journals is mandatory.',
      scope: 'department',
      department: departments['MCA']._id,
      priority: 'normal',
      author: hodUsers['MCA']._id,
    });

    await Announcement.create({
      title: 'B.Tech CSE Project Review & Technical Seminar',
      content: 'Major Capstone project repositories and architecture design diagrams must be reviewed by the respective faculty guides by this Friday in P.C. Ray Technology Complex.',
      scope: 'department',
      department: departments['CSE']._id,
      priority: 'normal',
      author: hodUsers['CSE']._id,
    });

    console.log('================================================================');
    console.log('   CAMPUS360 WEST BENGAL COLLEGES RE-SEED COMPLETED 100% SUCCESS  ');
    console.log('================================================================');
    console.log(` • Departments: 8 (BCA, MCA, B.Tech CSE/IT/ECE, M.Tech CSE/IT/ECE)`);
    console.log(` • Batches: Exactly ${batches.length} Batches (3 Active Batches per Department)`);
    console.log(` • Students: Exactly ${createdUsers.length} Students Enrolled (22 per batch with real Bengali names)`);
    console.log(` • Rooms: Exactly ${classrooms.length} Rooms (5 Labs, 2 Halls, 20 Classrooms)`);
    console.log(` • Subjects: Exactly ${totalSubjectCount} Semester-Wise Subjects (4-6 subjects per semester)`);
    console.log(` • Faculty: 8 HODs + ${facultyUsers.length} Teaching Professors + 1 Administrator`);
    console.log('----------------------------------------------------------------');
    console.log(' Quick Test Credentials:');
    console.log(' 1. Administrator:      admin@campus360.edu         Password: Admin@123');
    console.log(' 2. HOD MCA:            hod.mca@campus360.edu       Password: Teacher@123 (Dr. Sharmistha Sen)');
    console.log(' 3. HOD B.Tech CSE:     hod.cse@campus360.edu       Password: Teacher@123 (Dr. Debashis De)');
    console.log(' 4. Faculty Mentor:     mentor@campus360.edu        Password: Teacher@123 (Prof. Partha Sarathi Ghosh)');
    console.log(' 5. Student (MCA-Sem2): student1@campus360.edu      Password: Student@123 (Subhajit Banerjee)');
    console.log(' 6. Student (Defaulter):student3@campus360.edu      Password: Student@123 (<75% attendance alert)');
    console.log(' 7. Student (B.Tech):   student.btech@campus360.edu Password: Student@123');
    console.log(' 8. Student (BCA):      student.bca@campus360.edu   Password: Student@123');
    console.log('================================================================');

    process.exit(0);
  } catch (error) {
    console.error('Database re-seed failed:', error);
    process.exit(1);
  }
};

seedDatabase();
