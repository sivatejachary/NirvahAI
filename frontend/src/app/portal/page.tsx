'use client';

import { useState, useEffect, FormEvent } from 'react';

interface Job {
  id: string;
  title: string;
  description: string;
  requirements: string[];
  employment_type?: string;
  location_type?: string;
  salary_min?: number;
  salary_max?: number;
  currency?: string;
}

type FlowStep = 'job_detail' | 'apply_form' | 'consent' | 'success';

export default function CandidatePortalPage() {
  const [tenantSlug, setTenantSlug] = useState('');
  const [jobId, setJobId] = useState('');
  const [channel, setChannel] = useState('');
  const [job, setJob] = useState<Job | null>(null);
  const [jobLoading, setJobLoading] = useState(false);

  const [step, setStep] = useState<FlowStep>('job_detail');

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [applicationId, setApplicationId] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tenant') || '';
    const j = params.get('job') || '';
    const c = params.get('channel') || 'company_site';
    setTenantSlug(t);
    setJobId(j);
    setChannel(c);

    if (j && t) {
      setJobLoading(true);
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/jobs/${j}`, {
        headers: { 'X-Tenant-Slug': t }
      })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setJob(d); })
        .catch(() => {})
        .finally(() => setJobLoading(false));
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setResumeFile(f);
    const reader = new FileReader();
    reader.onload = ev => setResumeText((ev.target?.result as string) || '');
    reader.readAsText(f);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!consentChecked) { setErrorMsg('Please accept the data processing consent to proceed.'); return; }
    if (!name.trim() || !email.trim()) { setErrorMsg('Name and email are required.'); return; }
    if (!resumeText.trim()) { setErrorMsg('Please paste your resume text or upload a resume file.'); return; }

    setLoading(true);
    setErrorMsg('');
    try {
      // Log candidate consent first
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/public/consent/by-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Slug': tenantSlug },
        body: JSON.stringify({
          candidate_email: email.trim(),
          workflow_stage: 'APPLICATION',
          consent_status: true,
          consent_method: 'WEB_FORM',
          verification_metadata: { auto_granted_on_submit: true }
        }),
      });

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/public/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Slug': tenantSlug },
        body: JSON.stringify({
          job_id: jobId,
          candidate_name: name.trim(),
          candidate_email: email.trim(),
          resume_text: resumeText.trim(),
          resume_url: `https://portal.${tenantSlug}.com/resumes/${encodeURIComponent(name.trim().replace(' ', '_'))}.pdf`,
          source_channel: channel,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setApplicationId(data.id || '');
        setStep('success');
      } else {
        setErrorMsg(data.detail || 'Submission failed. Please try again.');
      }
    } catch {
      setErrorMsg('Could not connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const CHANNEL_LABELS: Record<string, string> = {
    linkedin: 'LinkedIn',
    indeed: 'Indeed',
    company_site: 'Company Site',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
      color: '#f3f4f6',
      fontFamily: "'Inter', system-ui, sans-serif",
      padding: '0',
    }}>
      {/* Top bar */}
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '16px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>🤖</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.02em' }}>
              {tenantSlug ? tenantSlug.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'HR Platform'}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>Careers Portal</div>
          </div>
        </div>
        {channel && (
          <div style={{
            fontSize: 11, fontWeight: 700, padding: '4px 12px',
            background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)',
            borderRadius: 20, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            via {CHANNEL_LABELS[channel] || channel}
          </div>
        )}
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 20px' }}>

        {/* SUCCESS STATE */}
        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 36, margin: '0 auto 24px',
              boxShadow: '0 0 40px rgba(16,185,129,0.4)',
            }}>✓</div>
            <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 12, letterSpacing: '-0.03em' }}>
              Application Submitted! 🎉
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>
              Your application for <strong style={{ color: '#a5b4fc' }}>{job?.title || 'the position'}</strong> has been received.<br />
              Our AI is now reviewing your profile and will be in touch shortly.
            </p>
            <div style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 16, padding: 24, display: 'inline-block', textAlign: 'left', minWidth: 320,
            }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>What happens next?</div>
              {[
                { icon: '🤖', step: 'AI Resume Analysis', desc: 'Your resume is scored for fit (1–100)' },
                { icon: '📝', step: 'MCQ Assessment', desc: 'Adaptive knowledge test sent to your email' },
                { icon: '💻', step: 'Coding Challenge', desc: 'Role-specific technical task' },
                { icon: '🎥', step: 'AI Interview', desc: 'Async video interview scheduled by AI' },
                { icon: '📄', step: 'Offer / Decision', desc: 'Final decision communicated within 5 days' },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 20, flexShrink: 0 }}>{s.icon}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{s.step}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            {applicationId && (
              <p style={{ marginTop: 24, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                Application ID: <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: 4 }}>{applicationId}</code>
              </p>
            )}
          </div>
        )}

        {/* JOB DETAIL + FORM */}
        {step !== 'success' && (
          <>
            {/* Job card */}
            {jobLoading ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.4)' }}>Loading position details…</div>
            ) : job ? (
              <div style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 20, padding: 32, marginBottom: 32,
                backdropFilter: 'blur(10px)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                  <div>
                    <h1 style={{ fontSize: 28, fontWeight: 900, margin: '0 0 8px', letterSpacing: '-0.03em' }}>{job.title}</h1>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {job.employment_type && (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 20, color: '#a5b4fc' }}>
                          {job.employment_type}
                        </span>
                      )}
                      {job.location_type && (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 20, color: '#6ee7b7' }}>
                          {job.location_type}
                        </span>
                      )}
                    </div>
                  </div>
                  {job.salary_min && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#fbbf24' }}>
                        ${job.salary_min?.toLocaleString()} – ${job.salary_max?.toLocaleString()}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{job.currency} / year</div>
                    </div>
                  )}
                </div>

                <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, margin: '20px 0', fontSize: 14, whiteSpace: 'pre-line' }}>
                  {job.description}
                </p>

                {job.requirements?.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.5)' }}>Requirements</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {job.requirements.map((r, i) => (
                        <span key={i} style={{
                          fontSize: 12, fontWeight: 600, padding: '5px 12px',
                          background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: 20, color: 'rgba(255,255,255,0.8)',
                        }}>{r}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.5)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>💼</div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>No job specified</div>
                <div style={{ fontSize: 13 }}>Please use the full application link provided by the recruiter.</div>
              </div>
            )}

            {/* Application Form */}
            {job && (
              <form onSubmit={handleSubmit} style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 20, padding: 32, backdropFilter: 'blur(10px)',
              }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 24px', letterSpacing: '-0.02em' }}>
                  Apply for this Position
                </h2>

                {errorMsg && (
                  <div style={{
                    background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
                    color: '#fca5a5', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 14,
                  }}>
                    ⚠️ {errorMsg}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Alex Johnson"
                      style={{
                        width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 10, padding: '12px 14px', color: '#f3f4f6', fontSize: 14,
                        outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="alex@example.com"
                      style={{
                        width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 10, padding: '12px 14px', color: '#f3f4f6', fontSize: 14,
                        outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Resume / CV *
                  </label>
                  <div style={{ marginBottom: 8 }}>
                    <input
                      type="file"
                      accept=".txt,.pdf,.doc,.docx"
                      onChange={handleFileChange}
                      id="resume-upload"
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="resume-upload" style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      background: 'rgba(99,102,241,0.2)', border: '1px dashed rgba(99,102,241,0.5)',
                      borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontSize: 13,
                      color: '#a5b4fc', fontWeight: 600, transition: 'all 0.2s',
                    }}>
                      📎 {resumeFile ? resumeFile.name : 'Upload Resume (PDF, DOC, TXT)'}
                    </label>
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>— or paste your resume text below —</div>
                  <textarea
                    required={!resumeFile}
                    value={resumeText}
                    onChange={e => setResumeText(e.target.value)}
                    placeholder="Paste your resume here... Include your experience, skills, education and achievements. The AI will parse and score it against the job requirements."
                    rows={8}
                    style={{
                      width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 10, padding: '12px 14px', color: '#f3f4f6', fontSize: 13, lineHeight: 1.6,
                      outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit',
                    }}
                  />
                </div>

                {/* GDPR Consent */}
                <div style={{
                  background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)',
                  borderRadius: 12, padding: 16, marginBottom: 24,
                }}>
                  <label style={{ display: 'flex', gap: 12, cursor: 'pointer', alignItems: 'flex-start' }}>
                    <input
                      type="checkbox"
                      checked={consentChecked}
                      onChange={e => setConsentChecked(e.target.checked)}
                      style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0, accentColor: '#6366f1' }}
                    />
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                      I consent to my personal data being processed for recruitment purposes by{' '}
                      <strong style={{ color: '#a5b4fc' }}>{tenantSlug || 'this company'}</strong> in accordance with GDPR and their{' '}
                      <a href="#" style={{ color: '#818cf8', textDecoration: 'underline' }}>Privacy Policy</a>.
                      My data will be used solely for evaluating my application for this role and will be deleted after 90 days if unsuccessful.
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading || !consentChecked}
                  style={{
                    width: '100%', padding: '16px 24px',
                    background: loading || !consentChecked
                      ? 'rgba(99,102,241,0.3)'
                      : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    border: 'none', borderRadius: 12, color: '#fff',
                    fontWeight: 800, fontSize: 16, cursor: loading || !consentChecked ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s', letterSpacing: '-0.01em',
                    boxShadow: loading || !consentChecked ? 'none' : '0 8px 32px rgba(99,102,241,0.4)',
                  }}
                >
                  {loading ? '⏳ Submitting to AI Pipeline...' : '🚀 Submit Application'}
                </button>

                <p style={{ textAlign: 'center', marginTop: 14, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                  🔒 Your data is encrypted and processed securely. Powered by AI-assisted hiring.
                </p>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
