'use client';

import { useState, useEffect } from 'react';

interface FunnelItem {
  stage: string;
  count: number;
  percentage: number;
}

interface TimeToHire {
  average_days: number;
  min_days: number;
  max_days: number;
}

interface OffersStats {
  total: number;
  draft: number;
  sent: number;
  accepted: number;
  declined: number;
  expired: number;
  acceptance_rate: number;
}

interface BiasAudit {
  note: string;
  status_distribution: Record<string, number>;
}

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<Record<string, number>>({});
  const [funnel, setFunnel] = useState<FunnelItem[]>([]);
  const [timeToHire, setTimeToHire] = useState<TimeToHire>({ average_days: 0, min_days: 0, max_days: 0 });
  const [offersStats, setOffersStats] = useState<OffersStats>({ total: 0, draft: 0, sent: 0, accepted: 0, declined: 0, expired: 0, acceptance_rate: 0 });
  const [biasData, setBiasData] = useState<BiasAudit>({ note: '', status_distribution: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/analytics/overview`, { headers }),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/analytics/hiring-funnel`, { headers }),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/analytics/time-to-hire`, { headers }),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/analytics/offers`, { headers }),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/analytics/bias-audit`, { headers }),
    ]).then(async ([overRes, funRes, timeRes, offRes, biasRes]) => {
      setOverview(overRes.ok ? await overRes.json() : {});
      setFunnel(funRes.ok ? await funRes.json() : []);
      setTimeToHire(timeRes.ok ? await timeRes.json() : { average_days: 0, min_days: 0, max_days: 0 });
      setOffersStats(offRes.ok ? await offRes.json() : { total: 0, draft: 0, sent: 0, accepted: 0, declined: 0, expired: 0, acceptance_rate: 0 });
      setBiasData(biasRes.ok ? await biasRes.json() : { note: '', status_distribution: {} });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Analytics &amp; Insights</h1>
          <p>Real-time system diagnostics, funnel ratios, speed timelines, and compliance audits</p>
        </div>
      </div>

      {/* Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Jobs', val: overview.total_jobs || 0, color: '#6366f1' },
          { label: 'Applications', val: overview.total_applications || 0, color: '#8b5cf6' },
          { label: 'Interviews Completed', val: overview.interviews_completed || 0, color: '#06b6d4' },
          { label: 'Offers Sent', val: overview.offers_sent || 0, color: '#f59e0b' },
          { label: 'Offer Acceptance Rate', val: `${overview.offer_acceptance_rate || 0}%`, color: '#10b981' },
        ].map((c, idx) => (
          <div key={idx} className="card" style={{ padding: '20px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 8 }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: c.color }}>{loading ? '—' : c.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* Section 1: Hiring Funnel */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 16 }}>Hiring Funnel Conversion</h3>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" style={{ margin: 'auto' }} /></div>
          ) : funnel.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>No application funnel data available.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {funnel.map((item, idx) => (
                <div key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{item.stage}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{item.count} ({item.percentage}%)</span>
                  </div>
                  <div style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${item.percentage}%`, height: '100%', background: COLORS[idx % COLORS.length] }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 2: Time to Hire */}
        <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: '0 0 20px', fontSize: 16 }}>Time to Hire (Days)</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>Average timeline for candidates to progress from applied to complete/selected status.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {[
              { label: 'Minimum Days', val: timeToHire.min_days, color: '#10b981' },
              { label: 'Average Days', val: timeToHire.average_days, color: '#6366f1' },
              { label: 'Maximum Days', val: timeToHire.max_days, color: '#ef4444' },
            ].map((t, i) => (
              <div key={i} style={{ padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>{t.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: t.color }}>{loading ? '—' : t.val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Section 3: Offers Status */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 16 }}>Offers Distribution</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            {[
              { label: 'Drafts', val: offersStats.draft, color: '#f59e0b' },
              { label: 'Sent', val: offersStats.sent, color: '#6366f1' },
              { label: 'Accepted', val: offersStats.accepted, color: '#10b981' },
              { label: 'Declined', val: offersStats.declined, color: '#ef4444' },
            ].map((o, idx) => (
              <div key={idx} style={{ padding: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{o.label}</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: o.color }}>{loading ? '—' : o.val}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8 }}>
            <div style={{ fontSize: 24 }}>📈</div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700 }}>Overall Acceptance Rate</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#10b981' }}>{loading ? '—' : `${offersStats.acceptance_rate}%`}</div>
            </div>
          </div>
        </div>

        {/* Section 4: Stage Distribution (Bias Audit placeholder) */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 16 }}>Demographic Audit &amp; Stage Ratios</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" style={{ margin: 'auto' }} /></div>
            ) : Object.keys(biasData.status_distribution).length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>No candidate records to audit.</div>
            ) : (
              Object.entries(biasData.status_distribution).map(([status, count], idx) => (
                <div key={status}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{status}</span>
                    <span style={{ fontWeight: 700 }}>{count}</span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${(count / (overview.total_applications || 1)) * 100}%`, height: '100%', background: COLORS[idx % COLORS.length] }} />
                  </div>
                </div>
              ))
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: 12, borderRadius: 8, textAlign: 'center', lineHeight: 1.4 }}>
            💡 {biasData.note || 'Compliance settings audit'}
          </div>
        </div>
      </div>
    </div>
  );
}
