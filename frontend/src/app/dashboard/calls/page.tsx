'use client';

import { useState } from 'react';

export default function CallsPage() {
  const [activeVoiceTab, setActiveVoiceTab] = useState<'overview' | 'analytics' | 'history' | 'templates'>('overview');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-white">HR Voice Center</h1>
          <p className="text-xs text-slate-400 mt-0.5">Autonomous voice agents, realtime calling and speech recognition</p>
        </div>
        <span className="rounded bg-violet-500/10 border border-violet-500/20 px-3 py-1 text-xs font-black text-violet-400 uppercase tracking-widest animate-pulse">
          🎙️ AI Realtime Voice
        </span>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-white/5 gap-2 pb-1 overflow-x-auto">
        {[
          { id: 'overview', label: '📞 Agent Overview' },
          { id: 'analytics', label: '📊 Call Analytics' },
          { id: 'history', label: '📜 Call History' },
          { id: 'templates', label: '📄 Voice Templates' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveVoiceTab(t.id as any)}
            className={`px-4 py-2 text-xs font-bold rounded-lg border whitespace-nowrap transition ${
              activeVoiceTab === t.id
                ? 'border-violet-500 bg-violet-500/10 text-violet-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeVoiceTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main info panel */}
          <div className="lg:col-span-2 rounded-2xl border border-dashed border-white/10 p-12 text-center bg-slate-900/20 flex flex-col items-center justify-center gap-4">
            <div className="text-7xl animate-bounce">🎙️</div>
            <h2 className="text-lg font-bold text-white">Realtime Voice Calling Coming Soon</h2>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              We are finalizing live Twilio &amp; VAPI integrations to enable fully autonomous speech interviews, phone screenings and smart voice call campaigns.
            </p>
            <div className="flex gap-2">
              <span className="rounded-full bg-slate-800 border border-white/5 px-3 py-1 text-[10px] text-slate-300">Autopilot Dialing</span>
              <span className="rounded-full bg-slate-800 border border-white/5 px-3 py-1 text-[10px] text-slate-300">Live Speech to Text</span>
              <span className="rounded-full bg-slate-800 border border-white/5 px-3 py-1 text-[10px] text-slate-300">Voice Sentiment AI</span>
            </div>
          </div>

          {/* Config card */}
          <div className="rounded-xl border border-white/5 bg-slate-900/40 p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Voice Feature Checklist</h3>
            <div className="space-y-3 text-xs">
              {[
                { title: 'Autonomous Outbound Calling', desc: 'Auto-dial shortlists to verify salary & notice period.' },
                { title: 'Inbound Candidate Line', desc: 'Direct phone number for candidates to start voice screenings.' },
                { title: 'Voice Template Customizer', desc: 'Modify LLM speech prompts, tones, and accents.' },
                { title: 'Conversation Memory Hub', desc: 'Per-candidate phone history & transcript summaries.' },
                { title: 'Telephony Carrier Config', desc: 'Integrate custom numbers, SIP trunks and call recording.' }
              ].map((item, idx) => (
                <div key={idx} className="flex gap-3 bg-slate-950/40 p-3 rounded-lg border border-white/5">
                  <span className="text-base flex-shrink-0">⚙️</span>
                  <div>
                    <h4 className="font-bold text-white">{item.title}</h4>
                    <p className="text-slate-400 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeVoiceTab === 'analytics' && (
        <div className="rounded-xl border border-white/5 bg-slate-900/40 p-12 text-center text-slate-500">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-sm font-semibold text-slate-300">Call analytics dashboard will load once carrier services are linked.</p>
        </div>
      )}

      {activeVoiceTab === 'history' && (
        <div className="rounded-xl border border-white/5 bg-slate-900/40 p-12 text-center text-slate-500">
          <div className="text-4xl mb-3">📜</div>
          <p className="text-sm font-semibold text-slate-300">No outbound call logs recorded in history logs.</p>
        </div>
      )}

      {activeVoiceTab === 'templates' && (
        <div className="rounded-xl border border-white/5 bg-slate-900/40 p-12 text-center text-slate-500">
          <div className="text-4xl mb-3">📄</div>
          <p className="text-sm font-semibold text-slate-300">Customize greeting messages, voice agent scripts and dialog rules here.</p>
        </div>
      )}
    </div>
  );
}
