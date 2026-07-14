'use client';

import { useState, useEffect } from 'react';

const STAGES = [
  { key: 'applied', label: 'Applied', color: '#6366f1', icon: '📋' },
  { key: 'screening', label: 'Screening', color: '#8b5cf6', icon: '🔍' },
  { key: 'mcq', label: 'MCQ', color: '#06b6d4', icon: '📝' },
  { key: 'coding', label: 'Coding', color: '#3b82f6', icon: '💻' },
  { key: 'interview', label: 'Interview', color: '#10b981', icon: '🎥' },
  { key: 'offer', label: 'Offer', color: '#f59e0b', icon: '📄' },
  { key: 'hired', label: 'Hired', color: '#22c55e', icon: '🎉' },
  { key: 'rejected', label: 'Rejected', color: '#ef4444', icon: '❌' },
];

interface Application {
  id: string;
  candidate_name: string;
  candidate_email: string;
  status: string;
  fit_score: number;
  job_title?: string;
  created_at: string;
}

export default function PipelinePage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/applications`, { headers }),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/jobs`, { headers }),
    ]).then(async ([appRes, jobRes]) => {
      const apps = appRes.ok ? await appRes.json() : [];
      const jobs = jobRes.ok ? await jobRes.json() : [];
      const mapped = apps.map((a: Application) => ({
        ...a,
        job_title: jobs.find((j: { id: string; title: string }) => j.id === a.job_title)?.title || 'Unknown Job',
      }));
      setApplications(mapped);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const byStage = (stage: string) =>
    applications.filter(a => a.status?.toLowerCase().includes(stage));

  const visible = selectedStage
    ? applications.filter(a => a.status?.toLowerCase().includes(selectedStage))
    : applications;

  const stageCounts = STAGES.map(s => ({ ...s, count: byStage(s.key).length }));
  const total = applications.length;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Hiring Pipeline</h1>
          <p>{total} total candidates across all stages</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => setSelectedStage(null)}>
            All Stages
          </button>
        </div>
      </div>

      {/* Funnel overview */}
      <div className="grid-4 mb-6">
        {stageCounts.map(s => (
          <div
            key={s.key}
            className="card"
            style={{
              padding: '16px 20px',
              cursor: 'pointer',
              border: selectedStage === s.key ? `2px solid ${s.color}` : '1px solid var(--border-subtle)',
              background: selectedStage === s.key ? `${s.color}15` : 'var(--surface-2)',
              transition: 'all var(--transition-base)',
            }}
            onClick={() => setSelectedStage(selectedStage === s.key ? null : s.key)}
          >
            <div style={{ fontSize: 24, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{s.label}</div>
            {total > 0 && (
              <div style={{ marginTop: 8, height: 3, background: 'var(--surface-4)', borderRadius: 4 }}>
                <div style={{ width: `${Math.round((s.count / total) * 100)}%`, height: '100%', background: s.color, borderRadius: 4 }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Candidate list */}
      <div className="card">
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700 }}>
            {selectedStage ? `${STAGES.find(s => s.key === selectedStage)?.label} Stage` : 'All Candidates'}
          </span>
          <span className="badge badge-secondary">{visible.length} candidates</span>
        </div>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center' }}><div className="spinner" style={{ margin: 'auto', width: 28, height: 28 }} /></div>
        ) : visible.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
            <p>No candidates in this stage yet</p>
          </div>
        ) : (
          <div>
            {visible.map(app => {
              const stage = STAGES.find(s => app.status?.toLowerCase().includes(s.key));
              return (
                <div key={app.id} style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '14px 24px',
                  borderBottom: '1px solid var(--border-subtle)',
                  transition: 'background var(--transition-base)',
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', background: 'var(--color-primary-900)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--color-primary-300)', fontWeight: 700, fontSize: 15, flexShrink: 0,
                  }}>
                    {app.candidate_name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{app.candidate_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{app.candidate_email}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: app.fit_score >= 80 ? 'var(--color-accent-400)' : app.fit_score >= 50 ? 'var(--color-primary-400)' : 'var(--text-secondary)' }}>
                      {app.fit_score}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>FIT</div>
                  </div>
                  <span className="badge" style={{
                    background: `${stage?.color}20`,
                    color: stage?.color,
                    border: `1px solid ${stage?.color}40`,
                    fontWeight: 600,
                  }}>
                    {stage?.icon} {app.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
