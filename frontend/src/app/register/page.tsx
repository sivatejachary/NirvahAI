'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const INDUSTRIES = ['Technology', 'Finance', 'Healthcare', 'E-Commerce', 'Manufacturing', 'Education', 'Media', 'Consulting', 'Retail', 'Other'];

const STEPS = ['Company Info', 'Admin Account', 'Launch'];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
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
      if (!res.ok) { setError(data.detail || 'Registration failed.'); return; }
      setSuccess(`Workspace "${form.company_slug}" is live!`);
      setStep(2);
      setTimeout(() => router.push('/'), 3000);
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const canNext = step === 0 ? (form.company_name && form.company_slug) : (form.admin_full_name && form.admin_email && form.admin_password);

  return (
    <main style={{ minHeight: '100vh', background: '#060612', display: 'flex', fontFamily: 'Inter, sans-serif', color: '#fff' }}>
      {/* Left Panel - Branding */}
      <div style={{ width: 420, flexShrink: 0, background: 'linear-gradient(160deg, #0d0a1e 0%, #0e0e1c 60%, #060612 100%)', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', padding: '48px 40px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -100, left: -100, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 60, position: 'relative', zIndex: 1 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg, #7c3aed, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 17, boxShadow: '0 0 20px rgba(124,58,237,0.5)' }}>N</div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>NirvahAI</div>
        </div>

        {/* Company preview */}
        <div style={{ position: 'relative', zIndex: 1, flex: 1 }}>
          <div style={{ marginBottom: 16, fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Your Workspace Preview</div>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '20px', marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #7c3aed, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, flexShrink: 0 }}>
                {form.company_name ? form.company_name[0].toUpperCase() : 'H'}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#fff', lineHeight: 1 }}>{form.company_name || 'Your Company'}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>{form.company_slug || 'workspace-slug'}.nirvah.ai</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', lineHeight: 1.6 }}>
              ✅ Isolated workspace · Row-level security<br />
              ✅ Custom AI pipeline · 15-stage workflow<br />
              ✅ GDPR compliant · Audit logs enabled
            </div>
          </div>

          <div style={{ marginBottom: 12, fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Included in Every Workspace</div>
          {[
            { icon: '🤖', text: 'AI Resume Screening' },
            { icon: '🎙️', text: 'Voice AI Phone Screener' },
            { icon: '💻', text: 'Proctored Code Assessments' },
            { icon: '📊', text: 'Bias-Free Analytics & Reports' },
            { icon: '⚡', text: '15-Stage Hiring Autopilot' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>
              <span style={{ fontSize: 15 }}>{item.icon}</span>
              {item.text}
            </div>
          ))}
        </div>

        <div style={{ position: 'relative', zIndex: 1, marginTop: 32, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
          © 2026 NirvahAI Inc. · GDPR Compliant
        </div>
      </div>

      {/* Right Panel - Form */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: 480 }}>
          {/* Progress Steps */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 48 }}>
            {STEPS.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: i < step ? 'linear-gradient(135deg, #7c3aed, #6366f1)' : i === step ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.06)', border: i === step ? '2px solid rgba(124,58,237,0.6)' : '2px solid transparent', color: i <= step ? '#fff' : 'rgba(255,255,255,0.3)', transition: 'all 0.3s', flexShrink: 0 }}>
                    {i < step ? '✓' : i + 1}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: i === step ? 700 : 400, color: i === step ? '#fff' : 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>{s}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: 1, background: i < step ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.07)', margin: '0 12px', transition: 'background 0.3s' }} />
                )}
              </div>
            ))}
          </div>

          {step === 2 ? (
            /* Success State */
            <div style={{ textAlign: 'center', animation: 'fadeSlide 0.4s ease' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', border: '2px solid rgba(16,185,129,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 24px', boxShadow: '0 0 30px rgba(16,185,129,0.3)' }}>🎉</div>
              <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>Workspace Created!</h2>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 24, lineHeight: 1.7 }}>
                <strong style={{ color: '#a78bfa' }}>{form.company_slug}.nirvah.ai</strong> is live.<br />Redirecting you to sign in...
              </p>
              <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'linear-gradient(90deg, #7c3aed, #6366f1)', borderRadius: 4, animation: 'progressFill 2.8s linear forwards' }} />
              </div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: 8 }}>
                  {step === 0 ? 'Set up your workspace' : 'Create admin account'}
                </h1>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, margin: 0 }}>
                  {step === 0 ? 'Your company\'s autonomous HR platform, live in 30 seconds.' : 'You\'ll be the workspace admin. You can invite teammates later.'}
                </p>
              </div>

              {error && (
                <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, color: '#f87171', fontSize: 13, marginBottom: 20 }}>
                  ⚠️ {error}
                </div>
              )}

              <form onSubmit={step === 0 ? (e) => { e.preventDefault(); setStep(1); } : handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {step === 0 ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 7 }}>Company Name *</label>
                        <input id="company-name" type="text" placeholder="Acme Technologies" value={form.company_name}
                          onChange={e => handleCompanyName(e.target.value)} required
                          style={{ width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif', transition: 'border-color 0.2s' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 7 }}>Workspace Slug *</label>
                        <input id="company-slug" type="text" placeholder="acme-technologies" value={form.company_slug}
                          pattern="[a-z0-9-]+" onChange={e => setForm(f => ({ ...f, company_slug: e.target.value }))} required
                          style={{ width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }} />
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 5 }}>Lowercase, numbers, hyphens only</div>
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 7 }}>Industry</label>
                      <select id="industry" value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
                        style={{ width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: form.industry ? '#fff' : 'rgba(255,255,255,0.35)', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}>
                        <option value="">Select industry</option>
                        {INDUSTRIES.map(i => <option key={i} value={i} style={{ background: '#0e0e1c' }}>{i}</option>)}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 7 }}>Full Name *</label>
                        <input id="admin-name" type="text" placeholder="Jane Smith" value={form.admin_full_name}
                          onChange={e => setForm(f => ({ ...f, admin_full_name: e.target.value }))} required
                          style={{ width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 7 }}>Work Email *</label>
                        <input id="admin-email" type="email" placeholder="jane@company.com" value={form.admin_email}
                          onChange={e => setForm(f => ({ ...f, admin_email: e.target.value }))} required
                          style={{ width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }} />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 7 }}>Password *</label>
                      <input id="admin-password" type="password" placeholder="Minimum 10 characters" value={form.admin_password}
                        minLength={10} onChange={e => setForm(f => ({ ...f, admin_password: e.target.value }))} required
                        style={{ width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }} />
                    </div>
                  </>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  {step === 1 && (
                    <button type="button" onClick={() => setStep(0)} style={{ flex: 1, padding: '13px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                      ← Back
                    </button>
                  )}
                  <button type="submit" disabled={loading || !canNext} id={step === 0 ? 'next-step' : 'register-submit'}
                    style={{ flex: 2, padding: '13px', background: canNext ? 'linear-gradient(135deg, #7c3aed, #6366f1)' : 'rgba(124,58,237,0.3)', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 14, cursor: canNext ? 'pointer' : 'not-allowed', transition: 'all 0.2s', boxShadow: canNext ? '0 4px 20px rgba(124,58,237,0.35)' : 'none', fontFamily: 'Inter, sans-serif' }}>
                    {loading ? 'Creating workspace...' : step === 0 ? 'Continue →' : '🚀 Create Workspace'}
                  </button>
                </div>
              </form>

              <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
                Already have a workspace?{' '}
                <Link href="/" style={{ color: '#a78bfa', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes progressFill {
          from { width: 0; }
          to { width: 100%; }
        }
        input:focus, select:focus {
          border-color: rgba(124,58,237,0.6) !important;
          box-shadow: 0 0 0 3px rgba(124,58,237,0.12);
        }
        @media (max-width: 900px) {
          main { flex-direction: column; }
          main > div:first-child { width: 100%; min-height: auto; }
        }
      `}</style>
    </main>
  );
}
