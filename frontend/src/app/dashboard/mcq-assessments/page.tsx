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
    risk === 'HIGH' ? 'text-rose-400' :
    risk === 'MEDIUM' ? 'text-amber-400' :
    'text-emerald-400';

  const scoreColor = (score: number | null, max: number) => {
    if (score === null) return 'text-slate-400';
    const pct = (score / max) * 100;
    if (pct >= 85) return 'text-emerald-400';
    if (pct >= 50) return 'text-amber-400';
    return 'text-rose-400';
  };

  return (
    <div style={{ display: 'flex', gap: '24px', height: 'calc(100vh - 100px)', minHeight: 0 }}>
      {/* Left Attempts List */}
      <div style={{ width: '300px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 800 }}>MCQ Assessment Console</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 2 }}>Integrity proctoring & score review</p>
        </div>
        {successMsg && <div className="alert alert-success">{successMsg}</div>}
        {errorMsg && <div className="alert alert-error">{errorMsg}</div>}

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
          {loading ? (
            <div style={{ display: 'flex', height: 120, alignItems: 'center', justifyContent: 'center' }}>
              <div className="spinner" style={{ width: 24, height: 24 }} />
            </div>
          ) : attempts.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '24px 0' }}>No assessment attempts recorded.</p>
          ) : (
            attempts.map(att => (
              <div key={att.id} onClick={() => setSelectedAttempt(att)}
                className="card"
                style={{
                  padding: '12px', cursor: 'pointer',
                  borderColor: selectedAttempt?.id === att.id ? 'var(--color-primary-500)' : 'var(--border-subtle)',
                  background: selectedAttempt?.id === att.id ? 'rgba(99,102,241,0.06)' : 'var(--surface-2)',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{att.candidate_name}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{att.job_title}</p>
                  </div>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, paddingLeft: 8 }} className={scoreColor(att.score, att.max_score)}>
                    {att.score !== null ? `${att.score}/${att.max_score}` : 'Pending'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Details Panel */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {!selectedAttempt ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 48, textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📝</div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Select an Attempt</h2>
            <p style={{ fontSize: '12.5px' }}>Verify candidate score marks, evaluate proctor integrity logs, and route candidates.</p>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>{selectedAttempt.candidate_name}</h2>
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: 2 }}>{selectedAttempt.candidate_email} · {selectedAttempt.job_title}</p>
              </div>
              <div className="card" style={{ padding: '8px 16px', background: 'var(--surface-3)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '16px', fontWeight: 800 }} className={scoreColor(selectedAttempt.score, selectedAttempt.max_score)}>
                  {selectedAttempt.score !== null ? `${Math.round((selectedAttempt.score / selectedAttempt.max_score) * 100)}%` : 'TBD'}
                </span>
                <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, marginTop: 2 }}>Exam Grade</span>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Proctor status block */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Proctor Integrity Scan</h4>
                  <span style={{ fontSize: '12px', fontWeight: 700 }} className={integrityColor(selectedAttempt.integrity_risk)}>{selectedAttempt.integrity_risk} RISK</span>
                </div>
                <div style={{ background: 'var(--surface-3)', borderRadius: 'var(--radius-md)', padding: '12px', fontSize: '12.5px', fontFamily: 'var(--font-mono)', border: '1px solid var(--border-subtle)' }}>
                  {selectedAttempt.proctoring_logs && selectedAttempt.proctoring_logs.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {selectedAttempt.proctoring_logs.map((log, idx) => (
                        <p key={idx} style={{ color: 'var(--text-secondary)' }}>
                          ⚠️ [{new Date(log.timestamp).toLocaleTimeString()}] Event: {log.event_type}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--color-accent-400)' }}>✔ No anomalous copy-paste or tab loss telemetry detected.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', display: 'flex', gap: '12px' }}>
              <button onClick={() => handleDecision(selectedAttempt.application_id, 'CODING_STAGE')} disabled={actionLoading}
                className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                Pass Assessment (Move to Coding)
              </button>
              <button onClick={() => handleDecision(selectedAttempt.application_id, 'REJECTED')} disabled={actionLoading}
                className="btn btn-danger" style={{ flex: 1, justifyContent: 'center' }}>
                Reject Candidate
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
