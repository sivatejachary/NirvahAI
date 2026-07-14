'use client';

import { useEffect, useState } from 'react';

interface DashboardStats {
  active_jobs: number;
  applications: number;
  candidates_in_process: number;
  interviews_today: number;
  live_calls: number;
  offers_pending: number;
  new_hires: number;
  employees: number;
  integrity_reviews: number;
  human_review_requests: number;
  hr_tasks: number;
}

const MOCK_STATS: DashboardStats = {
  active_jobs: 0, applications: 0, candidates_in_process: 0,
  interviews_today: 0, live_calls: 0, offers_pending: 0,
  new_hires: 0, employees: 0, integrity_reviews: 0,
  human_review_requests: 0, hr_tasks: 0,
};

const PIPELINE_STAGES = [
  { label: 'Resume', color: '#6366f1', pct: 100 },
  { label: 'MCQ', color: '#8b5cf6', pct: 72 },
  { label: 'Coding', color: '#06b6d4', pct: 48 },
  { label: 'Interview', color: '#10b981', pct: 32 },
  { label: 'Offer', color: '#f59e0b', pct: 18 },
];

const RECENT_ACTIVITY = [
  { time: '—', action: 'No activity yet', detail: 'Agents will log actions here', color: 'var(--text-disabled)' },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>(MOCK_STATS);
  const [loading, setLoading] = useState(true);
  const [autonomy, setAutonomy] = useState('ASSISTED');

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    // Load tenant settings for autonomy display
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/tenants/me`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(d => {
      // will load stats from API when implemented
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const statCards = [
    { label: 'Active Jobs', value: stats.active_jobs, icon: '💼', delta: 'Set up jobs to begin' },
    { label: 'Applications', value: stats.applications, icon: '📋', delta: 'Awaiting first application' },
    { label: 'In Pipeline', value: stats.candidates_in_process, icon: '⚡', delta: 'Candidates in process' },
    { label: 'Interviews Today', value: stats.interviews_today, icon: '🎥', delta: 'Scheduled interviews' },
    { label: 'Live Calls', value: stats.live_calls, icon: '📞', delta: 'Active recruiter calls' },
    { label: 'Offers Pending', value: stats.offers_pending, icon: '📄', delta: 'Awaiting response' },
    { label: 'New Hires', value: stats.new_hires, icon: '🎉', delta: 'This month' },
    { label: 'Employees', value: stats.employees, icon: '👥', delta: 'Total headcount' },
    { label: 'Review Requests', value: stats.human_review_requests, icon: '🔍', delta: 'Need human review' },
    { label: 'HR Tasks', value: stats.hr_tasks, icon: '✅', delta: 'Open tasks' },
  ];

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>Workforce Command Center</h1>
          <p>Autonomous AI HR OS · Phase 0 · All agents ready</p>
        </div>
        <div className="page-actions">
          <div className="badge badge-primary badge-dot">{autonomy}</div>
          <a href="/dashboard/jobs" className="btn btn-primary btn-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Job
          </a>
        </div>
      </div>

      {/* System Status Banner */}
      <div className="card-glass mb-6" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-accent-500)', animation: 'pulse-glow 2s infinite' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-accent-400)' }}>Platform Ready</span>
        </div>
        <span style={{ color: 'var(--border-default)', fontSize: 12 }}>|</span>
        <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>
          Phase 0 complete · Multi-tenant isolation active · Audit logging enabled · RLS enforced
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
          {['PostgreSQL', 'Qdrant', 'Redis', 'Temporal'].map(svc => (
            <span key={svc} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-tertiary)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-accent-500)', display: 'inline-block' }} />
              {svc}
            </span>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stat-grid">
        {statCards.map((s, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-icon" style={{ fontSize: 16 }}>{s.icon}</div>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{loading ? '—' : s.value.toLocaleString()}</div>
            <div className="stat-delta">{s.delta}</div>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
        {/* Hiring Funnel */}
        <div className="card">
          <div className="section-header">
            <div>
              <div className="section-title">Hiring Funnel</div>
              <div className="section-subtitle">Candidate conversion across stages</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
            {PIPELINE_STAGES.map(stage => (
              <div key={stage.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{stage.label}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>0 candidates</span>
                </div>
                <div style={{ background: 'var(--surface-3)', borderRadius: 'var(--radius-full)', height: 8, overflow: 'hidden' }}>
                  <div style={{ width: `0%`, height: '100%', background: stage.color, borderRadius: 'inherit', transition: 'width 1s ease' }} />
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-disabled)', marginTop: 20, textAlign: 'center' }}>
            Funnel data will populate as candidates progress through the pipeline.
          </p>
        </div>

        {/* Agent Activity Timeline */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="section-header">
            <div>
              <div className="section-title">Agent Activity</div>
              <div className="section-subtitle">Recent autonomous actions</div>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
            {RECENT_ACTIVITY.map((event, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-disabled)', flexShrink: 0, marginTop: 1 }}>{event.time}</div>
                <div>
                  <div style={{ fontSize: 13, color: event.color || 'var(--text-primary)', fontWeight: 500 }}>{event.action}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{event.detail}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: '12px', background: 'var(--surface-3)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>
              Agents run in the background. Actions appear here automatically.
            </p>
          </div>
        </div>
      </div>

      {/* Compliance and Kill Switch Panel */}
      <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card">
          <div className="section-header mb-2">
            <div className="section-title">Compliance Status</div>
            <span className="badge badge-success badge-dot">Active</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Row-Level Security (RLS)', status: 'enforced', color: 'var(--color-accent-400)' },
              { label: 'Audit Logging', status: 'active', color: 'var(--color-accent-400)' },
              { label: 'Tenant Isolation', status: 'enforced', color: 'var(--color-accent-400)' },
              { label: 'AI Disclosure Gates', status: 'configured', color: 'var(--color-primary-400)' },
              { label: 'Human Review Paths', status: 'configured', color: 'var(--color-primary-400)' },
              { label: 'Proctoring', status: 'disabled', color: 'var(--text-tertiary)' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                <span style={{ color: item.color, fontWeight: 600, fontSize: 11.5 }}>{item.status.toUpperCase()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="section-header mb-2">
            <div className="section-title">Emergency Controls</div>
            <span className="badge badge-warn">Platform Admin</span>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginBottom: 14 }}>
            Kill switches pause specific platform capabilities. Every activation is permanently audited.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Pause Automated Rejections', switch: 'automated_rejections' },
              { label: 'Disable Proctoring', switch: 'proctoring' },
              { label: 'Disable Voice Calls', switch: 'voice_calls' },
              { label: 'Pause All Workflows', switch: 'all_workflows' },
            ].map(ks => (
              <button key={ks.switch} className="btn btn-danger btn-sm"
                style={{ justifyContent: 'flex-start', gap: 8 }}
                onClick={() => {
                  if (confirm(`Activate kill switch: ${ks.label}? This will be audited.`)) {
                    const token = localStorage.getItem('access_token');
                    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/tenants/me/kill-switch/${ks.switch}`, {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}` }
                    }).then(r => r.json()).then(d => alert(d.message || 'Activated'));
                  }
                }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>
                </svg>
                {ks.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
