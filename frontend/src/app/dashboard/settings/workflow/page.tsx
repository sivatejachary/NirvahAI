'use client';

import { useState, useEffect } from 'react';

interface StageConfig {
  stage_number: number;
  stage_name: string;
  enabled: boolean;
  ai_enabled: boolean;
  pass_mark: number;
  auto_shortlist: boolean;
  require_human_approval: boolean;
  notification_channels: string[];
}

export default function WorkflowBuilderPage() {
  const [stages, setStages] = useState<StageConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Active sub-option tab
  const [activeSubTab, setActiveSubTab] = useState<'templates' | 'stages' | 'assessments' | 'interviews' | 'resume_rules' | 'screening_rules' | 'shortlist_rules' | 'notifications' | 'approvals'>('stages');

  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  useEffect(() => {
    const loadWorkflow = async () => {
      setLoading(true);
      setErrorMsg('');
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/pipeline/company/settings/workflow`, {
          headers: getHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          const workflowStages = Array.isArray(data.stages) ? data.stages : [
            { stage_number: 1, stage_name: 'Resume Screening', enabled: true, ai_enabled: true, pass_mark: 70, auto_shortlist: true, require_human_approval: false, notification_channels: ['email'] },
            { stage_number: 2, stage_name: 'MCQ Assessment', enabled: true, ai_enabled: true, pass_mark: 60, auto_shortlist: true, require_human_approval: false, notification_channels: ['email', 'whatsapp'] },
            { stage_number: 3, stage_name: 'Coding Assessment', enabled: true, ai_enabled: true, pass_mark: 50, auto_shortlist: false, require_human_approval: true, notification_channels: ['email'] },
            { stage_number: 4, stage_name: 'AI Technical Interview', enabled: true, ai_enabled: true, pass_mark: 70, auto_shortlist: false, require_human_approval: true, notification_channels: ['email'] },
            { stage_number: 5, stage_name: 'Hackathon / Assignment', enabled: false, ai_enabled: false, pass_mark: 60, auto_shortlist: false, require_human_approval: true, notification_channels: ['email'] },
            { stage_number: 6, stage_name: 'AI HR Call (Post-Technical)', enabled: false, ai_enabled: true, pass_mark: 50, auto_shortlist: false, require_human_approval: false, notification_channels: [] },
            { stage_number: 7, stage_name: 'Technical Interview (Human)', enabled: true, ai_enabled: false, pass_mark: 70, auto_shortlist: false, require_human_approval: true, notification_channels: ['email'] },
            { stage_number: 8, stage_name: 'AI HR Call (Post-Interview)', enabled: false, ai_enabled: true, pass_mark: 50, auto_shortlist: false, require_human_approval: false, notification_channels: [] },
            { stage_number: 9, stage_name: 'HR / Hiring Manager Round', enabled: true, ai_enabled: false, pass_mark: 70, auto_shortlist: false, require_human_approval: true, notification_channels: ['email'] },
            { stage_number: 10, stage_name: 'AI HR Call (Pre-Offer)', enabled: false, ai_enabled: true, pass_mark: 50, auto_shortlist: false, require_human_approval: false, notification_channels: [] },
            { stage_number: 11, stage_name: 'Offer Letter', enabled: true, ai_enabled: false, pass_mark: 100, auto_shortlist: false, require_human_approval: true, notification_channels: ['email', 'whatsapp'] },
            { stage_number: 12, stage_name: 'AI HR Call (Post-Offer)', enabled: false, ai_enabled: true, pass_mark: 50, auto_shortlist: false, require_human_approval: false, notification_channels: [] },
            { stage_number: 13, stage_name: 'Background Verification', enabled: true, ai_enabled: false, pass_mark: 100, auto_shortlist: false, require_human_approval: true, notification_channels: ['email'] },
            { stage_number: 14, stage_name: 'AI HR Call (BGV Update)', enabled: false, ai_enabled: true, pass_mark: 50, auto_shortlist: false, require_human_approval: false, notification_channels: [] },
            { stage_number: 15, stage_name: 'Joining & Onboarding', enabled: true, ai_enabled: false, pass_mark: 100, auto_shortlist: false, require_human_approval: true, notification_channels: ['email'] }
          ];
          setStages(workflowStages);
        } else {
          setErrorMsg('Failed to load company workflow config.');
        }
      } catch {
        setErrorMsg('Connection error loading workflow.');
      } finally {
        setLoading(false);
      }
    };
    loadWorkflow();
  }, []);

  const toggleField = (stageNum: number, field: keyof StageConfig) => {
    setStages(prev => prev.map(s => {
      if (s.stage_number === stageNum) {
        return { ...s, [field]: !s[field] };
      }
      return s;
    }));
  };

  const updateNumeric = (stageNum: number, field: keyof StageConfig, val: number) => {
    setStages(prev => prev.map(s => {
      if (s.stage_number === stageNum) {
        return { ...s, [field]: val };
      }
      return s;
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/pipeline/company/settings/workflow`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ stages })
      });
      if (res.ok) {
        setSuccessMsg('Hiring workflow configuration saved successfully.');
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setErrorMsg('Failed to save configuration settings.');
      }
    } catch {
      setErrorMsg('Connection error.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '24px', height: 'calc(100vh - 120px)', minHeight: 0 }}>
      {/* Left sub-options panel */}
      <div style={{ width: '220px', flexShrink: 0, borderRight: '1px solid var(--border-color)', paddingRight: '16px', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Hiring Workflow</h2>
        {[
          { id: 'templates', label: '📋 Workflow Templates' },
          { id: 'stages', label: '📊 Recruitment Stages' },
          { id: 'assessments', label: '📝 Assessment Config' },
          { id: 'interviews', label: '🎙️ Interview Config' },
          { id: 'resume_rules', label: '📄 AI Resume Rules' },
          { id: 'screening_rules', label: '🔍 AI Screening Rules' },
          { id: 'shortlist_rules', label: '⭐ Auto Shortlist Rules' },
          { id: 'notifications', label: '📨 Notification Templates' },
          { id: 'approvals', label: '✔ Approval Workflow' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveSubTab(t.id as any)}
            style={{
              textAlign: 'left',
              width: '100%',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: activeSubTab === t.id ? 700 : 400,
              color: activeSubTab === t.id ? '#fff' : 'var(--text-secondary)',
              background: activeSubTab === t.id ? 'rgba(99,102,241,0.15)' : 'transparent',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Right content panel */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }} className="space-y-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-base font-bold text-white capitalize">{activeSubTab.replace('_', ' ')} Options</h2>
          {activeSubTab === 'stages' && (
            <button onClick={handleSave} disabled={saving}
              className="rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-violet-500 transition disabled:opacity-50">
              {saving ? 'Saving...' : '💾 Save Stages'}
            </button>
          )}
        </div>

        {successMsg && <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-400">{successMsg}</div>}
        {errorMsg && <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400">{errorMsg}</div>}

        {activeSubTab === 'stages' ? (
          <div>
            {loading ? (
              <div className="flex h-40 items-center justify-center">
                <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="rounded-xl border border-white/5 bg-slate-900/20 overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-950/60 text-slate-400 font-semibold uppercase border-b border-white/5">
                    <tr>
                      <th className="p-4 w-12 text-center">Stage</th>
                      <th className="p-4">Stage Name</th>
                      <th className="p-4 text-center">Enabled</th>
                      <th className="p-4 text-center">AI Autopilot</th>
                      <th className="p-4 text-center">Passing Mark (%)</th>
                      <th className="p-4 text-center">Auto Shortlist</th>
                      <th className="p-4 text-center">Approval Required</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300">
                    {stages.map(s => (
                      <tr key={s.stage_number} className={`hover:bg-white/3 transition ${!s.enabled ? 'opacity-40' : ''}`}>
                        <td className="p-4 text-center font-bold text-slate-400">#{s.stage_number}</td>
                        <td className="p-4 font-semibold text-white">{s.stage_name}</td>
                        <td className="p-4 text-center">
                          <input type="checkbox" checked={s.enabled} onChange={() => toggleField(s.stage_number, 'enabled')} className="cursor-pointer" />
                        </td>
                        <td className="p-4 text-center">
                          <input type="checkbox" checked={s.ai_enabled} disabled={!s.enabled} onChange={() => toggleField(s.stage_number, 'ai_enabled')} className="cursor-pointer disabled:opacity-30" />
                        </td>
                        <td className="p-4 text-center">
                          <input type="number" min={0} max={100} value={s.pass_mark} disabled={!s.enabled}
                            onChange={e => updateNumeric(s.stage_number, 'pass_mark', parseInt(e.target.value) || 0)}
                            className="w-16 text-center rounded border border-white/10 bg-slate-950 px-2 py-1 text-white disabled:opacity-30 focus:outline-none" />
                        </td>
                        <td className="p-4 text-center">
                          <input type="checkbox" checked={s.auto_shortlist} disabled={!s.enabled} onChange={() => toggleField(s.stage_number, 'auto_shortlist')} className="cursor-pointer disabled:opacity-30" />
                        </td>
                        <td className="p-4 text-center">
                          <input type="checkbox" checked={s.require_human_approval} disabled={!s.enabled} onChange={() => toggleField(s.stage_number, 'require_human_approval')} className="cursor-pointer disabled:opacity-30" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* Templates and rule builders - placeholder views */
          <div className="rounded-xl border border-dashed border-white/10 p-12 text-center text-slate-500">
            <div className="text-4xl mb-3">⚙️</div>
            <p className="text-sm font-semibold text-slate-300">Custom rules for {activeSubTab.replace('_', ' ')} will show here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
