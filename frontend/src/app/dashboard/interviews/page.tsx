'use client';

import { useState, useEffect } from 'react';

interface Interview {
  id: string;
  application_id: string;
  candidate_name?: string;
  job_title?: string;
  status: string;
  interview_type: string;
  ai_feedback?: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  active: '#6366f1',
  completed: '#10b981',
  abandoned: '#ef4444',
};

export default function InterviewsPage() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [applications, setApplications] = useState<Record<string, { candidate_name: string; job_title?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Interview | null>(null);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/applications`, { headers }),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/jobs`, { headers }),
    ]).then(async ([appRes, jobRes]) => {
      const apps: { id: string; candidate_name: string; job_id: string }[] = appRes.ok ? await appRes.json() : [];
      const jobs: { id: string; title: string }[] = jobRes.ok ? await jobRes.json() : [];
      const appMap: Record<string, { candidate_name: string; job_title?: string }> = {};
      apps.forEach(a => {
        const job = jobs.find(j => j.id === a.job_id);
        appMap[a.id] = { candidate_name: a.candidate_name, job_title: job?.title };
      });
      setApplications(appMap);

      // Derive interviews from applications with interview status
      const interviewApps = apps
        .filter(a => (a as unknown as { status: string }).status?.toLowerCase().includes('interview'))
        .map((a, i) => ({
          id: `interview-${a.id}`,
          application_id: a.id,
          candidate_name: a.candidate_name,
          job_title: jobs.find(j => j.id === a.job_id)?.title || 'Unknown',
          status: 'pending',
          interview_type: 'AI_ASYNC',
          created_at: new Date().toISOString(),
        }));
      setInterviews(interviewApps);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'ALL' ? interviews : interviews.filter(i => i.status === filter.toLowerCase());

  const counts = {
    ALL: interviews.length,
    PENDING: interviews.filter(i => i.status === 'pending').length,
    ACTIVE: interviews.filter(i => i.status === 'active').length,
    COMPLETED: interviews.filter(i => i.status === 'completed').length,
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>AI Interviews</h1>
          <p>Autonomous adaptive interview sessions managed by AI</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {(['ALL', 'PENDING', 'ACTIVE', 'COMPLETED'] as const).map(f => (
          <button
            key={f}
            className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter(f)}
          >
            {f} <span className="badge badge-secondary" style={{ marginLeft: 6 }}>{counts[f]}</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 24 }}>
        {/* List */}
        <div className="card">
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner" style={{ margin: 'auto', width: 28, height: 28 }} /></div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎥</div>
              <p style={{ fontWeight: 600 }}>No interviews yet</p>
              <p style={{ fontSize: 13 }}>Interviews are triggered automatically when candidates reach the interview stage.</p>
            </div>
          ) : (
            filtered.map(iv => (
              <div
                key={iv.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px',
                  borderBottom: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  background: selected?.id === iv.id ? 'var(--color-primary-950)' : 'transparent',
                  transition: 'background var(--transition-base)',
                }}
                onClick={() => setSelected(selected?.id === iv.id ? null : iv)}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--color-primary-900)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: 'var(--color-primary-300)', fontWeight: 700, fontSize: 16,
                }}>
                  {iv.candidate_name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{iv.candidate_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{iv.job_title}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="badge" style={{
                    background: `${STATUS_COLORS[iv.status]}20`,
                    color: STATUS_COLORS[iv.status],
                    border: `1px solid ${STATUS_COLORS[iv.status]}40`,
                    fontWeight: 600, textTransform: 'capitalize',
                  }}>
                    {iv.status}
                  </span>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{iv.interview_type}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="card" style={{ padding: 24, alignSelf: 'start', position: 'sticky', top: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>Interview Detail</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%', background: 'var(--color-primary-900)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--color-primary-300)', fontWeight: 700, fontSize: 20,
              }}>
                {selected.candidate_name?.charAt(0)?.toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{selected.candidate_name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{selected.job_title}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Status', value: selected.status },
                { label: 'Type', value: selected.interview_type },
                { label: 'Application ID', value: selected.application_id.slice(0, 8) + '...' },
                { label: 'Created', value: new Date(selected.created_at).toLocaleDateString() },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>{label}</span>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{value}</span>
                </div>
              ))}
            </div>
            {selected.ai_feedback && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>AI Feedback</div>
                <div style={{ background: 'var(--surface-3)', borderRadius: 'var(--radius-md)', padding: 12, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {selected.ai_feedback}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
