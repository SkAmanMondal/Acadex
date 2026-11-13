import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { io } from 'socket.io-client';
import api from '../../services/api';
import { playSuccessSound, playDuplicateSound, playWrongStudentSound } from '../../utils/scanSounds';
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  Users,
  Play,
  Square,
  ShieldCheck,
  RefreshCw,
  LogOut,
  Maximize2,
  Minimize2,
  Keyboard,
  Upload,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ClassroomKioskScanner() {
  const [sessionCodeInput, setSessionCodeInput] = useState('');
  const [activeSession, setActiveSession] = useState(null);
  const [sessionEndedByTeacher, setSessionEndedByTeacher] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(600);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedRecords, setScannedRecords] = useState([]);
  const [scanFeedback, setScanFeedback] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Hardware acceleration & camera selection
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [activeTab, setActiveTab] = useState('webcam'); // 'webcam' | 'manual'
  const [manualToken, setManualToken] = useState('');

  const html5QrCodeRef = useRef(null);
  const lastScannedTokenRef = useRef('');
  const socketRef = useRef(null);

  // Initialize socket for kiosk podium terminal
  useEffect(() => {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
    socketRef.current = newSocket;

    // Listen for teacher ending the session early from phone
    newSocket.on('attendance_session_ended', (data) => {
      stopScanner();
      playTone(400, 0.35);
      setSessionEndedByTeacher(data);
    });

    // Listen for teacher cancelling the session before activation
    newSocket.on('attendance_session_cancelled', () => {
      stopScanner();
      setError('This attendance session was cancelled by the instructor.');
      setActiveSession(null);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Audio tone generator
  const playTone = (freq = 880, duration = 0.12) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  };

  // Timer countdown
  useEffect(() => {
    if (!activeSession || remainingSeconds <= 0) return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          stopScanner();
          setError('Session window has closed. The 10-minute scan limit was reached.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession, remainingSeconds]);

  // Connect to session using 6-character code
  const handleConnectSession = async (e) => {
    if (e) e.preventDefault();
    if (!sessionCodeInput.trim()) {
      setError('Please enter the 6-character session code');
      return;
    }

    setLoading(true);
    setError('');
    setSessionEndedByTeacher(null);
    try {
      const cleanCode = sessionCodeInput.trim().toUpperCase();
      const res = await api.get(`/attendance/kiosk/session/${cleanCode}`);
      if (res.data?.success) {
        const { session, remainingSeconds: remSec } = res.data.data;
        setActiveSession(session);
        setRemainingSeconds(remSec);
        setScannedRecords([]);

        // Join socket room for this session
        socketRef.current?.emit('join_attendance_session', cleanCode);

        // Discover camera and start
        await startKioskCamera(session.sessionCode);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired session code');
    } finally {
      setLoading(false);
    }
  };

  const handleScanProcess = async (token, code) => {
    if (!token) return;
    if (lastScannedTokenRef.current === token) return;
    lastScannedTokenRef.current = token;
    setTimeout(() => {
      lastScannedTokenRef.current = '';
    }, 2500);

    try {
      const res = await api.post('/attendance/kiosk/scan', {
        sessionCode: code,
        qrToken: token,
      });

      if (res.data?.success) {
        const record = res.data.data;
        playSuccessSound(); // ✨ Ascending bright chime
        setScanFeedback({
          type: 'success',
          message: `Attendance Recorded: ${record.student.name} (${record.student.rollNumber})`,
        });
        setScannedRecords((prev) => [record, ...prev]);
        setManualToken('');
      }
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.message || 'Invalid or duplicate attendance scan';
      const isDuplicate = status === 409 || /already/i.test(msg);
      const isWrongStudent = status === 403 || /not enrolled|batch|invalid student/i.test(msg);

      if (isDuplicate) {
        playDuplicateSound(); // ⚠️ Double warning chime
        setScanFeedback({
          type: 'warning',
          message: msg,
        });
      } else if (isWrongStudent) {
        playWrongStudentSound(); // 🛑 Low error buzz
        setScanFeedback({
          type: 'error',
          message: `Batch Mismatch: ${msg}`,
        });
      } else {
        playWrongStudentSound(); // 🛑 Low error buzz
        setScanFeedback({
          type: 'error',
          message: msg,
        });
      }
    }
  };

  const startKioskCamera = async (code) => {
    try {
      setIsScanning(true);
      setError('');

      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop();
        } catch (e) {}
      }

      // Explicit native permission request
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      stream.getTracks().forEach((t) => t.stop());

      const devices = await Html5Qrcode.getCameras();
      setCameras(devices);
      const cameraId = devices.length > 0 ? devices[0].id : { facingMode: 'user' };

      const html5QrCode = new Html5Qrcode('kiosk-qr-reader', {
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true, // Native hardware acceleration!
        },
      });
      html5QrCodeRef.current = html5QrCode;

      // Dynamic generous scanning box (80% of viewport)
      const qrboxFunction = (viewfinderWidth, viewfinderHeight) => {
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
        const qrboxSize = Math.floor(minEdge * 0.78);
        return { width: qrboxSize, height: qrboxSize };
      };

      await html5QrCode.start(
        cameraId,
        {
          fps: 25, // High responsive frame-rate
          qrbox: qrboxFunction,
          aspectRatio: 1.777778, // 16:9 widescreen
        },
        (decodedText) => {
          handleScanProcess(decodedText, code);
        },
        () => {}
      );
    } catch (camErr) {
      console.warn('Kiosk Camera Error:', camErr);
      setError('Unable to activate webcam. Please allow camera permissions in your browser or use Manual Entry.');
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (e) {}
    }
    setIsScanning(false);
    setActiveSession(null);
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Kiosk Top Navigation */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-extrabold flex items-center justify-center text-sm shadow-lg shadow-blue-500/30">
            360
          </div>
          <div>
            <h1 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>Acadex Classroom Kiosk</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-400 border border-blue-800">
                Podium Terminal
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">Classroom Computer Attendance Mode (No Teacher Login Required)</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to={(localStorage.getItem('acadex_token') || localStorage.getItem('campus360_token')) ? '/' : '/login'}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition border border-slate-700 flex items-center gap-1.5 shadow-sm"
          >
            <span>{(localStorage.getItem('acadex_token') || localStorage.getItem('campus360_token')) ? '← Back to Dashboard' : 'Exit Kiosk / Sign In'}</span>
          </Link>
        </div>
      </header>

      {/* Main Kiosk Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {!activeSession ? (
          /* State 1: Enter Session Code Screen */
          <div className="max-w-lg w-full mx-auto my-auto py-12 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6">
              <div className="w-16 h-16 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                <Camera size={32} />
              </div>

              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white">Enter Classroom Session Code</h2>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Enter the 6-character code activated by the teacher from their phone or dashboard to start scanning.
                </p>
              </div>

              {error && (
                <div className="p-3.5 bg-rose-950/50 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center justify-center gap-2">
                  <AlertCircle size={15} />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleConnectSession} className="space-y-4">
                <div>
                  <input
                    type="text"
                    maxLength="6"
                    value={sessionCodeInput}
                    onChange={(e) => setSessionCodeInput(e.target.value.toUpperCase())}
                    placeholder="e.g. XK94P2"
                    required
                    className="w-full text-center font-mono text-3xl font-extrabold tracking-widest py-3.5 bg-slate-950 border border-slate-700 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase placeholder:text-slate-600"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || sessionCodeInput.trim().length === 0}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? <RefreshCw className="animate-spin" size={16} /> : <Play size={16} />}
                  <span>Connect & Activate Scanner</span>
                </button>
              </form>

              <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                <span className="font-semibold text-slate-300">How it works:</span> The faculty member taps "Start Session" on their personal phone/laptop, displays the 6-character code, and the podium PC scans all student QR passes without storing teacher passwords.
              </div>
            </div>
          </div>
        ) : (
          /* State 2: Active Kiosk Scanning Screen */
          <div className="flex-1 flex flex-col gap-4">
            {/* Session Info Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="bg-blue-950/80 border border-blue-800/80 px-4 py-2 rounded-xl text-center">
                  <div className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Session Code</div>
                  <div className="font-mono text-xl font-black text-white">{activeSession.sessionCode}</div>
                </div>

                <div>
                  <h2 className="text-base font-bold text-white">
                    {activeSession.subject?.name} ({activeSession.subject?.code})
                  </h2>
                  <div className="text-xs text-slate-400">
                    {activeSession.batch?.name} • Faculty: Prof. {activeSession.teacher?.name} • Room: {activeSession.classroom?.roomNumber}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800">
                  <Clock size={16} className={remainingSeconds < 60 ? 'text-rose-500 animate-pulse' : 'text-blue-400'} />
                  <span className="font-mono text-sm font-bold text-white">{formatTime(remainingSeconds)}</span>
                </div>

                <button
                  onClick={stopScanner}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Square size={14} />
                  <span>End Session</span>
                </button>
              </div>
            </div>

            {/* Error or Warning */}
            {error && (
              <div className="p-3.5 bg-rose-950/50 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            {/* Scanner Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
              {/* Left Column: High-Performance Camera Stream */}
              <div className="lg:col-span-8 flex flex-col gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex-1 flex flex-col justify-between">
                  {/* Mode Selector */}
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex gap-2 text-xs font-semibold">
                      <button
                        onClick={() => setActiveTab('webcam')}
                        className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition shrink-0 ${
                          activeTab === 'webcam' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        <Camera size={14} className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} />
                        <span>High-Speed Webcam</span>
                      </button>
                      <button
                        onClick={() => setActiveTab('manual')}
                        className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition shrink-0 ${
                          activeTab === 'manual' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        <Keyboard size={14} className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} />
                        <span>Manual / USB Scanner</span>
                      </button>
                    </div>

                    <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      <span>Ready for Student Passes</span>
                    </span>
                  </div>

                  {/* High-Performance Camera Viewport */}
                  {activeTab === 'webcam' ? (
                    <div className="relative overflow-hidden rounded-2xl bg-black aspect-video flex items-center justify-center border-2 border-slate-800 shadow-2xl">
                      <div id="kiosk-qr-reader" className="w-full h-full" />
                    </div>
                  ) : (
                    <div className="p-6 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                      <label className="block text-xs font-semibold text-slate-300">
                        Scan with USB Barcode Reader or Paste QR Token
                      </label>
                      <input
                        type="text"
                        autoFocus
                        value={manualToken}
                        onChange={(e) => setManualToken(e.target.value)}
                        placeholder="Scan or paste student token..."
                        className="w-full p-3 font-mono text-xs bg-slate-900 border border-slate-700 rounded-xl text-white"
                      />
                      <button
                        onClick={() => handleScanProcess(manualToken.trim(), activeSession.sessionCode)}
                        disabled={!manualToken.trim()}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs cursor-pointer disabled:opacity-50"
                      >
                        Submit Attendance Pass
                      </button>
                    </div>
                  )}

                  {/* Immediate Multi-State Feedback Banner with Sound Correlated Colors */}
                  {scanFeedback && (
                    <div
                      className={`mt-4 p-4 rounded-2xl text-xs font-extrabold flex items-center gap-3 shadow-xl transition-all animate-fade-in ${
                        scanFeedback.type === 'success'
                          ? 'bg-emerald-950/90 text-emerald-200 border border-emerald-600/80 shadow-emerald-900/30'
                          : scanFeedback.type === 'warning'
                          ? 'bg-amber-950/90 text-amber-200 border border-amber-600/80 shadow-amber-900/30'
                          : 'bg-rose-950/90 text-rose-200 border border-rose-600/80 shadow-rose-900/30'
                      }`}
                    >
                      {scanFeedback.type === 'success' ? (
                        <CheckCircle2 size={22} className="text-emerald-400 shrink-0" />
                      ) : scanFeedback.type === 'warning' ? (
                        <AlertTriangle size={22} className="text-amber-400 shrink-0" />
                      ) : (
                        <AlertCircle size={22} className="text-rose-400 shrink-0" />
                      )}
                      <div className="flex-1">
                        <span className="block text-[10px] uppercase font-bold tracking-wider opacity-75">
                          {scanFeedback.type === 'success'
                            ? '✓ Verified Present'
                            : scanFeedback.type === 'warning'
                            ? '⚠️ Already Marked'
                            : '✕ Verification Failed'}
                        </span>
                        <span className="text-xs">{scanFeedback.message}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Live Attendee Roll-Call List */}
              <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Users size={18} className="text-blue-400" />
                      <h3 className="text-sm font-bold text-white">Present Students</h3>
                    </div>
                    <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-blue-950 text-blue-400 border border-blue-800">
                      {scannedRecords.length} Verified
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                    {scannedRecords.length === 0 ? (
                      <div className="text-center py-16 text-slate-500 text-xs">
                        Awaiting student scans... Point student mobile screens at the camera.
                      </div>
                    ) : (
                      scannedRecords.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs"
                        >
                          <div>
                            <div className="font-bold text-white">{item.student.name}</div>
                            <div className="text-slate-400 font-mono text-[10px]">{item.student.rollNumber}</div>
                          </div>
                          <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 font-mono">
                            <CheckCircle2 size={12} />
                            {new Date(item.scannedAt).toLocaleTimeString()}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 text-[10px] text-slate-500 text-center">
                  Protected by Acadex HMAC Single-Use Attendance Verification
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Instructor Remote Termination Alert (Triggered from Teacher's Phone) */}
      {sessionEndedByTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-3xl p-6 text-center space-y-5 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
              <Square size={28} fill="currentColor" />
            </div>

            <div className="space-y-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                Session Concluded by Instructor
              </span>
              <h3 className="text-xl font-bold text-white">Attendance Closed by Faculty</h3>
              <p className="text-xs text-slate-300">
                {sessionEndedByTeacher.teacherName || 'The instructor'} ended this session early from their mobile device.
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total Present Students Recorded
              </span>
              <p className="text-3xl font-extrabold text-white mt-1">
                {sessionEndedByTeacher.totalScanned ?? scannedRecords.length}
              </p>
            </div>

            <button
              onClick={() => {
                setSessionEndedByTeacher(null);
                setActiveSession(null);
                setSessionCodeInput('');
              }}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-lg cursor-pointer"
            >
              Ready for Next Lecture Session
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
