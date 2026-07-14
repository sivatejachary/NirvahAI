'use client';

import { useState, useEffect, FormEvent } from 'react';

interface Department {
  id: string;
  name: string;
  description: string;
  parent_department_id: string | null;
  is_active: boolean;
  children?: Department[];
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [all, setAll] = useState<Department[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', description: '', parent_id: '' });

  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  const fetchDepts = () => {
    setLoading(true);
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/company/departments`, { headers })
      .then(r => r.json())
      .then(root => {
        setDepartments(root);
        setAll(root);
      })
      .catch(() => setDepartments([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchDepts(); }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
          const headers = getHeaders();
      const body: any = { name: form.name, description: form.description };
      if (form.parent_id) body.parent_id = form.parent_id;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/company/departments`, {
        method: 'POST', headers, body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); setError(d.detail || 'Failed.'); return; }
      setShowForm(false);
      setForm({ name: '', description: '', parent_id: '' });
      fetchDepts();
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  };

  const DeptCard = ({ dept, depth = 0 }: { dept: Department; depth?: number }) => (
    <div style={{ marginLeft: depth > 0 ? 24 : 0, marginBottom: 8 }}>
      <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {depth > 0 && (
          <div style={{ width: 2, height: 24, background: 'var(--border-default)', marginRight: 4 }} />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{dept.name}</span>
            {depth === 0 && <span className="badge badge-default text-xs">Root</span>}
            {depth > 0 && <span className="badge badge-primary text-xs">Sub-dept</span>}
          </div>
          {dept.description && (
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{dept.description}</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm"
            onClick={() => {
              setForm({ name: '', description: '', parent_id: dept.id });
              setShowForm(true);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}>
            + Sub-dept
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="card">
        <div className="section-header mb-4">
          <div>
            <div className="section-title">Departments</div>
            <div className="section-subtitle">Hierarchical department structure for your organization</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => { setForm({ name: '', description: '', parent_id: '' }); setShowForm(v => !v); }}>
            {showForm ? 'âœ• Cancel' : '+ Add Department'}
          </button>
        </div>

        {showForm && (
          <div className="card-glass mb-4 animate-fade" style={{ padding: 20 }}>
            <h4 style={{ marginBottom: 16 }}>
              {form.parent_id ? 'New Sub-Department' : 'New Root Department'}
            </h4>
            {form.parent_id && (
              <div className="alert alert-info mb-4" style={{ fontSize: 12.5 }}>
                Creating sub-department under: <strong>{all.find(d => d.id === form.parent_id)?.name}</strong>
              </div>
            )}
            {error && <div className="alert alert-error mb-4">{error}</div>}
            <form onSubmit={handleCreate}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Department Name <span className="required">*</span></label>
                  <input className="input" placeholder="e.g. Engineering" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="input" placeholder="What does this department do?" value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                {!form.parent_id && all.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">Parent Department (optional)</label>
                    <select className="input" value={form.parent_id}
                      onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}>
                      <option value="">None (root department)</option>
                      {all.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, gap: 10 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                  {saving ? 'Creating...' : 'âœ“ Create Department'}
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: 'auto', width: 24, height: 24 }} /></div>
        ) : departments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>ðŸ—‚ï¸</div>
            <p style={{ fontSize: 14 }}>No departments yet.</p>
            <p className="text-sm" style={{ marginTop: 4 }}>Create departments to organize your workforce.</p>
          </div>
        ) : (
          <div>
            {departments.map(dept => <DeptCard key={dept.id} dept={dept} depth={0} />)}
          </div>
        )}
      </div>
    </div>
  );
}
