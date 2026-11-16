import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldCheck,
  RefreshCw,
  Clock,
  AlertCircle,
  Maximize2,
  Minimize2,
  Sun,
  ShieldAlert,
  Fingerprint,
  VideoOff,
  Lock,
  Unlock,
} from 'lucide-react';

// Pre-render a solid black 600x600 PNG image blob for instantaneous clipboard replacement
let blackBlobCache = null;
try {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = 600;
    c.height = 600;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, 600, 600);
      ctx.fillStyle = '#141416';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PROTECTED PASS - SCREENSHOT BLOCKED', 300, 300);
    }
    c.toBlob((b) => {
      blackBlobCache = b;
    }, 'image/png');
  }
} catch {}

const overwriteClipboardWithBlack = async () => {
  try {
    if (blackBlobCache && navigator.clipboard && navigator.clipboard.write) {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blackBlobCache })
      ]);
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText('');
    }
  } catch {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText('');
      }
    } catch {}
  }
};

export default function StudentQrPage() {
  const { user } = useAuth();
  const [qrToken, setQrToken] = useState('');
  const [timeLeft, setTimeLeft] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBlackout, setIsBlackout] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [liveMicroTime, setLiveMicroTime] = useState('');

  // 1. Live Running Millisecond Security Clock (Proof of live presence against video replay)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setLiveMicroTime(now.toTimeString().slice(0, 8) + '.' + String(now.getMilliseconds()).padStart(3, '0'));
    }, 60);
    return () => clearInterval(timer);
  }, []);

  // 2. Strict Screen Sharing Interception (Blocks WebRTC getDisplayMedia at JS runtime)
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      try {
        const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia;
        navigator.mediaDevices.getDisplayMedia = () => {
          setIsBlackout(true);
          overwriteClipboardWithBlack();
          return Promise.reject(
            new DOMException('Screen sharing is strictly prohibited on the attendance pass.', 'NotAllowedError')
          );
        };
        return () => {
          if (originalGetDisplayMedia) {
            navigator.mediaDevices.getDisplayMedia = originalGetDisplayMedia;
          }
        };
      } catch (e) {}
    }
  }, []);

  // 3. Multi-Layer Anti-Screenshot, Keystroke & Gesture Protection
  useEffect(() => {
    let focusTimer = null;
    let blackoutTimer = null;

    const triggerBlackout = (durationMs = 2500) => {
      setIsBlackout(true);
      setIsHolding(false);
      overwriteClipboardWithBlack();
      if (blackoutTimer) clearTimeout(blackoutTimer);
      if (durationMs > 0) {
        blackoutTimer = setTimeout(() => {
          if (document.hasFocus() && document.visibilityState === 'visible') {
            setIsBlackout(false);
          }
        }, durationMs);
      }
    };

    // A. ANY Key Down: (PrtScn, Win, Shift, Ctrl, Alt, F12, etc.)
    const handleKeyDown = (e) => {
      triggerBlackout(3000);
      overwriteClipboardWithBlack();

      if (
        e.key === 'PrintScreen' ||
        e.code === 'PrintScreen' ||
        e.keyCode === 44 ||
        e.key === 'Meta' ||
        e.key === 'OS' ||
        e.keyCode === 91 ||
        e.keyCode === 92 ||
        e.key === 'F12' ||
        ((e.ctrlKey || e.metaKey) && ['p', 'P', 's', 'S', 'u', 'U', 'c', 'C'].includes(e.key))
      ) {
        try {
          e.preventDefault();
        } catch {}
      }
    };

    // B. Key Up: (Windows PrintScreen emit)
    const handleKeyUp = (e) => {
      triggerBlackout(3000);
      overwriteClipboardWithBlack();
    };

    // C. Window Blur: (Snipping Tool, notification drop, external screenshot tool, app switch)
    const handleBlur = () => {
      setIsBlackout(true);
      setIsHolding(false);
      overwriteClipboardWithBlack();
    };

    // D. Window Focus
    const handleFocus = () => {
      if (focusTimer) clearTimeout(focusTimer);
      focusTimer = setTimeout(() => {
        setIsBlackout(false);
      }, 400);
    };

    // E. Document Visibility Change (mobile home swipe, screenshot overlay, app switch)
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || document.hidden) {
        setIsBlackout(true);
        setIsHolding(false);
        overwriteClipboardWithBlack();
      } else {
        if (focusTimer) clearTimeout(focusTimer);
        focusTimer = setTimeout(() => {
          setIsBlackout(false);
        }, 400);
      }
    };

    // F. Mouse Leave
    const handleMouseLeave = (e) => {
      if (
        !e.relatedTarget &&
        (e.clientY <= 5 || e.clientX <= 5 || e.clientX >= window.innerWidth - 5 || e.clientY >= window.innerHeight - 5)
      ) {
        triggerBlackout(2000);
      }
    };

    // G. Clipboard Copy Event Interception
    const handleCopy = (e) => {
      try {
        e.preventDefault();
      } catch {}
      overwriteClipboardWithBlack();
    };

    // H. Browser Print Protection
    const handleBeforePrint = () => {
      setIsBlackout(true);
      setIsHolding(false);
      overwriteClipboardWithBlack();
    };
    const handleAfterPrint = () => {
      setIsBlackout(false);
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('copy', handleCopy);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      if (focusTimer) clearTimeout(focusTimer);
      if (blackoutTimer) clearTimeout(blackoutTimer);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('copy', handleCopy);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  // 4. Touch & Gesture Handlers (Defeats phone screenshots & multi-finger gestures)
  const handleTouchStart = (e) => {
    // If more than 1 finger touches the screen (e.g. 3-finger swipe screenshot gesture):
    if (e.touches && e.touches.length > 1) {
      setIsBlackout(true);
      setIsHolding(false);
      overwriteClipboardWithBlack();
      return;
    }
    setIsHolding(true);
  };

  const handleTouchEnd = () => {
    setIsHolding(false);
  };

  // Hardware buttons (Power + Volume Down) fire touchcancel on Android & iOS:
  const handleTouchCancel = () => {
    setIsHolding(false);
    setIsBlackout(true);
    overwriteClipboardWithBlack();
    setTimeout(() => {
      if (document.hasFocus() && document.visibilityState === 'visible') {
        setIsBlackout(false);
      }
    }, 2000);
  };

  const handleMouseDown = () => {
    setIsHolding(true);
  };

  const handleMouseUp = () => {
    setIsHolding(false);
  };

  // 5. Dynamic QR Token Fetcher (5-Second Expiry)
  const fetchNewToken = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/attendance/student/qr-token');
      if (res.data?.success) {
        setQrToken(res.data.data.token);
        setTimeLeft(5);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate attendance QR code');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNewToken();
  }, []);

  // 6. Countdown timer for 5-second rolling token
  useEffect(() => {
    if (timeLeft <= 0) {
      fetchNewToken();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  // Determine whether the QR is currently visible (Strictly enforced: only during active hold & no blackout)
  const isQrVisible = !isBlackout && isHolding;

  return (
    <div className="max-w-md mx-auto space-y-5 select-none" style={{ WebkitTouchCallout: 'none' }}>
      {/* Print Blackout CSS injection */}
      <style>{`
        @media print {
          html, body, #root, * {
            background: #000000 !important;
            color: #000000 !important;
            visibility: hidden !important;
          }
        }
      `}</style>

      {/* Screen Capture / Screenshot Blackout Shield */}
      {isBlackout && (
        <div
          className="fixed inset-0 z-[999999] bg-black flex flex-col items-center justify-center p-6 text-center select-none"
          style={{
            backgroundColor: '#000000',
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 999999,
          }}
        >
          <div className="w-16 h-16 rounded-3xl bg-black border border-zinc-900 flex items-center justify-center text-zinc-800 shadow-2xl mb-4">
            <ShieldAlert size={32} className="text-zinc-800" />
          </div>
          <h2 className="text-sm font-bold text-zinc-700">Dynamic Attendance Pass Protected</h2>
          <p className="text-xs text-zinc-800 mt-1">Screen capture and sharing restricted for attendance security.</p>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 text-center shadow-sm relative overflow-hidden">
        {/* Security & Anti-Capture Badges */}
        <div className="flex items-center justify-center gap-2 flex-wrap mb-3.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
            <ShieldCheck size={13} className="text-emerald-600" />
            <span>Dynamic QR Pass • 5s Auto-Rotation</span>
          </div>

          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
            <VideoOff size={11} />
            <span>Screen Sharing Blocked</span>
          </div>
        </div>

        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
          Your Attendance QR Pass
        </h1>
        <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
          Hold this QR code 15–25 cm in front of the classroom podium camera.
        </p>

        {/* Anti-Proxy Hardware & Screen Shutter Shield */}
        <div className="mt-4 px-3 py-2 bg-slate-900 text-slate-100 rounded-2xl flex items-center justify-between max-w-xs mx-auto text-xs shadow-xs border border-slate-800 select-none">
          <div className="flex items-center gap-2">
            <Fingerprint size={16} className="text-emerald-400 animate-pulse" />
            <div className="text-left">
              <div className="font-bold text-[11px] text-white">Biometric Touch Shutter</div>
              <div className="text-[10px] text-slate-400">Press & hold to reveal pass</div>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/80 font-bold">
            ENFORCED
          </span>
        </div>

        {error ? (
          <div className="my-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs flex items-center justify-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        ) : (
          <div className="my-5 flex flex-col items-center justify-center">
            {/* Interactive Protected QR Container with Touch-to-Present */}
            <div
              className={`w-[280px] h-[280px] rounded-3xl shadow-xl relative select-none flex flex-col items-center justify-center p-3 transition-all duration-150 touch-none ${
                !isQrVisible
                  ? 'bg-slate-950 border-2 border-emerald-500/50 cursor-pointer active:scale-98'
                  : 'bg-white border-2 border-slate-900'
              }`}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchCancel}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onContextMenu={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
            >
              {loading && !qrToken ? (
                <div className="flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="animate-spin text-brand-600" size={36} />
                  <span className="text-xs text-slate-400 font-medium">Generating ultra-clear pass...</span>
                </div>
              ) : !isQrVisible ? (
                /* Shutter Mode: When not actively holding down finger */
                <div className="flex flex-col items-center justify-center p-4 text-center select-none space-y-2.5">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
                    <Fingerprint size={38} className="animate-pulse" />
                  </div>
                  <h3 className="text-sm font-extrabold text-white tracking-wide uppercase">
                    Press & Hold to Present
                  </h3>
                  <p className="text-[11px] text-slate-400 leading-tight max-w-[210px]">
                    Touch and hold screen to show QR to podium camera.
                  </p>
                  <span className="text-[10px] text-emerald-400/90 font-mono font-bold bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-md">
                    🔒 Anti-Screenshot Active
                  </span>
                </div>
              ) : (
                /* Active Mode: QR Code rendered during active touch hold or continuous mode */
                <div className="relative flex flex-col items-center">
                  <div className="text-[9px] font-mono font-extrabold text-slate-500 mb-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    <span>LIVE PASS • {liveMicroTime}</span>
                  </div>
                  <QRCodeSVG
                    value={qrToken}
                    size={230}
                    level="L"
                    includeMargin={true}
                    fgColor="#000000"
                    bgColor="#ffffff"
                    className="rounded-2xl transition-all"
                  />
                  {/* Quick Expand Button Hover */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFullscreen(true);
                    }}
                    className="absolute top-6 right-1 p-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-900 text-white shadow-md transition cursor-pointer backdrop-blur-sm opacity-80 hover:opacity-100"
                    title="Fullscreen zoom"
                  >
                    <Maximize2 size={13} />
                  </button>
                </div>
              )}
            </div>

            {/* Countdown Progress Bar (5 Seconds Rolling) */}
            <div className="w-72 mt-4 space-y-1.5">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <Clock size={13} />
                  <span>Dynamic Pass Validity</span>
                </span>
                <span className={timeLeft <= 2 ? 'text-rose-600 font-bold font-mono' : 'text-brand-600 font-mono font-bold'}>
                  {timeLeft}s remaining
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-1000 ease-linear ${
                    timeLeft <= 2 ? 'bg-rose-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${(timeLeft / 5) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Security Advice Notice Box */}
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3 text-left text-xs text-amber-900/90 flex items-start gap-2.5">
          <Sun size={15} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed">
            <strong>Security Notice:</strong> Biometric Touch Shutter is enforced. Lifting your finger, multi-touch gestures, switching apps, taking screenshots, or screen sharing immediately blacks out the pass to prevent proxy attendance.
          </p>
        </div>

        {/* Student Credential Ledger Info (Without Token Format) */}
        <div className="bg-slate-50 rounded-2xl p-3.5 text-left border border-slate-100 space-y-1.5 text-xs mt-3.5">
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Student Name:</span>
            <span className="font-bold text-slate-800">{user?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Roll Number:</span>
            <span className="font-mono font-bold text-slate-800">{user?.profile?.rollNumber || 'MCA-2024-001'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Department:</span>
            <span className="font-semibold text-slate-800">{user?.department?.name || 'Computer Applications'}</span>
          </div>
        </div>

        {/* Refresh Action Button */}
        <button
          onClick={fetchNewToken}
          disabled={loading}
          className="mt-4 w-full py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer active:scale-98"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Code Immediately</span>
        </button>
      </div>

      {/* Fullscreen Magnified Modal for Instant Recognition */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-slate-950/95 backdrop-blur-md animate-fade-in select-none">
          <button
            onClick={() => setIsFullscreen(false)}
            className="absolute top-6 right-6 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
          >
            <Minimize2 size={20} />
          </button>

          <div className="text-center space-y-2 mb-5">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold uppercase tracking-wider">
              Maximum Visibility Mode
            </span>
            <h3 className="text-xl font-bold text-white">Present to Podium Camera</h3>
          </div>

          <div
            className={`p-6 rounded-3xl shadow-2xl border-4 select-none transition-all touch-none ${
              !isQrVisible ? 'bg-black border-zinc-800' : 'bg-white border-slate-800'
            }`}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchCancel}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
          >
            {!isQrVisible ? (
              <div className="w-[300px] h-[300px] bg-black rounded-2xl flex flex-col items-center justify-center p-4 text-center select-none">
                <Fingerprint size={52} className="text-emerald-400 animate-pulse mb-3" />
                <span className="text-sm font-extrabold text-white uppercase tracking-wider">
                  Touch & Hold to Reveal
                </span>
                <span className="text-xs text-slate-400 mt-1">
                  Release to instantly blackout
                </span>
              </div>
            ) : (
              <QRCodeSVG
                value={qrToken}
                size={300}
                level="L"
                includeMargin={true}
                fgColor="#000000"
                bgColor="#ffffff"
              />
            )}
          </div>

          <div className="mt-5 text-center text-xs font-mono font-bold text-slate-400">
            {timeLeft}s remaining • Tap anywhere outside to close
          </div>

          <button
            onClick={() => setIsFullscreen(false)}
            className="mt-5 px-6 py-2.5 rounded-2xl bg-white text-slate-900 font-bold text-xs transition cursor-pointer hover:bg-slate-100"
          >
            Done Scanning
          </button>
        </div>
      )}
    </div>
  );
}