'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    company_name: '', company_slug: '', admin_full_name: '',
    admin_email: '', admin_password: '', industry: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const slugify = (v: string) =>
    v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const handleCompanyName = (v: string) => {
    setForm(f => ({ ...f, company_name: v, company_slug: slugify(v) }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || 'Registration failed.');
        return;
      }
      setSuccess(`Workspace "${form.company_slug}" created. You can now sign in.`);
      setTimeout(() => router.push('/'), 2500);
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-bg-glow auth-bg-glow-1" />
      <div className="auth-bg-glow auth-bg-glow-2" />

      <div className="auth-card animate-fade" style={{ maxWidth: 500 }}>
        <div className="auth-logo">
          <div className="auth-logo-mark">H</div>
          <div className="auth-logo-text">
            <h2>HR OS</h2>
            <p>Set up your company workspace</p>
          </div>
        </div>

        <h1 style={{ fontSize: '1.3rem', marginBottom: '6px' }}>Create your workspace</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '24px' }}>
          Get your company&apos;s autonomous HR platform running in minutes.
        </p>

        {error && <div className="alert alert-error mb-4">{error}</div>}
        {success && <div className="alert alert-success mb-4">{success}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Company Name <span className="required">*</span></label>
              <input className="input" type="text" placeholder="Acme Technologies"
                value={form.company_name} onChange={e => handleCompanyName(e.target.value)} required id="company-name" />
            </div>
            <div className="form-group">
              <label className="form-label">Workspace Slug <span className="required">*</span></label>
              <input className="input" type="text" placeholder="acme-technologies"
                value={form.company_slug} pattern="[a-z0-9-]+"
                onChange={e => setForm(f => ({ ...f, company_slug: e.target.value }))} required id="company-slug" />
              <span className="form-hint">Only lowercase letters, numbers, hyphens</span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Industry</label>
            <select className="input" value={form.industry}
              onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} id="industry">
              <option value="">Select industry</option>
              {['Technology', 'Finance', 'Healthcare', 'E-Commerce', 'Manufacturing',
                'Education', 'Media', 'Consulting', 'Retail', 'Other'].map(i => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '18px' }}>
            <p className="text-xs text-muted mb-2" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Admin Account</p>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Full Name <span className="required">*</span></label>
                <input className="input" type="text" placeholder="Jane Smith"
                  value={form.admin_full_name} onChange={e => setForm(f => ({ ...f, admin_full_name: e.target.value }))} required id="admin-name" />
              </div>
              <div className="form-group">
                <label className="form-label">Work Email <span className="required">*</span></label>
                <input className="input" type="email" placeholder="jane@company.com"
                  value={form.admin_email} onChange={e => setForm(f => ({ ...f, admin_email: e.target.value }))} required id="admin-email" />
              </div>
            </div>
            <div className="form-group mt-2">
              <label className="form-label">Password <span className="required">*</span></label>
              <input className="input" type="password" placeholder="Min. 10 characters"
                value={form.admin_password} minLength={10}
                onChange={e => setForm(f => ({ ...f, admin_password: e.target.value }))} required id="admin-password" />
            </div>
          </div>

          <button type="submit" className="btn btn-primary w-full"
            style={{ justifyContent: 'center', padding: '11px' }} disabled={loading} id="register-submit">
            {loading ? <><div className="spinner" style={{ width: 15, height: 15, borderWidth: 2 }} /> Creating workspace...</>
              : 'Create workspace →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '16px' }}>
          Already have a workspace? <Link href="/" style={{ fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </main>
  );
}
