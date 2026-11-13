import * as docx from 'docx';
import fs from 'fs';
import path from 'path';

const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
  Header,
  Footer,
  PageNumber,
  PageBreak,
} = docx;

// Executive Color Palette
const COLOR_PRIMARY = '1E3A8A'; // Deep Navy
const COLOR_SECONDARY = '4338CA'; // Indigo
const COLOR_DARK = '0F172A'; // Slate 900
const COLOR_TEXT = '334155'; // Slate 700
const COLOR_MUTED = '64748B'; // Slate 500
const COLOR_LIGHT_BG = 'F8FAFC'; // Slate 50
const COLOR_BORDER = 'CBD5E1'; // Slate 300
const COLOR_CALLOUT_BG = 'EFF6FF'; // Blue 50
const COLOR_CALLOUT_BORDER = '2563EB'; // Blue 600
const COLOR_SUCCESS = '059669'; // Emerald
const COLOR_WARNING = 'D97706'; // Amber

function spacing(before = 120, after = 120) {
  return new Paragraph({
    spacing: { before, after },
  });
}

function createHeading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 180 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 32, // 16pt
        color: COLOR_PRIMARY,
        font: 'Segoe UI',
      }),
    ],
    border: {
      bottom: {
        color: COLOR_SECONDARY,
        space: 8,
        value: 'single',
        size: 16,
      },
    },
  });
}

function createHeading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 26, // 13pt
        color: COLOR_SECONDARY,
        font: 'Segoe UI',
      }),
    ],
  });
}

function createHeading3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 80 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 22, // 11pt
        color: COLOR_DARK,
        font: 'Segoe UI',
      }),
    ],
  });
}

function createPara(text, options = {}) {
  const { bold = false, italic = false, color = COLOR_TEXT, size = 20, align = AlignmentType.LEFT } = options;
  return new Paragraph({
    alignment: align,
    spacing: { before: 90, after: 90, line: 300 },
    children: [
      new TextRun({
        text,
        bold,
        italic,
        color,
        size,
        font: 'Segoe UI',
      }),
    ],
  });
}

function createBullet(title, description, level = 0) {
  return new Paragraph({
    bullet: { level },
    spacing: { before: 70, after: 70, line: 280 },
    children: [
      new TextRun({
        text: title ? `${title}: ` : '',
        bold: Boolean(title),
        color: COLOR_DARK,
        size: 20,
        font: 'Segoe UI',
      }),
      new TextRun({
        text: description,
        color: COLOR_TEXT,
        size: 20,
        font: 'Segoe UI',
      }),
    ],
  });
}

function createCalloutBox(title, body, borderColor = COLOR_CALLOUT_BORDER, bgColor = COLOR_CALLOUT_BG) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      left: { style: BorderStyle.SINGLE, size: 28, color: borderColor },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: bgColor, type: ShadingType.CLEAR },
            margins: { top: 160, bottom: 160, left: 200, right: 200 },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 60 },
                children: [
                  new TextRun({
                    text: `📌 ${title}`,
                    bold: true,
                    size: 21,
                    color: borderColor,
                    font: 'Segoe UI',
                  }),
                ],
              }),
              new Paragraph({
                spacing: { before: 0, after: 0, line: 280 },
                children: [
                  new TextRun({
                    text: body,
                    size: 19,
                    color: COLOR_DARK,
                    font: 'Segoe UI',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function createStyledTable(headers, rows, colWidths = []) {
  const tableRows = [];

  tableRows.push(
    new TableRow({
      tableHeader: true,
      children: headers.map((h, i) =>
        new TableCell({
          width: colWidths[i] ? { size: colWidths[i], type: WidthType.PERCENTAGE } : undefined,
          shading: { fill: COLOR_PRIMARY, type: ShadingType.CLEAR },
          margins: { top: 140, bottom: 140, left: 140, right: 140 },
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              children: [
                new TextRun({
                  text: h,
                  bold: true,
                  size: 19,
                  color: 'FFFFFF',
                  font: 'Segoe UI',
                }),
              ],
            }),
          ],
        })
      ),
    })
  );

  rows.forEach((row, rowIndex) => {
    const isEven = rowIndex % 2 === 0;
    tableRows.push(
      new TableRow({
        children: row.map((cellText, cellIndex) =>
          new TableCell({
            width: colWidths[cellIndex] ? { size: colWidths[cellIndex], type: WidthType.PERCENTAGE } : undefined,
            shading: { fill: isEven ? 'FFFFFF' : COLOR_LIGHT_BG, type: ShadingType.CLEAR },
            margins: { top: 110, bottom: 110, left: 140, right: 140 },
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                spacing: { before: 0, after: 0, line: 250 },
                children: [
                  new TextRun({
                    text: cellText,
                    size: 18,
                    color: COLOR_DARK,
                    font: 'Segoe UI',
                  }),
                ],
              }),
            ],
          })
        ),
      })
    );
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
      left: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
      right: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
    },
    rows: tableRows,
  });
}

