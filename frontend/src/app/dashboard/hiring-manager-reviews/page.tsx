'use client';

import { useState, useEffect, useCallback } from 'react';

interface InterviewRound {
  id: string;
  application_id: string;
  candidate_name?: string;
  candidate_email?: string;
  job_title?: string;
  round_type: string;
  interviewer_name: string;
  scheduled_at: string;
  decision: string; // PASS | FAIL | HOLD | PENDING
  rating: number | null;
  feedback: string | null;
}

export default function HiringManagerReviewsPage() {
  const [rounds, setRounds] = useState<InterviewRound[]>([]);
  const [selectedRound, setSelectedRound] = useState<InterviewRound | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [rating, setRating] = useState('5');
  const [feedbackText, setFeedbackText] = useState('');
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
      const [roundsRes, appRes, jobsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/selection/rounds`, { headers }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/applications`, { headers }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/jobs`, { headers })
      ]);

      let roundsData: InterviewRound[] = [];
      let appsData: Array<{ id: string; candidate_name: string; candidate_email: string; job_id: string }> = [];
      let jobsData: Array<{ id: string; title: string }> = [];

      if (roundsRes.ok) roundsData = await roundsRes.ok ? await roundsRes.json() : [];
      if (appRes.ok) appsData = await appRes.json();
      if (jobsRes.ok) jobsData = await jobsRes.json();

      const mappedRounds = roundsData.map(r => {
        const app = appsData.find(a => a.id === r.application_id);
        const job = app ? jobsData.find(j => j.id === app.job_id) : null;
        return {
          ...r,
          candidate_name: app?.candidate_name || 'Unknown Candidate',
          candidate_email: app?.candidate_email || 'Unknown Email',
          job_title: job?.title || 'Unknown Job'
        };
      });

      // Filter to manager/panel rounds that are still pending or completed
      setRounds(mappedRounds.filter(r => r.round_type === 'MANAGER' || r.round_type === 'TECHNICAL'));
    } catch {
      setErrorMsg('Failed to load review requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmitDecision = async (decision: string) => {
    if (!selectedRound) return;
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/selection/${selectedRound.id}/decision`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          decision,
          rating: parseInt(rating),
          feedback: feedbackText
        })
      });
      if (res.ok) {
        setSuccessMsg(`Round marked as ${decision}`);
        setFeedbackText('');
        setSelectedRound(null);
        await loadData();
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setErrorMsg('Failed to submit decision.');
      }
    } catch {
      setErrorMsg('Connection error.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '24px', height: 'calc(100vh - 100px)', minHeight: 0 }}>
      {/* Left panel */}
      <div style={{ width: '360px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h1 className="text-xl font-bold text-white">Hiring Manager Reviews</h1>
          <p className="text-xs text-slate-400 mt-0.5">Culture-fit & alignment grading</p>
        </div>
        {successMsg && <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-400">{successMsg}</div>}
        {errorMsg && <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400">{errorMsg}</div>}

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : rounds.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-xs text-slate-500">No review rounds pending.</div>
          ) : (
            rounds.map(round => (
              <div key={round.id} onClick={() => setSelectedRound(round)}
                className={`cursor-pointer rounded-xl border p-4 transition-all duration-150 ${
                  selectedRound?.id === round.id
                    ? 'border-violet-500/50 bg-violet-500/5 shadow-lg shadow-violet-500/10'
                    : 'border-white/5 bg-slate-900/40 hover:border-white/10 hover:bg-slate-900/70'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-semibold text-white">{round.candidate_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{round.job_title}</p>
                  </div>
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-400 uppercase">{round.decision}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {!selectedRound ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/10 bg-slate-900/20 text-center p-12">
            <div className="text-6xl">👨‍💼</div>
            <h2 className="text-lg font-semibold text-white">Select a Review Round</h2>
            <p className="text-sm text-slate-400 max-w-xs">Rate the candidate, provide structured culture-fit, technical alignment, and make the final decision.</p>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, gap: '20px' }}>
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedRound.candidate_name}</h2>
                <p className="text-xs text-slate-400">{selectedRound.candidate_email} · {selectedRound.job_title}</p>
              </div>
              <div className="text-center rounded-lg border border-white/5 bg-slate-900/30 px-3 py-1.5">
                <p className="text-sm font-black text-violet-400">{selectedRound.round_type}</p>
                <p className="text-[9px] font-bold text-slate-500 uppercase">Round Type</p>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }} className="space-y-4 pr-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Interviewer Rating (1-10)</label>
                <select value={rating} onChange={e => setRating(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none">
                  {[...Array(10)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1} - {i + 1 === 10 ? 'Elite' : i + 1 >= 8 ? 'Strong Pass' : i + 1 >= 5 ? 'Average' : 'Fail'}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Structured Feedback & Culture Alignment Notes</label>
                <textarea rows={6} value={feedbackText} onChange={e => setFeedbackText(e.target.value)} placeholder="Provide feedback notes on alignment, career goals, technical capabilities..."
                  className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none resize-none" />
              </div>
            </div>

            <div className="border-t border-white/5 pt-4 flex gap-3">
              <button onClick={() => handleSubmitDecision('PASS')} disabled={actionLoading}
                className="flex-1 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white hover:bg-emerald-500 transition disabled:opacity-50">
                Recommended Hire (Pass)
              </button>
              <button onClick={() => handleSubmitDecision('HOLD')} disabled={actionLoading}
                className="rounded-xl border border-white/10 px-6 py-3 text-xs font-bold text-slate-300 hover:bg-slate-800 transition disabled:opacity-50">
                Put on Hold
              </button>
              <button onClick={() => handleSubmitDecision('FAIL')} disabled={actionLoading}
                className="flex-1 rounded-xl bg-rose-600/20 border border-rose-500/30 py-3 text-xs font-bold text-rose-400 hover:bg-rose-600/30 transition disabled:opacity-50">
                Reject Candidate (Fail)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
