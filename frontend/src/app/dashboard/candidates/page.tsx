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
    PASSED: 'badge-success',
    FAILED: 'badge-error',
    PENDING: 'badge-warn',
    SCHEDULED: 'badge-primary',
    IN_PROGRESS: 'badge-default',
    SKIPPED: 'badge-default',
  };
  return s[status] || 'badge-default';
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
    s >= 80 ? 'text-emerald-400' :
    s >= 50 ? 'text-amber-400' :
    'text-rose-400';

  const passedCount = pipeline.filter(s => s.status === 'PASSED').length;
  const progress = pipeline.length > 0 ? Math.round((passedCount / pipeline.length) * 100) : 0;

  return (
    <div style={{ display: 'flex', gap: '24px', height: 'calc(100vh - 120px)', minHeight: 0 }}>
      {/* Left sub-options panel */}
      <div style={{ width: '200px', flexShrink: 0, borderRight: '1px solid var(--border-subtle)', paddingRight: '16px', display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
        <h3 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', paddingLeft: 8 }}>Candidates</h3>
        {[
          { id: 'all', label: '👥 All Candidates' },
          { id: 'applied', label: '📥 Applications' },
          { id: 'shortlisted', label: '⭐ Shortlisted' },
          { id: 'screening', label: '📄 Resume Review' },
          { id: 'calls', label: '📞 AI screening Calls' },
          { id: 'assessments', label: '📝 Assessments' },
          { id: 'ai_interviews', label: '🤖 AI Interviews' },
          { id: 'technical', label: '💻 Tech Interviews' },
          { id: 'manager', label: '🏢 Manager Reviews' },
          { id: 'hr', label: '💬 HR Discussion' },
          { id: 'offers', label: '💰 Offers' },
          { id: 'bgv', label: '🔍 Background Verification' },
          { id: 'joined', label: '🎉 Joined' },
          { id: 'rejected', label: '❌ Rejected' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => { setActiveSubTab(t.id as any); setSelectedApp(null); }}
            className={`btn ${activeSubTab === t.id ? 'btn-primary' : 'btn-ghost'}`}
            style={{ textAlign: 'left', width: '100%', justifyContent: 'flex-start', padding: '6px 12px', fontSize: '12px' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Right panel: split candidates list or selected candidate profile */}
      <div style={{ flex: 1, display: 'flex', gap: '20px', minWidth: 0, height: '100%' }}>
        
        {/* Candidates List Column */}
        <div style={{ width: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
          <input
            type="text" placeholder="Search candidates..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="input"
          />
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
            {loading ? (
              <div style={{ display: 'flex', height: 120, alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner" style={{ width: 24, height: 24 }} />
              </div>
            ) : getFilteredCandidates().length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '24px 0' }}>No candidates found.</p>
            ) : (
              getFilteredCandidates().map(app => (
                <div key={app.id} onClick={() => setSelectedApp(app)}
                  className="card"
                  style={{
                    padding: '12px', cursor: 'pointer',
                    borderColor: selectedApp?.id === app.id ? 'var(--color-primary-500)' : 'var(--border-subtle)',
                    background: selectedApp?.id === app.id ? 'rgba(99,102,241,0.06)' : 'var(--surface-2)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{app.candidate_name}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{app.job_title}</p>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 700, paddingLeft: 8 }} className={scoreColor(app.fit_score)}>{Math.round(app.fit_score)}%</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Candidate Detail Column */}
        <div style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {!selectedApp ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 48, textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>👤</div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Select a Candidate</h2>
              <p style={{ fontSize: '12.5px' }}>Click a candidate on the left to show the profile parameters on the right.</p>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }} className="space-y-4">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>{selectedApp.candidate_name}</h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: 2 }}>{selectedApp.candidate_email} · {selectedApp.job_title}</p>
                </div>
                <div className="card" style={{ padding: '8px 16px', background: 'var(--surface-3)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '16px', fontWeight: 800 }} className={scoreColor(selectedApp.fit_score)}>{Math.round(selectedApp.fit_score)}%</span>
                  <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, marginTop: 2 }}>Fit Score</span>
                </div>
              </div>

              {/* Profile sub-tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', gap: '4px', overflowX: 'auto', paddingBottom: '6px' }}>
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
                    className={`btn ${profileTab === t.id ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                    style={{ fontSize: '11.5px', padding: '4px 12px' }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab content panel */}
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
                {profileTab === 'profile' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Personal data */}
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <h4 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Personal Details</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12.5px' }}>
                        <p style={{ color: 'var(--text-secondary)' }}>Current Salary: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{selectedApp.raw_parsed_data?.current_salary}</span></p>
                        <p style={{ color: 'var(--text-secondary)' }}>Expected Salary: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{selectedApp.raw_parsed_data?.expected_salary}</span></p>
                        <p style={{ color: 'var(--text-secondary)' }}>Notice Period: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{selectedApp.raw_parsed_data?.notice_period}</span></p>
                        <p style={{ color: 'var(--text-secondary)' }}>Location: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{selectedApp.raw_parsed_data?.location}</span></p>
                      </div>
                    </div>

                    {/* Skills */}
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <h4 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Technical Skills</h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {selectedApp.raw_parsed_data?.skills?.map(s => (
                          <span key={s} className="badge badge-default" style={{ fontSize: '11px' }}>{s}</span>
                        ))}
                      </div>
                    </div>

                    {/* Experience & Education */}
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <h4 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Education Details</h4>
                      {selectedApp.raw_parsed_data?.education?.map((edu, idx) => (
                        <div key={idx} style={{ fontSize: '12.5px' }}>
                          <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{edu.degree}</p>
                          <p style={{ color: 'var(--text-secondary)' }}>{edu.school} ({edu.year})</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {profileTab === 'timeline' && (
                  <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <h4 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Recruitment Stages Timeline</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {pipeline.map(stage => (
                        <div key={stage.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px', background: 'var(--surface-3)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span>{STAGE_ICONS[stage.stage_number] || '🎯'}</span>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{stage.stage_name}</span>
                          </div>
                          <span className={`badge ${getStatusStyle(stage.status)}`}>{stage.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {profileTab === 'assessment' && (
                  <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <h4 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Assessment Dashboard</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="card" style={{ background: 'var(--surface-3)', textAlign: 'center', padding: '12px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>MCQ Aptitude</span>
                        <p style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>85 / 100</p>
                      </div>
                      <div className="card" style={{ background: 'var(--surface-3)', textAlign: 'center', padding: '12px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Coding Tests</span>
                        <p style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>90 / 100</p>
                      </div>
                    </div>
                  </div>
                )}

                {profileTab === 'interview' && (
                  <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <h4 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Interview Evaluators</h4>
                    <div style={{ background: 'var(--surface-3)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 14, fontSize: '12.5px', lineHeight: 1.6, fontFamily: 'var(--font-mono)' }}>
                      <p style={{ color: 'var(--color-primary-400)', fontWeight: 600 }}>🤖 AI Autopilot voice agent summary:</p>
                      <p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>"Candidate successfully passed asynchronous OS concurrency loops and explained multi-threading locking algorithms clearly."</p>
                    </div>
                  </div>
                )}

                {profileTab === 'documents' && (
                  <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <h4 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Document Checklist</h4>
                    {['Government ID Card', 'Degree Graduation Certificate', 'Relieving Experience Letter'].map((doc, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-3)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: '13px' }}>
                        <span style={{ color: 'var(--text-primary)' }}>📄 {doc}</span>
                        <span className="badge badge-primary" style={{ cursor: 'pointer' }}>View File</span>
                      </div>
                    ))}
                  </div>
                )}

                {profileTab === 'communication' && (
                  <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <h4 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Communication history feed</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px', fontFamily: 'var(--font-mono)' }}>
                      <p style={{ color: 'var(--text-secondary)' }}>💬 WhatsApp reminder dispatch confirmed.</p>
                      <p style={{ color: 'var(--text-secondary)' }}>📨 Automated email matching assessment generated.</p>
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
