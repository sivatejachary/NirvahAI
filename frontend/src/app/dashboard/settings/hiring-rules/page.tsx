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

interface WorkflowStage {
  stage_number: number;
  stage_name: string;
  enabled: boolean;
  pass_mark: number;
  ai_confidence_threshold: number;
  require_human_approval: boolean;
  notifications: {
    email: boolean;
    whatsapp: boolean;
    sms: boolean;
    in_app: boolean;
  };
}

const AUTONOMY_LEVELS = [
  {
    value: 'ASSISTED',
    label: 'Assisted',
    description: 'AI assists recruiters with suggestions. Every action requires human approval.',
    icon: '🤝',
    color: 'var(--color-primary-400, #818cf8)',
  },
  {
    value: 'SEMI_AUTONOMOUS',
    label: 'Semi-Autonomous',
    description: 'AI handles screening and scheduling. Offers, rejections, and key decisions still require approval.',
    icon: '⚡',
    color: 'var(--color-warn-400, #fbbf24)',
  },
  {
    value: 'AUTONOMOUS',
    label: 'Autonomous',
    description: 'AI manages the full hiring pipeline within policy bounds. Human oversight via audit trail.',
    icon: '🤖',
    color: 'var(--color-accent-400, #34d399)',
  },
];

export default function HiringRulesPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'stages'>('general');
  const [rules, setRules] = useState<Partial<HiringRules>>({});
  const [stages, setStages] = useState<WorkflowStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Form for custom stage additions
  const [newStageName, setNewStageName] = useState('');
  const [newStagePassMark, setNewStagePassMark] = useState(50);

  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const loadData = async () => {
    setLoading(true);
    try {
      const [rulesRes, stagesRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/company/profile`, { headers }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/pipeline/company/settings/workflow`, { headers })
      ]);
      
      if (rulesRes.ok) {
        const rulesData = await rulesRes.json();
        setRules(rulesData);
      }
      if (stagesRes.ok) {
        const stagesData = await stagesRes.json();
        setStages(stagesData.stages || []);
      }
    } catch {
      setError('Failed to fetch configurations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveGeneral = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/company/hiring-rules`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(rules),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.detail || 'Save failed.');
        return;
      }
      setSuccess('Hiring rules saved successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Network error.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStages = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/pipeline/company/settings/workflow`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ stages }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.detail || 'Failed to save pipeline configuration.');
        return;
      }
      setSuccess('Hiring pipeline stages saved successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Network error.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddCustomStage = () => {
    if (!newStageName.trim()) return;
    const nextNum = stages.length > 0 ? Math.max(...stages.map(s => s.stage_number)) + 1 : 1;
    const newStage: WorkflowStage = {
      stage_number: nextNum,
      stage_name: newStageName.trim(),
      enabled: true,
      pass_mark: newStagePassMark,
      ai_confidence_threshold: 0.75,
      require_human_approval: true,
      notifications: { email: true, whatsapp: true, sms: false, in_app: true }
    };
    setStages(prev => [...prev, newStage]);
    setNewStageName('');
    setNewStagePassMark(50);
  };

  const moveStage = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === stages.length - 1) return;
    
    const newStages = [...stages];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    
    // Swap positions
    const temp = newStages[index];
    newStages[index] = newStages[targetIdx];
    newStages[targetIdx] = temp;
    
    // Recalculate stage_number sequence strictly
    const updatedStages = newStages.map((s, idx) => ({
      ...s,
      stage_number: idx + 1
    }));
    
    setStages(updatedStages);
  };

  const toggleRule = (key: keyof HiringRules) => setRules(r => ({ ...r, [key]: !r[key] }));

  const toggleStageEnabled = (index: number) => {
    const updated = [...stages];
    updated[index].enabled = !updated[index].enabled;
    setStages(updated);
  };

  const updateStageField = (index: number, field: keyof WorkflowStage, value: any) => {
    const updated = [...stages];
    updated[index] = { ...updated[index], [field]: value };
    setStages(updated);
  };

  const updateStageNotification = (index: number, channel: 'email' | 'whatsapp' | 'sms' | 'in_app') => {
    const updated = [...stages];
    updated[index].notifications = {
      ...updated[index].notifications,
      [channel]: !updated[index].notifications[channel]
    };
    setStages(updated);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Recruitment Settings</h1>
        <p className="text-sm text-slate-400">
          Configure dynamic stages sequence, AI autonomy level, evaluation metrics, and notifications.
        </p>
      </div>

      {error && <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-400">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-400">{success}</div>}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/5 pb-2">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
            activeTab === 'general' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          General Rules
        </button>
        <button
          onClick={() => setActiveTab('stages')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
            activeTab === 'stages' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          Pipeline Stages Sequence ({stages.filter(s => s.enabled).length} Enabled)
        </button>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activeTab === 'general' ? (
        /* GENERAL RULES TAB */
        <form onSubmit={handleSaveGeneral} className="space-y-6">
          {/* Autonomy Level */}
          <div className="rounded-xl border border-white/5 bg-slate-900/60 p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-white">AI Autonomy Level</h2>
              <p className="text-xs text-slate-400">Controls how independently the AI operates your hiring workflows</p>
            </div>
            <div className="flex flex-col gap-3">
              {AUTONOMY_LEVELS.map(level => (
                <div
                  key={level.value}
                  onClick={() => setRules(r => ({ ...r, autonomy_level: level.value }))}
                  className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition ${
                    rules.autonomy_level === level.value ? 'border-violet-500 bg-violet-500/5' : 'border-white/5 bg-slate-950/20'
                  }`}
                >
                  <span className="text-2xl mt-0.5">{level.icon}</span>
                  <div className="flex-1">
                    <span className="text-sm font-bold text-white">{level.label}</span>
                    <p className="text-xs text-slate-400 mt-1">{level.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Feature Toggles */}
          <div className="rounded-xl border border-white/5 bg-slate-900/60 p-6 space-y-4">
            <h2 className="text-lg font-bold text-white">Core Switches</h2>
            <div className="space-y-4">
              {[
                { key: 'ai_interview_enabled', label: 'AI-Powered Interviews', desc: 'Enable adaptive AI technical interviews', icon: '🎯' },
                { key: 'voice_calls_enabled', label: 'Voice Call Screening', desc: 'Enable AI recruiter voice calls with candidates', icon: '📞' },
                { key: 'proctoring_enabled', label: 'Assessment Proctoring', desc: 'Enable AI proctoring during coding assessments', icon: '👁️' },
                { key: 'offer_approval_required', label: 'Offer Approval Required', desc: 'All offers must be approved by a manager before sending', icon: '✅' },
                { key: 'background_verification_required', label: 'Background Verification', desc: 'Require background checks before final offers', icon: '🔍' },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{item.icon}</span>
                    <div>
                      <div className="text-sm font-semibold text-white">{item.label}</div>
                      <div className="text-xs text-slate-500">{item.desc}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleRule(item.key as keyof HiringRules)}
                    className={`w-12 h-6 rounded-full relative transition duration-150 ${
                      rules[item.key as keyof HiringRules] ? 'bg-violet-600' : 'bg-slate-800'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${
                      rules[item.key as keyof HiringRules] ? 'right-1' : 'left-1'
                    }`} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Other settings */}
          <div className="rounded-xl border border-white/5 bg-slate-900/60 p-6 space-y-4">
            <h2 className="text-lg font-bold text-white">General Parameters</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Notice Period (Days)</label>
                <input
                  type="number"
                  value={rules.notice_period_days_default || 30}
                  onChange={e => setRules(r => ({ ...r, notice_period_days_default: parseInt(e.target.value) }))}
                  className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Daily AI Budget (USD)</label>
                <input
                  type="number"
                  value={rules.daily_ai_budget_usd || 50}
                  onChange={e => setRules(r => ({ ...r, daily_ai_budget_usd: parseFloat(e.target.value) }))}
                  className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Recruiter Display Name</label>
                <input
                  type="text"
                  value={rules.recruiter_display_name || ''}
                  onChange={e => setRules(r => ({ ...r, recruiter_display_name: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Sender Email</label>
                <input
                  type="email"
                  value={rules.sender_email || ''}
                  onChange={e => setRules(r => ({ ...r, sender_email: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" className="rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition">
              {saving ? 'Saving...' : 'Save General Rules'}
            </button>
          </div>
        </form>
      ) : (
        /* STAGES SEQUENCING TAB */
        <div className="space-y-6">
          {/* Add custom stage */}
          <div className="rounded-xl border border-white/5 bg-slate-900/60 p-4 flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Custom Stage Name (e.g. System Design Interview)..."
              value={newStageName}
              onChange={e => setNewStageName(e.target.value)}
              className="flex-1 min-w-[200px] rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Pass Mark:</span>
              <input
                type="number"
                min={0}
                max={100}
                value={newStagePassMark}
                onChange={e => setNewStagePassMark(parseInt(e.target.value))}
                className="w-16 rounded-lg border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-white focus:outline-none text-center"
              />
            </div>
            <button
              onClick={handleAddCustomStage}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition"
            >
              ➕ Add Stage
            </button>
          </div>

          {/* Stages List */}
          <div className="space-y-3">
            {stages.map((stage, index) => (
              <div
                key={stage.stage_number}
                className={`rounded-xl border p-4 transition ${
                  stage.enabled ? 'border-white/10 bg-slate-900/40' : 'border-white/5 bg-slate-900/10 opacity-40'
                }`}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  {/* Left: Move & Enable Switches */}
                  <div className="flex items-center gap-3">
                    {/* Move buttons */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveStage(index, 'up')}
                        disabled={index === 0}
                        className="text-[10px] text-slate-500 hover:text-white disabled:opacity-30"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveStage(index, 'down')}
                        disabled={index === stages.length - 1}
                        className="text-[10px] text-slate-500 hover:text-white disabled:opacity-30"
                      >
                        ▼
                      </button>
                    </div>

                    {/* Enable toggle */}
                    <button
                      onClick={() => toggleStageEnabled(index)}
                      className={`rounded px-2.5 py-1 text-[10px] font-black uppercase ${
                        stage.enabled ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {stage.enabled ? 'Enabled' : 'Disabled'}
                    </button>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500">#{stage.stage_number}</span>
                        <span className="text-sm font-bold text-white">{stage.stage_name}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Score/Threshold config inputs */}
                  {stage.enabled && (
                    <div className="flex items-center gap-4 flex-wrap text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">Pass Mark:</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={stage.pass_mark}
                          onChange={e => updateStageField(index, 'pass_mark', parseFloat(e.target.value))}
                          className="w-14 rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-center text-white focus:outline-none"
                        />
                        <span className="text-slate-500">%</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">AI Min Conf:</span>
                        <input
                          type="number"
                          min={0.0}
                          max={1.0}
                          step={0.05}
                          value={stage.ai_confidence_threshold}
                          onChange={e => updateStageField(index, 'ai_confidence_threshold', parseFloat(e.target.value))}
                          className="w-16 rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-center text-white focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`approval-${stage.stage_number}`}
                          checked={stage.require_human_approval}
                          onChange={e => updateStageField(index, 'require_human_approval', e.target.checked)}
                          className="rounded border-white/10 bg-slate-950 text-violet-600 focus:ring-0"
                        />
                        <label htmlFor={`approval-${stage.stage_number}`} className="text-slate-400 cursor-pointer">Human Approval</label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Notifications setup */}
                {stage.enabled && (
                  <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
                    <span className="text-slate-500 font-medium">Notification Channels:</span>
                    {['email', 'whatsapp', 'sms', 'in_app'].map(channel => (
                      <div key={channel} className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          id={`notif-${stage.stage_number}-${channel}`}
                          checked={stage.notifications[channel as keyof typeof stage.notifications] || false}
                          onChange={() => updateStageNotification(index, channel as any)}
                          className="rounded border-white/10 bg-slate-950 text-violet-600 focus:ring-0"
                        />
                        <label htmlFor={`notif-${stage.stage_number}-${channel}`} className="text-slate-400 uppercase text-[10px] cursor-pointer">
                          {channel.replace('_', ' ')}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveStages}
              className="rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition"
              disabled={saving}
            >
              {saving ? 'Saving...' : '✓ Save Pipeline Configuration'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
