'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '', tenant_slug: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

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
    <main className="min-h-screen bg-slate-950 text-white relative overflow-hidden flex flex-col justify-between font-sans">
      {/* Background glow effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />

      {/* Header bar */}
      <header className="max-w-6xl w-full mx-auto px-6 py-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 text-lg font-black text-white">N</div>
          <span className="text-lg font-black tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300">NirvahAI</span>
        </div>
        <div className="flex gap-4">
          <button onClick={() => setShowLoginModal(true)} className="px-5 py-2 text-xs font-bold text-slate-300 hover:text-white transition">Sign In</button>
          <Link href="/register" className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 px-5 py-2.5 text-xs font-bold text-white transition shadow-lg shadow-violet-500/20">Launch Workspace</Link>
        </div>
      </header>

      {/* Hero section */}
      <div className="max-w-4xl w-full mx-auto px-6 py-12 flex flex-col items-center justify-center text-center space-y-6 z-10 flex-1">
        <span className="rounded-full bg-violet-500/10 border border-violet-500/30 px-4 py-1 text-xs font-bold text-violet-300">
          🚀 Enterprise recruitment solution for all companies
        </span>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight max-w-2xl bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400">
          Autonomous AI Recruitment Operating System
        </h1>
        <p className="text-xs md:text-sm text-slate-400 max-w-xl leading-relaxed">
          NirvahAI provides enterprise-grade multi-tenant HR workspace setups for companies worldwide. Deploy voice screening agents, MCQ assessments, and compiler code reviews automatically.
        </p>

        {/* Feature widgets grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full pt-8 text-left">
          {[
            { title: '🏢 Multi-Tenant Setup', desc: 'Register workspace in 30 seconds. Isolated database setups and compliance.' },
            { title: '🤖 15-Stage Autopilot', desc: 'Let autonomous AI agents parse resumes, schedule calls, MCQ/coding evaluations.' },
            { title: '📊 GDPR & Bias Audits', desc: 'Secure, demographic-blind screening with bias audit graphs and compliance reports.' }
          ].map((feat, idx) => (
            <div key={idx} className="rounded-2xl border border-white/5 bg-slate-900/40 p-5 space-y-2">
              <h3 className="text-xs font-black text-white">{feat.title}</h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer info */}
      <footer className="max-w-6xl w-full mx-auto px-6 py-6 text-center text-[10px] text-slate-600 z-10">
        © 2026 NirvahAI Inc. Platforms hosted with multi-tenant isolation, row-level security &amp; audit tracking.
      </footer>

      {/* Sign In Modal */}
      {showLoginModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-6 w-[400px] space-y-4 shadow-2xl relative animate-fade">
            <button onClick={() => setShowLoginModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white font-bold">✕</button>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white">Sign In to Workspace</h3>
              <p className="text-[11px] text-slate-500">Access your company&apos;s custom HR operating system</p>
            </div>

            {error && <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400">Company Workspace Slug</label>
                <input type="text" placeholder="e.g. acme-corp" value={form.tenant_slug}
                  onChange={e => setForm(f => ({ ...f, tenant_slug: e.target.value }))} required
                  className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white placeholder-slate-500 focus:outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-slate-400">Email Address</label>
                <input type="email" placeholder="you@company.com" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required
                  className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white placeholder-slate-500 focus:outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-slate-400">Password</label>
                <input type="password" placeholder="••••••••••" value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required
                  className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white placeholder-slate-500 focus:outline-none" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 py-2.5 font-bold text-white transition disabled:opacity-50 mt-4">
                {loading ? 'Authenticating...' : 'Sign In & Launch'}
              </button>
            </form>

            <div className="text-center pt-2 border-t border-white/5 text-[11px] text-slate-400">
              New company? <Link href="/register" className="text-violet-400 font-bold hover:underline">Set up workspace</Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
