'use client';

import { useState, useEffect } from 'react';

interface Offer {
  id: string;
  application_id: string;
  candidate_name: string;
  candidate_email: string;
  job_title: string;
  department?: string;
  base_salary?: number;
  joining_date?: string;
  offer_letter_text?: string;
  status: string;
  expires_at?: string;
  sent_at?: string;
  compensation_details?: Record<string, any>;
  created_at: string;
}

interface Candidate {
  id: string;
  candidate_name: string;
  candidate_email: string;
  job_title?: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#f59e0b',
  sent: '#6366f1',
  accepted: '#10b981',
  declined: '#ef4444',
  expired: '#94a3b8',
};

export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Offer | null>(null);
  const [filter, setFilter] = useState('ALL');
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [formAppId, setFormAppId] = useState('');
  const [formCandidateName, setFormCandidateName] = useState('');
  const [formCandidateEmail, setFormCandidateEmail] = useState('');
  const [formJobTitle, setFormJobTitle] = useState('');
  const [formDept, setFormDept] = useState('');
  const [formSalary, setFormSalary] = useState('');
  const [formJoiningDate, setFormJoiningDate] = useState('');
  const [formBonus, setFormBonus] = useState('');

  const loadData = () => {
    setLoading(true);
    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/offers`, { headers }),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/applications`, { headers }),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/jobs`, { headers }),
    ]).then(async ([offerRes, appRes, jobRes]) => {
      const off: Offer[] = offerRes.ok ? await offerRes.json() : [];
      const apps = appRes.ok ? await appRes.json() : [];
      const jobs = jobRes.ok ? await jobRes.json() : [];
      
      setOffers(off);
      
      const cands = apps.map((a: any) => {
        const job = jobs.find((j: any) => j.id === a.job_id);
        return {
          id: a.id,
          candidate_name: a.candidate_name,
          candidate_email: a.candidate_email,
          job_title: job?.title
        };
      });
      setCandidates(cands);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/offers`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          application_id: formAppId,
          candidate_name: formCandidateName,
          candidate_email: formCandidateEmail,
          job_title: formJobTitle,
          department: formDept || null,
          base_salary: formSalary ? parseFloat(formSalary) : null,
          joining_date: formJoiningDate ? new Date(formJoiningDate).toISOString() : null,
          compensation_details: formBonus ? { sign_on_bonus: parseFloat(formBonus) } : {},
        }),
      });

      if (res.ok) {
        setShowModal(false);
        setFormAppId('');
        setFormCandidateName('');
        setFormCandidateEmail('');
        setFormJobTitle('');
        setFormDept('');
        setFormSalary('');
        setFormJoiningDate('');
        setFormBonus('');
        loadData();
      }
    } catch {}
  };

  const handleGenerateLetter = async (id: string) => {
    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/offers/${id}/generate-letter`, {
        method: 'POST',
        headers,
      });
      if (res.ok) {
        const updated = await res.json();
        setSelected(updated);
        loadData();
      }
    } catch {}
  };

  const handleSendOffer = async (id: string) => {
    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/offers/${id}/send`, {
        method: 'POST',
        headers,
      });
      if (res.ok) {
        const updated = await res.json();
        setSelected(updated);
        loadData();
      }
    } catch {}
  };

  const handleRespond = async (id: string, decision: 'ACCEPTED' | 'DECLINED') => {
    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/offers/${id}/respond`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ decision }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSelected(updated);
        loadData();
      }
    } catch {}
  };

  const handleSelectCandidate = (appId: string) => {
    const cand = candidates.find(c => c.id === appId);
    if (cand) {
      setFormAppId(appId);
      setFormCandidateName(cand.candidate_name);
      setFormCandidateEmail(cand.candidate_email);
      setFormJobTitle(cand.job_title || '');
    }
  };

  const filtered = filter === 'ALL' ? offers : offers.filter(o => o.status.toUpperCase() === filter);

  // Computations
  const stats = {
    total: offers.length,
    pending: offers.filter(o => o.status === 'SENT' || o.status === 'DRAFT').length,
    accepted: offers.filter(o => o.status === 'ACCEPTED').length,
    declined: offers.filter(o => o.status === 'DECLINED').length,
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Offers</h1>
          <p>Generate, review, and track formal job offers with selected candidates</p>
        </div>
        <div className="page-header-right">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            ➕ Create Job Offer
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Offers', val: stats.total, color: 'var(--text-primary)' },
          { label: 'Pending / Sent', val: stats.pending, color: '#f59e0b' },
          { label: 'Accepted', val: stats.accepted, color: '#10b981' },
          { label: 'Declined', val: stats.declined, color: '#ef4444' },
        ].map((s, idx) => (
          <div key={idx} className="card" style={{ padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {['ALL', 'DRAFT', 'SENT', 'ACCEPTED', 'DECLINED'].map(f => (
          <button
            key={f}
            className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 400px' : '1fr', gap: 24 }}>
        {/* List */}
        <div className="card">
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner" style={{ margin: 'auto', width: 28, height: 28 }} /></div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
              <p style={{ fontWeight: 600 }}>No offers found</p>
              <p style={{ fontSize: 13 }}>Create a new offer to start the onboarding pipeline.</p>
            </div>
          ) : (
            filtered.map(offer => (
              <div
                key={offer.id}
                className="list-item"
                style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px',
                  borderBottom: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  background: selected?.id === offer.id ? 'rgba(124,58,237,0.1)' : 'transparent',
                }}
                onClick={() => setSelected(selected?.id === offer.id ? null : offer)}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--color-primary-900)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: 'var(--color-primary-300)', fontWeight: 700, fontSize: 16,
                }}>
                  {offer.candidate_name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{offer.candidate_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {offer.job_title} · {offer.base_salary ? `₹${offer.base_salary.toLocaleString()}/yr` : 'TBD'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="badge" style={{
                    background: `${STATUS_COLORS[offer.status.toLowerCase()]}20`,
                    color: STATUS_COLORS[offer.status.toLowerCase()],
                    border: `1px solid ${STATUS_COLORS[offer.status.toLowerCase()]}40`,
                    fontWeight: 700, textTransform: 'uppercase', fontSize: 10,
                  }}>
                    {offer.status}
                  </span>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                    Start: {offer.joining_date ? new Date(offer.joining_date).toLocaleDateString() : 'TBD'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="card" style={{ padding: 24, alignSelf: 'start', position: 'sticky', top: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>Offer Details</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>✕</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Candidate</span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{selected.candidate_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Email</span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{selected.candidate_email}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Salary</span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{selected.base_salary ? `₹${selected.base_salary.toLocaleString()}/yr` : 'TBD'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Signing Bonus</span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>
                  {selected.compensation_details?.sign_on_bonus ? `₹${selected.compensation_details.sign_on_bonus.toLocaleString()}` : 'None'}
                </span>
              </div>
            </div>

            {/* Letter Preview Box */}
            {selected.offer_letter_text ? (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>Offer Letter Letter</div>
                <div style={{ 
                  background: '#fff', color: '#111827', borderRadius: 8, padding: 16, 
                  fontFamily: 'Georgia, serif', fontSize: 12, lineHeight: 1.5,
                  maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border-subtle)' 
                }}>
                  <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>{selected.offer_letter_text}</pre>
                </div>
              </div>
            ) : null}

            {/* Action Bar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {selected.status === 'DRAFT' && (
                <>
                  <button className="btn btn-ghost" onClick={() => handleGenerateLetter(selected.id)}>
                    ✨ Generate Offer Letter
                  </button>
                  {selected.offer_letter_text && (
                    <button className="btn btn-primary" onClick={() => handleSendOffer(selected.id)}>
                      ✉️ Send Offer Email
                    </button>
                  )}
                </>
              )}
              {selected.status === 'SENT' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button 
                    className="btn btn-sm btn-primary" 
                    style={{ background: '#10b981', border: 'none' }}
                    onClick={() => handleRespond(selected.id, 'ACCEPTED')}
                  >
                    Accept
                  </button>
                  <button 
                    className="btn btn-sm btn-ghost"
                    style={{ color: '#ef4444', border: '1px solid #ef4444' }}
                    onClick={() => handleRespond(selected.id, 'DECLINED')}
                  >
                    Decline
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal Create Offer */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ background: 'var(--bg-card)', padding: 32, width: '90%', maxWidth: 480, borderRadius: 'var(--radius-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>Create Offer</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateOffer} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Select Candidate</label>
                <select
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14 }}
                  required
                  value={formAppId}
                  onChange={e => handleSelectCandidate(e.target.value)}
                >
                  <option value="">Choose candidate...</option>
                  {candidates.map(c => (
                    <option key={c.id} value={c.id}>{c.candidate_name} ({c.job_title})</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Candidate Name</label>
                <input
                  type="text" required readOnly
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: 'var(--text-tertiary)', fontSize: 14, boxSizing: 'border-box' }}
                  value={formCandidateName}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Candidate Email</label>
                <input
                  type="email" required readOnly
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: 'var(--text-tertiary)', fontSize: 14, boxSizing: 'border-box' }}
                  value={formCandidateEmail}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Department</label>
                <input
                  type="text"
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
                  value={formDept}
                  onChange={e => setFormDept(e.target.value)}
                  placeholder="e.g. Engineering"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Base Salary (INR/yr)</label>
                  <input
                    type="number" required
                    style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
                    value={formSalary}
                    onChange={e => setFormSalary(e.target.value)}
                    placeholder="e.g. 1200000"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Sign-on Bonus</label>
                  <input
                    type="number"
                    style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
                    value={formBonus}
                    onChange={e => setFormBonus(e.target.value)}
                    placeholder="e.g. 50000"
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Joining Date</label>
                <input
                  type="date" required
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14 }}
                  value={formJoiningDate}
                  onChange={e => setFormJoiningDate(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }}>
                Create Offer Draft
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
