'use client';

import { useState, useEffect } from 'react';

interface TenantItem {
  id: string;
  company_name: string;
  company_slug: string;
  industry?: string;
  company_size?: string;
  status: string;
  plan: string;
  created_at?: string;
}

interface PlatformMetrics {
  total_companies: number;
  active_companies: number;
  pending_companies: number;
  total_jobs: number;
  active_jobs: number;
  closed_jobs: number;
  total_applications: number;
  total_hires: number;
  total_voice_calls: number;
  system_health: string;
}

export default function SuperAdminPage() {
  const [metrics, setMetrics] = useState<PlatformMetrics>({
    total_companies: 0, active_companies: 0, pending_companies: 0,
    total_jobs: 0, active_jobs: 0, closed_jobs: 0,
    total_applications: 0, total_hires: 0, total_voice_calls: 0,
    system_health: '100% Operational'
  });
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://nirvahai-production.up.railway.app';

  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  const loadData = async () => {
    setLoading(true);
    setError('');
    const headers = getHeaders();
    try {
      const [metricsRes, tenantsRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/analytics/platform`, { headers }),
        fetch(`${API_BASE}/api/v1/tenants/all`, { headers })
      ]);

      if (metricsRes.ok) {
        setMetrics(await metricsRes.json());
      }
      if (tenantsRes.ok) {
        setTenants(await tenantsRes.json());
      } else {
        setError('Super Admin access required. Log in as a platform_admin account.');
      }
    } catch {
      setError('Connection error loading Super Admin platform metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateStatus = async (tenantId: string, newStatus: string, newPlan?: string) => {
    setActionLoading(tenantId);
    setMsg('');
    setError('');
    try {
      const body: any = {};
      if (newStatus) body.status = newStatus;
      if (newPlan) body.plan = newPlan;

      const res = await fetch(`${API_BASE}/api/v1/tenants/${tenantId}/status`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(body)
      });
      if (res.ok) {
        setMsg(`Company updated successfully (${newStatus || newPlan}).`);
        await loadData();
      } else {
        const d = await res.json();
        setError(d.detail || 'Failed to update company.');
      }
    } catch {
      setError('Connection error updating company status.');
    } finally {
      setActionLoading(null);
    }
  };

  const statCard = (label: string, val: number | string, icon: string, color: string) => (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${color}, transparent)`, opacity: 0.7 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
        <span style={{ fontSize: 16 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 900, color, letterSpacing: '-0.02em' }}>{loading ? '—' : val}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 20, fontSize: 11, color: '#a78bfa', fontWeight: 700, marginBottom: 8 }}>
            👑 Super Admin Workspace Command
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', margin: 0 }}>
            Platform & Enterprise Management
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4, margin: 0 }}>
            Multi-tenant company approvals, global analytics, and operational system health
          </p>
        </div>
        <button onClick={loadData} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
          ↻ Refresh Metrics
        </button>
      </div>

      {msg && <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10, color: '#34d399', fontSize: 12 }}>{msg}</div>}
      {error && <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, color: '#f87171', fontSize: 12 }}>{error}</div>}

      {/* Global Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
        {statCard('Total Companies', metrics.total_companies, '🏢', '#7c3aed')}
        {statCard('Active Workspaces', metrics.active_companies, '⚡', '#34d399')}
        {statCard('Pending Approvals', metrics.pending_companies, '⏳', '#fbbf24')}
        {statCard('Total Posted Jobs', metrics.total_jobs, '💼', '#6366f1')}
        {statCard('Candidate Hires', metrics.total_hires, '🎉', '#22d3ee')}
        {statCard('Voice AI Calls', metrics.total_voice_calls, '🎙️', '#f472b6')}
      </div>

      {/* Enterprise Company Directory & Approval Table */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0 }}>Registered Enterprise Workspaces</h3>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2, margin: 0 }}>Approve, suspend, or upgrade multi-tenant company accounts</p>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Loading workspace directory...</div>
        ) : tenants.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>No tenant workspaces registered yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '12px 14px' }}>Company Workspace</th>
                  <th style={{ padding: '12px 14px' }}>Slug</th>
                  <th style={{ padding: '12px 14px' }}>Industry & Size</th>
                  <th style={{ padding: '12px 14px' }}>Plan</th>
                  <th style={{ padding: '12px 14px' }}>Status</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '14px 14px', fontWeight: 600, color: '#fff' }}>
                      {t.company_name}
                      {t.legal_name && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>{t.legal_name}</div>}
                    </td>
                    <td style={{ padding: '14px 14px', color: '#a78bfa', fontFamily: 'monospace' }}>{t.company_slug}</td>
                    <td style={{ padding: '14px 14px', color: 'rgba(255,255,255,0.6)' }}>
                      {t.industry || 'Tech'} · {t.company_size || 'Mid-size'}
                    </td>
                    <td style={{ padding: '14px 14px' }}>
                      <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}>
                        {t.plan}
                      </span>
                    </td>
                    <td style={{ padding: '14px 14px' }}>
                      <span style={{
                        padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                        background: t.status === 'active' ? 'rgba(16,185,129,0.15)' : t.status === 'pending_setup' ? 'rgba(251,191,36,0.15)' : 'rgba(239,68,68,0.15)',
                        color: t.status === 'active' ? '#34d399' : t.status === 'pending_setup' ? '#fbbf24' : '#f87171',
                        border: `1px solid ${t.status === 'active' ? 'rgba(16,185,129,0.3)' : t.status === 'pending_setup' ? 'rgba(251,191,36,0.3)' : 'rgba(239,68,68,0.3)'}`
                      }}>
                        {t.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 14px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {t.status !== 'active' && (
                          <button
                            disabled={actionLoading === t.id}
                            onClick={() => handleUpdateStatus(t.id, 'active')}
                            style={{ padding: '5px 10px', background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: 6, color: '#34d399', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                            Approve
                          </button>
                        )}
                        {t.status === 'active' && (
                          <button
                            disabled={actionLoading === t.id}
                            onClick={() => handleUpdateStatus(t.id, 'suspended')}
                            style={{ padding: '5px 10px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#f87171', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                            Suspend
                          </button>
                        )}
                        <select
                          value={t.plan}
                          onChange={e => handleUpdateStatus(t.id, t.status, e.target.value)}
                          style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#fff', fontSize: 11, outline: 'none' }}>
                          <option value="trial">Trial</option>
                          <option value="growth">Growth</option>
                          <option value="enterprise">Enterprise</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
