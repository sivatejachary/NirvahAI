'use client';

import { useState } from 'react';

export default function CallsPage() {
  const [activeVoiceTab, setActiveVoiceTab] = useState<'overview' | 'analytics' | 'history' | 'templates'>('overview');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 800 }}>HR Voice Center</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 2 }}>Autonomous voice agents, realtime calling and speech recognition</p>
        </div>
        <span className="badge badge-primary" style={{ padding: '6px 12px', fontSize: '11px', animation: 'pulse 2s infinite' }}>
          🎙️ AI Realtime Voice
        </span>
      </div>

      {/* Tabs navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', gap: '4px', paddingBottom: '6px', overflowX: 'auto' }}>
        {[
          { id: 'overview', label: '📞 Agent Overview' },
          { id: 'analytics', label: '📊 Call Analytics' },
          { id: 'history', label: '📜 Call History' },
          { id: 'templates', label: '📄 Voice Templates' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveVoiceTab(t.id as any)}
            className={`btn ${activeVoiceTab === t.id ? 'btn-primary' : 'btn-ghost'} btn-sm`}
            style={{ fontSize: '12px', padding: '6px 16px' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeVoiceTab === 'overview' && (
        <div style={{ display: 'flex', gap: '20px' }}>
          {/* Main info panel */}
          <div className="card" style={{ flex: 2, borderStyle: 'dashed', textAlign: 'center', padding: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
            <div style={{ fontSize: '64px', animation: 'bounce 2s infinite' }}>🎙️</div>
            <h2 style={{ fontSize: '18px', fontWeight: 800 }}>Realtime Voice Calling Coming Soon</h2>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', maxWidth: '380px', lineHeight: 1.6 }}>
              We are finalizing live Twilio &amp; VAPI integrations to enable fully autonomous speech interviews, phone screenings and smart voice call campaigns.
            </p>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <span className="badge badge-default" style={{ fontSize: '10px' }}>Autopilot Dialing</span>
              <span className="badge badge-default" style={{ fontSize: '10px' }}>Live Speech to Text</span>
              <span className="badge badge-default" style={{ fontSize: '10px' }}>Voice Sentiment AI</span>
            </div>
          </div>

          {/* Config card */}
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Voice Feature Checklist</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
              {[
                { title: 'Autonomous Outbound Calling', desc: 'Auto-dial shortlists to verify salary & notice period.' },
                { title: 'Inbound Candidate Line', desc: 'Direct phone number for candidates to start voice screenings.' },
                { title: 'Voice Template Customizer', desc: 'Modify LLM speech prompts, tones, and accents.' },
                { title: 'Conversation Memory Hub', desc: 'Per-candidate phone history & transcript summaries.' },
                { title: 'Telephony Carrier Config', desc: 'Integrate custom numbers, SIP trunks and call recording.' }
              ].map((item, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '10px', background: 'var(--surface-3)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
                  <span style={{ fontSize: '16px' }}>⚙️</span>
                  <div>
                    <h4 style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</h4>
                    <p style={{ color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeVoiceTab === 'analytics' && (
        <div className="card" style={{ borderStyle: 'dashed', padding: '48px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📊</div>
          <p style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Call analytics dashboard will load once carrier services are linked.</p>
        </div>
      )}

      {activeVoiceTab === 'history' && (
        <div className="card" style={{ borderStyle: 'dashed', padding: '48px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📜</div>
          <p style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>No outbound call logs recorded in history logs.</p>
        </div>
      )}

      {activeVoiceTab === 'templates' && (
        <div className="card" style={{ borderStyle: 'dashed', padding: '48px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📄</div>
          <p style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Customize greeting messages, voice agent scripts and dialog rules here.</p>
        </div>
      )}
    </div>
  );
}
