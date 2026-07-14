'use client';

import { useState, useEffect } from 'react';

const INTEGRATIONS = [
  { type: 'google_calendar', label: 'Google Calendar', icon: 'ðŸ“…', desc: 'Sync interview schedules and send calendar invites automatically.', category: 'Calendar' },
  { type: 'microsoft_graph', label: 'Microsoft 365', icon: 'ðŸªŸ', desc: 'Outlook calendar sync and Teams meeting links for interviews.', category: 'Calendar' },
  { type: 'smtp_email', label: 'Custom SMTP', icon: 'ðŸ“§', desc: 'Send emails from your own domain instead of the platform default.', category: 'Email' },
  { type: 'slack', label: 'Slack', icon: 'ðŸ’¬', desc: 'Get hiring notifications, AI summaries, and alerts in Slack channels.', category: 'Communication' },
  { type: 'teams', label: 'Microsoft Teams', icon: 'ðŸ‘¥', desc: 'Notifications and meeting links via Teams.', category: 'Communication' },
  { type: 'zoom', label: 'Zoom', icon: 'ðŸŽ¥', desc: 'Automatically generate Zoom meeting links for interviews.', category: 'Video' },
  { type: 'twilio', label: 'Twilio', icon: 'ðŸ“ž', desc: 'AI voice calls with candidates during screening. Requires Twilio account.', category: 'Voice' },
  { type: 'background_check', label: 'Background Verification', icon: 'ðŸ”', desc: 'Automated background verification triggers upon offer acceptance.', category: 'Compliance' },
  { type: 'e_signature', label: 'E-Signature', icon: 'âœï¸', desc: 'Send offer letters for digital signature.', category: 'Documents' },
];

const CATEGORIES = [...new Set(INTEGRATIONS.map(i => i.category))];

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [configValue, setConfigValue] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
  const h = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    // TODO: Fetch configured integrations from API
    setLoading(false);
  }, []);

  return (
    <div>
      <div className="card mb-4" style={{ background: 'var(--surface-3)', padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 20 }}>ðŸ”Œ</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>
              Platform Integrations
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>
              Connect your existing tools to supercharge the autonomous HR workflow. Credentials are encrypted and stored securely. They are never logged or returned via the API.
            </p>
          </div>
        </div>
      </div>

      {CATEGORIES.map(category => (
        <div key={category} className="card mb-4">
          <div className="section-header mb-4">
            <div className="section-title">{category}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {INTEGRATIONS.filter(i => i.category === category).map(integration => {
              const configured = integrations[integration.type];
              return (
                <div key={integration.type} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '14px 16px',
                  background: 'var(--surface-3)',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${configured?.is_active ? 'rgba(16,185,129,0.25)' : 'var(--border-subtle)'}`,
                }}>
                  <div style={{ fontSize: 24, flexShrink: 0 }}>{integration.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{integration.label}</span>
                      {configured?.is_active && (
                        <span className="badge badge-success badge-dot">Connected</span>
                      )}
                      {configured?.is_active === false && (
                        <span className="badge badge-warn">Not verified</span>
                      )}
                    </div>
                    <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', margin: 0 }}>{integration.desc}</p>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    {configured?.is_active ? (
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-error-400)' }}>
                        Disconnect
                      </button>
                    ) : (
                      <button className="btn btn-secondary btn-sm"
                        onClick={() => setConfiguring(
                          configuring === integration.type ? null : integration.type
                        )}>
                        Configure
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Configure Modal */}
      {configuring && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          backdropFilter: 'blur(4px)',
        }}
          onClick={() => setConfiguring(null)}>
          <div className="card animate-fade" style={{ width: 440, padding: 28 }}
            onClick={e => e.stopPropagation()}>
            {(() => {
              const integ = INTEGRATIONS.find(i => i.type === configuring)!;
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    <span style={{ fontSize: 28 }}>{integ.icon}</span>
                    <div>
                      <h3 style={{ margin: 0 }}>Configure {integ.label}</h3>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>
                        Credentials are encrypted at rest and never exposed via the API.
                      </p>
                    </div>
                  </div>
                  <div className="alert alert-info mb-4" style={{ fontSize: 12 }}>
                    Integration configuration will be available once the database is connected.
                    The API endpoint <code>POST /api/v1/integrations/{configuring}</code> is ready.
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setConfiguring(null)}>Close</button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