async function buildFullDocx() {
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Segoe UI',
            size: 20,
            color: COLOR_TEXT,
          },
          paragraph: {
            spacing: { line: 290 },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              bottom: 1440,
              left: 1440,
              right: 1440,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'Acadex • System Architecture & Major Project Specification',
                    size: 16,
                    color: COLOR_MUTED,
                    font: 'Segoe UI',
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'Page ',
                    size: 16,
                    color: COLOR_MUTED,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: COLOR_MUTED,
                  }),
                  new TextRun({
                    text: ' of ',
                    size: 16,
                    color: COLOR_MUTED,
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    color: COLOR_MUTED,
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // =========================================================================
          // COVER & TITLE BLOCK
          // =========================================================================
          spacing(100, 80),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'ACADEX',
                bold: true,
                size: 56, // 28pt
                color: COLOR_PRIMARY,
                font: 'Segoe UI',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'Smart Autonomous College ERP & Academic Operating System',
                bold: true,
                size: 28, // 14pt
                color: COLOR_SECONDARY,
                font: 'Segoe UI',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 80, after: 200 },
            children: [
              new TextRun({
                text: 'Comprehensive System Architecture, Complete Codebase Manifest, Implemented Modules, and Final Year Major Project Engineering Specification',
                italic: true,
                size: 20,
                color: COLOR_MUTED,
                font: 'Segoe UI',
              }),
            ],
          }),

          createStyledTable(
            ['Project Parameter', 'Engineering & Academic Details'],
            [
              ['Project Title', 'Acadex — Integrated Autonomous College Academic ERP & Intelligence Platform'],
              ['Document Scope', 'Full Technical Specification, Architecture, Code Directory Manifest & Major Project Roadmap'],
              ['Academic Phase', 'Phase 1 Production System Verified • Phase 2 Final Year Major Project Execution Plan'],
              ['Authors / Project Team', 'Engineering Team & Final Year Major Project Cohort (2025–2026)'],
              ['Core Technologies', 'React 18 + Vite + Tailwind CSS v4 | Node.js v22 + Express | MongoDB Atlas | Socket.io Engine | IndexedDB'],
              ['Security Protocol', 'Time-Based Rolling Cryptographic Tokens, Strict 6-Role Hierarchical RBAC, Zero-Trust Privacy Isolation'],
              ['Document Version', 'Release 2.5 (Exhaustive Master Edition) — November 2026'],
            ],
            [30, 70]
          ),

          spacing(200, 140),

          // =========================================================================
          // DOCUMENT MENU / TABLE OF CONTENTS
          // =========================================================================
          createHeading1('Document Menu & Table of Contents'),
          createPara(
            'This master specification is systematically organized into the following distinct functional sections. Each section details the institutional problem, mathematical models, software architecture, implemented codebase files, and planned major project extensions.'
          ),

          createStyledTable(
            ['Section #', 'Document Menu Item & Topic', 'Key Focus & Coverage'],
            [
              ['Section 1', 'Executive Problem Formulation & Higher Education Challenges', 'Proxy attendance, class scheduling chaos, unverified chat, delayed CIA marks, reactive student crisis.'],
              ['Section 2', 'Acadex Solution Paradigm & Architectural Framework', '3-Tier Modular Monolith, real-time WebSocket layer, security model, and 6-role RBAC permission matrix.'],
              ['Section 3', 'Complete Project Directory & File Manifest', 'Exhaustive breakdown of every single file and folder in `/server` and `/client` with inputs, outputs & logic.'],
              ['Section 4', 'Deep Dive: Implemented Production Modules (Phase 1)', 'Dynamic QR attendance, classroom kiosk, daily 7AM timetable cron, absentee privacy, messaging suite, curriculum ledger.'],
              ['Section 5', 'Major Project Pillar 1: Advanced CIA & Marks Automation', 'Continuous Internal Assessment, weightages, Bloom’s Taxonomy CO/PO mapping, grace marks, moderation workflow.'],
              ['Section 6', 'Major Project Pillar 2: Multi-Aspect AI Student Risk Engine', 'Multi-Factor Risk Index (MFRI), 6 distinct failure dimensions, predictive ML algorithms, automated prescriptive interventions.'],
              ['Section 7', 'Major Project Pillar 3: Omnichannel Notification Gateway', 'WhatsApp Business Cloud API, transactional SMS, VAPID Web Push (PWA), transactional email for daily timetable & alerts.'],
              ['Section 8', 'Major Project Pillar 4: High-Stakes Proctored CBT Engine', 'Offline-resilient exam runtime, fullscreen lock, webcam face tracking, audio decibel monitoring, automated grading.'],
              ['Section 9', 'Database Schema, Entity Dictionary & Performance Indexes', 'Detailed field-by-field schema breakdown of all 12+ MongoDB collections with compound index optimizations.'],
              ['Section 10', '16-Week Major Project Execution Roadmap & Sprint Plan', 'Sprint-by-sprint Gantt chart, milestones, deliverable targets, and final viva defense criteria.'],
              ['Section 11', 'Security, Institutional Compliance & Anti-Cheating Harness', 'Zero-trust token rotation, FERPA/GDPR compliance, replay protection, client-side integrity checks.'],
              ['Section 12', 'Conclusion & Institutional Scalability Vision', 'Summary, production readiness, multi-college multi-tenancy roadmap, and final university defense sign-off.'],
            ],
            [15, 45, 40]
          ),

          spacing(240, 160),

          // =========================================================================
          // SECTION 1: EXECUTIVE PROBLEM FORMULATION
          // =========================================================================
          createHeading1('1. Executive Problem Formulation & Higher Education Challenges'),
          createPara(
            'Higher education institutions worldwide are grappling with massive administrative overhead, legacy monolithic softwares, and fragmented communication tools. Autonomous engineering and science colleges face distinct systemic challenges that directly impair instructional delivery, student retention, and institutional accreditation.'
          ),

          createHeading2('1.1 The Proxy Attendance Crisis & Time Theft'),
          createPara(
            'Traditional paper attendance registers consume between 7 to 12 minutes of every 50-minute lecture period. In a standard college running 6 lecture slots daily across 40 class sections, institutions lose approximately 2,400 to 4,800 minutes of productive instructional time every single day. Furthermore, existing digital alternatives such as static QR codes printed on classroom walls suffer from widespread proxy fraud: students photograph the static QR code and share it via instant messaging groups with absent peers off-campus.'
          ),

          createHeading2('1.2 Class Scheduling Desynchronization & Substitution Chaos'),
          createPara(
            'When faculty members take emergency leave or attend official conferences, departments struggle to assign substitute faculty. Because schedules are managed via paper circulars or disconnected spreadsheets, students often arrive at lecture halls only to discover their teacher is absent. Past substitutions are rarely audited, making it impossible to compute exact syllabus completion percentages.'
          ),

          createHeading2('1.3 Unverified, Informal Academic Communication'),
          createPara(
            'Faculty personal contact numbers are routinely shared across informal WhatsApp and Telegram groups. This leads to boundary breaches, after-hours harassment, and lost doubt resolution queries. More critically, academic guidance provided informally lacks institutional auditability, leaving department heads and mentors in the dark regarding student struggles.'
          ),

          createHeading2('1.4 Opaque, Delayed Continuous Internal Assessment (CIA)'),
          createPara(
            'Continuous Internal Assessment (CIA) marks—comprising midterms, quizzes, lab vivas, and attendance—are calculated manually at the very end of the semester. This delay prevents students from understanding their standing, breeds suspicion regarding biased grading, and prevents academic councils from applying standardized moderation or Outcome-Based Education (OBE) Bloom\'s Taxonomy mapping.'
          ),

          createHeading2('1.5 Reactive Crisis Management Rather Than Predictive Intervention'),
          createPara(
            'Colleges discover student academic distress only after end-semester examination results are published. By then, the student has failed multiple subjects, lost credit standing, and is at risk of year back or dropout. No existing commercial ERP connects daily attendance dropouts with quiz performance, assignment submission lateness, and mentor disengagement to predict failure before it happens.'
          ),

          spacing(200, 140),

          // =========================================================================
          // SECTION 2: ACADEX SOLUTION PARADIGM & ARCHITECTURAL FRAMEWORK
          // =========================================================================
          createHeading1('2. Acadex Solution Paradigm & Architectural Framework'),
          createPara(
            'Acadex re-engineers college administration through an event-driven, real-time architecture built around four fundamental tenets: Zero-Proxy Attendance, Autonomous Schedule Materialization, Real-time Mentorship Communication, and Multi-Aspect Predictive Student Intervention.'
          ),

          createHeading2('2.1 Multi-Tier Modular Monolith Architecture'),
          createPara(
            'Rather than adopting fragile distributed microservices that introduce distributed transaction overhead and network latency, Acadex is engineered as a Modular Monolith. Highly cohesive domain modules (Auth, Timetable, Attendance, Communication, Examinations, LMS, Analytics) operate within a single optimized Node.js runtime while maintaining strict boundary encapsulation.'
          ),

          createStyledTable(
            ['Architectural Layer', 'Technical Framework', 'Operational Capabilities & Design Rationale'],
            [
              ['Presentation Layer', 'React 18, Vite, Tailwind CSS v4, Lucide Icons', 'Universal zero-scroll layout; permanent 64px icon rail; responsive side-by-side chat workspace; HTML5 high-speed camera QR scanner.'],
              ['State & Synchronization', 'Context API, Socket.io-client, Axios Interceptor', 'AuthContext manages JWT persistence & role predicates; SocketContext manages real-time presence, typing indicators & unread badges; Axios handles unified error envelopes.'],
              ['Application Layer', 'Node.js v22 LTS, Express.js (Modular Monolith)', 'REST controllers; daily 07:00 AM class generator cron; cryptographic token rotation engine; multi-tier RBAC authorization middleware.'],
              ['Real-Time Transport', 'Socket.io Engine (WebSockets + Polling Fallback)', 'Low-latency peer-to-peer and room-based message dispatch, read receipt synchronization, typing status emission, live attendance countdown heartbeat.'],
              ['Data Persistence', 'MongoDB Atlas Replica Set', 'Optimized connection pooling (maxPoolSize=50); compound indexing on timetable slots and student batches; immutable attendance ledger transactions.'],
            ],
            [22, 28, 50]
          ),

          spacing(160, 100),
          createHeading2('2.2 Multi-Tier Role-Based Access Control (RBAC) Grid'),
          createPara(
            'Security and privacy are maintained through a 6-tier hierarchical RBAC matrix enforced at both the route middleware level (`authorizeRoles`) and field-level database projections.'
          ),

          createStyledTable(
            ['Operational Domain', 'super_admin', 'college_admin', 'hod', 'teacher / mentor', 'student'],
            [
              ['Department & Batch Governance', 'Full Access', 'Full Access', 'Read-Only (Dept)', 'Read-Only (Enrolled)', 'Read-Only (Own)'],
              ['Weekly Master Timetable CRUD', 'Full Access', 'Full Access', 'Full Access (Dept)', 'View Assigned', 'View Enrolled'],
              ['Daily Class 7AM Schedule', 'Full Access', 'Full Access', 'Pause / Substitute', 'View Today / Launch', 'View Today (No absentees)'],
              ['Classroom Attendance Scanner', 'Full Access', 'Full Access', 'Full Access', 'Launch & Scan', 'Generate Pass Only'],
              ['Class Absentee Roster Modal', 'Full Access', 'Full Access', 'Full Access', 'Full Access', 'STRICTLY FORBIDDEN (403)'],
              ['Internal CIA Marks Entry', 'Audit Only', 'Audit Only', 'Approve / Moderate', 'Enter & Submit Marks', 'View Published Only'],
              ['Direct Academic Messaging', 'System Audit', 'System Audit', 'Message Dept/Faculty', 'Message Mentees/Classes', 'Message Mentors/Teachers'],
              ['Predictive Risk Analytics', 'Institute View', 'Institute View', 'Department View', 'Assigned Mentee View', 'Personal Health Radar'],
              ['Proctored CBT Examination', 'Full Access', 'Manage Exams', 'Manage Dept Exams', 'Invigilate / Grade', 'Write Active Exam Only'],
            ],
            [22, 15, 15, 16, 16, 16]
          ),

          spacing(200, 140),

          // =========================================================================
          // SECTION 3: EXHAUSTIVE DIRECTORY & FILE MANIFEST
          // =========================================================================
          createHeading1('3. Complete Project Directory & File Manifest'),
          createPara(
            'Below is an exhaustive, audited directory manifest of every file and folder in the Acadex repository. Every component, controller, model, and utility is documented with its operational responsibility.'
          ),

          createHeading2('3.1 Backend File Manifest (`d:/Acadex/server`)'),
          createStyledTable(
            ['File Path', 'Classification', 'Detailed Functional & Engineering Description'],
            [
              ['src/server.js', 'Application Bootstrapper', 'Initializes HTTP server, attaches Socket.io engine, verifies MongoDB Atlas replica set connection, starts automated daily 7:00 AM class generator cron.'],
              ['src/config/db.js', 'Database Connector', 'Configures Mongoose with optimized pool sizing, handles autoIndex toggling for production, and registers graceful process shutdown hooks.'],
              ['src/config/socket.js', 'WebSocket Engine', 'Binds Socket.io to HTTP port, configures cross-origin headers, enforces JWT socket handshake authentication, and tracks active user socket rooms.'],
              ['src/middleware/auth.js', 'Security Middleware', 'Exports `authenticate` (validates Bearer JWT header) and `authorizeRoles` (enforces strict multi-tier role gateway returning 403 upon breach).'],
              ['src/middleware/errorHandler.js', 'Error Handling', 'Catches unhandled asynchronous exceptions, maps Mongoose ValidationError and CastError, returns standard `{ success: false, message }` JSON.'],
              ['src/modules/auth/user.model.js', 'Database Model', 'Defines user accounts with bcrypt pre-save password hashing, role enum (`super_admin`, `college_admin`, `hod`, `teacher`, `student`), and department link.'],
              ['src/modules/auth/auth.controller.js', 'Module Controller', 'Implements login authentication, JWT token generation, profile retrieval, password change, and token refresh logic.'],
              ['src/modules/auth/auth.routes.js', 'API Routes', 'Exposes `/api/auth/login`, `/api/auth/profile`, `/api/auth/refresh`, and password reset endpoints.'],
              ['src/modules/academics/department.model.js', 'Database Model', 'Represents college departments (ECE, CSE, MECH), assigning HOD faculty member and tracking total semester counts.'],
              ['src/modules/academics/batch.model.js', 'Database Model', 'Represents student cohort batches (e.g. B.Tech ECE 2021-25, Section A, Semester 6) linking department and academic year.'],
              ['src/modules/academics/classroom.model.js', 'Database Model', 'Represents physical lecture halls, computer labs, podium kiosk terminal IDs, and maximum seat capacity.'],
              ['src/modules/academics/subject.model.js', 'Database Model', 'Stores subject catalogue: subject code, name, credit weight, department, and practical/theory classification.'],
              ['src/modules/academics/academic.controller.js', 'Module Controller', 'Manages department, batch, classroom, and subject CRUD with capacity and duplicate code validation.'],
              ['src/modules/academics/academic.routes.js', 'API Routes', 'Exposes endpoints for college structure: `/api/academic/departments`, `/api/academic/batches`, `/api/academic/classrooms`.'],
              ['src/modules/timetable/timetable.model.js', 'Database Model', 'Stores recurring master weekly schedule slots: dayOfWeek (1-6), startTime, endTime, subject, teacher, batch, classroom.'],
              ['src/modules/timetable/dailyClass.model.js', 'Database Model', 'Materialized daily class slot with date (YYYY-MM-DD), status (`scheduled`, `in_progress`, `completed`, `paused`), and substitute teacher.'],
              ['src/modules/timetable/timetable.controller.js', 'Module Controller', 'Calculates weekly schedule matrix, performs 3-way conflict validation (teacher busy, room occupied, batch occupied).'],
              ['src/modules/timetable/dailyClass.controller.js', 'Module Controller', 'Manages live daily schedule, 07:00 AM class materialization, faculty substitution, class pause/resume, and role-gated absentee auditing.'],
              ['src/modules/timetable/timetable.routes.js', 'API Routes', 'Exposes `/api/timetable`, `/api/timetable/daily-classes`, and strictly role-gated `/daily-classes/:id/absentees`.'],
              ['src/modules/attendance/attendanceSession.model.js', 'Database Model', 'Live QR session document storing sessionCode, secretSeed, expiry timestamp (10 mins), and marked student count.'],
              ['src/modules/attendance/attendanceRecord.model.js', 'Database Model', 'Immutable attendance ledger linking student, dailyClass, session, scan timestamp, status (`present`/`absent`), and device hash.'],
              ['src/modules/attendance/attendance.controller.js', 'Module Controller', 'Handles QR session generation, time-based rolling token verification, single-use nonce consumption, and manual attendance override.'],
              ['src/modules/attendance/attendance.routes.js', 'API Routes', 'Exposes `/api/attendance/session/start`, `/api/attendance/verify-qr`, and `/api/attendance/report`.'],
              ['src/modules/communication/message.model.js', 'Database Model', 'Direct academic messaging document: sender, recipient, message content, read status boolean, and timestamps.'],
              ['src/modules/communication/contact.model.js', 'Database Model', 'Cached relationship map linking students to mentors, course teachers, and HODs with pin status persistence.'],
              ['src/modules/communication/communication.controller.js', 'Module Controller', 'Fetches authorized contacts list, unread message badges, chat history, read receipt updates, and contact pin/unpin toggling.'],
              ['src/modules/communication/socketEvents.js', 'WebSocket Service', 'Implements real-time events: `join`, `sendMessage`, `typing`, `stopTyping`, `markRead`, and presence status.'],
              ['src/modules/communication/communication.routes.js', 'API Routes', 'Exposes `/api/communication/contacts`, `/api/communication/messages/:id`, and `/api/communication/contacts/:id/pin`.'],
              ['src/modules/examinations/internalMark.model.js', 'Database Model', 'Stores CIA marks, midterms, quizzes, assignments, component weightages, teacher remarks, and moderation status.'],
              ['src/modules/examinations/gradeCard.model.js', 'Database Model', 'Stores official semester grade transcripts: subject credits, grade points (O, A+, A, B+, B, C, F), SGPA, and cumulative CGPA.'],
              ['src/modules/examinations/exam.controller.js', 'Module Controller', 'Computes weighted internal marks, validates component totals, and publishes semester grade cards.'],
              ['src/modules/examinations/exam.routes.js', 'API Routes', 'Exposes `/api/examinations/internals`, `/api/examinations/transcript`, and grade publishing endpoints.'],
              ['src/modules/users/studentProfile.model.js', 'Database Model', 'Student academic record: rollNumber, registrationId, batch reference, assigned faculty mentor, and guardian contacts.'],
              ['src/modules/users/teacherProfile.model.js', 'Database Model', 'Faculty academic record: employeeCode, designation, department, specialization, and assigned mentee caseload.'],
              ['src/modules/users/userManagement.controller.js', 'Module Controller', 'Handles student enrollment, faculty onboarding, mentor assignment, and batch promotion.'],
              ['src/modules/users/userManagement.routes.js', 'API Routes', 'Exposes administrative registry endpoints: `/api/admin/students`, `/api/admin/teachers`, `/api/admin/assign-mentor`.'],
            ],
            [26, 20, 54]
          ),

          spacing(160, 100),
          createHeading2('3.2 Frontend File Manifest (`d:/Acadex/client`)'),
          createStyledTable(
            ['Frontend File Path', 'Classification', 'Detailed UI / UX & Functional Description'],
            [
              ['src/App.jsx', 'Router Root', 'Configures React Router v6 tree, wrapping protected routes in `<ProtectedRoute allowedRoles={[...]}>` and `<DashboardLayout />`.'],
              ['src/main.jsx', 'App Entry Point', 'Renders React application into DOM root with Tailwind CSS v4 styling and AuthProvider/SocketProvider contexts.'],
              ['src/context/AuthContext.jsx', 'Authentication Context', 'Maintains authenticated user session, JWT storage, login/logout functions, and convenient role booleans (`isStudent`, `isTeacher`, etc.).'],
              ['src/context/SocketContext.jsx', 'WebSocket Context', 'Manages live Socket.io connection, real-time message stream, unread message badges, online presence counts, and typing indicators.'],
              ['src/layouts/DashboardLayout.jsx', 'Universal App Shell', 'Unified shell with permanent 64px mini-rail / 288px sidebar, notification center, profile card, and zero-scroll container preventing page jitter.'],
              ['src/components/ProtectedRoute.jsx', 'Security Guard', 'Route gatekeeper checking JWT validity and user role; redirects unauthenticated users to `/login` with return intent.'],
              ['src/components/notifications/NotificationCenter.jsx', 'Notification Bell', 'Dropdown notification panel with audio alert chime, unread count pill, and real-time socket notification ingestion.'],
              ['src/components/chat/FloatingChatButton.jsx', 'Floating Shortcut', 'Bottom-right floating bubble showing unread message count and providing 1-click navigation to `/messages`.'],
              ['src/pages/Login.jsx', 'Authentication Page', 'Enterprise login interface featuring demo role switcher for 1-click testing of student, teacher, HOD, and admin personas.'],
              ['src/pages/DashboardOverview.jsx', 'Executive Dashboard', 'Role-sensitive dashboard displaying today’s class schedule, quick action tiles, live campus statistics, and attendance summary.'],
              ['src/pages/communication/MessagesPage.jsx', 'Messaging Suite', 'Side-by-side chat workspace with contacts search, unread filters, instant pin/unpin, real-time typing, read double-ticks, and in-chat keyword search.'],
              ['src/pages/timetables/TimetablePage.jsx', 'Master Timetable', 'Full weekly matrix viewer allowing admins and HODs to view and edit department recurring class schedules.'],
              ['src/pages/timetables/DailyScheduleView.jsx', 'Live Class Board', 'Real-time daily schedule board displaying live session codes, pause badges, substitution details, and role-gated absentee auditing.'],
              ['src/pages/curriculum/StudentCurriculumPage.jsx', 'Curriculum Ledger', 'Interactive monthly calendar with color-coded day markers (green/red/amber), subject breakdown, and statutory 75% defaulter warnings.'],
              ['src/pages/teacher/ClassroomScanner.jsx', 'Faculty Scanner', 'Mobile and webcam scanner enabling faculty to scan student dynamic QR passes directly inside the classroom.'],
              ['src/pages/kiosk/ClassroomKioskScanner.jsx', 'Podium Terminal', 'High-visibility fullscreen dynamic QR presenter designed for classroom podium projector or desktop screens.'],
              ['src/pages/student/StudentQrPage.jsx', 'Student Mobile Pass', 'Dynamic single-use student QR pass generator with rolling 10-second countdown timer for podium terminal scanning.'],
              ['src/pages/attendance/AttendanceReportPage.jsx', 'Attendance Intelligence', 'Institute-wide attendance ledger with department defaulter tables, custom date range filters, and Excel export.'],
              ['src/pages/examinations/InternalMarksPage.jsx', 'Internal Assessment', 'CIA marks entry matrix with automated percentage calculation, component breakdown, and batch grade submission.'],
              ['src/pages/examinations/SemesterGradeCardPage.jsx', 'Official Grade Card', 'Formal printable student transcript showing subject credits, grade points, SGPA, and cumulative CGPA.'],
              ['src/pages/materials/MaterialsPage.jsx', 'LMS Resource Hub', 'Categorized lecture notes, syllabus PDF viewer, video links, and download trackers sorted by department and subject.'],
              ['src/pages/assignments/AssignmentsPage.jsx', 'Assignment Gateway', 'Assignment distribution, deadline countdowns, student file submission, and grading rubric interfaces.'],
              ['src/pages/quizzes/QuizzesPage.jsx', 'Assessment Engine', 'Timed formative quizzes, instant score calculation, question review, and performance analytics.'],
              ['src/pages/mentorship/MentorshipPage.jsx', 'Mentorship Advisory', 'Caseload roster for faculty mentors, student risk indicators, 1-on-1 counseling tickets, and confidential notes.'],
              ['src/pages/analytics/AnalyticsPage.jsx', 'Academic Intelligence', 'Predictive risk dashboard, attendance decay charts, grade distributions, and department benchmark metrics.'],
            ],
            [26, 20, 54]
          ),

          spacing(200, 140),

          // =========================================================================
          // SECTION 4: DEEP DIVE: IMPLEMENTED PRODUCTION MODULES (PHASE 1)
          // =========================================================================
          createHeading1('4. Deep-Dive: Implemented Production Modules (Phase 1)'),
          createPara(
            'Phase 1 of Acadex has completed core operational loops with production-grade stability, rigorous security testing, and automated workflows:'
          ),

          createHeading2('4.1 High-Security Dynamic QR Attendance System'),
          createPara(
            'The dynamic attendance system completely eliminates proxy attendance through a dual-scanning cryptographic protocol:'
          ),
          createBullet('Classroom Podium Kiosk Mode (`/kiosk`)', 'Projected onto classroom screen. Displays a rotating cryptographic QR code refreshed every 5–10 seconds. Students scan using their smartphones.'),
          createBullet('Faculty Mobile Scanner Mode (`/teacher/scanner`)', 'In smaller tutorial batches or lab sessions, the teacher opens the scanner camera and scans individual dynamic student passes.'),
          createBullet('Student Dynamic Pass (`/student/qr`)', 'Generates single-use rotating student passes with visual countdown timers. Tokens are invalidated immediately upon scan.'),
          createBullet(),

          createHeading2('4.2 Automated 07:00 AM Daily Timetable Generator'),
          createBullet(),
          createBullet(),
          createBullet(),
          createBullet('Operational Class Pausing', 'Allows department heads to pause specific class slots (e.g., guest lectures or technical symposiums) with operational reason badges.'),
          createHeading2('4.3 Role-Gated Privacy Auditing & Absentee Protection'),
          createBullet('Student Privacy Boundary', 'On the Class Timetable page (`/timetables`), students see only class completion badges. Classmate attendance rosters, present counts, and absentee lists are strictly hidden.'),
          createBullet('Backend RBAC Guarding', 'The endpoint `/api/timetable/daily-classes/:id/absentees` is protected with `authorizeRoles(\'teacher\', \'hod\', \'college_admin\', \'super_admin\')` returning `403 Forbidden` if invoked with student credentials.'),
          createBullet(),

          createHeading2('4.4 Real-Time Direct Academic Messaging & Mentorship'),
          createBullet(),
          createBullet(),
          createBullet(),

          createHeading2('4.5 Interactive Course Curriculum & Attendance Calendar Ledger'),
          createBullet('Visual Attendance Calendar', 'Color-coded monthly ledger showing green (present), red (absent), and amber (late/leave) dates.'),
          createBullet(),

          spacing(200, 140),

          // =========================================================================
          // SECTION 5: MAJOR PROJECT PILLAR 1: MARKS & CIA AUTOMATION
          // =========================================================================
          createHeading1('5. Major Project Pillar 1: Advanced CIA & Marks Automation'),
          createPara(
            'Continuous Internal Assessment (CIA) is the cornerstone of autonomous college evaluation. The Acadex marks automation engine replaces manual grade entry with an audited, Outcome-Based Education (OBE) workflow.'
          ),

          createHeading2('5.1 Comprehensive Multi-Component Weightage Framework'),
          createPara(
            'The system supports customizable institutional weightage rules. The default autonomous university standard is formalized as follows:'
          ),

          createStyledTable(
            ['Assessment Component', 'Institutional Weightage', 'Autonomous Evaluation & Governance Workflow'],
            [
              ['CIA-1 (Midterm Exam 1)', '25% Weightage', 'Centralized hall-allocated theory exam. Barcoded OMR / digital marks entry with double-blind re-verification.'],
              ['CIA-2 (Midterm Exam 2)', '25% Weightage', 'Higher-order conceptual examination. Automatic best-of-2 or average calculation based on department policy.'],
              ['Continuous Quizzes', '15% Weightage', 'Bi-weekly automated CBT micro-quizzes. Instant automated grade ingestion into student CIA ledger.'],
              ['Assignments & Case Studies', '15% Weightage', 'Rubrics-based evaluation (0-10 scale per rubric item). Late submission penalty auto-deductions.'],
              ['Classroom Participation & Attendance', '10% Weightage', 'Dynamic curve: >90% attendance = 10 pts, 85-90% = 8 pts, 80-85% = 6 pts, 75-80% = 4 pts, <75% = 0 pts.'],
              ['Lab / Practical Assessment', '10% Weightage', 'Continuous experiment evaluation: viva-voce, execution, and lab record verification.'],
            ],
            [26, 20, 54]
          ),

          spacing(100, 80),
          createHeading2('5.2 Outcome-Based Education (OBE) & Bloom\'s Taxonomy Mapping'),
          createBullet('Course Outcome (CO) Mapping', 'Every exam question and assignment rubric item is tagged with specific Course Outcomes (CO1: Remember, CO2: Understand, CO3: Apply, CO4: Analyze, CO5: Evaluate, CO6: Create).'),
          createBullet('Program Outcome (PO) Attainment', 'System automatically calculates direct attainment levels against Program Outcomes (PO1 to PO12) required for NBA and NAAC tier-1 accreditation.'),
          createBullet(),
          createBullet('Intelligent Grace Marks Rule Engine', 'Configurable edge-case rules (e.g. students within 1-2 marks of passing grade with >=85% attendance automatically flagged for Academic Council review).'),
          spacing(200, 140),

          // =========================================================================
          // SECTION 6: MAJOR PROJECT PILLAR 2: MULTI-ASPECT AI RISK ENGINE
          // =========================================================================
          createHeading1('6. Major Project Pillar 2: Multi-Aspect AI Student Risk Analysis Engine'),
          createPara(
            'Rather than reacting after students fail semester exams, Acadex introduces a multi-aspect predictive intelligence engine that continuously updates a Multi-Factor Risk Index (MFRI).'
          ),

          createCalloutBox(
            'Multi-Factor Risk Index (MFRI) Mathematical Formulation',
            'MFRI = w1*(1 - AttendanceRate) + w2*(AttendanceDecayVelocity) + w3*(1 - CIAPercentage) + w4*(AssignmentLagFactor) + w5*(MentorshipDistressScore) + w6*(PrerequisiteGapIndex)\nWhere weights w1..w6 sum to 1.0 (e.g. w1=0.25, w2=0.20, w3=0.25, w4=0.10, w5=0.10, w6=0.10). An MFRI score > 0.65 flags Critical Risk, 0.40 - 0.65 flags Moderate Risk, < 0.40 flags Healthy Standing.'
          ),

          spacing(100, 80),
          createHeading2('6.1 Detailed Breakdown of the 6 Risk Dimensions'),
          createBullet(),
          createBullet(),
          createBullet(),
          createBullet(),
          createBullet('Dimension 5 — Prerequisite Failure Propagation', 'Identifies historical foundational failures (e.g., failing Mathematics-I predicting 82% failure probability in Signal & Systems).'),
          createBullet(),

          spacing(100, 80),
          createHeading2('6.2 Automated Prescriptive Interventions'),
          createStyledTable(
            ['Risk Severity Level', 'Index Range', 'Prescribed Autonomous Institutional Action'],
            [
              ['🟢 Low / Healthy', '0.00 – 0.39', 'Routine peer encouragement, optional honors / research elective recommendations.'],
              ['🟡 Moderate Risk', '0.40 – 0.64', 'Automated in-app nudge to student; mentor notified to schedule check-in; curated study materials recommended.'],
              ['🔴 Critical / Severe Risk', '0.65 – 1.00', 'Automatic priority counseling ticket created; SMS/WhatsApp alert sent to Parent/Guardian; compulsory remedial class enrollment.'],
            ],
            [22, 18, 60]
          ),

          spacing(200, 140),

          // =========================================================================
          // SECTION 7: MAJOR PROJECT PILLAR 3: OMNICHANNEL NOTIFICATION GATEWAY
          // =========================================================================
          createHeading1('7. Major Project Pillar 3: Omnichannel Notification Gateway'),
          createPara(
            'Ensures zero communication latency between institution, students, faculty, and parents by combining in-app websockets, web push notifications, and phone-number-based messaging.'
          ),

          createStyledTable(
            ['Channel Medium', 'Delivery Infrastructure', 'Target Operational Scenarios'],
            [
              ['In-App WebSocket Sync', 'Socket.io bidirectional rooms', 'Live chat messages, real-time QR attendance verification, instant in-session alerts.'],
              ['Web Push Notifications', 'Service Worker / Web Push API (VAPID)', 'Device lock-screen notifications when browser is minimized or closed (e.g., class starting in 10 mins).'],
              ['WhatsApp Business API', 'Meta Cloud API / Gupshup Gateway', 'Morning timetable dispatch (07:00 AM), immediate absence alerts to parents ("Your ward missed Physics at 09:00 AM"), fee/exam receipts.'],
              ['SMS (Transactional)', 'Twilio / Fast2SMS Enterprise API', 'High-priority emergency alerts, OTP verification, critical attendance debarment warning messages.'],
              ['Transactional Email', 'SendGrid / AWS SES / Nodemailer', 'Official semester grade cards, attendance deficit warnings, password recovery, examination hall tickets.'],
            ],
            [22, 28, 50]
          ),

          spacing(200, 140),

          // =========================================================================
          // SECTION 8: MAJOR PROJECT PILLAR 4: PROCTORED CBT ENGINE
          // =========================================================================
          createHeading1('8. Major Project Pillar 4: High-Stakes Proctored CBT Engine'),
          createPara(
            'Enables secure, high-concurrency midterms and entrance examinations with offline-resilient client caching and multi-layer proctoring enforcement.'
          ),

          createStyledTable(
            ['Examination Module', 'Technical Architecture', 'Anti-Cheating & Examination Integrity Controls'],
            [
              ['Question Engine', 'IndexedDB offline caching + LaTeX MathJax', 'Supports MCQ, MSQ, Numerical Value, and Code Snippets. Randomized question sequences and permuted answer options per candidate.'],
              ['Browser Lockdown', 'HTML5 Fullscreen API + Focus Listeners', 'Enforces fullscreen lock; tracks Alt+Tab and window defocus events; triggers auto-submission after 3 unauthorized tab switches.'],
              ['Webcam AI Proctoring', 'TensorFlow.js / MediaPipe Face Detection', 'Periodic webcam snapshots running client-side face verification: flags multiple faces, looking away, or candidate absence.'],
              ['Audio Decibel Monitor', 'Web Audio API AnalyzerNode', 'Detects room speech anomalies, whispers, or phone speaker activity exceeding baseline ambient threshold.'],
              ['Clipboard & Peripheral Lock', 'Browser Event Interceptors', 'Disables Right-Click, Cut/Copy/Paste, PrintScreen, DevTools shortcuts (F12, Ctrl+Shift+I), and multi-monitor setups.'],
              ['Auto-Grading & Scoring', 'Distributed Worker Queue', 'Instant objective question grading with customizable negative marking rules (-0.25, -0.33), difficulty index calculation, and percentile ranking.'],
            ],
            [22, 28, 50]
          ),

          spacing(200, 140),

          // =========================================================================
          // SECTION 9: DATABASE SCHEMA & PERFORMANCE INDEXES
          // =========================================================================
          createHeading1('9. Database Schema & Performance Indexing'),
          createPara(
            'Acadex utilizes optimized MongoDB collections with compound indexes to sustain high concurrency during morning timetable generation, live attendance scans, and exam submissions.'
          ),

          createStyledTable(
            ['Collection Name', 'Primary Keys & References', 'Critical Compound Indexes', 'Performance Target'],
            [
              ['users', '_id, email, role, department', '{ email: 1 } (Unique), { department: 1, role: 1 }', '< 5ms authenticated lookup'],
              ['studentprofiles', '_id, user, batch, mentor, rollNumber', '{ batch: 1 }, { rollNumber: 1 } (Unique), { mentor: 1 }', '< 8ms batch student roster'],
              ['timetables', '_id, department, batch, subject, teacher, dayOfWeek', '{ batch: 1, dayOfWeek: 1 }, { teacher: 1, dayOfWeek: 1 }', 'Zero-conflict schedule matrix'],
              ['dailyclasses', '_id, timetable, date, status, teacher, batch', '{ date: 1, batch: 1 }, { date: 1, teacher: 1 }', '< 10ms 07:00 AM class board'],
              ['attendancesessions', '_id, dailyClass, sessionCode, secretSeed, expiresAt', '{ dailyClass: 1 }, { expiresAt: 1 } (TTL Index)', 'Automatic TTL expiration'],
              ['attendancerecords', '_id, dailyClass, student, session, status', '{ dailyClass: 1, student: 1 } (Unique compound)', 'Idempotent single-scan guarantee'],
              ['messages', '_id, sender, recipient, isMentorMessage, read', '{ sender: 1, recipient: 1, createdAt: -1 }', '< 12ms conversation history'],
              ['internalmarks', '_id, student, subject, semester, component', '{ student: 1, subject: 1, semester: 1 } (Unique)', '< 15ms grade card rendering'],
              ['examattempts', '_id, exam, student, startTime, submittedAt', '{ exam: 1, student: 1 } (Unique)', 'High-throughput answer ingestion'],
            ],
            [18, 28, 36, 18]
          ),

          spacing(200, 140),

          // =========================================================================
          // SECTION 10: 16-WEEK MAJOR PROJECT EXECUTION ROADMAP
          // =========================================================================
          createHeading1('10. 16-Week Major Project Execution Roadmap & Sprint Plan'),
          createPara(
            'A structured 16-week engineering roadmap designed for final year major project delivery, comprehensive performance benchmarking, and formal institutional defense.'
          ),

          createStyledTable(
            ['Project Sprint', 'Timeline', 'Target Deliverables & Milestones', 'Success Criteria'],
            [
              ['Sprint 1: Assessment Core', 'Weeks 1 – 3', 'Continuous Internal Assessment (CIA) marks entry matrix, multi-component weightage calculator, Bloom’s taxonomy CO/PO attainment engine.', '100% automated calculation of grade sheets with zero manual transcription errors.'],
              ['Sprint 2: AI Risk Intelligence', 'Weeks 4 – 6', 'Multi-Factor Risk Index (MFRI) model training, predictive attendance decay detector, automated prescriptive intervention ticketing.', 'Accurate detection of at-risk students with >= 88% precision at least 3 weeks before midterms.'],
              ['Sprint 3: Omnichannel Gateway', 'Weeks 7 – 9', 'Service Worker Web Push notification, Twilio / WhatsApp Cloud API integration for parent alerts and daily 07:00 AM schedule dispatch.', 'Instant multi-channel delivery within < 3 seconds of triggering event.'],
              ['Sprint 4: Proctored CBT Engine', 'Weeks 10 – 13', 'High-concurrency exam runtime, fullscreen lock harness, client-side webcam face monitoring, audio decibel tracking, automated grading.', 'Successfully execute mock proctored examination with 200+ concurrent students without server crash.'],
              ['Sprint 5: Hardening & Defense', 'Weeks 14 – 16', 'Load testing (10,000 requests/min via k6), database indexing optimization, final major project thesis documentation, and viva defense.', 'Sub-150ms API response time under peak load, comprehensive thesis submitted.'],
            ],
            [20, 15, 45, 20]
          ),

          spacing(200, 140),

          // =========================================================================
          // SECTION 11: SECURITY, COMPLIANCE & ANTI-CHEATING HARNESS
          // =========================================================================
          createHeading1('11. Security, Institutional Compliance & Anti-Cheating Harness'),
          createPara(
            'Acadex implements defense-in-depth across every architectural boundary:'
          ),
          createBullet(),
          createBullet(),
          createBullet(),
          createBullet(),

          spacing(200, 140),

          // =========================================================================
          // SECTION 12: CONCLUSION & INSTITUTIONAL VISION
          // =========================================================================
          createHeading1('12. Conclusion & Institutional Vision'),
          createPara(
            'Acadex represents an autonomous academic operating system designed for 21st-century higher education. By combining zero-proxy dynamic attendance verification, autonomous schedule synchronization, auditable real-time mentorship messaging, and upcoming Phase 2 pillars (CIA Marks Automation, Multi-Aspect AI Risk Analytics, Omnichannel WhatsApp/SMS messaging, and High-Stakes Proctored CBT Testing), Acadex delivers an unmatched institutional blueprint for academic excellence and student success.'
          ),
          spacing(100, 100),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: '— End of Architectural Specification & Major Project Roadmap Document —',
                italic: true,
                size: 18,
                color: COLOR_MUTED,
                font: 'Segoe UI',
              }),
            ],
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outputPath = path.resolve('d:/Campus360/Acadex_Project_Documentation_and_Major_Project_Plan.docx');
  fs.writeFileSync(outputPath, buffer);
  console.log(`Exhaustive Master Document generated successfully at: ${outputPath} (${buffer.length} bytes)`);
}

buildFullDocx().catch((err) => {
  console.error('Error generating document:', err);
  process.exit(1);
});
