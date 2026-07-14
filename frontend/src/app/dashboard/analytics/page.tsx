'use client';

import { useState, useEffect } from 'react';

interface AnalyticsData {
  total_jobs: number;
  total_applications: number;
  active_workflows: number;
  total_spend_usd: number;
  applications_by_status: Record<string, number>;
  jobs_by_status: Record<string, number>;
  top_roles: Array<{ title: string; count: number }>;
}

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#22c55e'];

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData>({
    total_jobs: 0,
    total_applications: 0,
    active_workflows: 0,
    total_spend_usd: 0,
    applications_by_status: {},
    jobs_by_status: {},
    top_roles: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/jobs`, { headers }),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/applications`, { headers }),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/workflows`, { headers }),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/workflows/metrics/spend`, { headers }),
    ]).then(async ([jobsRes, appsRes, wfRes, spendRes]) => {
      const jobs: { id: string; title: string; status: string }[] = jobsRes.ok ? await jobsRes.json() : [];
      const apps: { id: string; status: string; job_id: string }[] = appsRes.ok ? await appsRes.json() : [];
      const workflows: { id: string; status: string }[] = wfRes.ok ? await wfRes.json() : [];
      const spend = spendRes.ok ? await spendRes.json() : { total_usd: 0 };

      // Aggregate
      const appsByStatus: Record<string, number> = {};
      apps.forEach(a => { appsByStatus[a.status] = (appsByStatus[a.status] || 0) + 1; });

      const jobsByStatus: Record<string, number> = {};
      jobs.forEach(j => { jobsByStatus[j.status] = (jobsByStatus[j.status] || 0) + 1; });

      // Top roles by application count
      const roleCounts: Record<string, number> = {};
      apps.forEach(a => {
        const job = jobs.find(j => j.id === a.job_id);
        if (job) roleCounts[job.title] = (roleCounts[job.title] || 0) + 1;
      });
      const topRoles = Object.entries(roleCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([title, count]) => ({ title, count }));

      setData({
        total_jobs: jobs.length,
        total_applications: apps.length,
        active_workflows: workflows.filter(w => w.status === 'running').length,
        total_spend_usd: spend.total_usd || 0,
        applications_by_status: appsByStatus,
        jobs_by_status: jobsByStatus,
        top_roles: topRoles,
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const maxAppCount = Math.max(...Object.values(data.applications_by_status), 1);
  const maxRoleCount = Math.max(...data.top_roles.map(r => r.count), 1);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Analytics</h1>
          <p>Real-time hiring intelligence and platform metrics</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid-4 mb-6">
        {[
          { label: 'Active Jobs', value: data.total_jobs, icon: '💼', color: '#6366f1', desc: 'Open positions' },
          { label: 'Applications', value: data.total_applications, icon: '📋', color: '#8b5cf6', desc: 'Total received' },
          { label: 'Live Workflows', value: data.active_workflows, icon: '⚡', color: '#06b6d4', desc: 'Running now' },
          { label: 'AI Spend', value: `$${data.total_spend_usd.toFixed(4)}`, icon: '💰', color: '#f59e0b', desc: 'Total cost' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{s.label}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: s.color, marginBottom: 4 }}>{loading ? '—' : s.value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{s.desc}</div>
              </div>
              <div style={{ fontSize: 32 }}>{s.icon}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* Applications by stage */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ margin: '0 0 20px' }}>Applications by Stage</h3>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" style={{ width: 24, height: 24 }} /></div>
          ) : Object.keys(data.applications_by_status).length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 13 }}>No data yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(data.applications_by_status).map(([status, count], i) => (
                <div key={status}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                    <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{status}</span>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{count}</span>
                  </div>
                  <div style={{ background: 'var(--surface-4)', borderRadius: 'var(--radius-full)', height: 8, overflow: 'hidden' }}>
                    <div style={{
                      width: `${(count / maxAppCount) * 100}%`, height: '100%', borderRadius: 'inherit',
                      background: COLORS[i % COLORS.length], transition: 'width 0.8s ease',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Jobs by status */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ margin: '0 0 20px' }}>Jobs by Status</h3>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" style={{ width: 24, height: 24 }} /></div>
          ) : Object.keys(data.jobs_by_status).length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 13 }}>No data yet</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', padding: '10px 0' }}>
              {Object.entries(data.jobs_by_status).map(([status, count], i) => {
                const total = Object.values(data.jobs_by_status).reduce((a, b) => a + b, 0);
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={status} style={{ textAlign: 'center', padding: '16px 20px', background: 'var(--surface-3)', borderRadius: 'var(--radius-lg)', minWidth: 100 }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: COLORS[i % COLORS.length] }}>{count}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'capitalize', marginTop: 4 }}>{status}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-disabled)', marginTop: 2 }}>{pct}%</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top roles by applications */}
      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ margin: '0 0 20px' }}>Top Roles by Applications</h3>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" style={{ width: 24, height: 24 }} /></div>
        ) : data.top_roles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 13 }}>
            Post jobs and receive applications to see analytics here.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.top_roles.map((role, i) => (
              <div key={role.title}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>#{i + 1} {role.title}</span>
                  <span style={{ color: COLORS[i % COLORS.length], fontWeight: 800 }}>{role.count} applications</span>
                </div>
                <div style={{ background: 'var(--surface-4)', borderRadius: 'var(--radius-full)', height: 10, overflow: 'hidden' }}>
                  <div style={{
                    width: `${(role.count / maxRoleCount) * 100}%`, height: '100%', borderRadius: 'inherit',
                    background: `linear-gradient(90deg, ${COLORS[i % COLORS.length]}, ${COLORS[(i + 1) % COLORS.length]})`,
                    transition: 'width 0.8s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
