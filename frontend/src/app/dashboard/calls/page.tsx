'use client';

import { useState, useEffect } from 'react';

interface RecruiterCall {
  id: string;
  application_id: string;
  candidate_name?: string;
  status: string;
  call_type: string;
  transcript_summary?: string;
  sentiment_score?: number;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  connecting: '#8b5cf6',
  active: '#6366f1',
  completed: '#10b981',
  failed: '#ef4444',
  disconnected: '#6b7280',
};

export default function CallsPage() {
  const [calls, setCalls] = useState<RecruiterCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<RecruiterCall | null>(null);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    // Calls come through applications at the 'recruiter_call' stage
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/applications`, { headers })
      .then(async r => {
        const apps: { id: string; candidate_name: string; status: string; created_at: string }[] = r.ok ? await r.json() : [];
        const callApps = apps
          .filter(a => a.status?.toLowerCase().includes('call') || a.status?.toLowerCase().includes('phone'))
          .map(a => ({
            id: `call-${a.id}`,
            application_id: a.id,
            candidate_name: a.candidate_name,
            status: a.status?.toLowerCase().includes('complete') ? 'completed' : 'pending',
            call_type: 'AI_VOICE',
            created_at: a.created_at,
          }));
        setCalls(callApps);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'ALL' ? calls : calls.filter(c => c.status === filter.toLowerCase());

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Recruiter Calls</h1>
          <p>AI-powered voice screening calls with candidates</p>
        </div>
        <div className="page-actions">
          <div className="badge badge-primary badge-dot">AI VOICE</div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid-4 mb-6">
        {[
          { label: 'Total Calls', value: calls.length, icon: '📞', color: '#6366f1' },
          { label: 'Completed', value: calls.filter(c => c.status === 'completed').length, icon: '✅', color: '#10b981' },
          { label: 'Pending', value: calls.filter(c => c.status === 'pending').length, icon: '⏳', color: '#f59e0b' },
          { label: 'Active Now', value: calls.filter(c => c.status === 'active').length, icon: '🔴', color: '#ef4444' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color, marginBottom: 4 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {['ALL', 'PENDING', 'ACTIVE', 'COMPLETED'].map(f => (
          <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 360px' : '1fr', gap: 24 }}>
        <div className="card">
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner" style={{ margin: 'auto', width: 28, height: 28 }} /></div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>📞</div>
              <p style={{ fontWeight: 600 }}>No calls yet</p>
              <p style={{ fontSize: 13 }}>AI recruiter calls are triggered automatically when candidates reach the call screening stage.</p>
            </div>
          ) : (
            filtered.map(call => (
              <div
                key={call.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px',
                  borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer',
                  background: selected?.id === call.id ? 'var(--color-primary-950)' : 'transparent',
                  transition: 'background var(--transition-base)',
                }}
                onClick={() => setSelected(selected?.id === call.id ? null : call)}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                  background: `${STATUS_COLORS[call.status]}20`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                }}>
                  📞
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{call.candidate_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{call.call_type} · {new Date(call.created_at).toLocaleDateString()}</div>
                </div>
                <span className="badge" style={{
                  background: `${STATUS_COLORS[call.status]}20`,
                  color: STATUS_COLORS[call.status],
                  border: `1px solid ${STATUS_COLORS[call.status]}40`,
                  fontWeight: 600, textTransform: 'capitalize',
                }}>
                  {call.status}
                </span>
              </div>
            ))
          )}
        </div>

        {selected && (
          <div className="card" style={{ padding: 24, alignSelf: 'start', position: 'sticky', top: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>Call Detail</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Candidate', value: selected.candidate_name || '—' },
                { label: 'Status', value: selected.status },
                { label: 'Call Type', value: selected.call_type },
                { label: 'Date', value: new Date(selected.created_at).toLocaleString() },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>{label}</span>
                  <span style={{ fontWeight: 600, fontSize: 13, textTransform: 'capitalize' }}>{value}</span>
                </div>
              ))}
            </div>
            {selected.transcript_summary && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>Transcript Summary</div>
                <div style={{ background: 'var(--surface-3)', borderRadius: 'var(--radius-md)', padding: 12, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {selected.transcript_summary}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
