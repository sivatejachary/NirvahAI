'use client';

import { useState, useEffect } from 'react';

interface WorkflowInstance {
  id: string;
  workflow_type: string;
  status: string;
  current_step: string;
  tenant_id: string;
  entity_id?: string;
  ai_cost_usd?: number;
  created_at: string;
  updated_at: string;
}

interface SpendMetrics {
  total_usd: number;
  workflow_count: number;
  avg_cost_per_workflow: number;
  budget_limit_usd: number;
  budget_used_pct: number;
}

const WORKFLOW_ICONS: Record<string, string> = {
  FULL_HIRE: '🏗️',
  JD_GENERATION: '📝',
  CANDIDATE_SCREENING: '🔍',
  INTERVIEW_SCHEDULING: '📅',
  OFFER_GENERATION: '📄',
  ONBOARDING: '🎉',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  running: '#6366f1',
  waiting_human: '#8b5cf6',
  completed: '#10b981',
  failed: '#ef4444',
  cancelled: '#6b7280',
};

export default function WorkforcePage() {
  const [workflows, setWorkflows] = useState<WorkflowInstance[]>([]);
  const [spend, setSpend] = useState<SpendMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/workflows`, { headers }),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/workflows/metrics/spend`, { headers }),
    ]).then(async ([wRes, sRes]) => {
      if (wRes.ok) setWorkflows(await wRes.json());
      if (sRes.ok) setSpend(await sRes.json());
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'ALL' ? workflows : workflows.filter(w => w.status === filter.toLowerCase());

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Workforce Plan</h1>
          <p>AI workflow orchestration and cost governance</p>
        </div>
        <div className="page-actions">
          <div className="badge badge-primary badge-dot">AUTONOMOUS</div>
        </div>
      </div>

      {/* Spend metrics */}
      {spend && (
        <div className="grid-4 mb-6">
          {[
            { label: 'Total AI Spend', value: `$${spend.total_usd?.toFixed(4) || '0.0000'}`, icon: '💰', color: '#f59e0b' },
            { label: 'Workflows Run', value: spend.workflow_count || 0, icon: '⚡', color: '#6366f1' },
            { label: 'Avg Cost / Run', value: `$${spend.avg_cost_per_workflow?.toFixed(4) || '0.0000'}`, icon: '📊', color: '#8b5cf6' },
            { label: 'Budget Used', value: `${spend.budget_used_pct?.toFixed(1) || 0}%`, icon: '🎯', color: spend.budget_used_pct > 80 ? '#ef4444' : '#10b981' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '20px 24px' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color, marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Budget bar */}
      {spend && (
        <div className="card mb-6" style={{ padding: '16px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
            <span style={{ fontWeight: 600 }}>Monthly Budget</span>
            <span style={{ color: 'var(--text-secondary)' }}>
              ${spend.total_usd?.toFixed(2)} / ${spend.budget_limit_usd?.toFixed(2)}
            </span>
          </div>
          <div style={{ background: 'var(--surface-4)', borderRadius: 'var(--radius-full)', height: 8, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(spend.budget_used_pct || 0, 100)}%`, height: '100%', borderRadius: 'inherit',
              background: spend.budget_used_pct > 80
                ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                : 'linear-gradient(90deg, var(--color-primary-500), var(--color-primary-700))',
              transition: 'width 0.8s ease',
            }} />
          </div>
        </div>
      )}

      {/* Workflow filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {['ALL', 'RUNNING', 'PENDING', 'WAITING_HUMAN', 'COMPLETED', 'FAILED'].map(f => (
          <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(f)}>
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Workflow list */}
      <div className="card">
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner" style={{ margin: 'auto', width: 28, height: 28 }} /></div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>⚡</div>
            <p style={{ fontWeight: 600 }}>No workflows yet</p>
            <p style={{ fontSize: 13 }}>Workflows are created automatically by AI agents when processing candidates.</p>
          </div>
        ) : (
          filtered.map(w => (
            <div key={w.id} style={{
              display: 'flex', alignItems: 'center', gap: 16, padding: '14px 24px',
              borderBottom: '1px solid var(--border-subtle)',
            }}>
              <div style={{ fontSize: 28, flexShrink: 0 }}>
                {WORKFLOW_ICONS[w.workflow_type] || '⚡'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{w.workflow_type.replace(/_/g, ' ')}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  Step: {w.current_step} · {new Date(w.created_at).toLocaleString()}
                </div>
              </div>
              {w.ai_cost_usd !== undefined && (
                <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-secondary)' }}>
                  ${w.ai_cost_usd.toFixed(4)}
                </div>
              )}
              <span className="badge" style={{
                background: `${STATUS_COLORS[w.status] || '#6b7280'}20`,
                color: STATUS_COLORS[w.status] || '#6b7280',
                border: `1px solid ${STATUS_COLORS[w.status] || '#6b7280'}40`,
                fontWeight: 600, textTransform: 'capitalize',
              }}>
                {w.status.replace(/_/g, ' ')}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
