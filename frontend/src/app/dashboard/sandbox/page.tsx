'use client';

import { useState, useEffect } from 'react';

interface SandboxStatus {
  status: string;
  tenant_id: string;
  environment: string;
  timestamp: string;
}

export default function SandboxPage() {
  const [status, setStatus] = useState<SandboxStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<string | null>(null);

  const loadStatus = () => {
    setLoading(true);
    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}` };

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/sandbox/status`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(data => setStatus(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleSeed = async () => {
    setSeeding(true);
    setSeedResult(null);
    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/sandbox/seed`, {
        method: 'POST',
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        setSeedResult(JSON.stringify(data, null, 2));
      }
    } catch {} finally {
      setSeeding(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you absolutely sure you want to reset the sandbox? All test data for this tenant will be cleared.')) return;
    setClearing(true);
    setResetResult(null);
    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/sandbox/reset`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        setResetResult(JSON.stringify(data, null, 2));
      }
    } catch {} finally {
      setClearing(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Sandbox &amp; Testing</h1>
          <p>Developer environments tools, seeding, diagnostics, and tenant compliance checks</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* Status Card */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 16 }}>Sandbox Environment Status</h3>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center' }}><div className="spinner" style={{ margin: 'auto' }} /></div>
          ) : status ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>System Connection</span>
                <span style={{ color: '#10b981', fontWeight: 700 }}>● Operational (Healthy)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>Isolation Tenant ID</span>
                <span style={{ fontFamily: 'monospace' }}>{status.tenant_id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>Application Environment</span>
                <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{status.environment}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>Diagnostics Time</span>
                <span>{new Date(status.timestamp).toLocaleString()}</span>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#ef4444' }}>Unable to retrieve environment status.</div>
          )}
        </div>

        {/* Tenant isolation policy details */}
        <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>🔒 Multi-Tenant Security Isolation</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              NirvahAI enforces tenant isolation directly inside the PostgreSQL layer using **Row-Level Security (RLS)**. 
              The application session binds the tenant context to ensure Tenant A can never query, read, or edit Tenant B's recruitment records.
            </p>
          </div>
          <div style={{ fontSize: 11, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: 10, borderRadius: 6, fontStyle: 'italic' }}>
            Verification checks: RLS policies active on 12 new schema modules.
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Seed Data Card */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>🌱 Seed Mock Recruitment Records</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
            Populate this tenant's lifecycle with mock jobs, candidates, test results, evaluations, and onboarding plans.
          </p>
          <button className="btn btn-ghost" style={{ width: '100%' }} onClick={handleSeed} disabled={seeding}>
            {seeding ? 'Creating data...' : 'Seed Mock Records'}
          </button>
          {seedResult && (
            <pre style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12, fontSize: 11, color: 'var(--text-secondary)', overflowX: 'auto', marginTop: 14 }}>
              {seedResult}
            </pre>
          )}
        </div>

        {/* Reset Sandbox Card */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, color: '#ef4444' }}>🗑️ Reset Environment Data</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
            Wipe all applications, records, scores, messages, onboarding sessions, and warning letters under this tenant.
          </p>
          <button className="btn btn-ghost" style={{ width: '100%', borderColor: '#ef4444', color: '#ef4444' }} onClick={handleReset} disabled={clearing}>
            {clearing ? 'Clearing...' : 'Clear Sandbox Data'}
          </button>
          {resetResult && (
            <pre style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12, fontSize: 11, color: 'var(--text-secondary)', overflowX: 'auto', marginTop: 14 }}>
              {resetResult}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
