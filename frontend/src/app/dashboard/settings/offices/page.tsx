'use client';

import { useState, useEffect, FormEvent } from 'react';

interface Office {
  id: string;
  name: string;
  city: string;
  country: string;
  address_line1: string;
  state: string;
  postal_code: string;
  time_zone: string;
  maps_url: string;
  is_active: boolean;
}

const TIMEZONES = [
  'Asia/Kolkata', 'Asia/Singapore', 'Asia/Dubai', 'Asia/Tokyo',
  'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Chicago',
  'America/Los_Angeles', 'America/Sao_Paulo', 'Australia/Sydney', 'UTC',
];

export default function OfficesPage() {
  const [offices, setOffices] = useState<Office[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', city: '', country: '', address_line1: '',
    state: '', postal_code: '', time_zone: '', maps_url: '',
  });

  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  const fetchOffices = () => {
    setLoading(true);
    const headers = getHeaders();
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/company/offices`, { headers })
      .then(r => r.json()).then(setOffices).catch(() => setOffices([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchOffices(); }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
          const headers = getHeaders();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/company/offices`, {
        method: 'POST', headers, body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json(); setError(d.detail || 'Failed to create office.'); return;
      }
      setShowForm(false);
      setForm({ name: '', city: '', country: '', address_line1: '', state: '', postal_code: '', time_zone: '', maps_url: '' });
      fetchOffices();
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  };

  const handleDeactivate = async (id: string) => {
    const headers = getHeaders();
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/company/offices/${id}`, {
      method: 'PATCH', headers, body: JSON.stringify({ is_active: false }),
    });
    fetchOffices();
  };

  return (
    <div>
      <div className="card">
        <div className="section-header mb-4">
          <div>
            <div className="section-title">Office Locations</div>
            <div className="section-subtitle">Manage your company's physical office locations</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v => !v)}>
            {showForm ? 'âœ• Cancel' : '+ Add Office'}
          </button>
        </div>

        {/* Create Form */}
        {showForm && (
          <div className="card-glass mb-4 animate-fade" style={{ padding: 20 }}>
            <h4 style={{ marginBottom: 16 }}>New Office Location</h4>
            {error && <div className="alert alert-error mb-4">{error}</div>}
            <form onSubmit={handleCreate}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Office Name <span className="required">*</span></label>
                  <input className="input" placeholder="Hyderabad HQ" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Time Zone</label>
                  <select className="input" value={form.time_zone}
                    onChange={e => setForm(f => ({ ...f, time_zone: e.target.value }))}>
                    <option value="">Select timezone</option>
                    {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">City <span className="required">*</span></label>
                  <input className="input" placeholder="Hyderabad" value={form.city}
                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">State / Province</label>
                  <input className="input" placeholder="Telangana" value={form.state}
                    onChange={e => setForm(f => ({ ...f, state: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Country <span className="required">*</span></label>
                  <input className="input" placeholder="India" value={form.country}
                    onChange={e => setForm(f => ({ ...f, country: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Postal Code</label>
                  <input className="input" placeholder="500081" value={form.postal_code}
                    onChange={e => setForm(f => ({ ...f, postal_code: e.target.value }))} />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Address Line 1</label>
                  <input className="input" placeholder="123 Tech Park, Madhapur" value={form.address_line1}
                    onChange={e => setForm(f => ({ ...f, address_line1: e.target.value }))} />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Google Maps URL</label>
                  <input className="input" type="url" placeholder="https://maps.google.com/..." value={form.maps_url}
                    onChange={e => setForm(f => ({ ...f, maps_url: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, gap: 10 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                  {saving ? 'Creating...' : 'âœ“ Create Office'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Offices List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: 'auto', width: 24, height: 24 }} /></div>
        ) : offices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>ðŸ“</div>
            <p style={{ fontSize: 14 }}>No office locations added yet.</p>
            <p className="text-sm" style={{ marginTop: 4 }}>Add your first office to complete the setup wizard.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {offices.map(office => (
              <div key={office.id} className="card" style={{ padding: 18, position: 'relative' }}>
                {!office.is_active && (
                  <span className="badge badge-warn" style={{ position: 'absolute', top: 12, right: 12 }}>Inactive</span>
                )}
                <div style={{ fontSize: 24, marginBottom: 8 }}>ðŸ¢</div>
                <h4 style={{ marginBottom: 4 }}>{office.name}</h4>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                  {[office.city, office.state, office.country].filter(Boolean).join(', ')}
                </p>
                {office.address_line1 && (
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, margin: 0 }}>{office.address_line1}</p>
                )}
                {office.time_zone && (
                  <div className="badge badge-default" style={{ marginTop: 10, display: 'inline-flex' }}>
                    ðŸ• {office.time_zone}
                  </div>
                )}
                {office.maps_url && (
                  <a href={office.maps_url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'block', fontSize: 12, color: 'var(--color-primary-400)', marginTop: 8 }}>
                    View on Maps â†’
                  </a>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  {office.is_active && (
                    <button className="btn btn-ghost btn-sm"
                      onClick={() => confirm('Deactivate this office?') && handleDeactivate(office.id)}>
                      Deactivate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
