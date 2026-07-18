'use client';

import { useState, useEffect } from 'react';

interface FunnelItem { stage: string; count: number; percentage: number; }
interface TimeToHire { average_days: number; min_days: number; max_days: number; }
interface OffersStats { total: number; draft: number; sent: number; accepted: number; declined: number; expired: number; acceptance_rate: number; }
interface BiasAudit { note: string; status_distribution: Record<string, number>; }

const COLORS = ['#6366f1', '#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#f472b6', '#3b82f6'];
const TIME_PERIODS = ['Last 7 days', 'Last 30 days', 'Last 90 days', 'All time'];

const MOCK_OVERVIEW = { total_jobs: 12, total_applications: 245, interviews_completed: 28, offers_sent: 6, offer_acceptance_rate: 83 };
const MOCK_FUNNEL: FunnelItem[] = [
  { stage: 'Applied', count: 245, percentage: 100 },
  { stage: 'Resume Screened', count: 180, percentage: 73 },
  { stage: 'MCQ Assessment', count: 90, percentage: 37 },
  { stage: 'AI Screening Call', count: 55, percentage: 22 },
  { stage: 'Technical Interview', count: 28, percentage: 11 },
  { stage: 'Offer Sent', count: 6, percentage: 2.4 },
  { stage: 'Joined', count: 5, percentage: 2.0 },
];

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<Record<string, number>>(MOCK_OVERVIEW);
  const [funnel, setFunnel] = useState<FunnelItem[]>(MOCK_FUNNEL);
  const [timeToHire, setTimeToHire] = useState<TimeToHire>({ average_days: 4.5, min_days: 2, max_days: 14 });
  const [offersStats, setOffersStats] = useState<OffersStats>({ total: 6, draft: 1, sent: 3, accepted: 5, declined: 1, expired: 0, acceptance_rate: 83 });
  const [biasData, setBiasData] = useState<BiasAudit>({ note: 'All screenings conducted via AI with demographic-blind scoring.', status_distribution: { 'APPLIED': 245, 'SHORTLISTED': 90, 'INTERVIEWED': 28, 'OFFERED': 6, 'REJECTED': 121 } });
  const [loading, setLoading] = useState(false);
  const [activePeriod, setActivePeriod] = useState('Last 30 days');

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    setLoading(true);
    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/analytics/overview`, { headers }),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/analytics/hiring-funnel`, { headers }),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/analytics/time-to-hire`, { headers }),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/analytics/offers`, { headers }),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/analytics/bias-audit`, { headers }),
    ]).then(async ([overRes, funRes, timeRes, offRes, biasRes]) => {
      if (overRes.ok) setOverview(await overRes.json());
      if (funRes.ok) { const d = await funRes.json(); if (d.length) setFunnel(d); }
      if (timeRes.ok) setTimeToHire(await timeRes.json());
      if (offRes.ok) setOffersStats(await offRes.json());
      if (biasRes.ok) setBiasData(await biasRes.json());
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const card = (label: string, value: string | number, color: string, icon: string, subtitle?: string) => (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${color}, transparent)`, opacity: 0.7 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 30, fontWeight: 900, color, letterSpacing: '-0.03em', lineHeight: 1 }}>{loading ? '—' : value}</div>
      {subtitle && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>{subtitle}</div>}
    </div>
  );

  const weeklyTrend = [18, 24, 19, 32, 28, 38, 42];
  const maxTrend = Math.max(...weeklyTrend);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginBottom: 4 }}>Analytics & Insights</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Real-time funnel, timing, bias audits and compliance reporting</p>
        </div>
        {/* Period Selector */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 4 }}>
          {TIME_PERIODS.map(p => (
            <button key={p} onClick={() => setActivePeriod(p)} style={{ padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: p === activePeriod ? 700 : 400, background: p === activePeriod ? 'rgba(124,58,237,0.3)' : 'transparent', border: p === activePeriod ? '1px solid rgba(124,58,237,0.4)' : '1px solid transparent', color: p === activePeriod ? '#a78bfa' : 'rgba(255,255,255,0.45)', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'Inter, sans-serif' }}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
        {card('Total Jobs', overview.total_jobs || 0, '#6366f1', '💼', 'Active + Draft positions')}
        {card('Applications', overview.total_applications || 0, '#7c3aed', '📥', 'Total candidates in pipeline')}
        {card('Interviews Done', overview.interviews_completed || 0, '#06b6d4', '🎥', 'AI + Human combined')}
        {card('Offers Sent', overview.offers_sent || 0, '#f59e0b', '📄', 'Pending acceptance')}
        {card('Acceptance Rate', `${overview.offer_acceptance_rate || 0}%`, '#10b981', '✅', 'Offer to join conversion')}
      </div>

      {/* Charts Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
        {/* Hiring Funnel */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '24px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 20 }}>📊 Hiring Funnel Conversion</div>
          {funnel.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>No funnel data yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {funnel.map((item, idx) => (
                <div key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[idx % COLORS.length], flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{item.stage}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>{item.count}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: COLORS[idx % COLORS.length], minWidth: 40, textAlign: 'right' }}>{item.percentage}%</span>
                    </div>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${item.percentage}%`, background: `linear-gradient(90deg, ${COLORS[idx % COLORS.length]}, ${COLORS[idx % COLORS.length]}88)`, borderRadius: 6, transition: 'width 1.2s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Weekly Trend */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 20 }}>📈 Daily Application Volume</div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 10, paddingTop: 12 }}>
            {weeklyTrend.map((val, i) => {
              const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 10, color: '#a78bfa', fontWeight: 600 }}>{val}</div>
                  <div style={{ width: '100%', borderRadius: '6px 6px 0 0', background: i === 6 ? 'linear-gradient(180deg, #7c3aed, #6366f1)' : 'rgba(124,58,237,0.3)', height: `${(val / maxTrend) * 120}px`, transition: 'height 0.8s ease', boxShadow: i === 6 ? '0 0 12px rgba(124,58,237,0.5)' : 'none' }} />
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{days[i]}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        {/* Time to Hire */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '24px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 20 }}>⏱️ Time to Hire</div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 20, lineHeight: 1.6 }}>Average days from application to joining</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Fastest Hire', val: timeToHire.min_days, color: '#10b981', icon: '🟢' },
              { label: 'Average', val: timeToHire.average_days, color: '#6366f1', icon: '🔵' },
              { label: 'Slowest Hire', val: timeToHire.max_days, color: '#f87171', icon: '🔴' },
            ].map((t, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>{t.icon}</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{t.label}</span>
                </div>
                <span style={{ fontSize: 20, fontWeight: 800, color: t.color }}>{loading ? '—' : `${t.val}d`}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Offers Stats */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '24px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 20 }}>📄 Offer Distribution</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Draft', val: offersStats.draft, color: '#f59e0b' },
              { label: 'Sent', val: offersStats.sent, color: '#6366f1' },
              { label: 'Accepted', val: offersStats.accepted, color: '#10b981' },
              { label: 'Declined', val: offersStats.declined, color: '#f87171' },
            ].map((o, idx) => (
              <div key={idx} style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{o.label}</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: o.color }}>{loading ? '—' : o.val}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: '12px 14px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>📈 Acceptance Rate</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>{loading ? '—' : `${offersStats.acceptance_rate}%`}</span>
          </div>
        </div>

        {/* Bias Audit */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '24px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>🔍 Bias-Free Audit</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 16, lineHeight: 1.6 }}>GDPR · Demographic-blind screening results</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Loading...</div>
            ) : Object.entries(biasData.status_distribution).length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No candidate records.</div>
            ) : (
              Object.entries(biasData.status_distribution).map(([status, count], idx) => {
                const total = Object.values(biasData.status_distribution).reduce((a, b) => a + b, 0);
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={status}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{status}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: COLORS[idx % COLORS.length] }}>{count} ({pct}%)</span>
                    </div>
                    <div style={{ height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 5, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: COLORS[idx % COLORS.length], borderRadius: 5 }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {biasData.note && (
            <div style={{ marginTop: 16, padding: '10px 12px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
              💡 {biasData.note}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
