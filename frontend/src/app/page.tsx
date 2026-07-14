'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '', tenant_slug: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || 'Login failed. Please check your credentials.');
        return;
      }
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      localStorage.setItem('tenant_id', data.tenant_id);
      localStorage.setItem('user_id', data.user_id);
      localStorage.setItem('roles', JSON.stringify(data.roles));
      router.push('/dashboard');
    } catch {
      setError('Unable to connect. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-bg-glow auth-bg-glow-1" />
      <div className="auth-bg-glow auth-bg-glow-2" />
      <div className="auth-card animate-fade">
        <div className="auth-logo">
          <div className="auth-logo-mark">H</div>
          <div className="auth-logo-text">
            <h2>HR OS</h2>
            <p>Autonomous AI Workforce Platform</p>
          </div>
        </div>
        <h1 style={{ fontSize: '1.4rem', marginBottom: '6px' }}>Sign in</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '28px' }}>
          Access your company&apos;s HR operating system.
        </p>
        {error && (
          <div className="alert alert-error mb-4">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            {error}
          </div>
        )}
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Company Workspace</label>
            <input className="input" type="text" placeholder="your-company" value={form.tenant_slug}
              onChange={e => setForm(f => ({ ...f, tenant_slug: e.target.value }))} required id="tenant-slug" />
            <span className="form-hint">Your company&apos;s unique workspace slug</span>
          </div>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input className="input" type="email" placeholder="you@company.com" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required id="email" />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="input" type="password" placeholder="••••••••••" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required id="password" />
          </div>
          <button type="submit" className="btn btn-primary w-full"
            style={{ justifyContent: 'center', marginTop: '8px', padding: '11px' }}
            disabled={loading} id="login-submit">
            {loading ? (
              <><div className="spinner" style={{ width: 15, height: 15, borderWidth: 2 }} /> Signing in...</>
            ) : (
              <>Sign in &rarr;</>
            )}
          </button>
        </form>
        <div className="auth-divider mt-4">or</div>
        <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '12px' }}>
          New company?{' '}
          <Link href="/register" style={{ fontWeight: 600 }}>Set up your workspace</Link>
        </p>
      </div>
    </main>
  );
}
