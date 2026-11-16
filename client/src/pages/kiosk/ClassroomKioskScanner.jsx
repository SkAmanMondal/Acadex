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
  SwitchCamera,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

export default function ClassroomKioskScanner() {
  const [searchParams] = useSearchParams();
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
  const [facingMode, setFacingMode] = useState('user'); // Always first open front camera

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

    // Listen for real-time student scans (from teacher scanner or student app)
    newSocket.on('attendance_student_scanned', (data) => {
      setScannedRecords((prev) => {
        if (
          prev.some(
            (r) =>
              r.student?._id?.toString() === data.student?._id?.toString() ||
              (r.student?.rollNumber && r.student?.rollNumber === data.student?.rollNumber)
          )
        ) {
          return prev;
        }
        return [
          {
            _id: data.recordId || Date.now().toString(),
            student: data.student,
            scannedAt: data.scannedAt || new Date(),
          },
          ...prev,
        ];
      });
      playSuccessSound();
      setScanFeedback({
        type: 'success',
        message: `Attendance Recorded: ${data.student?.name || 'Student'} (${data.student?.rollNumber || 'Enrolled'})`,
      });
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
  const connectToCode = async (rawCode) => {
    if (!rawCode || !rawCode.trim()) {
      setError('Please enter the 6-character session code');
      return;
    }

    setLoading(true);
    setError('');
    setSessionEndedByTeacher(null);
    try {
      const cleanCode = rawCode.trim().toUpperCase();
      const res = await api.get(`/attendance/kiosk/session/${cleanCode}`);
      if (res.data?.success) {
        const { session, remainingSeconds: remSec, scannedRecords: existingRecords } = res.data.data;
        setActiveSession(session);
        setRemainingSeconds(remSec);
        setScannedRecords(existingRecords || []);

        // Join socket room for this session
        socketRef.current?.emit('join_attendance_session', cleanCode);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired session code');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectSession = (e) => {
    if (e) e.preventDefault();
    connectToCode(sessionCodeInput);
  };

  // Auto-connect if code is passed via URL (e.g. /kiosk?code=RSDU8X)
  useEffect(() => {
    const urlCode = searchParams.get('code');
    if (urlCode && urlCode.trim()) {
      const clean = urlCode.trim().toUpperCase();
      setSessionCodeInput(clean);
      connectToCode(clean);
    }
  }, [searchParams]);

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

  const startKioskCamera = async (code, customCameraId) => {
    try {
      setIsScanning(true);
      setError('');

      // 1. Wait for #kiosk-qr-reader to be mounted in the DOM
      let attempts = 0;
      while (!document.getElementById('kiosk-qr-reader') && attempts < 25) {
        await new Promise((resolve) => setTimeout(resolve, 60));
        attempts++;
      }

      if (!document.getElementById('kiosk-qr-reader')) {
        console.warn('kiosk-qr-reader container not mounted in DOM yet.');
        return;
      }

      // 2. Stop any existing scanner cleanly
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            await html5QrCodeRef.current.stop();
          }
          html5QrCodeRef.current.clear();
        } catch (e) {}
      }

      // 3. Determine camera config: custom camera ID or facing mode (FRONT FIRST)
      let cameraConfig;
      if (customCameraId) {
        cameraConfig = customCameraId;
      } else if (selectedCameraId) {
        cameraConfig = selectedCameraId;
      } else {
        cameraConfig = { facingMode: facingMode };
      }

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

      try {
        await html5QrCode.start(
          cameraConfig,
          {
            fps: 25,
            qrbox: qrboxFunction,
            aspectRatio: 1.777778,
          },
          (decodedText) => {
            handleScanProcess(decodedText, code || activeSession?.sessionCode);
          },
          () => {}
        );
      } catch (startErr) {
        console.warn('Initial kiosk camera start failed, retrying with fallback:', startErr);
        if (cameraConfig && typeof cameraConfig === 'object') {
          await html5QrCode.start(
            { facingMode: facingMode === 'user' ? 'environment' : 'user' },
            {
              fps: 25,
              qrbox: qrboxFunction,
              aspectRatio: 1.777778,
            },
            (decodedText) => {
              handleScanProcess(decodedText, code || activeSession?.sessionCode);
            },
            () => {}
          );
        } else {
          throw startErr;
        }
      }

      setIsScanning(true);

      // 4. Query available cameras now that permission is granted
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setCameras(devices);
        }
      } catch (devErr) {
        console.warn('Device enumeration error:', devErr);
      }
    } catch (camErr) {
      console.warn('Kiosk Camera Error:', camErr);
      const isDenied =
        camErr?.name === 'NotAllowedError' ||
        camErr?.name === 'PermissionDeniedError' ||
        /denied|permission/i.test(camErr?.message || '');
      const isInUse =
        camErr?.name === 'NotReadableError' ||
        /could not start video source|in use|already/i.test(camErr?.message || '');

      if (isDenied) {
        setError(
          'Camera permission was denied in your browser. Please click the 🔒 lock or 📷 camera icon in the address bar, allow camera access, and click "Activate Camera Stream".'
        );
      } else if (isInUse) {
        setError(
          'Webcam is currently in use by another tab or program (e.g. Teacher Scanner). Please pause or close the camera in the other tab and click "Activate Camera Stream".'
        );
      } else {
        setError(
          camErr?.message ||
            'Unable to activate webcam. Please ensure a webcam is connected and allowed, or click "Activate Camera Stream".'
        );
      }
      setIsScanning(false);
    }
  };

  // Auto-start camera when active session is present
  useEffect(() => {
    if (!activeSession?.sessionCode) return;

    let isMounted = true;
    const timer = setTimeout(async () => {
      if (isMounted) {
        await startKioskCamera(activeSession.sessionCode);
      }
    }, 120);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [activeSession?.sessionCode]);

  // Flip Camera between Front (User) and Rear (Environment)
  const handleFlipCamera = async () => {
    if (!activeSession) return;
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);

    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch (e) {}
    }

    if (cameras.length > 1) {
      const targetCam = cameras.find((c) =>
        newMode === 'user'
          ? /front|user|selfie|face/i.test(c.label)
          : /back|rear|environment/i.test(c.label)
      );

      if (targetCam) {
        setSelectedCameraId(targetCam.id);
        await startKioskCamera(activeSession.sessionCode, targetCam.id);
        return;
      }

      const currIdx = cameras.findIndex((c) => c.id === selectedCameraId);
      const nextIdx = (currIdx + 1) % cameras.length;
      const nextCam = cameras[nextIdx];
      setSelectedCameraId(nextCam.id);
      await startKioskCamera(activeSession.sessionCode, nextCam.id);
    } else {
      setSelectedCameraId('');
      await startKioskCamera(activeSession.sessionCode, { facingMode: newMode });
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch (e) {}
    }
    setIsScanning(false);
  };

  const handleExitKiosk = async () => {
    await stopScanner();
    setActiveSession(null);
    setSessionCodeInput('');
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
                  onClick={handleExitKiosk}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Square size={14} />
                  <span>Exit Kiosk</span>
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
                  <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                    <div className="flex gap-2 text-xs font-semibold items-center">
                      <span className="text-slate-300 font-bold flex items-center gap-1.5">
                        <Camera size={14} className="text-blue-400" />
                        <span>High-Speed Webcam</span>
                      </span>

                      {cameras.length > 1 && (
                        <select
                          value={selectedCameraId}
                          onChange={(e) => {
                            setSelectedCameraId(e.target.value);
                            startKioskCamera(activeSession?.sessionCode, e.target.value);
                          }}
                          className="p-1.5 bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg cursor-pointer ml-2"
                        >
                          {cameras.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.label || `Camera ${c.id.substring(0, 5)}`}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleFlipCamera}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg flex items-center gap-1.5 border border-slate-700 transition cursor-pointer font-semibold"
                        title="Flip between front and rear cameras"
                      >
                        <SwitchCamera size={13} className="text-blue-400" />
                        <span>Flip Camera ({facingMode === 'user' ? 'Front' : 'Back'})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => startKioskCamera(activeSession?.sessionCode)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg flex items-center gap-1 border border-slate-700 transition cursor-pointer"
                        title="Restart Camera"
                      >
                        <RefreshCw size={12} className={isScanning ? '' : 'text-amber-400 animate-spin'} />
                        <span>Restart Camera</span>
                      </button>
                      <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5 ml-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                        <span>Ready for Passes</span>
                      </span>
                    </div>
                  </div>

                  {/* High-Performance Camera Viewport */}
                  <div className="relative overflow-hidden rounded-2xl bg-black aspect-video flex items-center justify-center border-2 border-slate-800 shadow-2xl">
                    <div id="kiosk-qr-reader" className="w-full h-full" />
                    {!isScanning && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 text-white p-6 text-center z-10 space-y-3">
                        <Camera size={40} className="text-slate-400 animate-pulse" />
                        <div>
                          <p className="text-sm font-bold text-slate-200">Camera Initializing...</p>
                          <p className="text-xs text-slate-400 max-w-xs mt-1">
                            If prompted, please allow camera permission in your browser.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => startKioskCamera(activeSession?.sessionCode)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-md"
                        >
                          Activate Camera Stream
                        </button>
                      </div>
                    )}
                  </div>

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
                            <div className="font-bold text-white">{item.student?.name || 'Student'}</div>
                            <div className="text-slate-400 font-mono text-[10px]">{item.student?.rollNumber || 'Enrolled'}</div>
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
