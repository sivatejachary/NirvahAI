'use client';

import { useState, useEffect, useCallback } from 'react';

interface Application {
  id: string;
  job_id: string;
  job_title?: string;
  candidate_name: string;
  candidate_email: string;
  resume_url: string;
  status: string;
  fit_score: number;
  screening_feedback: string;
  created_at: string;
  raw_parsed_data?: {
    skills?: string[];
    experience_years?: number;
    education?: Array<{ school: string; degree: string; year: string }>;
  };
}

interface Job { id: string; title: string; }

interface PipelineStage {
  id: string;
  stage_number: number;
  stage_name: string;
  status: string;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  score: number | null;
  max_score: number | null;
  feedback: string | null;
  ai_recommendation: string | null;
  recruiter_feedback: string | null;
  ai_evaluated: boolean;
  manually_overridden: boolean;
  metadata: Record<string, any>;
}

const STAGE_ICONS: Record<number, string> = {
  1: '📄', 2: '📝', 3: '💻', 4: '🤖', 5: '🏆',
  6: '📞', 7: '👤', 8: '📞', 9: '🏢', 10: '📞',
  11: '📋', 12: '📞', 13: '🔍', 14: '📞', 15: '🎉',
};

function getStatusStyle(status: string): string {
  const s: Record<string, string> = {
    PASSED: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400',
    FAILED: 'bg-rose-500/20 border-rose-500/40 text-rose-400',
    PENDING: 'bg-amber-500/20 border-amber-500/40 text-amber-400',
    SCHEDULED: 'bg-blue-500/20 border-blue-500/40 text-blue-400',
    IN_PROGRESS: 'bg-violet-500/20 border-violet-500/40 text-violet-400',
    SKIPPED: 'bg-slate-500/20 border-slate-500/40 text-slate-400',
  };
  return s[status] || 'bg-slate-800/50 border-white/5 text-slate-600';
}

