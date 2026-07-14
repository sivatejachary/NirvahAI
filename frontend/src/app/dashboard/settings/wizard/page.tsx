'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const STEPS = [
  { id: 'company_profile', label: 'Company Profile', icon: '🏢', desc: 'Legal name, industry, size', field: 'step_company_profile' },
  { id: 'offices', label: 'Offices', icon: '📍', desc: 'Physical locations', field: 'step_offices' },
  { id: 'departments', label: 'Departments', icon: '🗂️', desc: 'Organizational structure', field: 'step_departments' },
  { id: 'hiring_rules', label: 'Hiring Rules', icon: '⚙️', desc: 'AI autonomy and workflow', field: 'step_hiring_rules' },
  { id: 'compliance', label: 'Compliance', icon: '📋', desc: 'Policies and legal requirements', field: 'step_compliance' },
  { id: 'email_integration', label: 'Email', icon: '📧', desc: 'Candidate communications', field: 'step_email_integration' },
  { id: 'calendar_integration', label: 'Calendar', icon: '📅', desc: 'Interview scheduling', field: 'step_calendar_integration' },
  { id: 'sandbox_test', label: 'Sandbox Test', icon: '🧪', desc: 'Verify end-to-end flow', field: 'step_sandbox_test' },
];

export default function WizardPage() {
  const router = useRouter();
  const [wizard, setWizard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState('');

  const fetch_wizard = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
    const h = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/company/wizard`, { headers: h })
      .then(r => r.json()).then(setWizard).finally(() => setLoading(false));
  };

  useEffect(() => { fetch_wizard(); }, []);

  const STEP_ROUTES: Record<string, string> = {
    company_profile: '/dashboard/settings',
    offices: '/dashboard/settings/offices',
    departments: '/dashboard/settings/departments',
    hiring_rules: '/dashboard/settings/hiring-rules',
    compliance: '/dashboard/settings/policies',
    email_integration: '/dashboard/settings/integrations',
    calendar_integration: '/dashboard/settings/integrations',
    sandbox_test: '/dashboard',
  };

  const completedCount = wizard ? Object.values(wizard.steps || {}).filter(Boolean).length : 0;

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🚀</div>
        <h1 style={{ marginBottom: 8 }}>Setup Your Workspace</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Complete all 8 steps to activate your autonomous HR platform.
          The AI cannot process any real candidates until setup is complete.
        </p>
      </div>

      {/* Progress Bar */}
      {wizard && (
        <div className="card mb-6" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Overall Progress</span>
            <span style={{ fontWeight: 800, fontSize: 20, color: 'var(--color-primary-400)' }}>
              {wizard.completion_percentage}%
            </span>
          </div>
          <div style={{ background: 'var(--surface-4)', borderRadius: 'var(--radius-full)', height: 10, overflow: 'hidden', marginBottom: 10 }}>
            <div style={{
              width: `${wizard.completion_percentage}%`,
              height: '100%',
              background: wizard.is_complete
                ? 'linear-gradient(90deg, var(--color-accent-500), var(--color-accent-600))'
                : 'linear-gradient(90deg, var(--color-primary-500), var(--color-primary-700))',
              borderRadius: 'inherit',
              transition: 'width 0.8s ease',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-tertiary)' }}>
            <span>{completedCount} of 8 steps complete</span>
            {wizard.is_complete ? (
              <span style={{ color: 'var(--color-accent-400)', fontWeight: 700 }}>✓ Setup Complete!</span>
            ) : (
              <span>{8 - completedCount} remaining</span>
            )}
          </div>
        </div>
      )}

      {/* Steps Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ margin: 'auto', width: 32, height: 32 }} /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {STEPS.map((step, index) => {
            const done = wizard?.steps?.[step.field] || false;
            const isCurrent = !done && !STEPS.slice(0, index).every(s => wizard?.steps?.[s.field]);

            return (
              <div key={step.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                padding: '18px 24px',
                background: done ? 'rgba(16,185,129,0.06)' : isCurrent ? 'rgba(99,102,241,0.06)' : 'var(--surface-2)',
                border: `1px solid ${done ? 'rgba(16,185,129,0.20)' : isCurrent ? 'rgba(99,102,241,0.25)' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--radius-lg)',
                transition: 'all var(--transition-base)',
              }}>
                {/* Step number / check */}
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                  background: done ? 'var(--color-accent-500)' : isCurrent ? 'var(--color-primary-600)' : 'var(--surface-4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: done ? 18 : 16,
                  fontWeight: 800,
                  color: done || isCurrent ? 'white' : 'var(--text-tertiary)',
                  boxShadow: done ? 'var(--shadow-glow-accent)' : isCurrent ? 'var(--shadow-glow-primary)' : 'none',
                }}>
                  {done ? '✓' : step.icon}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
                    <span style={{
                      fontWeight: 700, fontSize: 15,
                      color: done ? 'var(--color-accent-400)' : isCurrent ? 'var(--text-primary)' : 'var(--text-secondary)',
                    }}>
                      Step {index + 1}: {step.label}
                    </span>
                    {done && <span className="badge badge-success">Complete</span>}
                    {isCurrent && <span className="badge badge-primary">Current</span>}
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>{step.desc}</p>
                </div>

                <div>
                  {done ? (
                    <button className="btn btn-ghost btn-sm"
                      onClick={() => router.push(STEP_ROUTES[step.id])}>
                      Review
                    </button>
                  ) : (
                    <button
                      className={`btn btn-sm ${isCurrent ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => router.push(STEP_ROUTES[step.id])}>
                      {isCurrent ? 'Start →' : 'Configure'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Complete Banner */}
      {wizard?.is_complete && (
        <div className="card mt-6 animate-fade" style={{
          padding: '28px 32px', textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(99,102,241,0.08))',
          border: '1px solid rgba(16,185,129,0.25)',
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
          <h2 style={{ marginBottom: 8 }}>Platform Ready!</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
            Your autonomous HR platform is fully configured. The AI is ready to manage your hiring workflows.
          </p>
          <button className="btn btn-primary btn-lg"
            onClick={() => router.push('/dashboard/jobs')}>
            Create Your First Job →
          </button>
        </div>
      )}
    </div>
  );
}
