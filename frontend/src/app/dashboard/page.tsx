'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface DashboardStats {
  total_jobs: number;
  active_jobs: number;
  total_applications: number;
  todays_applications: number;
  shortlisted_candidates: number;
  interviews_scheduled: number;
  offers_sent: number;
  joined_employees: number;
  rejected_candidates: number;
}




export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    total_jobs: 0, active_jobs: 0, total_applications: 0,
    todays_applications: 0, shortlisted_candidates: 0,
    interviews_scheduled: 0, offers_sent: 0,
    joined_employees: 0, rejected_candidates: 0
  });
  const [loading, setLoading] = useState(true);

  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  useEffect(() => {
    const load = async () => {
      if (typeof window !== 'undefined') {
        const roles = localStorage.getItem('roles');
        if (roles) {
          const parsed = JSON.parse(roles);
          if (parsed.includes('platform_admin')) {
            router.push('/dashboard/super-admin');
            return;
          }
        }
      }
      setLoading(true);
      const headers = getHeaders();
      try {
        const [appRes, jobsRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/applications`, { headers }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/jobs`, { headers })
        ]);
        let apps: any[] = [], jobs: any[] = [];
        if (appRes.ok) apps = await appRes.json();
        if (jobsRes.ok) jobs = await jobsRes.json();
        const todayStr = new Date().toDateString();
        setStats({
          total_jobs: jobs.length,
          active_jobs: jobs.filter((j: any) => j.status === 'PUBLISHED').length,
          total_applications: apps.length,
          todays_applications: apps.filter((a: any) => new Date(a.created_at).toDateString() === todayStr).length,
          shortlisted_candidates: apps.filter((a: any) => a.status !== 'APPLIED' && a.status !== 'REJECTED').length,
          interviews_scheduled: apps.filter((a: any) => a.status === 'INTERVIEW_STAGE').length,
          offers_sent: apps.filter((a: any) => a.status === 'OFFER_STAGE').length,
          joined_employees: apps.filter((a: any) => a.status === 'COMPLETED').length,
          rejected_candidates: apps.filter((a: any) => a.status === 'REJECTED').length,
        });
      } catch {/* show zeros on error */}
      finally { setLoading(false); }
    };
    load();
  }, []);


  const statCards = [
    { label: 'Total Jobs', value: stats.total_jobs, icon: '💼', accent: '#6366f1', bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.2)' },
    { label: 'Active Jobs', value: stats.active_jobs, icon: '⚡', accent: '#7c3aed', bg: 'rgba(124,58,237,0.1)', border: 'rgba(124,58,237,0.2)' },
    { label: 'Applications', value: stats.total_applications, icon: '📥', accent: '#34d399', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)' },
    { label: "Today's Apps", value: stats.todays_applications, icon: '📅', accent: '#20d9d2', bg: 'rgba(20,184,166,0.1)', border: 'rgba(20,184,166,0.2)' },
    { label: 'Shortlisted', value: stats.shortlisted_candidates, icon: '👥', accent: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.2)' },
    { label: 'Interviews', value: stats.interviews_scheduled, icon: '🎥', accent: '#818cf8', bg: 'rgba(129,140,248,0.1)', border: 'rgba(129,140,248,0.2)' },
    { label: 'Offers Sent', value: stats.offers_sent, icon: '📄', accent: '#f472b6', bg: 'rgba(244,114,182,0.1)', border: 'rgba(244,114,182,0.2)' },
    { label: 'Joined', value: stats.joined_employees, icon: '🎉', accent: '#22d3ee', bg: 'rgba(34,211,238,0.1)', border: 'rgba(34,211,238,0.2)' },
    { label: 'Rejected', value: stats.rejected_candidates, icon: '❌', accent: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.2)' },
  ];

  const funnelStages = [
    { label: 'Applied', count: stats.total_applications, color: '#6366f1' },
    { label: 'Shortlisted', count: stats.shortlisted_candidates, color: '#7c3aed' },
    { label: 'Interviewed', count: stats.interviews_scheduled, color: '#a78bfa' },
    { label: 'Offered', count: stats.offers_sent, color: '#f472b6' },
    { label: 'Joined', count: stats.joined_employees, color: '#34d399' },
  ];

  const trendBars: number[] = [];
  const maxBar = 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 4 }}>
            Workforce Command Center
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Real-time AI recruitment & operations intelligence</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, fontSize: 12, color: '#34d399', fontWeight: 600 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#34d399', animation: 'blink 2s ease-in-out infinite' }} />
            AI Autopilot Active
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
        {statCards.map((s, i) => (
          <div key={i} style={{ padding: '18px', background: s.bg, border: `1px solid ${s.border}`, borderRadius: 14, position: 'relative', overflow: 'hidden', transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'default' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${s.accent}, transparent)`, opacity: 0.6 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
              <span style={{ fontSize: 18 }}>{s.icon}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: s.accent, letterSpacing: '-0.03em', lineHeight: 1 }}>
              {loading ? '—' : s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        {/* Hiring Funnel */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '24px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 20 }}>Hiring Funnel</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {stats.total_applications === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>No application data yet</div>
            ) : funnelStages.map((stage, i) => {
              const pct = Math.round((stage.count / stats.total_applications) * 100);
              return (
                <div key={stage.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color, boxShadow: `0 0 6px ${stage.color}` }} />
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{stage.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{stage.count} candidates</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: stage.color }}>{pct}%</span>
                    </div>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${stage.color}, ${stage.color}88)`, borderRadius: 6, transition: 'width 1s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pipeline Summary */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '24px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 20 }}>Pipeline Summary</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Active Applications', value: stats.total_applications, color: '#6366f1' },
              { label: 'Shortlisted', value: stats.shortlisted_candidates, color: '#7c3aed' },
              { label: 'Interviews Scheduled', value: stats.interviews_scheduled, color: '#a78bfa' },
              { label: 'Offers Pending', value: stats.offers_sent, color: '#f472b6' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{item.label}</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: item.color }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Hire Stats */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '24px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>Hiring Outcomes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Total Jobs Posted', value: stats.total_jobs, color: '#6366f1', icon: '💼' },
              { label: 'Active Jobs', value: stats.active_jobs, color: '#7c3aed', icon: '⚡' },
              { label: 'Joined Employees', value: stats.joined_employees, color: '#34d399', icon: '🎉' },
              { label: 'Rejected Candidates', value: stats.rejected_candidates, color: '#f87171', icon: '❌' },
            ].map(m => (
              <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 15 }}>{m.icon}</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{m.label}</span>
                </div>
                <span style={{ fontSize: 16, fontWeight: 800, color: m.color }}>{loading ? '—' : m.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Offer Stats */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '24px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>Offer & Interview Stats</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: "Today's Applications", value: stats.todays_applications, color: '#20d9d2', icon: '📅' },
              { label: 'Interviews Scheduled', value: stats.interviews_scheduled, color: '#818cf8', icon: '🎥' },
              { label: 'Offers Sent', value: stats.offers_sent, color: '#f472b6', icon: '📄' },
              { label: 'Offer Acceptance Rate', value: stats.offers_sent > 0 ? `${Math.round((stats.joined_employees / stats.offers_sent) * 100)}%` : '—', color: '#34d399', icon: '✅' },
            ].map(m => (
              <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 15 }}>{m.icon}</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{m.label}</span>
                </div>
                <span style={{ fontSize: 16, fontWeight: 800, color: m.color }}>{loading ? '—' : m.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
