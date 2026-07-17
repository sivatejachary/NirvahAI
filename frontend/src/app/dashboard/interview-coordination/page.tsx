'use client';

import { useState, useEffect, useCallback } from 'react';

interface InterviewRound {
  id: string;
  application_id: string;
  candidate_name?: string;
  candidate_email?: string;
  job_title?: string;
  round_type: string; // HR | MANAGER | PANEL | TECHNICAL
  interviewer_name: string;
  interviewer_email: string;
  scheduled_at: string;
  decision: string; // PASS | FAIL | HOLD | PENDING
  rating: number | null;
  feedback: string | null;
}

export default function InterviewCoordinationPage() {
  const [rounds, setRounds] = useState<InterviewRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [candidates, setCandidates] = useState<Array<{ id: string; name: string; email: string; job: string }>>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [roundType, setRoundType] = useState('TECHNICAL');
  const [interviewerName, setInterviewerName] = useState('');
  const [interviewerEmail, setInterviewerEmail] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
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
      const [roundsRes, appRes, jobsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/selection/rounds`, { headers }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/applications`, { headers }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/jobs`, { headers })
      ]);

      let roundsData: InterviewRound[] = [];
      let appsData: Array<{ id: string; candidate_name: string; candidate_email: string; job_id: string }> = [];
      let jobsData: Array<{ id: string; title: string }> = [];

      if (roundsRes.ok) roundsData = await roundsRes.json();
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

      setRounds(mappedRounds);

      const selectCandidates = appsData.map(a => ({
        id: a.id,
        name: a.candidate_name,
        email: a.candidate_email,
        job: jobsData.find(j => j.id === a.job_id)?.title || 'Software Engineer'
      }));
      setCandidates(selectCandidates);
    } catch {
      setErrorMsg('Failed to load interview coordination details.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/selection/schedule`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          application_id: selectedCandidateId,
          round_type: roundType,
          interviewer_name: interviewerName,
          interviewer_email: interviewerEmail,
          scheduled_at: scheduleTime
        })
      });
      if (res.ok) {
        setSuccessMsg('Human Interview Round successfully scheduled.');
        setShowScheduleModal(false);
        setInterviewerName('');
        setInterviewerEmail('');
        setScheduleTime('');
        await loadData();
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        const d = await res.json();
        setErrorMsg(d.detail || 'Failed to schedule round.');
      }
    } catch {
      setErrorMsg('Connection error.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-white">Interview Coordinator</h1>
          <p className="text-xs text-slate-400 mt-0.5">Automated panel assignment, booking and notifications</p>
        </div>
        <button onClick={() => setShowScheduleModal(true)}
          className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-500 transition">
          ➕ Schedule Human Round
        </button>
      </div>

      {successMsg && <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-400">{successMsg}</div>}
      {errorMsg && <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400">{errorMsg}</div>}

      {/* Grid of Scheduled Interviews */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rounds.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-slate-500">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-sm">No scheduled human interviews yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rounds.map(round => (
            <div key={round.id} className="rounded-xl border border-white/5 bg-slate-900/40 p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-sm font-semibold text-white">{round.candidate_name}</h3>
                  <p className="text-xs text-slate-500">{round.job_title}</p>
                </div>
                <span className="rounded bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 text-[9px] font-black text-violet-400 uppercase">
                  {round.round_type}
                </span>
              </div>
              <div className="space-y-1.5 text-xs">
                <p className="text-slate-400">👤 Panel: <span className="text-slate-200">{round.interviewer_name}</span></p>
                <p className="text-slate-400">📅 Date: <span className="text-slate-200">{new Date(round.scheduled_at).toLocaleString()}</span></p>
                <p className="text-slate-400">🔗 Link: <span className="text-violet-400 font-mono underline cursor-pointer">join.zoom.us/902-832</span></p>
              </div>
              <div className="flex justify-between items-center border-t border-white/5 pt-2 text-[10px]">
                <span className="text-slate-500">Decision: {round.decision}</span>
                <span className="text-emerald-400 font-bold">ℹ️ Invites Sent</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Schedule Interview Modal */}
      {showScheduleModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="rounded-xl border border-white/10 bg-slate-900 p-6 w-[480px] space-y-4">
            <h2 className="text-lg font-bold text-white">Schedule Human Interview Round</h2>
            <form onSubmit={handleScheduleSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Candidate</label>
                <select value={selectedCandidateId} onChange={e => setSelectedCandidateId(e.target.value)} required
                  className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none">
                  <option value="">Select Candidate...</option>
                  {candidates.map(c => <option key={c.id} value={c.id}>{c.name} ({c.job})</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Round Type</label>
                <select value={roundType} onChange={e => setRoundType(e.target.value)} required
                  className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none">
                  <option value="TECHNICAL">Technical Round 1</option>
                  <option value="PANEL">Panel Coding Round</option>
                  <option value="MANAGER">Hiring Manager Fit</option>
                  <option value="HR">HR Negotiation</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">Interviewer Name</label>
                  <input type="text" value={interviewerName} onChange={e => setInterviewerName(e.target.value)} required placeholder="e.g. John Doe"
                    className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">Interviewer Email</label>
                  <input type="email" value={interviewerEmail} onChange={e => setInterviewerEmail(e.target.value)} required placeholder="e.g. john@company.com"
                    className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Schedule Date & Time</label>
                <input type="datetime-local" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} required
                  className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none" />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowScheduleModal(false)}
                  className="rounded-lg border border-white/10 px-4 py-2 text-xs text-slate-400 hover:text-white transition">Cancel</button>
                <button type="submit" disabled={actionLoading}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-500 transition disabled:opacity-50">
                  {actionLoading ? 'Scheduling...' : 'Create Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
