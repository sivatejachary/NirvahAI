'use client';

import { useState, useEffect, useCallback } from 'react';

interface AssessmentAttempt {
  id: string;
  application_id: string;
  candidate_name?: string;
  candidate_email?: string;
  job_title?: string;
  type: string; // MCQ | APTITUDE | TECHNICAL
  status: string; // PENDING | COMPLETED | EVALUATED
  score: number | null;
  max_score: number;
  integrity_risk: string; // LOW | MEDIUM | HIGH
  proctoring_logs?: Array<{ event_type: string; timestamp: string }>;
  created_at: string;
}

export default function MCQAssessmentsPage() {
  const [attempts, setAttempts] = useState<AssessmentAttempt[]>([]);
  const [selectedAttempt, setSelectedAttempt] = useState<AssessmentAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    const headers = getHeaders();
    try {
      const [attemptRes, appRes, jobsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/assessments/attempts`, { headers }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/applications`, { headers }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/jobs`, { headers })
      ]);
      
      let attemptsData: AssessmentAttempt[] = [];
      let appsData: Array<{ id: string; candidate_name: string; candidate_email: string; job_id: string }> = [];
      let jobsData: Array<{ id: string; title: string }> = [];

      if (attemptRes.ok) attemptsData = await attemptRes.json();
      if (appRes.ok) appsData = await appRes.json();
      if (jobsRes.ok) jobsData = await jobsRes.json();

      const mappedAttempts = attemptsData.map(att => {
        const app = appsData.find(a => a.id === att.application_id);
        const job = app ? jobsData.find(j => j.id === app.job_id) : null;
        return {
          ...att,
          candidate_name: app?.candidate_name || 'Unknown Candidate',
          candidate_email: app?.candidate_email || 'Unknown Email',
          job_title: job?.title || 'Unknown Job'
        };
      });

      setAttempts(mappedAttempts);
    } catch {
      setErrorMsg('Failed to load MCQ assessment attempts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDecision = async (appId: string, status: string) => {
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/applications/${appId}/status`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        setSuccessMsg(`Candidate marked as ${status}`);
        await loadData();
        setSelectedAttempt(null);
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setErrorMsg('Failed to update stage decision.');
      }
    } catch {
      setErrorMsg('Connection error.');
    } finally {
      setActionLoading(false);
    }
  };

  const integrityColor = (risk: string) =>
    risk === 'HIGH' ? 'text-rose-400 border-rose-500/30 bg-rose-500/10' :
    risk === 'MEDIUM' ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' :
    'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';

  return (
    <div style={{ display: 'flex', gap: '24px', height: 'calc(100vh - 100px)', minHeight: 0 }}>
      {/* Left panel: list of attempts */}
      <div style={{ width: '360px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h1 className="text-xl font-bold text-white">MCQ & Aptitude Assessments</h1>
          <p className="text-xs text-slate-400 mt-0.5">Automated screening & integrity auditing</p>
        </div>
        {successMsg && <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-400">{successMsg}</div>}
        {errorMsg && <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400">{errorMsg}</div>}

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : attempts.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-xs text-slate-500">No attempts registered yet.</div>
          ) : (
            attempts.map(att => (
              <div key={att.id} onClick={() => setSelectedAttempt(att)}
                className={`cursor-pointer rounded-xl border p-4 transition-all duration-150 ${
                  selectedAttempt?.id === att.id
                    ? 'border-violet-500/50 bg-violet-500/5 shadow-lg shadow-violet-500/10'
                    : 'border-white/5 bg-slate-900/40 hover:border-white/10 hover:bg-slate-900/70'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-semibold text-white">{att.candidate_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{att.job_title}</p>
                  </div>
                  <span className={`rounded border px-2 py-0.5 text-[9px] font-black tracking-wide ${integrityColor(att.integrity_risk)}`}>
                    🛡️ {att.integrity_risk}
                  </span>
                </div>
                <div className="mt-2 flex justify-between items-center text-xs">
                  <span className="text-slate-400">Score: {att.score !== null ? `${att.score}/${att.max_score}` : 'Pending'}</span>
                  <span className="text-slate-500">{att.status}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right panel: Details */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {!selectedAttempt ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/10 bg-slate-900/20 text-center p-12">
            <div className="text-6xl">📝</div>
            <h2 className="text-lg font-semibold text-white">Select an Assessment Attempt</h2>
            <p className="text-sm text-slate-400 max-w-xs">Audit candidate MCQ answers, check anti-cheat logs, integrity risk levels and assign decision status.</p>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, gap: '20px' }}>
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedAttempt.candidate_name}</h2>
                <p className="text-xs text-slate-400">{selectedAttempt.candidate_email} · {selectedAttempt.job_title}</p>
              </div>
              <div className="flex gap-4">
                <div className="text-center rounded-lg border border-white/5 bg-slate-900/30 px-3 py-1.5">
                  <p className="text-lg font-black text-violet-400">
                    {selectedAttempt.score !== null ? `${Math.round((selectedAttempt.score / selectedAttempt.max_score) * 100)}%` : 'N/A'}
                  </p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase">Aptitude Score</p>
                </div>
                <div className={`text-center rounded-lg border px-3 py-1.5 ${integrityColor(selectedAttempt.integrity_risk)}`}>
                  <p className="text-sm font-black uppercase">{selectedAttempt.integrity_risk}</p>
                  <p className="text-[9px] font-bold uppercase tracking-wider">Integrity Risk</p>
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }} className="space-y-4 pr-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">🔒 Anti-Cheating & Proctoring Logs</h3>
              <div className="rounded-xl border border-white/5 bg-slate-950/20 p-4 space-y-2 max-h-48 overflow-y-auto">
                {selectedAttempt.proctoring_logs && selectedAttempt.proctoring_logs.length > 0 ? (
                  selectedAttempt.proctoring_logs.map((log, idx) => (
                    <div key={idx} className="flex justify-between text-xs font-mono">
                      <span className="text-rose-400">⚠️ {log.event_type}</span>
                      <span className="text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400">🛡️ No integrity threats detected during test proctoring.</p>
                )}
              </div>

              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                <h4 className="text-xs font-bold text-violet-400 uppercase mb-1">🤖 AI Test Proctor Assessment</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {selectedAttempt.integrity_risk === 'HIGH' 
                    ? 'Proctoring logs alert multiple screen swaps or tab switches. Candidate flag is set to manual review.' 
                    : 'Candidate remained focused on the window with zero background activity. Integrity validated.'}
                </p>
              </div>
            </div>

            <div className="border-t border-white/5 pt-4 flex gap-3">
              <button onClick={() => handleDecision(selectedAttempt.application_id, 'CODING_STAGE')} disabled={actionLoading}
                className="flex-1 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white hover:bg-emerald-500 transition disabled:opacity-50">
                Pass (Move to Coding)
              </button>
              <button onClick={() => handleDecision(selectedAttempt.application_id, 'REJECTED')} disabled={actionLoading}
                className="flex-1 rounded-xl bg-rose-600/20 border border-rose-500/30 py-3 text-xs font-bold text-rose-400 hover:bg-rose-600/30 transition disabled:opacity-50">
                Fail & Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