export default function CandidatesDashboardPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('ALL');
  const [fitFilter, setFitFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [editStage, setEditStage] = useState<number | null>(null);
  const [editFeedback, setEditFeedback] = useState('');
  const [editScore, setEditScore] = useState('');

  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    const headers = getHeaders();
    try {
      const [appRes, jobsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/applications`, { headers }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/jobs`, { headers })
      ]);
      let appsData: Application[] = [];
      let jobsData: Job[] = [];
      if (appRes.ok) appsData = await appRes.json();
      if (jobsRes.ok) { jobsData = await jobsRes.json(); setJobs(jobsData); }
      const mappedApps = appsData.map(app => ({
        ...app,
        job_title: jobsData.find(j => j.id === app.job_id)?.title || 'Unknown Job'
      }));
      mappedApps.sort((a, b) => b.fit_score - a.fit_score);
      setApplications(mappedApps);
    } catch (err) {
      setErrorMsg('Failed to load candidates.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPipeline = useCallback(async (appId: string) => {
    setPipelineLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/pipeline/applications/${appId}/stages`,
        { headers: getHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        setPipeline(data);
      } else {
        // No stages yet — show empty
        setPipeline([]);
      }
    } catch {
      setPipeline([]);
    } finally {
      setPipelineLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    if (selectedApp) loadPipeline(selectedApp.id);
    else setPipeline([]);
  }, [selectedApp, loadPipeline]);

  const handleStageUpdate = async (stageNum: number, newStatus: string) => {
    if (!selectedApp) return;
    const key = `${stageNum}-${newStatus}`;
    setActionLoading(key);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const body: any = { status: newStatus };
      if (editStage === stageNum) {
        if (editScore) body.score = parseFloat(editScore);
        if (editFeedback) body.recruiter_feedback = editFeedback;
        setEditStage(null); setEditFeedback(''); setEditScore('');
      }
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/pipeline/applications/${selectedApp.id}/stages/${stageNum}`,
        { method: 'PATCH', headers: getHeaders(), body: JSON.stringify(body) }
      );
      if (res.ok) {
        setSuccessMsg(`Stage ${stageNum} → ${newStatus}`);
        await loadPipeline(selectedApp.id);
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        const d = await res.json();
        setErrorMsg(d.detail || 'Failed.');
      }
    } catch { setErrorMsg('Connection error.'); }
    finally { setActionLoading(null); }
  };

  const filteredApps = applications.filter(app => {
    const matchesSearch = app.candidate_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.candidate_email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesJob = selectedJobId === 'ALL' || app.job_id === selectedJobId;
    let matchesFit = true;
    if (fitFilter === 'HIGH') matchesFit = app.fit_score >= 80;
    else if (fitFilter === 'MID') matchesFit = app.fit_score >= 50 && app.fit_score < 80;
    else if (fitFilter === 'LOW') matchesFit = app.fit_score < 50;
    return matchesSearch && matchesJob && matchesFit;
  });

  const scoreColor = (s: number) =>
    s >= 80 ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' :
    s >= 50 ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' :
    'text-rose-400 border-rose-500/30 bg-rose-500/10';

  const passedCount = pipeline.filter(s => s.status === 'PASSED').length;
  const progress = pipeline.length > 0 ? Math.round((passedCount / pipeline.length) * 100) : 0;

  return (
    <div style={{ display: 'flex', gap: '24px', height: '100%', minHeight: 0 }}>
      {/* Left: Candidate List */}
      <div style={{ width: '360px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h1 className="text-xl font-bold text-white">Candidates Pipeline</h1>
          <p className="text-xs text-slate-400 mt-0.5">AI-powered 15-stage recruitment tracking</p>
        </div>
        {successMsg && <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-400">{successMsg}</div>}
        {errorMsg && <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400">{errorMsg}</div>}
        <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3 space-y-2">
          <input
            type="text" placeholder="Search candidates..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <select value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)}
              className="rounded-lg border border-white/10 bg-slate-950/40 px-2 py-1.5 text-xs text-white focus:outline-none">
              <option value="ALL">All Jobs</option>
              {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
            <select value={fitFilter} onChange={e => setFitFilter(e.target.value)}
              className="rounded-lg border border-white/10 bg-slate-950/40 px-2 py-1.5 text-xs text-white focus:outline-none">
              <option value="ALL">All Scores</option>
              <option value="HIGH">≥80%</option>
              <option value="MID">50-79%</option>
              <option value="LOW">&lt;50%</option>
            </select>
          </div>
          <button onClick={loadData} className="w-full rounded-lg bg-slate-800 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition">↻ Refresh</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredApps.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-xs text-slate-500">No candidates found.</div>
          ) : filteredApps.map(app => (
            <div key={app.id} onClick={() => setSelectedApp(app)}
              className={`cursor-pointer rounded-xl border p-4 transition-all duration-150 ${
                selectedApp?.id === app.id
                  ? 'border-violet-500/50 bg-violet-500/5 shadow-lg shadow-violet-500/10'
                  : 'border-white/5 bg-slate-900/40 hover:border-white/10 hover:bg-slate-900/70'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 text-sm font-black text-violet-300">
                  {app.candidate_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p className="truncate text-sm font-semibold text-white">{app.candidate_name}</p>
                  <p className="truncate text-xs text-slate-400">{app.candidate_email}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{app.job_title}</p>
                </div>
                <div className={`flex-shrink-0 rounded-lg border px-2 py-1 text-center ${scoreColor(app.fit_score)}`}>
                  <p className="text-xs font-black">{Math.round(app.fit_score)}%</p>
                  <p className="text-[9px] font-medium uppercase">ATS</p>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  {app.status.replace('_STAGE', '')}
                </span>
                <span className="text-[10px] text-slate-500">{new Date(app.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Pipeline Timeline */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {!selectedApp ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/10 bg-slate-900/20 text-center p-12">
            <div className="text-6xl">🎯</div>
            <h2 className="text-lg font-semibold text-white">Select a Candidate</h2>
            <p className="text-sm text-slate-400 max-w-xs">Choose a candidate to view their full 15-stage AI recruitment pipeline and take action at each stage.</p>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-indigo-500/30 text-xl font-black text-violet-300">
                  {selectedApp.candidate_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedApp.candidate_name}</h2>
                  <p className="text-sm text-slate-400">{selectedApp.candidate_email} · {selectedApp.job_title}</p>
                </div>
              </div>
              <div className={`rounded-xl border px-4 py-2 ${scoreColor(selectedApp.fit_score)}`}>
                <p className="text-2xl font-black">{Math.round(selectedApp.fit_score)}%</p>
                <p className="text-[10px] font-bold uppercase tracking-widest">AI FIT SCORE</p>
              </div>
            </div>

            {/* Progress */}
            {pipeline.length > 0 && (
              <div className="mb-5">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-400">{passedCount}/{pipeline.length} stages completed</span>
                  <span className="font-bold text-white">{progress}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-800">
                  <div className="h-1.5 rounded-full bg-gradient-to-r from-violet-500 to-emerald-500 transition-all duration-700" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            {/* AI Feedback card */}
            {selectedApp.screening_feedback && (
              <div className="mb-4 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                <p className="text-xs font-semibold text-violet-400 mb-1">🤖 AI Resume Screening Analysis</p>
                <p className="text-xs text-slate-300 leading-relaxed">{selectedApp.screening_feedback}</p>
              </div>
            )}

            {/* Candidate Skills */}
            {selectedApp.raw_parsed_data?.skills && selectedApp.raw_parsed_data.skills.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-1.5">
                {selectedApp.raw_parsed_data.skills.slice(0, 12).map((skill: string) => (
                  <span key={skill} className="rounded-lg bg-slate-800 border border-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-300">{skill}</span>
                ))}
              </div>
            )}

            {/* Stages */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
              {pipelineLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : pipeline.length === 0 ? (
                <div className="flex flex-col h-48 items-center justify-center rounded-xl border border-dashed border-white/10 text-center gap-3 p-8">
                  <p className="text-xs text-slate-500">No pipeline stages found for this application.</p>
                  <button
                    onClick={async () => {
                      const res = await fetch(
                        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/pipeline/applications/${selectedApp.id}/initialize`,
                        { method: 'POST', headers: getHeaders() }
                      );
                      if (res.ok) loadPipeline(selectedApp.id);
                    }}
                    className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-500 transition"
                  >
                    ▶ Initialize 15-Stage Pipeline
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                  {pipeline.map((stage, idx) => {
                    const isLocked = stage.status === 'LOCKED';
                    const isPassed = stage.status === 'PASSED';
                    const isFailed = stage.status === 'FAILED';
                    const isEditing = editStage === stage.stage_number;
                    const borderCls = isPassed ? 'border-emerald-500/20 bg-emerald-500/5'
                      : isFailed ? 'border-rose-500/20 bg-rose-500/5'
                      : isLocked ? 'border-white/3 bg-slate-900/20'
                      : 'border-amber-500/20 bg-amber-500/5';
                    return (
                      <div key={stage.id} style={{ display: 'flex', gap: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border text-sm ${
                            isPassed ? 'border-emerald-500/50 bg-emerald-500/20' :
                            isFailed ? 'border-rose-500/50 bg-rose-500/20' :
                            isLocked ? 'border-white/5 bg-slate-900/50' :
                            'border-amber-500/50 bg-amber-500/10'
                          }`}>
                            {isPassed ? '✓' : isFailed ? '✗' : isLocked ? '🔒' : STAGE_ICONS[stage.stage_number]}
                          </div>
                          {idx < pipeline.length - 1 && (
                            <div className={`w-0.5 my-1 min-h-4 ${isPassed ? 'bg-emerald-500' : isFailed ? 'bg-rose-500' : 'bg-slate-700'}`} style={{ flex: 1 }} />
                          )}
                        </div>
                        <div className={`flex-1 mb-2 rounded-xl border p-3 ${borderCls} ${isLocked ? 'opacity-50' : ''} transition-all`}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span className="text-xs font-bold text-slate-500">#{stage.stage_number}</span>
                                <span className={`text-sm font-semibold ${isLocked ? 'text-slate-600' : 'text-white'}`}>{stage.stage_name}</span>
                                <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${getStatusStyle(stage.status)}`}>{stage.status}</span>
                                {stage.ai_evaluated && <span className="text-[10px] text-violet-400">🤖 AI</span>}
                                {stage.manually_overridden && <span className="text-[10px] text-amber-400">👤 Manual</span>}
                              </div>
                              {(stage.scheduled_at || stage.completed_at) && (
                                <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }} className="text-[10px] text-slate-500">
                                  {stage.scheduled_at && <span>📅 {new Date(stage.scheduled_at).toLocaleString()}</span>}
                                  {stage.completed_at && <span>✅ {new Date(stage.completed_at).toLocaleString()}</span>}
                                </div>
                              )}
                              {stage.score !== null && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                                  <div style={{ height: '4px', flex: 1, borderRadius: '9999px', background: '#1e293b' }}>
                                    <div style={{
                                      height: '4px', borderRadius: '9999px', width: `${Math.min(stage.score, 100)}%`,
                                      background: stage.score >= 70 ? '#10b981' : stage.score >= 40 ? '#f59e0b' : '#ef4444'
                                    }} />
                                  </div>
                                  <span className="text-[10px] font-bold text-white">{stage.score.toFixed(0)}%</span>
                                </div>
                              )}
                              {stage.feedback && <p className="mt-1.5 text-[11px] text-slate-400 leading-relaxed line-clamp-2">{stage.feedback}</p>}
                              {stage.ai_recommendation && <p className="mt-1 text-[11px] text-violet-300">🤖 {stage.ai_recommendation}</p>}
                              {stage.recruiter_feedback && <p className="mt-1 text-[11px] text-amber-300">👤 {stage.recruiter_feedback}</p>}
                            </div>
                            {!isLocked && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                                {!isPassed && (
                                  <button onClick={() => handleStageUpdate(stage.stage_number, 'PASSED')}
                                    disabled={!!actionLoading}
                                    className="rounded-lg bg-emerald-600/80 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-emerald-500 transition disabled:opacity-50">
                                    {actionLoading === `${stage.stage_number}-PASSED` ? '...' : '✓ Pass'}
                                  </button>
                                )}
                                {!isFailed && (
                                  <button onClick={() => handleStageUpdate(stage.stage_number, 'FAILED')}
                                    disabled={!!actionLoading}
                                    className="rounded-lg bg-rose-600/80 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-rose-500 transition disabled:opacity-50">
                                    {actionLoading === `${stage.stage_number}-FAILED` ? '...' : '✗ Fail'}
                                  </button>
                                )}
                                <button
                                  onClick={() => { setEditStage(isEditing ? null : stage.stage_number); setEditFeedback(stage.recruiter_feedback || ''); setEditScore(stage.score !== null ? String(stage.score) : ''); }}
                                  className="rounded-lg border border-white/10 px-2.5 py-1 text-[10px] font-bold text-slate-400 hover:text-white hover:border-white/20 transition">
                                  ✏️ Note
                                </button>
                              </div>
                            )}
                          </div>
                          {isEditing && (
                            <div className="mt-3 border-t border-white/5 pt-3 space-y-2">
                              <input type="number" placeholder="Score (0-100)" value={editScore} onChange={e => setEditScore(e.target.value)}
                                className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none" />
                              <textarea placeholder="Recruiter note..." value={editFeedback} onChange={e => setEditFeedback(e.target.value)} rows={2}
                                className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none resize-none" />
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => handleStageUpdate(stage.stage_number, stage.status)}
                                  className="flex-1 rounded-lg bg-violet-600 py-1.5 text-xs font-bold text-white hover:bg-violet-500 transition">Save</button>
                                <button onClick={() => setEditStage(null)}
                                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:text-white transition">Cancel</button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
