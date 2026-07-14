'use client';

import { useState, useEffect, FormEvent } from 'react';

interface Policy {
  id: string;
  title: string;
  slug: string;
  category: string;
  description: string;
  status: string;
  has_published_version: boolean;
  requires_legal_review: boolean;
  created_at: string;
}

const CATEGORIES = [
  { value: 'leave', label: 'Leave Policy' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'wfh', label: 'WFH / Remote Work' },
  { value: 'code_of_conduct', label: 'Code of Conduct' },
  { value: 'notice_period', label: 'Notice Period' },
  { value: 'benefits', label: 'Benefits' },
  { value: 'compensation', label: 'Compensation' },
  { value: 'hiring', label: 'Hiring Policy' },
  { value: 'assessment', label: 'Assessment Policy' },
  { value: 'interview', label: 'Interview Policy' },
  { value: 'offer', label: 'Offer Policy' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'offboarding', label: 'Offboarding' },
  { value: 'data_privacy', label: 'Data Privacy' },
  { value: 'acceptable_use', label: 'Acceptable Use' },
  { value: 'expense', label: 'Expense Policy' },
];

const STATUS_STYLES: Record<string, string> = {
  draft: 'badge-default',
  under_review: 'badge-warn',
  approved: 'badge-primary',
  published: 'badge-success',
  archived: 'badge-default',
};

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '', category: 'leave', description: '', initial_content: '',
    requires_legal_review: false,
  });
  const [editor, setEditor] = useState('');
  const [editingVersion, setEditingVersion] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
  const h = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchPolicies = () => {
    setLoading(true);
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/policies/`, { headers: h })
      .then(r => r.json()).then(setPolicies).catch(() => setPolicies([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPolicies(); }, []);

  const fetchVersions = (policyId: string) => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/policies/${policyId}/versions`, { headers: h })
      .then(r => r.json()).then(setVersions).catch(() => setVersions([]));
  };

  const selectPolicy = (p: Policy) => {
    setSelectedPolicy(p);
    fetchVersions(p.id);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/policies/`, {
        method: 'POST', headers: h, body: JSON.stringify(form),
      });
      if (!res.ok) { const d = await res.json(); setError(d.detail || 'Failed.'); return; }
      setShowCreate(false);
      fetchPolicies();
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  };

  const handleAction = async (action: 'submit' | 'approve' | 'publish', versionId: string) => {
    if (!selectedPolicy) return;
    const url = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/policies/${selectedPolicy.id}/versions/${versionId}/${action}`;
    const res = await fetch(url, { method: 'POST', headers: h, body: JSON.stringify({}) });
    if (res.ok) {
      fetchVersions(selectedPolicy.id);
      fetchPolicies();
    }
  };

  const handleNewVersion = async () => {
    if (!selectedPolicy || !editor.trim()) return;
    setSaving(true);
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/policies/${selectedPolicy.id}/versions`, {
      method: 'POST', headers: h, body: JSON.stringify({ content: editor, change_summary: 'Manual edit' }),
    });
    if (res.ok) {
      setEditingVersion(false);
      setEditor('');
      fetchVersions(selectedPolicy.id);
    }
    setSaving(false);
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'flex-start' }}>
        {/* Policy List */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Policies</span>
            <button className="btn btn-primary btn-sm" style={{ padding: '4px 10px' }} onClick={() => setShowCreate(v => !v)}>
              {showCreate ? 'âœ•' : '+'}
            </button>
          </div>

          {showCreate && (
            <div style={{ padding: 16, borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-3)' }}>
              {error && <div className="alert alert-error mb-3" style={{ fontSize: 12 }}>{error}</div>}
              <form onSubmit={handleCreate}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input className="input" placeholder="Policy title" value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required style={{ fontSize: 13 }} />
                  <select className="input" value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ fontSize: 13 }}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  <textarea className="input" placeholder="Initial content (markdown)..." value={form.initial_content}
                    onChange={e => setForm(f => ({ ...f, initial_content: e.target.value }))}
                    style={{ fontSize: 13, minHeight: 60 }} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.requires_legal_review}
                      onChange={e => setForm(f => ({ ...f, requires_legal_review: e.target.checked }))} />
                    Requires legal review
                  </label>
                  <button type="submit" className="btn btn-primary btn-sm w-full" disabled={saving}
                    style={{ justifyContent: 'center' }}>
                    {saving ? 'Creating...' : 'Create Policy'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {loading ? (
            <div style={{ padding: 32, textAlign: 'center' }}><div className="spinner" style={{ margin: 'auto' }} /></div>
          ) : policies.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
              No policies yet.
            </div>
          ) : (
            <div>
              {policies.map(p => (
                <div key={p.id}
                  onClick={() => selectPolicy(p)}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border-subtle)',
                    background: selectedPolicy?.id === p.id ? 'rgba(99,102,241,0.08)' : 'transparent',
                    transition: 'background var(--transition-fast)',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: selectedPolicy?.id === p.id ? 'var(--color-primary-400)' : 'var(--text-primary)' }}>
                      {p.title}
                    </span>
                    <span className={`badge ${STATUS_STYLES[p.status] || 'badge-default'}`} style={{ fontSize: 9 }}>
                      {p.status}
                    </span>
                  </div>
                  <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                    {CATEGORIES.find(c => c.value === p.category)?.label || p.category}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Policy Detail */}
        {!selectedPolicy ? (
          <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>ðŸ“‹</div>
            <p>Select a policy to view its versions and lifecycle status.</p>
          </div>
        ) : (
          <div>
            <div className="card mb-4">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <h3 style={{ marginBottom: 4 }}>{selectedPolicy.title}</h3>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className={`badge ${STATUS_STYLES[selectedPolicy.status]}`}>{selectedPolicy.status}</span>
                    <span className="text-xs text-muted">
                      {CATEGORIES.find(c => c.value === selectedPolicy.category)?.label}
                    </span>
                    {selectedPolicy.requires_legal_review && (
                      <span className="badge badge-warn">Legal Review Required</span>
                    )}
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm"
                  onClick={() => { setEditingVersion(v => !v); setEditor(''); }}>
                  {editingVersion ? 'Cancel Edit' : '+ New Version'}
                </button>
              </div>

              {/* Policy Lifecycle Info */}
              <div style={{ display: 'flex', gap: 0, padding: '12px 0', borderTop: '1px solid var(--border-subtle)' }}>
                {['Draft', 'Review', 'Approved', 'Published'].map((stage, i) => {
                  const statusMap: Record<string, number> = { draft: 0, under_review: 1, approved: 2, published: 3 };
                  const current = statusMap[selectedPolicy.status] ?? 0;
                  const isActive = i <= current;
                  return (
                    <div key={stage} style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
                      {i > 0 && (
                        <div style={{
                          position: 'absolute', left: 0, top: 10, height: 2, width: '50%',
                          background: isActive ? 'var(--color-accent-500)' : 'var(--border-default)',
                        }} />
                      )}
                      {i < 3 && (
                        <div style={{
                          position: 'absolute', right: 0, top: 10, height: 2, width: '50%',
                          background: i < current ? 'var(--color-accent-500)' : 'var(--border-default)',
                        }} />
                      )}
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%', margin: '0 auto',
                        background: isActive ? 'var(--color-accent-500)' : 'var(--surface-4)',
                        border: `2px solid ${isActive ? 'var(--color-accent-500)' : 'var(--border-default)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        position: 'relative', zIndex: 1,
                      }}>
                        {isActive && <span style={{ fontSize: 10, color: 'white' }}>âœ“</span>}
                      </div>
                      <span style={{ fontSize: 11, color: isActive ? 'var(--color-accent-400)' : 'var(--text-disabled)', marginTop: 4, display: 'block' }}>
                        {stage}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Editor */}
            {editingVersion && (
              <div className="card mb-4 animate-fade">
                <h4 style={{ marginBottom: 12 }}>Edit Content (Markdown)</h4>
                <textarea className="input" value={editor} onChange={e => setEditor(e.target.value)}
                  placeholder={`# ${selectedPolicy.title}\n\nWrite your policy content in Markdown...`}
                  style={{ minHeight: 200, fontFamily: 'var(--font-mono)', fontSize: 13 }} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditingVersion(false)}>Cancel</button>
                  <button className="btn btn-primary btn-sm" onClick={handleNewVersion} disabled={saving || !editor.trim()}>
                    {saving ? 'Saving...' : 'Save as New Version'}
                  </button>
                </div>
              </div>
            )}

            {/* Versions */}
            <div className="card">
              <div className="section-header mb-3">
                <div className="section-title">Version History</div>
              </div>
              {versions.length === 0 ? (
                <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>No versions yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {versions.map(v => (
                    <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--surface-3)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-primary-400)', fontWeight: 700, minWidth: 52 }}>
                        v{v.version_number}
                      </div>
                      <span className={`badge ${STATUS_STYLES[v.status] || 'badge-default'}`}>{v.status}</span>
                      {v.is_ai_drafted && <span className="badge badge-warn">AI Draft</span>}
                      <span style={{ flex: 1, fontSize: 12, color: 'var(--text-tertiary)' }}>
                        {v.change_summary || 'Initial version'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>
                        {new Date(v.created_at).toLocaleDateString()}
                      </span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {v.status === 'draft' && (
                          <button className="btn btn-secondary btn-sm" style={{ fontSize: 11, padding: '3px 10px' }}
                            onClick={() => handleAction('submit', v.id)}>
                            Submit for Review
                          </button>
                        )}
                        {v.status === 'under_review' && (
                          <button className="btn btn-primary btn-sm" style={{ fontSize: 11, padding: '3px 10px' }}
                            onClick={() => handleAction('approve', v.id)}>
                            Approve
                          </button>
                        )}
                        {v.status === 'approved' && (
                          <button className="btn btn-primary btn-sm" style={{ fontSize: 11, padding: '3px 10px', background: 'var(--color-accent-600)' }}
                            onClick={() => handleAction('publish', v.id)}>
                            Publish
                          </button>
                        )}
                        {v.status === 'published' && (
                          <span style={{ fontSize: 11, color: 'var(--color-accent-400)', fontWeight: 600 }}>âœ“ Live</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
