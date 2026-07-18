'use client';

import { useState } from 'react';

type VoiceTab = 'overview' | 'analytics' | 'history' | 'templates';

const VOICE_FEATURES = [
  { icon: '📞', title: 'Autonomous Outbound Dialing', desc: 'Auto-dial shortlisted candidates to verify salary, notice period & availability. Runs 24/7.' },
  { icon: '🎤', title: 'Live Speech-to-Text', desc: 'Real-time transcription with speaker diarization and sentiment tagging.' },
  { icon: '🧠', title: 'AI Intent Detection', desc: 'Understands candidate intent, schedules follow-ups, and flags escalations automatically.' },
  { icon: '📊', title: 'Voice Analytics', desc: 'Tone analysis, confidence scoring, and behavioral pattern recognition per candidate.' },
  { icon: '🔄', title: 'Multi-Stage Calling', desc: 'Configurable call scripts per pipeline stage — screening, pre-offer, BGV update, and more.' },
  { icon: '🌍', title: 'Multi-Language Support', desc: 'Hindi, English, Telugu, Tamil and 20+ regional languages supported natively.' },
];

const CALL_HISTORY = [
  { candidate: 'Rahul Sharma', job: 'Senior Backend Engineer', duration: '4m 32s', outcome: 'CONNECTED', score: 78, time: '2h ago' },
  { candidate: 'Priya Patel', job: 'Product Manager', duration: '6m 14s', outcome: 'CONNECTED', score: 85, time: '3h ago' },
  { candidate: 'Arjun Mehta', job: 'Data Scientist', duration: '0m 12s', outcome: 'VOICEMAIL', score: 0, time: '4h ago' },
  { candidate: 'Sneha Reddy', job: 'Frontend Developer', duration: '3m 48s', outcome: 'CONNECTED', score: 91, time: '6h ago' },
  { candidate: 'Kiran Kumar', job: 'DevOps Engineer', duration: '0m 00s', outcome: 'NO ANSWER', score: 0, time: '8h ago' },
];

const TEMPLATES = [
  { name: 'Initial Screening Call', stage: 'Post-Resume', duration: '3-5 min', questions: 6 },
  { name: 'Notice Period Confirmation', stage: 'Pre-Interview', duration: '2-3 min', questions: 4 },
  { name: 'Pre-Offer Salary Discussion', stage: 'Pre-Offer', duration: '5-8 min', questions: 8 },
  { name: 'BGV Status Update', stage: 'Background Check', duration: '2-3 min', questions: 3 },
  { name: 'Joining Day Reminder', stage: 'Pre-Joining', duration: '1-2 min', questions: 2 },
];

export default function CallsPage() {
  const [activeTab, setActiveTab] = useState<VoiceTab>('overview');

  const TABS = [
    { id: 'overview' as VoiceTab, label: '📞 Agent Overview' },
    { id: 'analytics' as VoiceTab, label: '📊 Analytics' },
    { id: 'history' as VoiceTab, label: '📜 Call History' },
    { id: 'templates' as VoiceTab, label: '📄 Voice Templates' },
  ];

  const outcomeStyle = (o: string) => {
    if (o === 'CONNECTED') return { color: '#34d399', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' };
    if (o === 'VOICEMAIL') return { color: '#fbbf24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' };
    return { color: '#f87171', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginBottom: 4 }}>HR Voice Center</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Autonomous AI voice agents — phone screening, verification, and follow-ups</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ padding: '6px 14px', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 8, fontSize: 11, color: '#fbbf24', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fbbf24', animation: 'blink 1.5s ease-in-out infinite' }} />
            Twilio Integration — Coming Soon
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 1 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: '8px 16px', borderRadius: '8px 8px 0 0', fontSize: 12, fontWeight: activeTab === t.id ? 700 : 400, background: activeTab === t.id ? 'rgba(124,58,237,0.2)' : 'transparent', border: activeTab === t.id ? '1px solid rgba(124,58,237,0.35)' : '1px solid transparent', borderBottomColor: activeTab === t.id ? 'transparent' : 'transparent', color: activeTab === t.id ? '#a78bfa' : 'rgba(255,255,255,0.45)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          {/* Main hero */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '48px 40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ width: 88, height: 88, borderRadius: 24, background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(99,102,241,0.1))', border: '1px solid rgba(124,58,237,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, position: 'relative', zIndex: 1 }}>
              🎙️
            </div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginBottom: 10 }}>Realtime Voice AI — Coming Soon</h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', maxWidth: 480, lineHeight: 1.7, margin: '0 auto 24px' }}>
                We are finalizing <strong style={{ color: '#a78bfa' }}>Twilio + VAPI</strong> integrations to enable fully autonomous speech interviews, phone screenings, and intelligent voice campaigns across all candidates.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {['Autopilot Dialing', 'Live STT', 'Voice Sentiment AI', 'Multi-Language', 'Smart Scheduling'].map(tag => (
                  <span key={tag} style={{ padding: '5px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 99, fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>{tag}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Feature Checklist */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '24px', display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>Feature Roadmap</div>
            {VOICE_FEATURES.slice(0, 5).map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.05)' : 'none', alignItems: 'flex-start' }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{f.icon}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 3 }}>{f.title}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Features Grid */}
          <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {VOICE_FEATURES.map((f, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '20px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.4), transparent)' }} />
                <div style={{ fontSize: 22, marginBottom: 10 }}>{f.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{f.title}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {[
            { label: 'Total Calls Made', value: '0', color: '#6366f1', icon: '📞' },
            { label: 'Calls Connected', value: '0', color: '#34d399', icon: '✅' },
            { label: 'Avg Duration', value: '0m', color: '#fbbf24', icon: '⏱️' },
            { label: 'Conversion Rate', value: '0%', color: '#a78bfa', icon: '📈' },
          ].map((s, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '20px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${s.color}, transparent)`, opacity: 0.6 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{s.label}</div>
                <span style={{ fontSize: 18 }}>{s.icon}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>Available after integration</div>
            </div>
          ))}
          <div style={{ gridColumn: '1 / -1', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
            📊 Detailed call analytics will appear here once Twilio/VAPI integration is live.
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Recent Call History (Mock Data)
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                {['Candidate', 'Job Role', 'Duration', 'Outcome', 'AI Score', 'When'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CALL_HISTORY.map((c, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.15s' }}>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#fff' }}>{c.candidate}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>{c.job}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>{c.duration}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, ...outcomeStyle(c.outcome) }}>{c.outcome}</span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: c.score > 0 ? '#a78bfa' : 'rgba(255,255,255,0.2)' }}>{c.score > 0 ? `${c.score}/100` : '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{c.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Voice Script Templates</div>
            <button style={{ padding: '7px 14px', background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(99,102,241,0.2))', border: '1px solid rgba(124,58,237,0.35)', borderRadius: 8, color: '#a78bfa', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              + Create Template
            </button>
          </div>
          {TEMPLATES.map((t, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📄</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{t.name}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ padding: '2px 8px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 99, fontSize: 10, color: '#a78bfa', fontWeight: 600 }}>{t.stage}</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>⏱️ {t.duration}</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>❓ {t.questions} questions</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ padding: '6px 12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Preview</button>
                <button style={{ padding: '6px 12px', background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 8, color: '#a78bfa', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Edit</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        tr:hover { background: rgba(255,255,255,0.02) !important; }
      `}</style>
    </div>
  );
}
