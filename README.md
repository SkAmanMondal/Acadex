# Acadex — Smart College Management & Academic Engagement Platform

![Node.js](https://img.shields.io/badge/Node.js-20.x%2B-green.svg)
![React](https://img.shields.io/badge/React-18.x-blue.svg)
![Vite](https://img.shields.io/badge/Vite-5.x-purple.svg)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.x-38bdf8.svg)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47a248.svg)
![Socket.io](https://img.shields.io/badge/Socket.io-4.x-black.svg)
![Cloudinary](https://img.shields.io/badge/Cloudinary-Integrated-blueviolet.svg)
![License](https://img.shields.io/badge/License-MIT-brightgreen.svg)

**Acadex** is a modular enterprise academic operating system designed for modern universities and colleges. It unifies high-speed QR-based classroom attendance, collision-free timetable scheduling, semester grade transcript generation, mentorship advisories, real-time doubt resolution channels, and cloud study material distribution into a single, cohesive, mobile-first experience.

---

## 🌟 Core Platform Modules

### 1. 🛡️ Dynamic HMAC Rolling QR Attendance Engine
- **Rotating HMAC Tokens:** Students generate rolling 60-second encrypted QR passes protected with SHA-256 HMAC cryptographic signatures.
- **Hardware-Accelerated Classroom Scanning:** Supports classroom podium PCs (`/kiosk`) and faculty mobile cameras (`/teacher/scanner`) with sub-500ms multi-frame barcode detection.
- **Auditory & Visual Feedback:** Custom Web Audio synthesizer feedback for successful scans, duplicate scans, and unregistered batch mismatches.
- **Real-Time Attendance Audit:** Automated 75% attendance threshold monitoring with instant defaulter flags.

### 2. 📅 Collision-Free Timetable & Schedule Explorer
- **Multi-Perspective Timetable Matrix:** Inspect weekly and daily recurring schedules filtered across 5 distinct axes: Batch Cohort, Teaching Faculty load, Classroom occupancy, Department, or Day.
- **Collision Detection:** Prevents simultaneous teacher double-booking, classroom over-allocation, and overlapping student lecture slots.

### 3. 🎓 Examinations & Continuous Internal Assessment (CIA)
- **Continuous Internal Assessment:** Faculty entry of CIA Components (Unit Tests, Assignments, Class Attendance, Seminars) with automatic weighted aggregation.
- **Semester Transcript & Grade Card:** Generates official institutional grade sheets with SGPA/CGPA calculations, letter grading scales, and PDF download options.

### 4. 💬 Direct Academic Messaging & Live Doubt Resolution
- **Multi-Factor Roster Filtering:** Filter by Mentors, Assigned Faculty, Department HOD, and Peer Mentees with unread indicators and pinned conversations.
- **Socket.io Live Sync:** Real-time message streaming, typing indicators, read receipts, and online presence tracking.
- **Adaptive Mobile Chat:** Full-screen single-pane mobile chat with quick `< Chats` back navigation.

### 5. 📚 Learning Resources & Cloudinary Cloud Storage
- **Hybrid Storage Architecture:** Integrated with **Cloudinary CDN** for streaming cloud uploads of lecture slides, PDFs, notes, and assignment solutions, backed by automatic local disk fallback.
- **Assignment Submissions & Grading:** Student solution submissions, late submission tracking, and faculty evaluation ledger.

### 6. 📱 Native Mobile-First Optimization
- **Responsive Layout:** Dynamic bottom navigation bar for quick thumb-navigation (`Home`, `Schedule`, `Chat`, `Scanner`, `Menu`).
- **Zero-Friction Desktop Sidebar:** Desktop sidebar cleanly hides on mobile devices (`hidden md:flex`) so content occupies 100% of the screen width.

---

## 🏗️ Repository Architecture

```
Acadex/
├── client/                     # Frontend Application (React 18 + Vite + Tailwind CSS)
│   ├── public/                 # Static assets & webmanifest
│   ├── src/
│   │   ├── components/         # Reusable UI widgets, modals, notification center
│   │   ├── context/            # AuthContext, SocketContext
│   │   ├── layouts/            # DashboardLayout (Responsive header, sidebar & bottom nav)
│   │   ├── pages/              # Role-specific dashboard views, kiosks, timetables, chat
│   │   ├── services/           # Axios API instance with JWT interceptors
│   │   └── utils/              # Sound generators, formatting helpers
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── server/                     # Backend API (Node.js Express Modular Monolith + Socket.io)
│   ├── src/
│   │   ├── config/             # MongoDB connection, Socket.io, Cloudinary SDK
│   │   ├── middleware/         # JWT authentication, role authorization, error handling
│   │   ├── modules/            # Domain modules (auth, academics, attendance, timetable, etc.)
│   │   ├── services/           # Storage service (Cloudinary upload stream & local disk fallback)
│   │   ├── utils/              # Seeder, daily scheduler, response formatters
│   │   ├── app.js              # Express application configuration
│   │   └── server.js           # HTTP + WebSocket server entry point
│   ├── package.json
│   └── .env.example
│
├── .gitignore                  # Git ignore rules for node_modules, .env, dist, and uploads
└── README.md                   # Complete platform documentation & Render hosting guide
```

---

## ⚡ Quick Start & Local Setup

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or later
- [MongoDB Atlas](https://www.mongodb.com/atlas) cluster or local MongoDB instance
- [Cloudinary Account](https://cloudinary.com/) (Free tier works perfectly)

---

### 1. Backend Server Setup

```bash
# 1. Navigate to server directory
cd server

# 2. Install dependencies
npm install

# 3. Create your .env file
cp .env.example .env
```

Edit `server/.env` with your credentials:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/acadex?retryWrites=true&w=majority
JWT_SECRET=acadex_jwt_access_secret_key_2026
JWT_REFRESH_SECRET=acadex_jwt_refresh_secret_key_2026
JWT_EXPIRES_IN=1d
JWT_REFRESH_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
QR_HMAC_SECRET=acadex_attendance_hmac_secret_2026
UPLOAD_DIR=uploads

# Cloudinary Cloud Storage (Optional - falls back to local disk if omitted)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Seed the database with complete academic departments, courses, teachers, and student rosters:
```bash
npm run seed
```

Start the backend server:
```bash
npm start
# Server listens at http://localhost:5000
```

---

### 2. Frontend Client Setup

```bash
# 1. Navigate to client directory
cd ../client

# 2. Install dependencies
npm install

# 3. Launch Vite development server
npm run dev
# Frontend runs at http://localhost:5173
```

---

## 🔑 Default Test Accounts (Generated via Seeder)

| Role | Email | Password | Details |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@campus360.edu` | `Admin@123` | Institutional Control Panel & Faculty Management |
| **HOD (B.Tech CSE)** | `hod.cse@campus360.edu` | `Teacher@123` | Department Management & Timetable Matrix |
| **HOD (MCA)** | `hod.mca@campus360.edu` | `Teacher@123` | Dr. Sharmistha Sen |
| **Faculty Mentor** | `mentor@campus360.edu` | `Teacher@123` | Mentee Advisory & 1-on-1 Guidance |
| **Student (B.Tech)** | `student.btech@campus360.edu` | `Student@123` | Enrolled B.Tech CSE Student |
| **Student (MCA)** | `student1@campus360.edu` | `Student@123` | Dynamic QR Pass, Curriculum, Grades |

---

## 🚀 How to Host Acadex on Render.com

Render offers free and affordable hosting for both the Node.js backend and the React Vite frontend. Follow these step-by-step instructions:

### Step 1: Deploy the Backend API (`Web Service`)

1. Log in to [Render Dashboard](https://dashboard.render.com/) and click **New +** > **Web Service**.
2. Connect your GitHub repository: `https://github.com/SkAmanMondal/Acadex.git`.
3. Configure the service:
   - **Name:** `acadex-api`
   - **Root Directory:** `server`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node src/server.js`
   - **Instance Type:** `Free`
4. Under **Environment Variables**, add the following keys:
   - `NODE_ENV`: `production`
   - `PORT`: `5000` (Render binds automatically or maps `$PORT`)
   - `MONGODB_URI`: *Your MongoDB Atlas connection string*
   - `JWT_SECRET`: *A secure random string (e.g. 64 characters)*
   - `JWT_REFRESH_SECRET`: *A secure random string*
   - `QR_HMAC_SECRET`: *A secure random string*
   - `CLIENT_URL`: `https://acadex.onrender.com` *(Update with your frontend URL once created)*
   - `CLOUDINARY_CLOUD_NAME`: *Your Cloudinary cloud name*
   - `CLOUDINARY_API_KEY`: *Your Cloudinary API key*
   - `CLOUDINARY_API_SECRET`: *Your Cloudinary API secret*
5. Click **Create Web Service**. Render will deploy your API and provide a URL like `https://acadex-api.onrender.com`.

---

### Step 2: Deploy the Frontend Client (`Static Site`)

1. In Render Dashboard, click **New +** > **Static Site**.
2. Select the same GitHub repository (`Acadex`).
3. Configure the frontend:
   - **Name:** `acadex`
   - **Root Directory:** `client`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
4. Under **Environment Variables**, add:
   - `VITE_API_URL`: `https://acadex-api.onrender.com` *(Your backend Render URL from Step 1)*
5. **Critical Single-Page Application (SPA) Routing Rule:**
   - Go to the **Redirects / Rewrites** tab in your Static Site settings.
   - Add a rewrite rule:
     - **Source:** `/*`
     - **Destination:** `/index.html`
     - **Action:** `Rewrite`
   - *This ensures direct page navigation (e.g., `/messages`, `/timetables`) does not return a 404 on refresh.*
6. Click **Create Static Site**.

---

### Step 3: Link Client & Server CORS

1. Go back to your backend service on Render (`acadex-api`).
2. Update the `CLIENT_URL` environment variable to match your frontend URL (e.g., `https://acadex.onrender.com`).
3. Click **Save Changes** (Render will automatically re-deploy with updated CORS settings).

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
