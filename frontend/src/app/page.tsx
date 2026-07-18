'use client';

import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const FEATURES = [
  { icon: '🤖', title: 'AI Resume Screening', desc: 'Parse & score thousands of resumes in seconds with our ML models trained on 10M+ hiring decisions.' },
  { icon: '🎙️', title: 'Voice AI Screener', desc: 'Autonomous voice agents conduct live screening calls 24/7. Sub-450ms latency feels human.' },
  { icon: '💻', title: 'Proctored Code Tests', desc: 'Browser-locked coding assessments with AI plagiarism detection and auto-evaluation.' },
  { icon: '📊', title: 'Bias-Free Analytics', desc: 'Demographic-blind scoring with GDPR-compliant audit trails and bias heat maps.' },
  { icon: '⚡', title: '15-Stage Autopilot', desc: 'Full pipeline automation from application to onboarding. Configure once, hire forever.' },
  { icon: '🏢', title: 'Multi-Tenant SaaS', desc: 'Every company gets isolated DB, custom branding & row-level security. Enterprise-ready.' },
];

const STATS = [
  { value: '500+', label: 'Companies Onboarded' },
  { value: '2.4M', label: 'Candidates Processed' },
  { value: '98%', label: 'AI Screening Accuracy' },
  { value: '4.5d', label: 'Average Time-to-Hire' },
];

const PIPELINE_STAGES = [
  'Apply', 'Resume AI', 'MCQ Test', 'Code Test', 'AI Screen',
  'Technical', 'HR Round', 'Offer', 'BGV', 'Join'
];

