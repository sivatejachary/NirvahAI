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
    s >= 80 ? 'text-emerald-400' :
    s >= 50 ? 'text-amber-400' :
    'text-rose-400';

  return (
    <div style={{ display: 'flex', gap: '24px', height: 'calc(100vh - 100px)', minHeight: 0 }}>
      {/* Left List */}
      <div style={{ width: '300px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 800 }}>Resume Screening AI</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 2 }}>Demographics-blind parsing & matching</p>
        </div>
        {successMsg && <div className="alert alert-success">{successMsg}</div>}
        {errorMsg && <div className="alert alert-error">{errorMsg}</div>}
        
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
          {loading ? (
            <div style={{ display: 'flex', height: 120, alignItems: 'center', justifyContent: 'center' }}>
              <div className="spinner" style={{ width: 24, height: 24 }} />
            </div>
          ) : applications.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '24px 0' }}>No applications to screen.</p>
          ) : (
            applications.map(app => (
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

      {/* Right Details */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {!selectedApp ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 48, textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Select a Candidate</h2>
            <p style={{ fontSize: '12.5px' }}>View demographics-blind parsing metadata, AI feedback matching, and screen applications.</p>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>{selectedApp.candidate_name}</h2>
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: 2 }}>{selectedApp.candidate_email} · {selectedApp.job_title}</p>
              </div>
              <div className="card" style={{ padding: '8px 16px', background: 'var(--surface-3)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '16px', fontWeight: 800 }} className={scoreColor(selectedApp.fit_score)}>{Math.round(selectedApp.fit_score)}%</span>
                <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, marginTop: 2 }}>ATS Match</span>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="card" style={{ background: 'rgba(124, 58, 237, 0.05)', borderColor: 'rgba(124, 58, 237, 0.2)', padding: 16 }}>
                <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>🤖 AI Screening Recommendation</h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{selectedApp.screening_feedback || 'No screening notes generated.'}</p>
              </div>

              {selectedApp.raw_parsed_data && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <h4 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Technical Skills</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {selectedApp.raw_parsed_data.skills?.map(skill => (
                        <span key={skill} className="badge badge-default" style={{ fontSize: '11px' }}>{skill}</span>
                      )) || <span style={{ fontSize: '12px', color: 'var(--text-disabled)' }}>None extracted</span>}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <h4 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Work Experience</h4>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedApp.raw_parsed_data.experience_years ?? 0} Years</p>
                    </div>
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <h4 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Education</h4>
                      {selectedApp.raw_parsed_data.education?.map((edu, idx) => (
                        <p key={idx} style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{edu.degree} - {edu.school} ({edu.year})</p>
                      )) || <span style={{ fontSize: '12px', color: 'var(--text-disabled)' }}>None extracted</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', display: 'flex', gap: '12px' }}>
              <button onClick={() => handleDecision(selectedApp.id, 'MCQ_STAGE')} disabled={actionLoading}
                className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                Shortlist (Move to MCQ)
              </button>
              <button onClick={() => handleDecision(selectedApp.id, 'REVIEW_REQUIRED')} disabled={actionLoading}
                className="btn btn-secondary">
                Mark for Review
              </button>
              <button onClick={() => handleDecision(selectedApp.id, 'REJECTED')} disabled={actionLoading}
                className="btn btn-danger" style={{ flex: 1, justifyContent: 'center' }}>
                Reject & Recommend Upskilling
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
