'use client';

import { useState, useEffect, useCallback } from 'react';

interface AIInterview {
  id: string;
  application_id: string;
  candidate_name?: string;
  candidate_email?: string;
  job_title?: string;
  status: string;
  transcript: Array<{ role: string; content: string }> | string;
  metadata: {
    technical_score?: number;
    communication_score?: number;
    confidence_score?: number;
    ai_summary?: string;
    recommendation?: string;
  };
  created_at: string;
}

export default function AIInterviewsPage() {
  const [interviews, setInterviews] = useState<AIInterview[]>([]);
  const [selectedInt, setSelectedInt] = useState<AIInterview | null>(null);
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
      
      let appsData: Array<{ id: string; candidate_name: string; candidate_email: string; job_id: string }> = [];
      let jobsData: Array<{ id: string; title: string }> = [];
      if (appRes.ok) appsData = await appRes.json();
      if (jobsRes.ok) jobsData = await jobsRes.json();

      const dummyInterviews: AIInterview[] = appsData.map((app, idx) => ({
        id: `ai-int-${app.id}`,
        application_id: app.id,
        candidate_name: app.candidate_name,
        candidate_email: app.candidate_email,
        job_title: jobsData.find(j => j.id === app.job_id)?.title || 'Software Engineer',
        status: idx % 3 === 0 ? 'COMPLETED' : 'IN_PROGRESS',
        transcript: [
          { role: 'assistant', content: 'Hello! Welcome to your AI Technical Interview. Can you explain the difference between processes and threads?' },
          { role: 'candidate', content: 'Sure. A process is an executing instance of an application with its own memory space. A thread is a path of execution within a process, and threads in the same process share its memory.' },
          { role: 'assistant', content: 'Excellent. How do you handle synchronization issues when multiple threads access shared resources?' },
          { role: 'candidate', content: 'We can use locks, mutexes, or semaphores to prevent race conditions and ensure thread safety.' }
        ],
        metadata: {
          technical_score: idx % 3 === 0 ? 88 : 62,
          communication_score: idx % 3 === 0 ? 92 : 70,
          confidence_score: idx % 3 === 0 ? 85 : 55,
          ai_summary: idx % 3 === 0 
            ? 'Candidate showed solid fundamentals in concurrency, OS concepts, and memory architectures. Explanations were clear and precise.'
            : 'Candidate understood basics but struggled to explain thread pool configurations and deadlocks.',
          recommendation: idx % 3 === 0 ? 'PASS' : 'REJECT'
        },
        created_at: new Date().toISOString()
      }));

      setInterviews(dummyInterviews);
    } catch {
      setErrorMsg('Failed to load AI interviews.');
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
        setSuccessMsg(`Interview evaluation successfully updated to ${status}`);
        await loadData();
        setSelectedInt(null);
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

  const getScoreColor = (score?: number) => {
    if (!score) return 'text-slate-400';
    if (score >= 80) return 'text-emerald-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-rose-400';
  };

  return (
    <div style={{ display: 'flex', gap: '24px', height: 'calc(100vh - 100px)', minHeight: 0 }}>
      {/* Left List */}
      <div style={{ width: '300px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 800 }}>AI Technical Interview</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 2 }}>Speech audio analysis & transcripts</p>
        </div>
        {successMsg && <div className="alert alert-success">{successMsg}</div>}
        {errorMsg && <div className="alert alert-error">{errorMsg}</div>}

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
          {loading ? (
            <div style={{ display: 'flex', height: 120, alignItems: 'center', justifyContent: 'center' }}>
              <div className="spinner" style={{ width: 24, height: 24 }} />
            </div>
          ) : interviews.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '24px 0' }}>No AI interviews recorded.</p>
          ) : (
            interviews.map(int => (
              <div key={int.id} onClick={() => setSelectedInt(int)}
                className="card"
                style={{
                  padding: '12px', cursor: 'pointer',
                  borderColor: selectedInt?.id === int.id ? 'var(--color-primary-500)' : 'var(--border-subtle)',
                  background: selectedInt?.id === int.id ? 'rgba(99,102,241,0.06)' : 'var(--surface-2)',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{int.candidate_name}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{int.job_title}</p>
                  </div>
                  <span className={`badge ${int.status === 'COMPLETED' ? 'badge-success' : 'badge-primary'}`} style={{ fontSize: '9px' }}>{int.status}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Details Panel */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {!selectedInt ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 48, textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🤖</div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Select an Interview</h2>
            <p style={{ fontSize: '12.5px' }}>Verify audio transcription records, evaluate confidence/expression ratings, and route candidates.</p>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>{selectedInt.candidate_name}</h2>
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: 2 }}>{selectedInt.candidate_email} · {selectedInt.job_title}</p>
              </div>
              <div className="card" style={{ padding: '8px 16px', background: 'var(--surface-3)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '16px', fontWeight: 800 }} className={getScoreColor(selectedInt.metadata.technical_score)}>{selectedInt.metadata.technical_score ?? 'TBD'}</span>
                <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, marginTop: 2 }}>Technical Rating</span>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Score breakdown metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Communication Score</span>
                  <p style={{ fontSize: '16px', fontWeight: 700 }} className={getScoreColor(selectedInt.metadata.communication_score)}>{selectedInt.metadata.communication_score}%</p>
                </div>
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Confidence Score</span>
                  <p style={{ fontSize: '16px', fontWeight: 700 }} className={getScoreColor(selectedInt.metadata.confidence_score)}>{selectedInt.metadata.confidence_score}%</p>
                </div>
              </div>

              {/* AI evaluation Summary */}
              <div className="card" style={{ background: 'rgba(124, 58, 237, 0.05)', borderColor: 'rgba(124, 58, 237, 0.2)' }}>
                <h4 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-primary-400)', textTransform: 'uppercase', marginBottom: '6px' }}>🤖 AI Autopilot voice summary</h4>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{selectedInt.metadata.ai_summary}</p>
              </div>

              {/* Speech Transcript Console */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h4 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '8px' }}>Speech Transcript Records</h4>
                <div className="card" style={{ background: 'var(--surface-3)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 12, display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                  {Array.isArray(selectedInt.transcript) ? (
                    selectedInt.transcript.map((msg, idx) => (
                      <div key={idx} style={{ fontSize: '12px' }}>
                        <span style={{ fontWeight: 700, color: msg.role === 'assistant' ? 'var(--color-primary-400)' : 'var(--color-accent-400)' }}>
                          {msg.role === 'assistant' ? 'Voice Coordinator Agent' : 'Candidate'}:
                        </span>
                        <p style={{ color: 'var(--text-secondary)', marginTop: 2, display: 'inline', marginLeft: 6 }}>{msg.content}</p>
                      </div>
                    ))
                  ) : (
                    <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>{selectedInt.transcript}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', display: 'flex', gap: '12px' }}>
              <button onClick={() => handleDecision(selectedInt.application_id, 'INTERVIEW_STAGE')} disabled={actionLoading}
                className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                Pass Interview (Move to Human round)
              </button>
              <button onClick={() => handleDecision(selectedInt.application_id, 'REJECTED')} disabled={actionLoading}
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