export default function LandingPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '', tenant_slug: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStage(s => (s + 1) % PIPELINE_STAGES.length);
    }, 900);
    return () => clearInterval(interval);
  }, []);

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
      if (!res.ok) { setError(data.detail || 'Login failed.'); return; }
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      localStorage.setItem('tenant_id', data.tenant_id);
      localStorage.setItem('user_id', data.user_id);
      localStorage.setItem('roles', JSON.stringify(data.roles));
      router.push('/dashboard');
    } catch {
      setError('Unable to connect. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', background: '#060612', color: '#fff', fontFamily: 'Inter, sans-serif', overflowX: 'hidden' }}>
      {/* ── Animated Orbs Background ── */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)', animation: 'orbFloat 12s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.14) 0%, transparent 70%)', animation: 'orbFloat 16s ease-in-out infinite reverse' }} />
        <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translateX(-50%)', width: 900, height: 2, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.3), transparent)' }} />
      </div>

      {/* ── Header ── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(6,6,18,0.8)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #7c3aed, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 16, boxShadow: '0 0 20px rgba(124,58,237,0.5)' }}>N</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.02em', lineHeight: 1 }}>NirvahAI</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: 1, marginTop: 2 }}>HR OS for all companies</div>
            </div>
          </div>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <a href="#features" style={{ padding: '7px 14px', fontSize: 13, color: 'rgba(255,255,255,0.55)', textDecoration: 'none', borderRadius: 8, transition: 'color 0.15s' }}>Features</a>
            <a href="#pipeline" style={{ padding: '7px 14px', fontSize: 13, color: 'rgba(255,255,255,0.55)', textDecoration: 'none', borderRadius: 8 }}>Pipeline</a>
            <button onClick={() => setShowLoginModal(true)} style={{ padding: '7px 16px', fontSize: 13, color: 'rgba(255,255,255,0.75)', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, cursor: 'pointer', fontWeight: 500 }}>
              Sign In
            </button>
            <Link href="/register" style={{ padding: '8px 18px', fontSize: 13, color: '#fff', background: 'linear-gradient(135deg, #7c3aed, #6366f1)', borderRadius: 8, fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 20px rgba(124,58,237,0.4)' }}>
              Launch Workspace →
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto', padding: '100px 24px 80px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 999, background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)', marginBottom: 32 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c3aed', animation: 'pulse 2s ease-in-out infinite', display: 'inline-block' }} />
          <span style={{ fontSize: 12, color: '#a78bfa', fontWeight: 600, letterSpacing: '0.04em' }}>Enterprise AI Recruitment Platform for Every Company</span>
        </div>

        <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.05, marginBottom: 24, background: 'linear-gradient(135deg, #fff 30%, rgba(167,139,250,0.8) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          Autonomous AI<br />Recruitment OS
        </h1>

        <p style={{ fontSize: 'clamp(1rem, 2vw, 1.2rem)', color: 'rgba(255,255,255,0.5)', maxWidth: 620, margin: '0 auto 48px', lineHeight: 1.7, fontWeight: 400 }}>
          NirvahAI powers end-to-end recruitment for <strong style={{ color: 'rgba(167,139,250,0.9)' }}>any company</strong> — from posting a job to welcoming a new hire. AI screening, voice calls, code tests & compliance built-in.
        </p>

        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 80 }}>
          <Link href="/register" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 32px', background: 'linear-gradient(135deg, #7c3aed, #6366f1)', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 15, textDecoration: 'none', boxShadow: '0 8px 32px rgba(124,58,237,0.45)', transition: 'transform 0.15s' }}>
            🚀 Launch Your Workspace
          </Link>
          <button onClick={() => setShowLoginModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 32px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, color: '#fff', fontWeight: 600, fontSize: 15, cursor: 'pointer', backdropFilter: 'blur(10px)' }}>
            Sign In to Workspace
          </button>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', maxWidth: 800, margin: '0 auto' }}>
          {STATS.map((s, i) => (
            <div key={i} style={{ background: 'rgba(6,6,18,0.9)', padding: '24px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 900, color: '#a78bfa', letterSpacing: '-0.03em', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 6, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Live Pipeline Visualization ── */}
      <section id="pipeline" style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto', padding: '60px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 12 }}>Watch the Pipeline Run</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Every candidate flows through a fully automated 15-stage pipeline</p>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: '32px 24px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 0, alignItems: 'center', overflowX: 'auto' }}>
            {PIPELINE_STAGES.map((stage, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 80 }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, transition: 'all 0.4s ease', background: i === activeStage ? 'linear-gradient(135deg, #7c3aed, #6366f1)' : i < activeStage ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.04)', border: i === activeStage ? '2px solid rgba(124,58,237,0.8)' : i < activeStage ? '2px solid rgba(16,185,129,0.4)' : '2px solid rgba(255,255,255,0.08)', boxShadow: i === activeStage ? '0 0 20px rgba(124,58,237,0.6)' : 'none', transform: i === activeStage ? 'scale(1.15)' : 'scale(1)' }}>
                    {i < activeStage ? '✓' : i === activeStage ? '⚡' : '○'}
                  </div>
                  <div style={{ fontSize: 10, color: i === activeStage ? '#a78bfa' : i < activeStage ? '#34d399' : 'rgba(255,255,255,0.3)', fontWeight: i === activeStage ? 700 : 400, whiteSpace: 'nowrap', transition: 'color 0.4s' }}>{stage}</div>
                </div>
                {i < PIPELINE_STAGES.length - 1 && (
                  <div style={{ width: '100%', height: 2, background: i < activeStage ? 'linear-gradient(90deg, #34d399, #6366f1)' : 'rgba(255,255,255,0.06)', transition: 'background 0.4s', flex: 0.5, minWidth: 8 }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section id="features" style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto', padding: '60px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 12 }}>Everything Your HR Team Needs</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, maxWidth: 500, margin: '0 auto' }}>Built for enterprise scale, accessible to every company — from 10 to 100,000 employees.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
          {FEATURES.map((feat, i) => (
            <div key={i} style={{ padding: '28px 28px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, transition: 'all 0.25s ease', cursor: 'default', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.5), transparent)', opacity: 0.6 }} />
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 16 }}>
                {feat.icon}
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 8, letterSpacing: '-0.01em' }}>{feat.title}</h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.65, margin: 0 }}>{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ textAlign: 'center', background: 'linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(99,102,241,0.1) 100%)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 24, padding: '64px 40px' }}>
          <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 16 }}>Ready to hire smarter?</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, marginBottom: 36, maxWidth: 480, margin: '0 auto 36px' }}>
            Set up your company workspace in 30 seconds. No credit card required.
          </p>
          <Link href="/register" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '16px 40px', background: 'linear-gradient(135deg, #7c3aed, #6366f1)', borderRadius: 14, color: '#fff', fontWeight: 800, fontSize: 16, textDecoration: 'none', boxShadow: '0 8px 40px rgba(124,58,237,0.5)' }}>
            🚀 Start for Free — Launch Workspace
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ position: 'relative', zIndex: 1, borderTop: '1px solid rgba(255,255,255,0.05)', padding: '32px 24px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #7c3aed, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13 }}>N</div>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>NirvahAI</span>
        </div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', margin: 0 }}>
          © 2026 NirvahAI Inc. · Multi-tenant isolation · Row-level security · GDPR compliant
        </p>
      </footer>

      {/* ── Sign In Modal ── */}
      {showLoginModal && (
        <div onClick={() => setShowLoginModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, background: '#0e0e1c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '36px 32px', position: 'relative', animation: 'modalSlide 0.2s ease' }}>
            <button onClick={() => setShowLoginModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.06)', border: 'none', color: 'rgba(255,255,255,0.5)', width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg, #7c3aed, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 17, boxShadow: '0 0 16px rgba(124,58,237,0.5)' }}>N</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>Sign In to NirvahAI</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Access your company workspace</div>
              </div>
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, color: '#f87171', fontSize: 12, marginBottom: 16 }}>{error}</div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Company Workspace Slug', placeholder: 'e.g. acme-corp', key: 'tenant_slug', type: 'text' },
                { label: 'Email Address', placeholder: 'you@company.com', key: 'email', type: 'email' },
                { label: 'Password', placeholder: '••••••••', key: 'password', type: 'password' },
              ].map(field => (
                <div key={field.key}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.55)', display: 'block', marginBottom: 6 }}>{field.label}</label>
                  <input
                    type={field.type}
                    placeholder={field.placeholder}
                    value={form[field.key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                    required
                    style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }}
                  />
                </div>
              ))}

              <button type="submit" disabled={loading} style={{ padding: '13px', background: loading ? 'rgba(124,58,237,0.5)' : 'linear-gradient(135deg, #7c3aed, #6366f1)', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 6, transition: 'all 0.2s', boxShadow: '0 4px 20px rgba(124,58,237,0.35)' }}>
                {loading ? 'Authenticating...' : '🚀 Sign In & Launch'}
              </button>
            </form>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
              No workspace yet?{' '}
              <Link href="/register" style={{ color: '#a78bfa', fontWeight: 600, textDecoration: 'none' }}>Create one free →</Link>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes orbFloat {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-40px) scale(1.05); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
        @keyframes modalSlide {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        a:hover { opacity: 0.85; }
        button:hover:not(:disabled) { filter: brightness(1.1); }
        @media (max-width: 600px) {
          nav a { display: none; }
        }
      `}</style>
    </main>
  );
}
