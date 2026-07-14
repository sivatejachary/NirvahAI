'use client';

import { useState, useEffect, FormEvent } from 'react';

interface Department { id: string; name: string; }
interface Team {
  id: string; name: string; description: string;
  department_id: string; headcount_target: number; is_active: boolean;
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', department_id: '', description: '', headcount_target: '' });

  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
  const h = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/company/teams`, { headers: h }).then(r => r.json()),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/company/departments`, { headers: h }).then(r => r.json()),
    ]).then(([t, d]) => { setTeams(t || []); setDepartments(d || []); })
      .catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.department_id) { setError('Please select a department.'); return; }
    setSaving(true); setError('');
    try {
      const body: any = { name: form.name, department_id: form.department_id, description: form.description };
      if (form.headcount_target) body.headcount_target = parseInt(form.headcount_target);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/company/teams`, {
        method: 'POST', headers: h, body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); setError(d.detail || 'Failed.'); return; }
      setShowForm(false);
      setForm({ name: '', department_id: '', description: '', headcount_target: '' });
      fetchData();
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  };

  const deptName = (id: string) => departments.find(d => d.id === id)?.name || 'â€”';

  return (
    <div>
      <div className="card">
        <div className="section-header mb-4">
          <div>
            <div className="section-title">Teams</div>
            <div className="section-subtitle">Teams within your departments with headcount targets</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v => !v)}>
            {showForm ? 'âœ• Cancel' : '+ Add Team'}
          </button>
        </div>

        {showForm && (
          <div className="card-glass mb-4 animate-fade" style={{ padding: 20 }}>
            <h4 style={{ marginBottom: 16 }}>New Team</h4>
            {error && <div className="alert alert-error mb-4">{error}</div>}
            {departments.length === 0 && (
              <div className="alert alert-warn mb-4" style={{ fontSize: 13 }}>
                You need to create departments first before adding teams.
              </div>
            )}
            <form onSubmit={handleCreate}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Team Name <span className="required">*</span></label>
                  <input className="input" placeholder="e.g. Backend Platform" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Department <span className="required">*</span></label>
                  <select className="input" value={form.department_id}
                    onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))} required>
                    <option value="">Select department</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <input className="input" placeholder="What does this team do?" value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Headcount Target</label>
                  <input className="input" type="number" min={1} placeholder="e.g. 8"
                    value={form.headcount_target}
                    onChange={e => setForm(f => ({ ...f, headcount_target: e.target.value }))} />
                  <span className="form-hint">Workforce planning target for this team</span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, gap: 10 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={saving || !departments.length}>
                  {saving ? 'Creating...' : 'âœ“ Create Team'}
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: 'auto', width: 24, height: 24 }} /></div>
        ) : teams.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>ðŸ‘¥</div>
            <p style={{ fontSize: 14 }}>No teams created yet.</p>
            <p className="text-sm" style={{ marginTop: 4 }}>Teams help organize headcount and workforce planning.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Department</th>
                  <th>Description</th>
                  <th>Headcount Target</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {teams.map(team => (
                  <tr key={team.id}>
                    <td style={{ fontWeight: 600 }}>{team.name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{deptName(team.department_id)}</td>
                    <td style={{ color: 'var(--text-tertiary)', fontSize: 12.5 }}>{team.description || 'â€”'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary-400)' }}>
                      {team.headcount_target ? `${team.headcount_target} hires` : 'â€”'}
                    </td>
                    <td>
                      <span className={`badge ${team.is_active ? 'badge-success' : 'badge-default'}`}>
                        {team.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
