import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
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
  RefreshCw,
  Upload,
  Keyboard,
  ShieldAlert,
  Info,
  ArrowUpRight,
} from 'lucide-react';

export default function ClassroomScanner() {
  const [scheduledClasses, setScheduledClasses] = useState([]);
  const [selectedTimetable, setSelectedTimetable] = useState('');
  const [activeSession, setActiveSession] = useState(null);
  const [scannedRecords, setScannedRecords] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(600); // 10 minutes
  const [scanFeedback, setScanFeedback] = useState(null);
  const [error, setError] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Available camera devices
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');

  // Fallback modes
  const [activeTab, setActiveTab] = useState('webcam'); // 'webcam' | 'upload' | 'manual'
  const [manualToken, setManualToken] = useState('');
  const [isProcessingToken, setIsProcessingToken] = useState(false);

  const html5QrCodeRef = useRef(null);
  const lastScannedTokenRef = useRef('');
  const fileInputRef = useRef(null);

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

  // Load teacher's scheduled classes
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

      // 1. Explicitly prompt user for permission
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Stop temp stream tracks immediately
      stream.getTracks().forEach((track) => track.stop());

      // 2. Query available camera devices
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        setCameras(devices);
        setSelectedCameraId(devices[0].id);
        return devices[0].id;
      } else {
        throw new Error('No video input hardware detected on this machine.');
      }
    } catch (err) {
      console.warn('Camera permission / detection error:', err);
      setPermissionDenied(true);
      setError(
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'Camera permission was denied. Please allow camera access in your browser address bar.'
          : err.message || 'Unable to access camera.'
      );
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

    setIsProcessingToken(true);
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
        setManualToken('');
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
    } finally {
      setIsProcessingToken(false);
    }
  };

  const startWebcam = async (sessionId, cameraId) => {
    try {
      setIsScanning(true);
      setError('');
      setPermissionDenied(false);

      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop();
        } catch (e) {}
      }

      const html5QrCode = new Html5Qrcode('qr-reader', {
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true, // Native hardware acceleration
        },
      });
      html5QrCodeRef.current = html5QrCode;

      const cameraConfig = cameraId ? cameraId : { facingMode: 'user' };

      const qrboxFunction = (viewfinderWidth, viewfinderHeight) => {
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
        const qrboxSize = Math.floor(minEdge * 0.78);
        return { width: qrboxSize, height: qrboxSize };
      };

      await html5QrCode.start(
        cameraConfig,
        {
          fps: 25, // High responsive frame-rate
          qrbox: qrboxFunction,
          aspectRatio: 1.777778,
        },
        (decodedText) => {
          handleProcessQrToken(decodedText, sessionId);
        },
        () => {
          // Normal frame scan tick
        }
      );
    } catch (camErr) {
      console.error('Webcam start failed:', camErr);
      setPermissionDenied(true);
      setError('Unable to activate video stream. Please grant camera permission or use the fallback options below.');
      setIsScanning(false);
    }
  };

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

  // Image File QR Scanner Fallback
  const handleFileUploadScan = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeSession) return;

    try {
      const html5QrCode = new Html5Qrcode('qr-file-reader');
      const decodedText = await html5QrCode.scanFile(file, true);
      handleProcessQrToken(decodedText, activeSession._id);
    } catch (err) {
      setScanFeedback({
        type: 'error',
        message: 'Could not detect a valid QR code in the uploaded image.',
      });
    }
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="space-y-6">
      {/* Hidden element for file-based QR decoding */}
      <div id="qr-file-reader" className="hidden" />

      {/* Header Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Classroom Attendance Scanner</h1>
          <p className="text-xs text-slate-500 mt-1">
            Activate the scheduled class session. Use the classroom webcam, upload a QR pass screenshot, or enter the code.
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

          <div className="flex flex-wrap gap-2 pt-2 border-t border-amber-200/60">
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
            <button
              onClick={() => setActiveTab('manual')}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition"
            >
              Use Manual / Image QR Fallback Instead
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
                    <a
                      href="/kiosk"
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-blue-500/25 cursor-pointer"
                    >
                      <span>Open Podium Kiosk</span>
                      <ArrowUpRight size={14} />
                    </a>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed border-t border-slate-800 pt-2">
                    Open <strong className="text-white">http://localhost:5173/kiosk</strong> on the classroom computer and enter code <strong className="text-amber-300">{activeSession.sessionCode}</strong>. Students can scan directly on the big screen!
                  </p>
                </div>

                {/* Method Switcher Tabs */}
                <div className="flex gap-2 border-b border-slate-100 pb-2 text-xs font-semibold">
                  <button
                    onClick={() => {
                      setActiveTab('webcam');
                      if (activeSession && cameras.length > 0) {
                        startWebcam(activeSession._id, selectedCameraId);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition shrink-0 ${
                      activeTab === 'webcam'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Camera size={14} className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} />
                    <span>Live Webcam</span>
                  </button>

                  <button
                    onClick={() => {
                      stopScanner();
                      setActiveTab('upload');
                    }}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition shrink-0 ${
                      activeTab === 'upload'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Upload size={14} className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} />
                    <span>Scan QR Image</span>
                  </button>

                  <button
                    onClick={() => {
                      stopScanner();
                      setActiveTab('manual');
                    }}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition shrink-0 ${
                      activeTab === 'manual'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Keyboard size={14} className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} />
                    <span>Manual Code</span>
                  </button>
                </div>

                {/* Tab 1: Live Webcam Feed */}
                {activeTab === 'webcam' && (
                  <div className="space-y-3">
                    {cameras.length > 1 && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500 font-medium">Select Camera:</span>
                        <select
                          value={selectedCameraId}
                          onChange={(e) => {
                            setSelectedCameraId(e.target.value);
                            startWebcam(activeSession._id, e.target.value);
                          }}
                          className="p-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50"
                        >
                          {cameras.map((c) => (
                            <option key={c.id} value={c.id}>{c.label || `Camera ${c.id.substring(0, 5)}`}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="relative overflow-hidden rounded-2xl bg-black aspect-video flex items-center justify-center border border-slate-800">
                      <div id="qr-reader" className="w-full h-full" />
                    </div>
                  </div>
                )}

                {/* Tab 2: Upload QR Image Fallback */}
                {activeTab === 'upload' && (
                  <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl text-center space-y-3 bg-slate-50/50">
                    <Upload size={32} className="mx-auto text-blue-600" />
                    <div className="text-xs font-semibold text-slate-700">
                      Upload or drag student QR code pass screenshot
                    </div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleFileUploadScan}
                      className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 cursor-pointer"
                    />
                  </div>
                )}

                {/* Tab 3: Manual Token Input Fallback */}
                {activeTab === 'manual' && (
                  <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                    <label className="block font-semibold text-slate-700">
                      Paste Student Dynamic QR Token String
                    </label>
                    <textarea
                      rows="3"
                      value={manualToken}
                      onChange={(e) => setManualToken(e.target.value)}
                      placeholder="Paste base64 token string from student pass or scan with handheld scanner..."
                      className="w-full p-2.5 font-mono text-[11px] bg-white border border-slate-200 rounded-xl"
                    />
                    <button
                      onClick={() => handleProcessQrToken(manualToken.trim(), activeSession._id)}
                      disabled={!manualToken.trim() || isProcessingToken}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <span>Process & Record Attendance</span>
                    </button>
                  </div>
                )}

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
                      <div className="font-semibold text-slate-800">{rec.student.name}</div>
                      <div className="text-slate-500 font-mono text-[10px]">{rec.student.rollNumber}</div>
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
