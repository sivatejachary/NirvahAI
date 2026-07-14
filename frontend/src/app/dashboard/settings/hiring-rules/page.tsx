'use client';

import { useState, useEffect, FormEvent } from 'react';

interface HiringRules {
  autonomy_level: string;
  notice_period_days_default: number;
  offer_approval_required: boolean;
  background_verification_required: boolean;
  proctoring_enabled: boolean;
  ai_interview_enabled: boolean;
  voice_calls_enabled: boolean;
  recruiter_display_name: string;
  sender_email: string;
  daily_ai_budget_usd: number;
  monthly_ai_budget_usd: number;
}

const AUTONOMY_LEVELS = [
  {
    value: 'ASSISTED',
    label: 'Assisted',
    description: 'AI assists recruiters with suggestions. Every action requires human approval.',
    icon: 'ðŸ¤',
    color: 'var(--color-primary-400)',
  },
  {
    value: 'SEMI_AUTONOMOUS',
    label: 'Semi-Autonomous',
    description: 'AI handles screening and scheduling. Offers, rejections, and key decisions still require approval.',
    icon: 'âš¡',
    color: 'var(--color-warn-400)',
  },
  {
    value: 'AUTONOMOUS',
    label: 'Autonomous',
    description: 'AI manages the full hiring pipeline within policy bounds. Human oversight via audit trail.',
    icon: 'ðŸ¤–',
    color: 'var(--color-accent-400)',
  },
];

export default function HiringRulesPage() {
  const [rules, setRules] = useState<Partial<HiringRules>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
  const h = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/company/profile`, { headers: h })
      .then(r => r.json())
      .then(d => setRules(prev => ({ ...prev, ...d })))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
          const headers = getHeaders();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/company/hiring-rules`, {
        method: 'PATCH', headers: h, body: JSON.stringify(rules),
      });
      if (!res.ok) { const d = await res.json(); setError(d.detail || 'Save failed.'); return; }
      setSuccess('Hiring rules saved successfully.');
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  };

  const toggle = (key: keyof HiringRules) => setRules(r => ({ ...r, [key]: !r[key] }));

  return (
    <div>
      <form onSubmit={handleSave}>
        {/* Autonomy Level */}
        <div className="card mb-4">
          <div className="section-header mb-4">
            <div>
              <div className="section-title">AI Autonomy Level</div>
              <div className="section-subtitle">Controls how independently the AI operates your hiring workflows</div>
            </div>
          </div>

          {error && <div className="alert alert-error mb-4">{error}</div>}
          {success && <div className="alert alert-success mb-4">{success}</div>}

          {loading ? (
            <div style={{ textAlign: 'center', padding: 32 }}><div className="spinner" style={{ margin: 'auto', width: 24, height: 24 }} /></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {AUTONOMY_LEVELS.map(level => (
                <div key={level.value}
                  onClick={() => setRules(r => ({ ...r, autonomy_level: level.value }))}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 16,
                    padding: '16px 20px',
                    borderRadius: 'var(--radius-lg)',
                    border: `2px solid ${rules.autonomy_level === level.value ? level.color : 'var(--border-subtle)'}`,
                    background: rules.autonomy_level === level.value ? 'rgba(99,102,241,0.06)' : 'var(--surface-3)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}>
                  <div style={{ fontSize: 28, flexShrink: 0, marginTop: 2 }}>{level.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: rules.autonomy_level === level.value ? level.color : 'var(--text-primary)' }}>
                        {level.label}
                      </span>
                      {rules.autonomy_level === level.value && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: level.color, background: `rgba(0,0,0,0.3)`, padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>{level.description}</p>
                  </div>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${rules.autonomy_level === level.value ? level.color : 'var(--border-default)'}`, flexShrink: 0, marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {rules.autonomy_level === level.value && (
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: level.color }} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Feature Toggles */}
        <div className="card mb-4">
          <div className="section-header mb-4">
            <div className="section-title">Platform Features</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { key: 'ai_interview_enabled', label: 'AI-Powered Interviews', desc: 'Enable adaptive AI technical interviews', icon: 'ðŸŽ¯' },
              { key: 'voice_calls_enabled', label: 'Voice Call Screening', desc: 'Enable AI recruiter voice calls with candidates', icon: 'ðŸ“ž' },
              { key: 'proctoring_enabled', label: 'Assessment Proctoring', desc: 'Enable AI proctoring during coding assessments', icon: 'ðŸ‘ï¸' },
              { key: 'offer_approval_required', label: 'Offer Approval Required', desc: 'All offers must be approved by a manager before sending', icon: 'âœ…' },
              { key: 'background_verification_required', label: 'Background Verification', desc: 'Require background checks before final offers', icon: 'ðŸ”' },
            ].map(item => (
              <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{item.desc}</div>
                </div>
                {/* Toggle */}
                <div
                  onClick={() => toggle(item.key as keyof HiringRules)}
                  style={{
                    width: 44, height: 24, borderRadius: 12, cursor: 'pointer', position: 'relative', flexShrink: 0,
                    background: rules[item.key as keyof HiringRules] ? 'var(--color-accent-500)' : 'var(--surface-5)',
                    transition: 'background var(--transition-base)',
                  }}>
                  <div style={{
                    position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%',
                    background: 'white', transition: 'left var(--transition-base)',
                    left: rules[item.key as keyof HiringRules] ? 23 : 3,
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Workflow Settings */}
        <div className="card mb-4">
          <div className="section-header mb-4">
            <div className="section-title">Workflow Configuration</div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Notice Period (days)</label>
              <input className="input" type="number" min={0} max={180}
                value={rules.notice_period_days_default || 30}
                onChange={e => setRules(r => ({ ...r, notice_period_days_default: parseInt(e.target.value) }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Daily AI Budget (USD)</label>
              <input className="input" type="number" min={0} step={0.5}
                placeholder="e.g. 50"
                value={rules.daily_ai_budget_usd || ''}
                onChange={e => setRules(r => ({ ...r, daily_ai_budget_usd: parseFloat(e.target.value) }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Recruiter Display Name</label>
              <input className="input" placeholder="e.g. TalentBot by Acme"
                value={rules.recruiter_display_name || ''}
                onChange={e => setRules(r => ({ ...r, recruiter_display_name: e.target.value }))} />
              <span className="form-hint">Name shown to candidates in emails and calls</span>
            </div>
            <div className="form-group">
              <label className="form-label">Sender Email</label>
              <input className="input" type="email" placeholder="talent@company.com"
                value={rules.sender_email || ''}
                onChange={e => setRules(r => ({ ...r, sender_email: e.target.value }))} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary" disabled={saving || loading}>
            {saving ? 'Saving...' : 'âœ“ Save Hiring Rules'}
          </button>
        </div>
      </form>
    </div>
  );
}
