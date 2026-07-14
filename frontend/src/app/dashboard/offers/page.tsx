'use client';

import { useState, useEffect } from 'react';

interface Application {
  id: string;
  candidate_name: string;
  candidate_email: string;
  status: string;
  fit_score: number;
  job_id: string;
  job_title?: string;
  created_at: string;
}

interface Offer {
  id: string;
  application: Application;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  salary?: number;
  start_date?: string;
  expiry_date?: string;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { color: string; icon: string }> = {
  pending: { color: '#f59e0b', icon: '⏳' },
  accepted: { color: '#10b981', icon: '✅' },
  declined: { color: '#ef4444', icon: '❌' },
  expired: { color: '#6b7280', icon: '⌛' },
};

export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'pending' | 'accepted' | 'declined'>('ALL');
  const [selected, setSelected] = useState<Offer | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/applications`, { headers }),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/jobs`, { headers }),
    ]).then(async ([appRes, jobRes]) => {
      const apps: { id: string; candidate_name: string; candidate_email: string; status: string; fit_score: number; job_id: string; created_at: string }[] = appRes.ok ? await appRes.json() : [];
      const jobs: { id: string; title: string }[] = jobRes.ok ? await jobRes.json() : [];

      // Derive offers from applications at offer/hired stage
      const offerApps = apps
        .filter(a => ['offer', 'offered', 'hired', 'accepted', 'rejected_offer'].some(s => a.status?.toLowerCase().includes(s)))
        .map(a => {
          let status: 'pending' | 'accepted' | 'declined' | 'expired' = 'pending';
          if (a.status?.toLowerCase().includes('hired') || a.status?.toLowerCase().includes('accept')) status = 'accepted';
          else if (a.status?.toLowerCase().includes('reject') || a.status?.toLowerCase().includes('decline')) status = 'declined';

          return {
            id: `offer-${a.id}`,
            application: {
              ...a,
              job_title: jobs.find(j => j.id === a.job_id)?.title || 'Unknown',
            },
            status,
            created_at: a.created_at,
          };
        });
      setOffers(offerApps);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'ALL' ? offers : offers.filter(o => o.status === filter);

  const counts = {
    ALL: offers.length,
    pending: offers.filter(o => o.status === 'pending').length,
    accepted: offers.filter(o => o.status === 'accepted').length,
    declined: offers.filter(o => o.status === 'declined').length,
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Offers</h1>
          <p>Manage employment offers and track responses</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid-4 mb-6">
        {[
          { label: 'Total Offers', value: offers.length, icon: '📄', color: '#6366f1' },
          { label: 'Pending', value: counts.pending, icon: '⏳', color: '#f59e0b' },
          { label: 'Accepted', value: counts.accepted, icon: '✅', color: '#10b981' },
          { label: 'Declined', value: counts.declined, icon: '❌', color: '#ef4444' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color, marginBottom: 4 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Offer acceptance rate bar */}
      {offers.length > 0 && (
        <div className="card mb-6" style={{ padding: '16px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
            <span style={{ fontWeight: 600 }}>Offer Acceptance Rate</span>
            <span style={{ color: 'var(--color-accent-400)', fontWeight: 700 }}>
              {Math.round((counts.accepted / offers.length) * 100)}%
            </span>
          </div>
          <div style={{ background: 'var(--surface-4)', borderRadius: 'var(--radius-full)', height: 8, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.round((counts.accepted / offers.length) * 100)}%`,
              height: '100%', borderRadius: 'inherit',
              background: 'linear-gradient(90deg, var(--color-accent-500), var(--color-accent-600))',
              transition: 'width 0.8s ease',
            }} />
          </div>
        </div>
      )}

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {(['ALL', 'pending', 'accepted', 'declined'] as const).map(f => (
          <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)} <span className="badge badge-secondary" style={{ marginLeft: 6 }}>{counts[f]}</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 360px' : '1fr', gap: 24 }}>
        <div className="card">
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner" style={{ margin: 'auto', width: 28, height: 28 }} /></div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>📄</div>
              <p style={{ fontWeight: 600 }}>No offers yet</p>
              <p style={{ fontSize: 13 }}>Offers are generated automatically when candidates complete the interview stage.</p>
            </div>
          ) : (
            filtered.map(offer => {
              const cfg = STATUS_CONFIG[offer.status];
              return (
                <div
                  key={offer.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px',
                    borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer',
                    background: selected?.id === offer.id ? 'var(--color-primary-950)' : 'transparent',
                    transition: 'background var(--transition-base)',
                  }}
                  onClick={() => setSelected(selected?.id === offer.id ? null : offer)}
                >
                  <div style={{ fontSize: 28, flexShrink: 0 }}>{cfg.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{offer.application.candidate_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      {offer.application.job_title} · {new Date(offer.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-primary-400)', marginBottom: 4 }}>
                      {offer.application.fit_score}% fit
                    </div>
                    <span className="badge" style={{
                      background: `${cfg.color}20`, color: cfg.color, border: `1px solid ${cfg.color}40`,
                      fontWeight: 600, textTransform: 'capitalize',
                    }}>
                      {offer.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {selected && (
          <div className="card" style={{ padding: 24, alignSelf: 'start', position: 'sticky', top: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>Offer Detail</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Candidate', value: selected.application.candidate_name },
                { label: 'Position', value: selected.application.job_title || '—' },
                { label: 'Fit Score', value: `${selected.application.fit_score}%` },
                { label: 'Status', value: selected.status },
                { label: 'Offer Date', value: new Date(selected.created_at).toLocaleDateString() },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>{label}</span>
                  <span style={{ fontWeight: 600, fontSize: 13, textTransform: 'capitalize' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
