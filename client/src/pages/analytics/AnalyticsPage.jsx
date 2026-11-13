import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { AlertTriangle, ShieldAlert, CheckCircle2, User, BookOpen, Clock, Users } from 'lucide-react';

export default function AnalyticsPage() {
  const { user, isMentor } = useAuth();
  const [riskData, setRiskData] = useState([]);
  const [onlyMentees, setOnlyMentees] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadRiskIndicators = async () => {
    try {
      setLoading(true);
      const url = onlyMentees
        ? '/analytics/risk-indicators?onlyMentees=true'
        : '/analytics/risk-indicators';
      const res = await api.get(url);
      if (res.data?.success) {
        setRiskData(res.data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRiskIndicators();
  }, [onlyMentees]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 rounded-full text-xs font-semibold mb-2">
            <AlertTriangle size={14} />
            <span>Early Warning & Academic Support Intelligence</span>
          </div>
          <h1 className="text-xl font-bold text-slate-800">Explainable Student Risk Indicators</h1>
          <p className="text-xs text-slate-500 mt-1">
            Synthesizes attendance deficits, internal exam marks, and submission compliance to identify students needing intervention.
          </p>
        </div>

        {isMentor && (
          <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={onlyMentees}
              onChange={(e) => setOnlyMentees(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span>Filter to My Assigned Mentees Only</span>
          </label>
        )}
      </div>

      {/* Risk Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Identified Students</div>
          <div className="text-2xl font-bold text-slate-800 mt-1">{riskData.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">Requiring mentor attention</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-sm">
          <div className="text-xs font-semibold text-rose-600 uppercase tracking-wider">High Risk Alert</div>
          <div className="text-2xl font-bold text-rose-700 mt-1">
            {riskData.filter((r) => r.riskLevel === 'high').length}
          </div>
          <div className="text-[11px] text-rose-500 mt-1">Multiple simultaneous factors</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm">
          <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Moderate Concern</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">
            {riskData.filter((r) => r.riskLevel === 'moderate').length}
          </div>
          <div className="text-[11px] text-amber-600 mt-1">Attendance or coursework alert</div>
        </div>
      </div>

      {/* Explainable Indicator Cards */}
      <div className="space-y-4">
        {riskData.length === 0 ? (
          <div className="py-16 text-center text-slate-400 bg-white rounded-3xl border border-slate-200 text-xs">
            <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
            <span>No student academic risk triggers currently detected.</span>
          </div>
        ) : (
          riskData.map((item) => (
            <div
              key={item.student._id}
              className={`bg-white rounded-3xl border p-6 shadow-sm space-y-4 transition ${
                item.riskLevel === 'high'
                  ? 'border-rose-200 hover:border-rose-300'
                  : 'border-amber-200 hover:border-amber-300'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-slate-900">{item.student.name}</span>
                    <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {item.student.rollNumber}
                    </span>
                    <span className="text-xs text-slate-500">{item.student.batch}</span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-3">
                    <span>Email: {item.student.email}</span>
                    <span>Mentor: {item.student.mentor}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 ${
                      item.riskLevel === 'high'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    <ShieldAlert size={14} />
                    <span>{item.riskLevel} Attention</span>
                  </span>
                </div>
              </div>

              {/* Explainable Conditions List */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Explainable Conditions Triggered:
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {item.factors.map((factor, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-2xl border text-xs space-y-1 ${
                        factor.severity === 'critical'
                          ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                          : 'bg-amber-50/70 border-amber-200 text-amber-900'
                      }`}
                    >
                      <div className="font-bold text-[11px] uppercase tracking-wider">
                        [{factor.dimension}]
                      </div>
                      <p>{factor.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
