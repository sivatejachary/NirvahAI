'use client';

import { useState, useEffect, useCallback } from 'react';

interface Application {
  id: string;
  job_id: string;
  candidate_name: string;
  candidate_email: string;
  job_title?: string;
  fit_score: number;
  screening_feedback: string;
  created_at: string;
  status: string;
  raw_parsed_data?: {
    skills?: string[];
    experience_years?: number;
    education?: Array<{ school: string; degree: string; year: string }>;
  };
}

export default function ResumeScreeningPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
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
      const [appRes, jobsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/applications`, { headers }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/jobs`, { headers })
      ]);
      let appsData: Application[] = [];
      let jobsData: Array<{ id: string; title: string }> = [];
      if (appRes.ok) appsData = await appRes.json();
      if (jobsRes.ok) jobsData = await jobsRes.json();
      
      const mappedApps = appsData.map(app => ({
        ...app,
        job_title: jobsData.find(j => j.id === app.job_id)?.title || 'Unknown Job'
      }));
      setApplications(mappedApps);
    } catch {
      setErrorMsg('Failed to load screening applications.');
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
        setSuccessMsg(`Candidate successfully moved to ${status}`);
        await loadData();
        setSelectedApp(null);
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        const d = await res.json();
        setErrorMsg(d.detail || 'Failed to update application status.');
      }
    } catch {
      setErrorMsg('Connection error.');
    } finally {
      setActionLoading(false);
    }
  };

  const scoreColor = (s: number) =>
    s >= 80 ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' :
    s >= 50 ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' :
    'text-rose-400 border-rose-500/30 bg-rose-500/10';

  return (
    <div style={{ display: 'flex', gap: '24px', height: 'calc(100vh - 100px)', minHeight: 0 }}>
      {/* Left List */}
      <div style={{ width: '360px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h1 className="text-xl font-bold text-white">Resume Screening AI</h1>
          <p className="text-xs text-slate-400 mt-0.5">Demographics-blind parsing & matching</p>
        </div>
        {successMsg && <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-400">{successMsg}</div>}
        {errorMsg && <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400">{errorMsg}</div>}
        
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : applications.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-xs text-slate-500">No applications to screen.</div>
          ) : (
            applications.map(app => (
              <div key={app.id} onClick={() => setSelectedApp(app)}
                className={`cursor-pointer rounded-xl border p-4 transition-all duration-150 ${
                  selectedApp?.id === app.id
                    ? 'border-violet-500/50 bg-violet-500/5 shadow-lg shadow-violet-500/10'
                    : 'border-white/5 bg-slate-900/40 hover:border-white/10 hover:bg-slate-900/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p className="truncate text-sm font-semibold text-white">{app.candidate_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{app.job_title}</p>
                  </div>
                  <div className={`flex-shrink-0 rounded-lg border px-2 py-1 text-center ${scoreColor(app.fit_score)}`}>
                    <p className="text-xs font-black">{Math.round(app.fit_score)}%</p>
                    <p className="text-[9px] font-medium uppercase">ATS</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Details */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {!selectedApp ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/10 bg-slate-900/20 text-center p-12">
            <div className="text-6xl">📄</div>
            <h2 className="text-lg font-semibold text-white">Select a Candidate</h2>
            <p className="text-sm text-slate-400 max-w-xs">View demographics-blind parsing metadata, AI feedback matching, and screen applications.</p>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, gap: '20px' }}>
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedApp.candidate_name}</h2>
                <p className="text-xs text-slate-400">{selectedApp.candidate_email} · {selectedApp.job_title}</p>
              </div>
              <div className={`rounded-xl border px-4 py-2 ${scoreColor(selectedApp.fit_score)}`}>
                <p className="text-xl font-black">{Math.round(selectedApp.fit_score)}%</p>
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">ATS Match</p>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }} className="space-y-5 pr-2">
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                <h3 className="text-xs font-bold text-violet-400 uppercase tracking-wider mb-2">🤖 AI Screening Recommendation</h3>
                <p className="text-xs text-slate-300 leading-relaxed">{selectedApp.screening_feedback || 'No screening notes generated.'}</p>
              </div>

              {selectedApp.raw_parsed_data && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Technical Skills</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedApp.raw_parsed_data.skills?.map(skill => (
                        <span key={skill} className="rounded bg-slate-800 border border-white/5 px-2.5 py-1 text-xs text-slate-300">{skill}</span>
                      )) || <span className="text-xs text-slate-500">None extracted</span>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Work Experience</h4>
                      <p className="text-sm font-medium text-white">{selectedApp.raw_parsed_data.experience_years ?? 0} Years</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Education</h4>
                      <div className="space-y-1">
                        {selectedApp.raw_parsed_data.education?.map((edu, idx) => (
                          <p key={idx} className="text-xs text-slate-300">{edu.degree} - {edu.school} ({edu.year})</p>
                        )) || <p className="text-xs text-slate-500">None extracted</p>}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="border-t border-white/5 pt-4 flex gap-3">
              <button onClick={() => handleDecision(selectedApp.id, 'MCQ_STAGE')} disabled={actionLoading}
                className="flex-1 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white hover:bg-emerald-500 transition disabled:opacity-50">
                Shortlist (Move to MCQ)
              </button>
              <button onClick={() => handleDecision(selectedApp.id, 'REVIEW_REQUIRED')} disabled={actionLoading}
                className="rounded-xl border border-white/10 px-6 py-3 text-xs font-bold text-slate-300 hover:bg-slate-800 transition disabled:opacity-50">
                Mark for Review
              </button>
              <button onClick={() => handleDecision(selectedApp.id, 'REJECTED')} disabled={actionLoading}
                className="flex-1 rounded-xl bg-rose-600/20 border border-rose-500/30 py-3 text-xs font-bold text-rose-400 hover:bg-rose-600/30 transition disabled:opacity-50">
                Reject & Recommend Upskilling
              </button>
            </div>
            
            {/* Upskill note */}
            {selectedApp.status === 'REJECTED' && (
              <div className="rounded-xl border border-rose-500/10 bg-rose-500/5 p-3 text-xs text-rose-300">
                💡 Candidate rejected. A personalized email was dispatched suggesting upskilling courses in their VidyamargAI student account.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
