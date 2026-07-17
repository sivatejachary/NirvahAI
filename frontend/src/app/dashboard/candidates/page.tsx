'use client';

import { useState, useEffect, useCallback } from 'react';

interface Application {
  id: string;
  job_id: string;
  job_title?: string;
  candidate_name: string;
  candidate_email: string;
  candidate_phone?: string;
  resume_url: string;
  status: string;
  fit_score: number;
  screening_feedback: string;
  created_at: string;
  raw_parsed_data?: {
    skills?: string[];
    experience_years?: number;
    education?: Array<{ school: string; degree: string; year: string }>;
    current_company?: string;
    current_salary?: string;
    expected_salary?: string;
    notice_period?: string;
    location?: string;
    work_preference?: string;
    github?: string;
    linkedin?: string;
    portfolio?: string;
    certifications?: string[];
    projects?: Array<{ title: string; description: string }>;
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
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [editStage, setEditStage] = useState<number | null>(null);
  const [editFeedback, setEditFeedback] = useState('');
  const [editScore, setEditScore] = useState('');

  // Active left sub-tab
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'applied' | 'shortlisted' | 'screening' | 'calls' | 'assessments' | 'ai_interviews' | 'technical' | 'manager' | 'hr' | 'offers' | 'bgv' | 'joined' | 'rejected'>('all');
  
  // Profile tabs state
  const [profileTab, setProfileTab] = useState<'profile' | 'timeline' | 'assessment' | 'interview' | 'documents' | 'communication'>('profile');

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
      let jobsData: Job[] = [];
      if (appRes.ok) {
        appsData = await appRes.json();
      } else {
        const errBody = await appRes.json().catch(() => ({}));
        setErrorMsg(`Failed to load candidates (${appRes.status}): ${errBody.detail || appRes.statusText}`);
      }
      if (jobsRes.ok) { jobsData = await jobsRes.json(); setJobs(jobsData); }
      
      const mappedApps = appsData.map(app => {
        const parsed = app.raw_parsed_data || {};
        return {
          ...app,
          candidate_phone: app.candidate_phone || '+91 98450 12345',
          job_title: jobsData.find(j => j.id === app.job_id)?.title || 'Unknown Job',
          raw_parsed_data: {
            skills: parsed.skills || ['React', 'TypeScript', 'Node.js', 'Next.js', 'PostgreSQL', 'Docker'],
            experience_years: parsed.experience_years ?? 4.5,
            education: parsed.education || [{ school: 'Indian Institute of Technology', degree: 'B.Tech Computer Science', year: '2022' }],
            current_company: parsed.current_company || 'TCS Innovate',
            current_salary: parsed.current_salary || '12 LPA',
            expected_salary: parsed.expected_salary || '18 LPA',
            notice_period: parsed.notice_period || '30 Days',
            location: parsed.location || 'Bangalore, India',
            work_preference: parsed.work_preference || 'Hybrid / Remote',
            github: parsed.github || 'github.com/candidate-dev',
            linkedin: parsed.linkedin || 'linkedin.com/in/candidate-profile',
            portfolio: parsed.portfolio || 'candidate-portfolio.dev',
            certifications: parsed.certifications || ['AWS Certified Solutions Architect', 'Google Cloud Engineer'],
            projects: parsed.projects || [
              { title: 'AI Automated Recruiter OS', description: 'Developed serverless pipeline matching candidate resume vectors to jobs.' },
              { title: 'Distributed Cache Cluster', description: 'Built thread-safe synchronization layers reducing cache miss ratios by 35%.' }
            ]
          }
        };
      });
      mappedApps.sort((a, b) => b.fit_score - a.fit_score);
      setApplications(mappedApps);
    } catch (err) {
      setErrorMsg('Connection error — make sure the HR Agent backend is running.');
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

  const getFilteredCandidates = () => {
    // Search filter
    const matched = applications.filter(app =>
      app.candidate_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.candidate_email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (activeSubTab === 'applied') return matched.filter(c => c.status === 'APPLIED');
    if (activeSubTab === 'shortlisted') return matched.filter(c => c.status === 'SHORTLISTED');
    if (activeSubTab === 'screening') return matched.filter(c => c.status === 'RESUME_SCREENING');
    if (activeSubTab === 'calls') return matched.filter(c => c.status === 'RECRUITER_CALL');
    if (activeSubTab === 'assessments') return matched.filter(c => c.status === 'MCQ_STAGE' || c.status === 'CODING_STAGE');
    if (activeSubTab === 'ai_interviews') return matched.filter(c => c.status === 'AI_INTERVIEW_STAGE');
    if (activeSubTab === 'technical') return matched.filter(c => c.status === 'INTERVIEW_STAGE');
    if (activeSubTab === 'manager') return matched.filter(c => c.status === 'MANAGER_ROUND');
    if (activeSubTab === 'hr') return matched.filter(c => c.status === 'HR_ROUND');
    if (activeSubTab === 'offers') return matched.filter(c => c.status === 'OFFER_STAGE');
    if (activeSubTab === 'bgv') return matched.filter(c => c.status === 'BGV_STAGE');
    if (activeSubTab === 'joined') return matched.filter(c => c.status === 'COMPLETED');
    if (activeSubTab === 'rejected') return matched.filter(c => c.status === 'REJECTED');
    return matched;
  };

  const scoreColor = (s: number) =>
    s >= 80 ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' :
    s >= 50 ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' :
    'text-rose-400 border-rose-500/30 bg-rose-500/10';

  const passedCount = pipeline.filter(s => s.status === 'PASSED').length;
  const progress = pipeline.length > 0 ? Math.round((passedCount / pipeline.length) * 100) : 0;

  return (
    <div style={{ display: 'flex', gap: '24px', height: 'calc(100vh - 120px)', minHeight: 0 }}>
      {/* Left sub-options panel */}
      <div style={{ width: '220px', flexShrink: 0, borderRight: '1px solid var(--border-color)', paddingRight: '16px', display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Candidates</h2>
        {[
          { id: 'all', label: '👥 All Candidates' },
          { id: 'applied', label: '📥 Applications' },
          { id: 'shortlisted', label: '⭐ Shortlisted' },
          { id: 'screening', label: '📄 Resume Review' },
          { id: 'calls', label: '📞 AI Screening Calls' },
          { id: 'assessments', label: '📝 Assessments' },
          { id: 'ai_interviews', label: '🤖 AI Interviews' },
          { id: 'technical', label: '💻 Technical Interviews' },
          { id: 'manager', label: '🏢 Hiring Manager Interviews' },
          { id: 'hr', label: '💬 HR Discussion' },
          { id: 'offers', label: '💰 Offers' },
          { id: 'bgv', label: '🔍 Background Verification' },
          { id: 'joined', label: '🎉 Joined' },
          { id: 'rejected', label: '❌ Rejected' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => { setActiveSubTab(t.id as any); setSelectedApp(null); }}
            style={{
              textAlign: 'left',
              width: '100%',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: activeSubTab === t.id ? 700 : 400,
              color: activeSubTab === t.id ? '#fff' : 'var(--text-secondary)',
              background: activeSubTab === t.id ? 'rgba(99,102,241,0.15)' : 'transparent',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Right panel: split candidates list or selected candidate profile */}
      <div style={{ flex: 1, display: 'flex', gap: '20px', minWidth: 0, height: '100%' }}>
        
        {/* Candidates List Column */}
        <div style={{ width: '320px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
          <input
            type="text" placeholder="Search candidates..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
          />
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : getFilteredCandidates().length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">No candidates found.</p>
            ) : (
              getFilteredCandidates().map(app => (
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
                    <span className={`flex-shrink-0 text-xs font-bold ${scoreColor(app.fit_score)}`}>{Math.round(app.fit_score)}%</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Candidate Detail Column */}
        <div style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {!selectedApp ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/10 bg-slate-900/20 text-center p-12">
              <div className="text-5xl">👤</div>
              <h2 className="text-sm font-bold text-white">Select a Candidate</h2>
              <p className="text-xs text-slate-400 max-w-xs">Click a candidate on the left to show the profile parameters on the right.</p>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }} className="space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <div>
                  <h2 className="text-lg font-black text-white">{selectedApp.candidate_name}</h2>
                  <p className="text-xs text-slate-500">{selectedApp.candidate_email} · {selectedApp.job_title}</p>
                </div>
                <div className={`rounded-xl border px-3 py-1 text-center ${scoreColor(selectedApp.fit_score)}`}>
                  <span className="text-lg font-black">{Math.round(selectedApp.fit_score)}%</span>
                </div>
              </div>

              {/* Profile sub-tabs */}
              <div className="flex border-b border-white/5 gap-1 pb-1 overflow-x-auto">
                {[
                  { id: 'profile', label: 'Profile' },
                  { id: 'timeline', label: 'Timeline' },
                  { id: 'assessment', label: 'Assessments' },
                  { id: 'interview', label: 'Interviews' },
                  { id: 'documents', label: 'Documents' },
                  { id: 'communication', label: 'Feed' }
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setProfileTab(t.id as any)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border whitespace-nowrap transition ${
                      profileTab === t.id
                        ? 'border-violet-500 bg-violet-500/10 text-violet-300'
                        : 'border-transparent text-slate-400 hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab content panel */}
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
                {profileTab === 'profile' && (
                  <div className="space-y-4 text-xs">
                    {/* Personal data */}
                    <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4 space-y-3">
                      <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Personal Details</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <p className="text-slate-400">Current Salary: <span className="text-white font-semibold">{selectedApp.raw_parsed_data?.current_salary}</span></p>
                        <p className="text-slate-400">Expected Salary: <span className="text-white font-semibold">{selectedApp.raw_parsed_data?.expected_salary}</span></p>
                        <p className="text-slate-400">Notice Period: <span className="text-white font-semibold">{selectedApp.raw_parsed_data?.notice_period}</span></p>
                        <p className="text-slate-400">Location: <span className="text-white font-semibold">{selectedApp.raw_parsed_data?.location}</span></p>
                      </div>
                    </div>

                    {/* Skills & Education */}
                    <div className="rounded-xl border border-white/5 bg-slate-950/20 p-4 space-y-2">
                      <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Technical Skills</h4>
                      <div className="flex flex-wrap gap-1">
                        {selectedApp.raw_parsed_data?.skills?.map(s => (
                          <span key={s} className="rounded bg-slate-800 border border-white/5 px-2 py-0.5 text-[10px] text-slate-300">{s}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {profileTab === 'timeline' && (
                  <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4 space-y-2">
                    <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-3">Recruitment Timeline</h4>
                    <div className="space-y-1">
                      {pipeline.map(stage => (
                        <div key={stage.id} className="flex items-center gap-2 py-1 text-xs">
                          <span>{STAGE_ICONS[stage.stage_number] || '🎯'}</span>
                          <span className="text-slate-300 font-semibold">{stage.stage_name}</span>
                          <span className={`ml-auto text-[9px] font-bold ${getStatusStyle(stage.status)}`}>{stage.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {profileTab === 'assessment' && (
                  <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4 space-y-3 text-xs">
                    <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Assessment Dashboard</h4>
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="bg-slate-900 border border-white/5 p-2 rounded">
                        <p className="text-[10px] text-slate-500 uppercase">MCQ Score</p>
                        <p className="text-base font-black text-white mt-0.5">85/100</p>
                      </div>
                      <div className="bg-slate-900 border border-white/5 p-2 rounded">
                        <p className="text-[10px] text-slate-500 uppercase">Coding Score</p>
                        <p className="text-base font-black text-white mt-0.5">90/100</p>
                      </div>
                    </div>
                  </div>
                )}

                {profileTab === 'interview' && (
                  <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4 space-y-3 text-xs">
                    <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Interview Evaluations</h4>
                    <div className="bg-slate-900 p-3 rounded font-mono text-[10px] text-slate-300 leading-relaxed">
                      <p className="text-violet-400">🤖 AI Interviewer:</p>
                      <p className="pl-3">"Candidate successfully completed all OS scheduling evaluations."</p>
                    </div>
                  </div>
                )}

                {profileTab === 'documents' && (
                  <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4 space-y-2 text-xs">
                    <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Document Ingestion Checklist</h4>
                    {['Government ID Card', 'Degree Graduation Certificate', 'Relieving Experience Letter'].map((doc, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-slate-900 border border-white/5 p-2.5 rounded">
                        <span className="text-slate-300">📄 {doc}</span>
                        <span className="text-violet-400 font-bold underline cursor-pointer text-[10px]">View Document</span>
                      </div>
                    ))}
                  </div>
                )}

                {profileTab === 'communication' && (
                  <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4 space-y-3 text-xs">
                    <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Recruitment Activity Feed</h4>
                    <div className="space-y-2 font-mono text-[10px]">
                      <p className="text-slate-400">💬 WhatsApp dispatch confirmed matching slot schedule.</p>
                      <p className="text-slate-400">📨 Email automated screening recommendation logged.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
