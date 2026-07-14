'use client';

import { useState, useEffect } from 'react';

interface WarningLetter {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_email: string;
  violation_type: string;  // ATTENDANCE | PERFORMANCE | CONDUCT | POLICY | OTHER
  description: string;
  letter_content: string;
  issued_by: string;
  issued_at?: string;
  acknowledged_at?: string;
  status: string;          // DRAFT | ISSUED | ACKNOWLEDGED
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#f59e0b',
  issued: '#6366f1',
  acknowledged: '#10b981',
};

const VIOLATION_COLORS: Record<string, string> = {
  ATTENDANCE: '#f59e0b',
  PERFORMANCE: '#6366f1',
  CONDUCT: '#ef4444',
  POLICY: '#3b82f6',
  OTHER: '#94a3b8',
};

export default function WarningLettersPage() {
  const [letters, setLetters] = useState<WarningLetter[]>([]);
  const [selected, setSelected] = useState<WarningLetter | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formType, setFormType] = useState('CONDUCT');
  const [formDesc, setFormDesc] = useState('');
  const [formIssuer, setFormIssuer] = useState('');

  const loadData = () => {
    setLoading(true);
    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}` };

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/warning-letters`, { headers })
      .then(r => r.ok ? r.json() : [])
      .then(data => setLetters(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/warning-letters/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          employee_name: formName,
          employee_email: formEmail,
          violation_type: formType,
          description: formDesc,
          issued_by: formIssuer,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        setFormName('');
        setFormEmail('');
        setFormDesc('');
        setFormIssuer('');
        loadData();
      }
    } catch {}
  };

  const handleIssue = async (id: string) => {
    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/warning-letters/${id}/issue`, {
        method: 'PATCH',
        headers,
      });

      if (res.ok) {
        const updated = await res.json();
        setSelected(updated);
        loadData();
      }
    } catch {}
  };

  const handleAcknowledge = async (id: string) => {
    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/warning-letters/${id}/acknowledge`, {
        method: 'PATCH',
        headers,
      });

      if (res.ok) {
        const updated = await res.json();
        setSelected(updated);
        loadData();
      }
    } catch {}
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Warning Letters</h1>
          <p>Generate, issue, and archive formal warning notices for compliance and conduct tracking</p>
        </div>
        <div className="page-header-right">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            ⚠️ Draft Warning Letter
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 420px' : '1fr', gap: 24 }}>
        {/* List */}
        <div className="card">
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner" style={{ margin: 'auto', width: 28, height: 28 }} /></div>
          ) : letters.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
              <p style={{ fontWeight: 600 }}>No warning letters recorded</p>
              <p style={{ fontSize: 13 }}>Click "Draft Warning Letter" to begin drafting a warning record.</p>
            </div>
          ) : (
            letters.map(l => (
              <div
                key={l.id}
                className="list-item"
                style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px',
                  borderBottom: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  background: selected?.id === l.id ? 'rgba(124,58,237,0.1)' : 'transparent',
                }}
                onClick={() => setSelected(selected?.id === l.id ? null : l)}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--color-primary-900)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: 'var(--color-primary-300)', fontWeight: 700, fontSize: 16,
                }}>
                  ⚠️
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{l.employee_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Type: <span style={{ color: VIOLATION_COLORS[l.violation_type] || '#fff', fontWeight: 600 }}>{l.violation_type}</span> · Issued By: {l.issued_by}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="badge" style={{
                    background: `${STATUS_COLORS[l.status.toLowerCase()]}20`,
                    color: STATUS_COLORS[l.status.toLowerCase()],
                    border: `1px solid ${STATUS_COLORS[l.status.toLowerCase()]}40`,
                    fontWeight: 700, textTransform: 'uppercase', fontSize: 10,
                  }}>
                    {l.status}
                  </span>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                    {l.issued_at ? new Date(l.issued_at).toLocaleDateString() : 'Draft'}
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
              <h3 style={{ margin: 0 }}>Warning Details</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>✕</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>Employee</span>
                <span style={{ fontWeight: 600 }}>{selected.employee_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>Email</span>
                <span style={{ fontWeight: 600 }}>{selected.employee_email}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>Type</span>
                <span style={{ fontWeight: 600, color: VIOLATION_COLORS[selected.violation_type] }}>{selected.violation_type}</span>
              </div>
            </div>

            {/* Document Preview Box */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>Warning Document</div>
              <div style={{ 
                background: '#fff', color: '#111827', borderRadius: 8, padding: 16, 
                fontFamily: 'monospace', fontSize: 11, lineHeight: 1.4,
                maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border-subtle)' 
              }}>
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>{selected.letter_content}</pre>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {selected.status === 'DRAFT' && (
                <button className="btn btn-primary" onClick={() => handleIssue(selected.id)}>
                  ✉️ Issue and Send Letter
                </button>
              )}
              {selected.status === 'ISSUED' && (
                <button className="btn btn-primary" style={{ background: '#10b981', border: 'none' }} onClick={() => handleAcknowledge(selected.id)}>
                  ✓ Acknowledge Receipt
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Draft Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ background: 'var(--bg-card)', padding: 32, width: '90%', maxWidth: 480, borderRadius: 'var(--radius-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>Draft Warning Letter</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Employee Name</label>
                <input
                  type="text" required
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. Liam Parker"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Employee Email</label>
                <input
                  type="email" required
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                  placeholder="liam.p@company.com"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Violation Type</label>
                  <select
                    style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14 }}
                    value={formType}
                    onChange={e => setFormType(e.target.value)}
                  >
                    <option value="CONDUCT">Conduct</option>
                    <option value="ATTENDANCE">Attendance</option>
                    <option value="PERFORMANCE">Performance</option>
                    <option value="POLICY">Policy</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Issuer Name</label>
                  <input
                    type="text" required
                    style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
                    value={formIssuer}
                    onChange={e => setFormIssuer(e.target.value)}
                    placeholder="HR Department"
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Violation Details</label>
                <textarea
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
                  rows={4} required
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  placeholder="Specify context, dates, policies violated..."
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }}>
                Generate Warning Notice
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
