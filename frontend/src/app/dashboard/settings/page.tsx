'use client';

import { useState, useEffect, FormEvent } from 'react';

interface CompanyProfile {
  company_name: string;
  legal_name: string;
  industry: string;
  company_size: string;
  website: string;
  email_domain: string;
  headquarters_country: string;
  headquarters_city: string;
  operating_countries: string[];
  hiring_countries: string[];
}

const INDUSTRIES = [
  'Technology', 'Finance', 'Healthcare', 'E-Commerce', 'Manufacturing',
  'Education', 'Media', 'Consulting', 'Retail', 'Other',
];

const COMPANY_SIZES = [
  '1-10', '11-50', '51-200', '201-500', '501-2000', '2000+',
];

export default function CompanyProfilePage() {
  const [profile, setProfile] = useState<CompanyProfile>({
    company_name: '', legal_name: '', industry: '', company_size: '',
    website: '', email_domain: '', headquarters_country: '', headquarters_city: '',
    operating_countries: [], hiring_countries: [],
  });
  const [wizard, setWizard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  useEffect(() => {
        const headers = getHeaders();
    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/company/profile`, { headers }),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/company/wizard`, { headers }),
    ]).then(async ([p, w]) => {
      const pd = await p.json();
      const wd = await w.json();
      setProfile({ ...profile, ...pd });
      setWizard(wd);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
          const headers = getHeaders();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/company/profile`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(profile),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.detail || 'Save failed.');
        return;
      }
      setSuccess('Company profile saved successfully.');
    } catch {
      setError('Network error.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Wizard Progress Banner */}
      {wizard && (
        <div className="card mb-4" style={{ padding: '16px 20px', background: 'var(--surface-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                Setup Wizard â€” {wizard.completion_percentage}% complete
              </span>
              {wizard.is_complete && (
                <span className="badge badge-success ml-2" style={{ marginLeft: 8 }}>âœ“ Complete</span>
              )}
            </div>
            <a href="/dashboard/settings/wizard" style={{ fontSize: 12.5, color: 'var(--color-primary-400)' }}>
              View full wizard â†’
            </a>
          </div>
          <div style={{ background: 'var(--surface-4)', borderRadius: 'var(--radius-full)', height: 6, overflow: 'hidden' }}>
            <div style={{
              width: `${wizard.completion_percentage}%`,
              height: '100%',
              background: 'linear-gradient(90deg, var(--color-primary-500), var(--color-accent-500))',
              borderRadius: 'inherit',
              transition: 'width 0.8s ease',
            }} />
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
            {Object.entries(wizard.steps || {}).map(([key, done]) => (
              <span key={key} style={{
                fontSize: 11.5,
                color: done ? 'var(--color-accent-400)' : 'var(--text-disabled)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}>
                {done ? 'âœ“' : 'â—‹'} {key.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="section-header mb-4">
          <div>
            <div className="section-title">Company Profile</div>
            <div className="section-subtitle">Legal, contact, and operational information</div>
          </div>
          {profile.company_name && (
            <span className="badge badge-success badge-dot">Saved</span>
          )}
        </div>

        {error && <div className="alert alert-error mb-4">{error}</div>}
        {success && <div className="alert alert-success mb-4">{success}</div>}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div className="spinner" style={{ width: 24, height: 24 }} />
          </div>
        ) : (
          <form onSubmit={handleSave}>
            {/* Identity */}
            <div style={{ marginBottom: 24 }}>
              <p className="text-xs text-muted mb-2" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                Company Identity
              </p>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Company Name <span className="required">*</span></label>
                  <input className="input" type="text" value={profile.company_name}
                    onChange={e => setProfile(p => ({ ...p, company_name: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Legal Name</label>
                  <input className="input" type="text" placeholder="e.g. Acme Technologies Pvt. Ltd."
                    value={profile.legal_name || ''}
                    onChange={e => setProfile(p => ({ ...p, legal_name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Industry</label>
                  <select className="input" value={profile.industry || ''}
                    onChange={e => setProfile(p => ({ ...p, industry: e.target.value }))}>
                    <option value="">Select industry</option>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Company Size</label>
                  <select className="input" value={profile.company_size || ''}
                    onChange={e => setProfile(p => ({ ...p, company_size: e.target.value }))}>
                    <option value="">Select size</option>
                    {COMPANY_SIZES.map(s => <option key={s} value={s}>{s} employees</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Website</label>
                  <input className="input" type="url" placeholder="https://company.com"
                    value={profile.website || ''}
                    onChange={e => setProfile(p => ({ ...p, website: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Domain</label>
                  <input className="input" type="text" placeholder="company.com"
                    value={profile.email_domain || ''}
                    onChange={e => setProfile(p => ({ ...p, email_domain: e.target.value }))} />
                  <span className="form-hint">Used to verify employee email addresses</span>
                </div>
              </div>
            </div>

            {/* Headquarters */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 20, marginBottom: 24 }}>
              <p className="text-xs text-muted mb-2" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                Headquarters
              </p>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Country</label>
                  <input className="input" type="text" placeholder="India"
                    value={profile.headquarters_country || ''}
                    onChange={e => setProfile(p => ({ ...p, headquarters_country: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">City</label>
                  <input className="input" type="text" placeholder="Hyderabad"
                    value={profile.headquarters_city || ''}
                    onChange={e => setProfile(p => ({ ...p, headquarters_city: e.target.value }))} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Saving...</>
                  : 'âœ“ Save Profile'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
