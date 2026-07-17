'use client';

import { useState, useEffect, useCallback } from 'react';

interface Candidate {
  id: string;
  job_id: string;
  candidate_name: string;
  candidate_email: string;
  job_title?: string;
  status: string;
  fit_score: number;
}

export default function HiringDecisionsPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
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
      const [appRes, jobsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/applications`, { headers }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/jobs`, { headers })
      ]);

      let appsData: Candidate[] = [];
      let jobsData: Array<{ id: string; title: string }> = [];

      if (appRes.ok) appsData = await appRes.json();
      if (jobsRes.ok) jobsData = await jobsRes.json();

      const mapped = appsData.map(a => ({
        ...a,
        job_title: jobsData.find(j => j.id === a.job_id)?.title || 'Software Engineer'
      }));

      setCandidates(mapped);
    } catch {
      setErrorMsg('Failed to load candidate decisions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const moveCandidate = async (candidateId: string, newStatus: string) => {
    setActionLoading(candidateId);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/applications/${candidateId}/status`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setSuccessMsg(`Candidate successfully transitioned to ${newStatus.replace('_STAGE', '')}`);
        await loadData();
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setErrorMsg('Failed to transition candidate.');
      }
    } catch {
      setErrorMsg('Connection error.');
    } finally {
      setActionLoading(null);
    }
  };

  const getColumnCandidates = (colType: string) => {
    if (colType === 'HIRE') {
      return candidates.filter(c => c.status === 'OFFER_STAGE' || c.status === 'COMPLETED');
    }
    if (colType === 'HOLD') {
      return candidates.filter(c => c.status === 'REVIEW_REQUIRED' || c.status === 'APPLIED');
    }
    return candidates.filter(c => c.status === 'REJECTED');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Hiring Decisions Board</h1>
        <p className="text-xs text-slate-400 mt-0.5">Kanban board to finalize offers, holds, and rejections</p>
      </div>

      {successMsg && <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-400">{successMsg}</div>}
      {errorMsg && <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400">{errorMsg}</div>}

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6" style={{ height: 'calc(100vh - 200px)', minHeight: 0 }}>
          {/* Column HIRE */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex flex-col gap-3 overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-emerald-500/10">
              <h2 className="text-sm font-bold text-emerald-400">🎉 HIRE ({getColumnCandidates('HIRE').length})</h2>
            </div>
            {getColumnCandidates('HIRE').map(c => (
              <div key={c.id} className="rounded-lg border border-white/5 bg-slate-900/60 p-3.5 space-y-2">
                <p className="text-xs font-semibold text-white">{c.candidate_name}</p>
                <p className="text-[10px] text-slate-500">{c.job_title}</p>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => moveCandidate(c.id, 'REJECTED')} disabled={actionLoading === c.id}
                    className="flex-1 rounded bg-rose-950/40 hover:bg-rose-950/70 border border-rose-900/40 text-[9px] font-bold text-rose-400 py-1 transition">Reject</button>
                  <button onClick={() => moveCandidate(c.id, 'REVIEW_REQUIRED')} disabled={actionLoading === c.id}
                    className="flex-1 rounded bg-slate-800 hover:bg-slate-700 text-[9px] font-bold text-slate-300 py-1 transition">Hold</button>
                </div>
              </div>
            ))}
          </div>

          {/* Column HOLD */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex flex-col gap-3 overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-amber-500/10">
              <h2 className="text-sm font-bold text-amber-400">⏳ HOLD / REVIEW ({getColumnCandidates('HOLD').length})</h2>
            </div>
            {getColumnCandidates('HOLD').map(c => (
              <div key={c.id} className="rounded-lg border border-white/5 bg-slate-900/60 p-3.5 space-y-2">
                <p className="text-xs font-semibold text-white">{c.candidate_name}</p>
                <p className="text-[10px] text-slate-500">{c.job_title}</p>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => moveCandidate(c.id, 'OFFER_STAGE')} disabled={actionLoading === c.id}
                    className="flex-1 rounded bg-emerald-950/40 hover:bg-emerald-950/70 border border-emerald-900/40 text-[9px] font-bold text-emerald-400 py-1 transition">Approve Hire</button>
                  <button onClick={() => moveCandidate(c.id, 'REJECTED')} disabled={actionLoading === c.id}
                    className="flex-1 rounded bg-rose-950/40 hover:bg-rose-950/70 border border-rose-900/40 text-[9px] font-bold text-rose-400 py-1 transition">Reject</button>
                </div>
              </div>
            ))}
          </div>

          {/* Column REJECT */}
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 flex flex-col gap-3 overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-rose-500/10">
              <h2 className="text-sm font-bold text-rose-400">❌ REJECTED ({getColumnCandidates('REJECTED').length})</h2>
            </div>
            {getColumnCandidates('REJECTED').map(c => (
              <div key={c.id} className="rounded-lg border border-white/5 bg-slate-900/60 p-3.5 space-y-2">
                <p className="text-xs font-semibold text-white">{c.candidate_name}</p>
                <p className="text-[10px] text-slate-500">{c.job_title}</p>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => moveCandidate(c.id, 'OFFER_STAGE')} disabled={actionLoading === c.id}
                    className="flex-1 rounded bg-emerald-950/40 hover:bg-emerald-950/70 border border-emerald-900/40 text-[9px] font-bold text-emerald-400 py-1 transition">Re-evaluate</button>
                  <button onClick={() => moveCandidate(c.id, 'REVIEW_REQUIRED')} disabled={actionLoading === c.id}
                    className="flex-1 rounded bg-slate-800 hover:bg-slate-700 text-[9px] font-bold text-slate-300 py-1 transition">Hold</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
