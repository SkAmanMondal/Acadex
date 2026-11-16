import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
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
  RefreshCw,
  ShieldAlert,
  Info,
  ArrowUpRight,
  SwitchCamera,
} from 'lucide-react';

export default function ClassroomScanner() {
  const { socket } = useSocket();
  const [scheduledClasses, setScheduledClasses] = useState([]);
  const [selectedTimetable, setSelectedTimetable] = useState('');
  const [activeSession, setActiveSession] = useState(null);
  const [scannedRecords, setScannedRecords] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(600); // 10 minutes
  const [scanFeedback, setScanFeedback] = useState(null);
  const [error, setError] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Available camera devices & facing mode
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [facingMode, setFacingMode] = useState('user'); // Always first open front camera ('user')

  const html5QrCodeRef = useRef(null);
  const lastScannedTokenRef = useRef('');

  // Web Audio feedback generator
  const playBeep = (freq = 880, duration = 0.15) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.warn('Audio playback not supported');
    }
  };

  // 1. Real-time Socket.io listener for live attendance scans
  useEffect(() => {
    if (!socket || !activeSession) return;

    // Join the session room for real-time live events
    socket.emit('join_attendance_session', activeSession.sessionCode);

    const onStudentScanned = (data) => {
      if (
        data.sessionId?.toString() === activeSession._id?.toString() ||
        data.sessionCode === activeSession.sessionCode
      ) {
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
          message: `Live Scan Recorded: ${data.student?.name} (${data.student?.rollNumber})`,
        });
      }
    };

    const onSessionEnded = () => {
      stopScanner();
      setActiveSession(null);
    };

    socket.on('attendance_student_scanned', onStudentScanned);
    socket.on('attendance_session_ended', onSessionEnded);
    socket.on('attendance_session_cancelled', onSessionEnded);

    return () => {
      socket.off('attendance_student_scanned', onStudentScanned);
      socket.off('attendance_session_ended', onSessionEnded);
      socket.off('attendance_session_cancelled', onSessionEnded);
    };
  }, [socket, activeSession?._id, activeSession?.sessionCode]);

  // 2. Load teacher's scheduled classes and any active session with its scanned records
  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        const [schedRes, activeRes] = await Promise.allSettled([
          api.get('/timetable'),
          api.get('/attendance/active-session'),
        ]);

        if (schedRes.status === 'fulfilled' && schedRes.value.data?.success) {
          setScheduledClasses(schedRes.value.data.data);
          if (schedRes.value.data.data.length > 0) {
            setSelectedTimetable(schedRes.value.data.data[0]._id);
          }
        }

        if (activeRes.status === 'fulfilled' && activeRes.value.data?.data?.activeSession) {
          const act = activeRes.value.data.data.activeSession;
          setActiveSession(act);
          if (activeRes.value.data.data.remainingSeconds) {
            setRemainingSeconds(activeRes.value.data.data.remainingSeconds);
          }
          if (activeRes.value.data.data.scannedRecords) {
            setScannedRecords(activeRes.value.data.data.scannedRecords);
          }
        }
      } catch (err) {
        console.error('Failed to fetch schedule:', err);
      }
    };
    fetchSchedules();
  }, []);

  // Countdown timer for 10-minute session deadline
  useEffect(() => {
    if (!activeSession || remainingSeconds <= 0) return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          stopScanner();
          setError('The 10-minute attendance window has closed.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession, remainingSeconds]);

  // Request native browser camera permission & discover video devices
  const requestCameraPermissionAndDiscover = async () => {
    try {
      setError('');
      setPermissionDenied(false);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support camera access (mediaDevices API missing).');
      }

      // 1. Explicitly prompt user for permission prioritizing front camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
      });
      // Stop temp stream tracks immediately
      stream.getTracks().forEach((track) => track.stop());

      // 2. Query available camera devices
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        setCameras(devices);
        const frontCam = devices.find((d) => /front|user|selfie|face/i.test(d.label));
        const chosenId = frontCam ? frontCam.id : devices[0].id;
        setSelectedCameraId(chosenId);
        return chosenId;
      } else {
        return null;
      }
    } catch (err) {
      console.warn('Camera permission / detection error:', err);
      setPermissionDenied(true);
      const isDenied =
        err?.name === 'NotAllowedError' ||
        err?.name === 'PermissionDeniedError' ||
        /denied|permission/i.test(err?.message || '');
      const isInUse =
        err?.name === 'NotReadableError' ||
        /could not start video source|in use|already/i.test(err?.message || '');

      if (isDenied) {
        setError('Camera permission was denied in your browser. Please allow camera access in your browser address bar.');
      } else if (isInUse) {
        setError('Webcam is currently in use by another tab or program (e.g. Podium Kiosk).');
      } else {
        setError(err.message || 'Unable to access camera.');
      }
      return null;
    }
  };

  // Activate session & start webcam scanner
  const handleStartSession = async () => {
    if (!selectedTimetable) {
      setError('Please select a scheduled class first');
      return;
    }

    setError('');
    try {
      const res = await api.post('/attendance/session/activate', { timetableId: selectedTimetable });
      if (res.data?.success) {
        let session = res.data.data;
        if (session.status === 'pending') {
          const directRes = await api.post(`/attendance/session/${session._id}/start-direct`);
          if (directRes.data?.success) {
            session = directRes.data.data.session;
          }
        }
        setActiveSession(session);
        setRemainingSeconds(600); // 10 minutes
        setScannedRecords([]);

        // Initiate camera permission and start
        const camId = await requestCameraPermissionAndDiscover();
        if (camId) {
          startWebcam(session._id, camId);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to activate attendance session');
    }
  };

  const handleEndSessionEarly = async () => {
    if (activeSession?._id) {
      try {
        await api.post(`/attendance/session/${activeSession._id}/end`);
      } catch (err) {
        console.error('Failed to end session:', err);
      }
    }
    stopScanner();
    setActiveSession(null);
  };

  const handleProcessQrToken = async (decodedText, sessionId) => {
    if (!decodedText) return;
    if (lastScannedTokenRef.current === decodedText) return;
    lastScannedTokenRef.current = decodedText;
    setTimeout(() => {
      lastScannedTokenRef.current = '';
    }, 3000);

    try {
      const scanRes = await api.post(`/attendance/session/${sessionId}/scan`, { qrToken: decodedText });
      if (scanRes.data?.success) {
        const record = scanRes.data.data;
        playSuccessSound(); // ✨ Ascending bright chime
        setScanFeedback({
          type: 'success',
          message: `Attendance Recorded: ${record.student.name} (${record.student.rollNumber})`,
        });
        setScannedRecords((prev) => [record, ...prev]);
      }
    } catch (scanErr) {
      const status = scanErr.response?.status;
      const msg = scanErr.response?.data?.message || 'Invalid or duplicate scan';
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

  const startWebcam = async (sessionId, cameraIdOrConfig) => {
    try {
      setIsScanning(true);
      setError('');
      setPermissionDenied(false);

      // Wait for #qr-reader element to be mounted in the DOM
      let attempts = 0;
      while (!document.getElementById('qr-reader') && attempts < 25) {
        await new Promise((resolve) => setTimeout(resolve, 60));
        attempts++;
      }

      if (!document.getElementById('qr-reader')) {
        throw new Error('Webcam container not ready in DOM.');
      }

      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            await html5QrCodeRef.current.stop();
          }
          html5QrCodeRef.current.clear();
        } catch (e) {}
      }

      const html5QrCode = new Html5Qrcode('qr-reader', {
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true, // Native hardware acceleration
        },
      });
      html5QrCodeRef.current = html5QrCode;

      // Determine camera config: string deviceId or facingMode object (FRONT CAMERA FIRST)
      let cameraConfig;
      if (typeof cameraIdOrConfig === 'string' && cameraIdOrConfig) {
        cameraConfig = cameraIdOrConfig;
      } else if (cameraIdOrConfig && typeof cameraIdOrConfig === 'object') {
        cameraConfig = cameraIdOrConfig;
      } else if (selectedCameraId) {
        cameraConfig = selectedCameraId;
      } else {
        cameraConfig = { facingMode: facingMode };
      }

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
            handleProcessQrToken(decodedText, sessionId);
          },
          () => {}
        );
      } catch (firstErr) {
        console.warn('Initial camera start failed, retrying with fallback:', firstErr);
        if (cameraConfig && typeof cameraConfig === 'object') {
          await html5QrCode.start(
            { facingMode: facingMode === 'user' ? 'environment' : 'user' },
            {
              fps: 25,
              qrbox: qrboxFunction,
              aspectRatio: 1.777778,
            },
            (decodedText) => {
              handleProcessQrToken(decodedText, sessionId);
            },
            () => {}
          );
        } else {
          throw firstErr;
        }
      }

      setIsScanning(true);

      // Query available cameras in background after stream starts
      if (cameras.length === 0) {
        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            setCameras(devices);
          }
        } catch (e) {}
      }
    } catch (camErr) {
      console.error('Webcam start failed:', camErr);
      setPermissionDenied(true);
      const isDenied =
        camErr?.name === 'NotAllowedError' ||
        camErr?.name === 'PermissionDeniedError' ||
        /denied|permission/i.test(camErr?.message || '');
      const isInUse =
        camErr?.name === 'NotReadableError' ||
        /could not start video source|in use|already/i.test(camErr?.message || '');

      if (isDenied) {
        setError('Camera permission was denied in your browser. Please allow camera access in the address bar.');
      } else if (isInUse) {
        setError('Webcam is currently in use by another tab or program (e.g. Podium Kiosk). Stop camera in the other tab or click "Start Camera Now".');
      } else {
        setError(camErr?.message || 'Unable to activate video stream. Please grant camera permission or use the flip/fallback options.');
      }
      setIsScanning(false);
    }
  };

  // Flip Camera between Front (User) and Rear (Environment)
  const handleFlipCamera = async () => {
    if (!activeSession) return;
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);

    await stopScanner();

    if (cameras.length > 1) {
      const targetCam = cameras.find((c) =>
        newMode === 'user'
          ? /front|user|selfie|face/i.test(c.label)
          : /back|rear|environment/i.test(c.label)
      );

      if (targetCam) {
        setSelectedCameraId(targetCam.id);
        await startWebcam(activeSession._id, targetCam.id);
        return;
      }

      const currIdx = cameras.findIndex((c) => c.id === selectedCameraId);
      const nextIdx = (currIdx + 1) % cameras.length;
      const nextCamera = cameras[nextIdx];
      setSelectedCameraId(nextCamera.id);
      await startWebcam(activeSession._id, nextCamera.id);
    } else {
      setSelectedCameraId('');
      await startWebcam(activeSession._id, { facingMode: newMode });
    }
  };

  // Auto-start webcam whenever an active session is loaded
  useEffect(() => {
    if (!activeSession?._id) return;

    let isMounted = true;
    const autoInitTimer = setTimeout(async () => {
      try {
        let camId = selectedCameraId;
        if (cameras.length === 0) {
          camId = await requestCameraPermissionAndDiscover();
        }
        if (isMounted && activeSession?._id) {
          startWebcam(activeSession._id, camId || { facingMode: facingMode });
        }
      } catch (e) {
        console.warn('Auto webcam start error:', e);
      }
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(autoInitTimer);
    };
  }, [activeSession?._id]);

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn('Error stopping scanner:', e);
      }
    }
    setIsScanning(false);
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Classroom Attendance Scanner</h1>
          <p className="text-xs text-slate-500 mt-1">
            Activate the scheduled class session and scan student dynamic QR passes using the camera.
          </p>
        </div>

        {activeSession && (
          <div className="flex items-center gap-4 bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 font-medium">Session Code:</span>
              <span className="font-mono font-bold text-blue-700 ml-1.5 text-sm">
                {activeSession.sessionCode}
              </span>
            </div>
            <div className="h-4 w-px bg-slate-300" />
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Clock size={15} className={remainingSeconds < 60 ? 'text-rose-600 animate-pulse' : 'text-blue-600'} />
              <span>{formatTime(remainingSeconds)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Permission Denied / Actionable Guidance Card */}
      {permissionDenied && (
        <div className="p-5 bg-amber-50/80 border border-amber-200 rounded-3xl space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-xl mt-0.5">
              <ShieldAlert size={20} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-amber-900">Camera Access Blocked or Not Permitted</h3>
              <p className="text-xs text-amber-800">
                Your browser blocked camera access for <span className="font-mono font-bold">http://localhost:5173</span>.
              </p>
              <div className="text-xs text-amber-800 mt-2 space-y-1 list-disc pl-4">
                <li>Click the <strong>🔒 lock or 📷 camera icon</strong> on the left side of your browser's address bar.</li>
                <li>Toggle <strong>Camera</strong> permission to <strong>Allow</strong>.</li>
                <li>Click the button below to re-request permission.</li>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-amber-200/60">
            <button
              onClick={async () => {
                const camId = await requestCameraPermissionAndDiscover();
                if (camId && activeSession) {
                  startWebcam(activeSession._id, camId);
                }
              }}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition shadow-sm"
            >
              <RefreshCw size={14} />
              <span>Grant Camera Permission & Start</span>
            </button>
          </div>
        </div>
      )}

      {error && !permissionDenied && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Main Scanner Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Camera Feed & Session Starter */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            {!activeSession ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Select Scheduled Class Slot
                  </label>
                  <select
                    value={selectedTimetable}
                    onChange={(e) => setSelectedTimetable(e.target.value)}
                    className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    {scheduledClasses.length === 0 ? (
                      <option value="">No scheduled classes found</option>
                    ) : (
                      scheduledClasses.map((item) => (
                        <option key={item._id} value={item._id}>
                          {item.subject?.name} ({item.subject?.code}) — {item.batch?.name} • Room {item.classroom?.roomNumber} ({item.day} {item.startTime}-{item.endTime})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <button
                  onClick={handleStartSession}
                  disabled={scheduledClasses.length === 0}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition shadow-md shadow-blue-600/20 disabled:opacity-50 cursor-pointer"
                >
                  <Play size={16} />
                  <span>Activate 10-Minute Attendance Session</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Classroom Podium PC Kiosk Banner */}
                <div className="p-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl border border-indigo-800/60 space-y-2.5 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">Classroom Podium PC Kiosk Mode</span>
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-400">Teacher Login Not Required</span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Podium Session Code:</div>
                      <div className="font-mono text-2xl font-black text-amber-300 tracking-widest">
                        {activeSession.sessionCode}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isScanning && (
                        <button
                          type="button"
                          onClick={stopScanner}
                          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer border border-slate-700"
                          title="Pause camera if you want to use the camera in Podium Kiosk on this computer"
                        >
                          Pause Teacher Camera
                        </button>
                      )}
                      <a
                        href={`/kiosk?code=${activeSession.sessionCode}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-blue-500/25 cursor-pointer"
                      >
                        <span>Open Podium Kiosk</span>
                        <ArrowUpRight size={14} />
                      </a>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed border-t border-slate-800 pt-2">
                    Open <strong className="text-white">{typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}/kiosk?code={activeSession.sessionCode}</strong> on the classroom computer. The session code <strong className="text-amber-300">{activeSession.sessionCode}</strong> is automatically integrated!
                  </p>
                </div>

                {/* Live Camera Feed */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                        <Camera size={14} className="text-blue-600" />
                        <span>Live Camera Feed</span>
                      </span>
                      {cameras.length > 1 && (
                        <div className="flex items-center gap-1.5 ml-2">
                          <span className="text-slate-500 font-medium">Camera:</span>
                          <select
                            value={selectedCameraId}
                            onChange={(e) => {
                              setSelectedCameraId(e.target.value);
                              startWebcam(activeSession._id, e.target.value);
                            }}
                            className="p-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 font-medium cursor-pointer"
                          >
                            {cameras.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.label || `Camera ${c.id.substring(0, 5)}`}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Flip Camera and Restart Controls */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleFlipCamera}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs border border-slate-200"
                        title="Switch between front and rear cameras"
                      >
                        <SwitchCamera size={14} className="text-blue-600" />
                        <span>Flip Camera ({facingMode === 'user' ? 'Front' : 'Back'})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => startWebcam(activeSession._id, selectedCameraId || { facingMode: facingMode })}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer border border-slate-200"
                        title="Restart Camera"
                      >
                        <RefreshCw size={13} className={isScanning ? '' : 'text-amber-600 animate-spin'} />
                        <span>Restart</span>
                      </button>
                    </div>
                  </div>

                  <div className="relative overflow-hidden rounded-2xl bg-black aspect-video flex items-center justify-center border border-slate-800 shadow-inner">
                    <div id="qr-reader" className="w-full h-full" />
                    {!isScanning && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white p-4 text-center z-10">
                        <Camera size={36} className="text-slate-400 mb-2 animate-pulse" />
                        <p className="text-xs font-semibold text-slate-200">Camera Initializing...</p>
                        <button
                          type="button"
                          onClick={() => startWebcam(activeSession._id, selectedCameraId || { facingMode: facingMode })}
                          className="mt-3 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                        >
                          Start Camera Now
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Scan Feedback Banner with Correlated Sound & Color */}
                {scanFeedback && (
                  <div
                    className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-all shadow-sm ${
                      scanFeedback.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : scanFeedback.type === 'warning'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {scanFeedback.type === 'success' ? (
                      <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                    ) : scanFeedback.type === 'warning' ? (
                      <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                    ) : (
                      <AlertCircle size={18} className="text-rose-600 shrink-0" />
                    )}
                    <span>{scanFeedback.message}</span>
                  </div>
                )}

                <button
                  onClick={handleEndSessionEarly}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Square size={14} />
                  <span>End Session Early</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Scanned Roll-call Feed */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-blue-600" />
                <h2 className="text-sm font-bold text-slate-800">Present Students</h2>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                {scannedRecords.length} Scanned
              </span>
            </div>

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {scannedRecords.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  Awaiting student scans... Place student QR passes in front of the webcam.
                </div>
              ) : (
                scannedRecords.map((rec, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-800">{rec.student?.name || 'Student'}</div>
                      <div className="text-slate-500 font-mono text-[10px]">{rec.student?.rollNumber || 'Enrolled'}</div>
                    </div>
                    <div className="flex items-center gap-1.5 text-emerald-600 font-semibold text-[11px]">
                      <CheckCircle2 size={14} />
                      <span>{new Date(rec.scannedAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
