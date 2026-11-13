import React, { useState, useEffect } from 'react';
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
  Sparkles,
  Zap,
} from 'lucide-react';

export default function StudentQrPage() {
  const { user } = useAuth();
  const [qrToken, setQrToken] = useState('');
  const [timeLeft, setTimeLeft] = useState(60);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [densityMode, setDensityMode] = useState('ultra'); // 'ultra' (Level L - lowest detail) | 'standard' (Level M)

  const fetchNewToken = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/attendance/student/qr-token');
      if (res.data?.success) {
        setQrToken(res.data.data.token);
        setTimeLeft(60);
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

  // Countdown timer for 60-second rolling token
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

  const errorCorrectionLevel = densityMode === 'ultra' ? 'L' : 'M';

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 text-center shadow-sm relative overflow-hidden">
        {/* Top Header Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold mb-4">
          <Zap size={13} className="text-emerald-600" />
          <span>Ultra-Fast High-Legibility Pass</span>
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
            <div className="p-4 bg-white border-2 border-slate-900 rounded-3xl shadow-xl relative inline-block group">
              {loading && !qrToken ? (
                <div className="w-64 h-64 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="animate-spin text-brand-600" size={36} />
                  <span className="text-xs text-slate-400 font-medium">Generating ultra-clear pass...</span>
                </div>
              ) : (
                <div className="relative">
                  <QRCodeSVG
                    value={qrToken}
                    size={250}
                    level={errorCorrectionLevel}
                    includeMargin={true}
                    fgColor="#000000"
                    bgColor="#ffffff"
                    className="rounded-2xl transition-all"
                  />
                  {/* Quick Expand Button Hover */}
                  <button
                    onClick={() => setIsFullscreen(true)}
                    className="absolute top-2 right-2 p-2 rounded-xl bg-slate-900/80 hover:bg-slate-900 text-white shadow-md transition cursor-pointer backdrop-blur-sm opacity-90 hover:opacity-100"
                    title="Fullscreen zoom for instant podium scanning"
                  >
                    <Maximize2 size={15} />
                  </button>
                </div>
              )}
            </div>

            {/* Quick density level toggle */}
            <div className="mt-4 flex items-center justify-center gap-2">
              <span className="text-[11px] font-semibold text-slate-400">QR Detail:</span>
              <button
                onClick={() => setDensityMode('ultra')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                  densityMode === 'ultra'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Ultra-Clear (Minimal Detail)
              </button>
              <button
                onClick={() => setDensityMode('standard')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                  densityMode === 'standard'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Balanced
              </button>
            </div>

            {/* Countdown Progress Bar */}
            <div className="w-72 mt-5 space-y-1.5">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <Clock size={13} />
                  <span>Dynamic Pass Validity</span>
                </span>
                <span className={timeLeft < 15 ? 'text-rose-600 font-bold' : 'text-brand-600 font-mono font-bold'}>
                  {timeLeft}s remaining
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-1000 ${
                    timeLeft < 15 ? 'bg-rose-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${(timeLeft / 60) * 100}%` }}
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

        {/* Student Credential Ledger Info */}
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
          <div className="flex justify-between border-t border-slate-200/60 pt-2 text-[11px]">
            <span className="text-slate-400">Token Format:</span>
            <span className="font-mono text-emerald-700 font-bold">Ultra-Compact (35 Chars)</span>
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
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-slate-950/95 backdrop-blur-md animate-fade-in">
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

          <div className="p-6 bg-white rounded-3xl shadow-2xl border-4 border-slate-800">
            <QRCodeSVG
              value={qrToken}
              size={300}
              level={errorCorrectionLevel}
              includeMargin={true}
              fgColor="#000000"
              bgColor="#ffffff"
            />
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