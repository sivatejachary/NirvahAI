'use client';

import { useState, useEffect } from 'react';

interface BGVCheck {
  id: string;
  application_id: string;
  candidate_name: string;
  candidate_email: string;
  check_type: string;  // CRIMINAL | EDUCATION | EMPLOYMENT | REFERENCE | CREDIT
  status: string;      // INITIATED | PENDING | CLEAR | FLAGGED | FAILED
  vendor?: string;
  report_url?: string;
  notes?: string;
  initiated_at?: string;
  completed_at?: string;
}

interface Application {
  id: string;
  candidate_name: string;
  candidate_email: string;
}

const STATUS_COLORS: Record<string, string> = {
  initiated: '#f59e0b',
  pending: '#f59e0b',
  clear: '#10b981',
  flagged: '#ef4444',
  failed: '#ef4444',
};

export default function BGVPage() {
  const [checks, setChecks] = useState<BGVCheck[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [formAppId, setFormAppId] = useState('');
  const [formCheckTypes, setFormCheckTypes] = useState<string[]>([]);
  
  // Update State
  const [selectedCheckId, setSelectedCheckId] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState('CLEAR');
  const [updateNotes, setUpdateNotes] = useState('');
  const [updateReportUrl, setUpdateReportUrl] = useState('');

  const loadData = () => {
    setLoading(true);
    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/bgv`, { headers }),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/applications`, { headers }),
    ]).then(async ([bgvRes, appRes]) => {
      const bgvData = bgvRes.ok ? await bgvRes.json() : [];
      const appData = appRes.ok ? await appRes.json() : [];
      
      setChecks(bgvData);
      setApplications(appData);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formCheckTypes.length === 0) return;
    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const app = applications.find(a => a.id === formAppId);
    if (!app) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/bgv/initiate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          application_id: formAppId,
          candidate_name: app.candidate_name,
          candidate_email: app.candidate_email,
          check_types: formCheckTypes,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        setFormAppId('');
        setFormCheckTypes([]);
        loadData();
      }
    } catch {}
  };

  const handleUpdateCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCheckId) return;
    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/bgv/${selectedCheckId}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          status: updateStatus,
          notes: updateNotes || null,
          report_url: updateReportUrl || null,
        }),
      });

      if (res.ok) {
        setSelectedCheckId(null);
        setUpdateNotes('');
        setUpdateReportUrl('');
        loadData();
      }
    } catch {}
  };

  const toggleCheckType = (t: string) => {
    setFormCheckTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  // Group checks by candidate / application_id client-side
  const candidatesMap: Record<string, { candidate_name: string; candidate_email: string; checks: BGVCheck[] }> = {};
  checks.forEach(c => {
    if (!candidatesMap[c.application_id]) {
      candidatesMap[c.application_id] = {
        candidate_name: c.candidate_name,
        candidate_email: c.candidate_email,
        checks: []
      };
    }
    candidatesMap[c.application_id].checks.push(c);
  });

  const candidatesList = Object.entries(candidatesMap).map(([appId, details]) => {
    // Determine overall status
    let status = 'CLEAR';
    if (details.checks.some(c => c.status === 'FLAGGED' || c.status === 'FAILED')) {
      status = 'FLAGGED';
    } else if (details.checks.some(c => c.status === 'PENDING' || c.status === 'INITIATED')) {
      status = 'PENDING';
    }
    return { appId, status, ...details };
  });

  const selectedGroup = selectedAppId ? candidatesMap[selectedAppId] : null;

  // Stats
  const stats = {
    total: candidatesList.length,
    clear: candidatesList.filter(c => c.status === 'CLEAR').length,
    pending: candidatesList.filter(c => c.status === 'PENDING').length,
    flagged: candidatesList.filter(c => c.status === 'FLAGGED').length,
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Background Verification</h1>
          <p>Initiate, monitor, and sign off on credentials and background checks</p>
        </div>
        <div className="page-header-right">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            🛡️ Initiate BGV Check
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Audits', val: stats.total, color: 'var(--text-primary)' },
          { label: 'Clear', val: stats.clear, color: '#10b981' },
          { label: 'Pending Checks', val: stats.pending, color: '#f59e0b' },
          { label: 'Flagged Records', val: stats.flagged, color: '#ef4444' },
        ].map((s, idx) => (
          <div key={idx} className="card" style={{ padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedGroup ? '1fr 400px' : '1fr', gap: 24 }}>
        {/* Left List */}
        <div className="card">
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner" style={{ margin: 'auto', width: 28, height: 28 }} /></div>
          ) : candidatesList.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🛡️</div>
              <p style={{ fontWeight: 600 }}>No BGV processes active</p>
              <p style={{ fontSize: 13 }}>Click "Initiate BGV Check" to start a background audit.</p>
            </div>
          ) : (
            candidatesList.map(c => (
              <div
                key={c.appId}
                className="list-item"
                style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px',
                  borderBottom: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  background: selectedAppId === c.appId ? 'rgba(124,58,237,0.1)' : 'transparent',
                }}
                onClick={() => setSelectedAppId(selectedAppId === c.appId ? null : c.appId)}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--color-primary-900)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: 'var(--color-primary-300)', fontWeight: 700, fontSize: 16,
                }}>
                  {c.candidate_name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{c.candidate_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.candidate_email}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    {c.checks.map(chk => (
                      <span key={chk.id} style={{ fontSize: 9, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', padding: '2px 6px', borderRadius: 4 }}>
                        {chk.check_type.substring(0, 4)}: {chk.status.substring(0, 4)}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="badge" style={{
                    background: `${STATUS_COLORS[c.status.toLowerCase()]}20`,
                    color: STATUS_COLORS[c.status.toLowerCase()],
                    border: `1px solid ${STATUS_COLORS[c.status.toLowerCase()]}40`,
                    fontWeight: 700, textTransform: 'uppercase', fontSize: 10,
                  }}>
                    {c.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right Detail Panel */}
        {selectedGroup && (
          <div className="card" style={{ padding: 24, alignSelf: 'start', position: 'sticky', top: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>Candidate Audits</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedAppId(null)}>✕</button>
            </div>
            
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{selectedGroup.candidate_name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>{selectedGroup.candidate_email}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {selectedGroup.checks.map(check => (
                <div key={check.id} style={{ padding: 14, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{check.check_type}</span>
                    <span className="badge" style={{
                      background: `${STATUS_COLORS[check.status.toLowerCase()]}20`,
                      color: STATUS_COLORS[check.status.toLowerCase()],
                      fontSize: 10, fontWeight: 700, textTransform: 'uppercase'
                    }}>
                      {check.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <div>Vendor: {check.vendor || 'TBD'}</div>
                    {check.report_url && (
                      <div>
                        Report: <a href={check.report_url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent-500)', textDecoration: 'none' }}>View Document ↗</a>
                      </div>
                    )}
                    {check.notes && <div style={{ fontStyle: 'italic', marginTop: 4 }}>"{check.notes}"</div>}
                  </div>
                  {check.status !== 'CLEAR' && check.status !== 'FAILED' && (
                    <button
                      className="btn btn-sm btn-ghost"
                      style={{ marginTop: 10, width: '100%', fontSize: 11 }}
                      onClick={() => { setSelectedCheckId(check.id); setUpdateStatus(check.status); }}
                    >
                      ✍️ Update Audit Status
                    </button>
                  )}

                  {selectedCheckId === check.id && (
                    <form onSubmit={handleUpdateCheck} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14, borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>New Status</label>
                        <select
                          style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: 6, color: '#fff', fontSize: 12 }}
                          value={updateStatus}
                          onChange={e => setUpdateStatus(e.target.value)}
                        >
                          <option value="PENDING">PENDING</option>
                          <option value="CLEAR">CLEAR</option>
                          <option value="FLAGGED">FLAGGED</option>
                          <option value="FAILED">FAILED</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>Audit Report URL (Optional)</label>
                        <input
                          type="text"
                          style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: 6, color: '#fff', fontSize: 12, boxSizing: 'border-box' }}
                          value={updateReportUrl}
                          onChange={e => setUpdateReportUrl(e.target.value)}
                          placeholder="https://reports.com/file.pdf"
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>Verification Notes</label>
                        <textarea
                          style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: 6, color: '#fff', fontSize: 12, boxSizing: 'border-box' }}
                          rows={2}
                          value={updateNotes}
                          onChange={e => setUpdateNotes(e.target.value)}
                          placeholder="Verification logs, details of flag..."
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <button type="submit" className="btn btn-sm btn-primary">Save</button>
                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setSelectedCheckId(null)}>Cancel</button>
                      </div>
                    </form>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Initiate Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ background: 'var(--bg-card)', padding: 32, width: '90%', maxWidth: 480, borderRadius: 'var(--radius-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>Initiate BGV Audit</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleInitiate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Candidate</label>
                <select
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14 }}
                  required
                  value={formAppId}
                  onChange={e => setFormAppId(e.target.value)}
                >
                  <option value="">Choose candidate...</option>
                  {applications.map(a => (
                    <option key={a.id} value={a.id}>{a.candidate_name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>Verification Scope</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {['CRIMINAL', 'EDUCATION', 'EMPLOYMENT', 'REFERENCE', 'CREDIT'].map(type => (
                    <label key={type} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={formCheckTypes.includes(type)}
                        onChange={() => toggleCheckType(type)}
                      />
                      {type.charAt(0) + type.slice(1).toLowerCase()} Verification
                    </label>
                  ))}
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }} disabled={formCheckTypes.length === 0}>
                Begin Audit Processing
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
