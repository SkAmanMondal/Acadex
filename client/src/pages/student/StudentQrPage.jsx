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

  // 1. Comprehensive Multi-Layer Anti-Screenshot Protection
  useEffect(() => {
    let focusTimer = null;
    let blackoutTimer = null;

    const triggerBlackout = (durationMs = 2500) => {
      setIsBlackout(true);
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

    // A. ANY Key Down:
    // This page has zero form fields. Any keystroke is an attempt to screenshot
    // (PrintScreen, Win+Shift+S, Alt+PrtScn, Win+G, Snipping Tool, Ctrl+P, F12, etc.)
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

    // B. Key Up:
    // In Windows Chrome/Edge, PrintScreen only emits keyup (after OS screenshot).
    // Immediately overwrites the clipboard image with solid black so pasted screenshots are black.
    const handleKeyUp = (e) => {
      triggerBlackout(3000);
      overwriteClipboardWithBlack();
    };

    // C. Window Blur:
    // Fires instantly when Windows Snipping Tool (Win+Shift+S), Greenshot, Lightshot, or taskbar is activated.
    const handleBlur = () => {
      setIsBlackout(true);
      overwriteClipboardWithBlack();
    };

    // D. Window Focus:
    // Restores display only after user returns focus to the browser window
    const handleFocus = () => {
      if (focusTimer) clearTimeout(focusTimer);
      focusTimer = setTimeout(() => {
        setIsBlackout(false);
      }, 400);
    };

    // E. Document Visibility Change:
    // Triggered when switching apps, multitasking on phones, or overlay capture
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || document.hidden) {
        setIsBlackout(true);
        overwriteClipboardWithBlack();
      } else {
        if (focusTimer) clearTimeout(focusTimer);
        focusTimer = setTimeout(() => {
          setIsBlackout(false);
        }, 400);
      }
    };

    // F. Mouse Leave:
    // Triggered when cursor moves out of the browser window toward Snipping Tool or screenshot software
    const handleMouseLeave = (e) => {
      if (
        !e.relatedTarget &&
        (e.clientY <= 5 || e.clientX <= 5 || e.clientX >= window.innerWidth - 5 || e.clientY >= window.innerHeight - 5)
      ) {
        triggerBlackout(2000);
      }
    };

    // G. Copy interception:
    const handleCopy = (e) => {
      try {
        e.preventDefault();
      } catch {}
      overwriteClipboardWithBlack();
    };

    // H. Browser Print Protection
    const handleBeforePrint = () => {
      setIsBlackout(true);
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

  // 2. Dynamic QR Token Fetcher
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

  // 3. Countdown timer for 5-second rolling token
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

  return (
    <div className="max-w-md mx-auto space-y-6 select-none" style={{ WebkitTouchCallout: 'none' }}>
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
          <p className="text-xs text-zinc-800 mt-1">Screen capture restricted for attendance integrity.</p>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 text-center shadow-sm relative overflow-hidden">
        {/* Top Header Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold mb-4">
          <ShieldCheck size={13} className="text-emerald-600" />
          <span>Dynamic QR Pass • 5s Auto-Rotation</span>
        </div>

        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
          Your Attendance QR Pass
        </h1>
        <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
          Hold this QR code 15–25 cm in front of the classroom podium camera.
        </p>

        {error ? (
          <div className="my-8 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs flex items-center justify-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        ) : (
          <div className="my-6 flex flex-col items-center justify-center">
            {/* QR Code Container with High Contrast & Quiet Zone */}
            <div
              className={`p-4 rounded-3xl shadow-xl relative inline-block group select-none transition-colors duration-75 ${
                isBlackout ? 'bg-black border-2 border-black' : 'bg-white border-2 border-slate-900'
              }`}
              onContextMenu={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
            >
              {loading && !qrToken ? (
                <div className="w-64 h-64 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="animate-spin text-brand-600" size={36} />
                  <span className="text-xs text-slate-400 font-medium">Generating ultra-clear pass...</span>
                </div>
              ) : (
                <div className="relative">
                  {isBlackout ? (
                    <div className="w-[250px] h-[250px] bg-black rounded-2xl" />
                  ) : (
                    <QRCodeSVG
                      value={qrToken}
                      size={250}
                      level="L"
                      includeMargin={true}
                      fgColor="#000000"
                      bgColor="#ffffff"
                      className="rounded-2xl transition-all"
                    />
                  )}
                  {/* Quick Expand Button Hover */}
                  {!isBlackout && (
                    <button
                      onClick={() => setIsFullscreen(true)}
                      className="absolute top-2 right-2 p-2 rounded-xl bg-slate-900/80 hover:bg-slate-900 text-white shadow-md transition cursor-pointer backdrop-blur-sm opacity-90 hover:opacity-100"
                      title="Fullscreen zoom for instant podium scanning"
                    >
                      <Maximize2 size={15} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Countdown Progress Bar (5 Seconds Rolling) */}
            <div className="w-72 mt-5 space-y-1.5">
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

        {/* Visibility & Scanning Guidance Tip Box */}
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5 text-left text-xs text-amber-900/90 flex items-start gap-2.5">
          <Sun size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed">
            <strong>Optimal Scanning Tip:</strong> Set phone screen brightness to 70%+ and hold flat ~20 cm from the camera. The large-pixel QR format is optimized for fast recognition without lag.
          </p>
        </div>

        {/* Student Credential Ledger Info (Without Token Format) */}
        <div className="bg-slate-50 rounded-2xl p-4 text-left border border-slate-100 space-y-2 text-xs mt-4">
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
          className="mt-5 w-full py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer active:scale-98"
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

          <div className="text-center space-y-3 mb-6">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold uppercase tracking-wider">
              Maximum Visibility Mode
            </span>
            <h3 className="text-xl font-bold text-white">Present to Podium Camera</h3>
          </div>

          <div
            className="p-6 bg-white rounded-3xl shadow-2xl border-4 border-slate-800 select-none"
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
          >
            {isBlackout ? (
              <div className="w-[300px] h-[300px] bg-black rounded-2xl" />
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

          <div className="mt-6 text-center text-xs font-mono font-bold text-slate-400">
            {timeLeft}s remaining • Tap anywhere outside to close
          </div>

          <button
            onClick={() => setIsFullscreen(false)}
            className="mt-6 px-6 py-2.5 rounded-2xl bg-white text-slate-900 font-bold text-xs transition cursor-pointer hover:bg-slate-100"
          >
            Done Scanning
          </button>
        </div>
      )}
    </div>
  );
}