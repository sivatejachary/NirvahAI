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
      <div style={{ width: '200px', flexShrink: 0, borderRight: '1px solid var(--border-subtle)', paddingRight: '16px', display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto' }}>
        <h3 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', paddingLeft: 8 }}>Hiring Workflow</h3>
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
            className={`btn ${activeSubTab === t.id ? 'btn-primary' : 'btn-ghost'}`}
            style={{ textAlign: 'left', width: '100%', justifyContent: 'flex-start', padding: '8px 12px', fontSize: '12.5px' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Right content panel */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }} className="space-y-4">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{activeSubTab.replace('_', ' ')} Options</h2>
          {activeSubTab === 'stages' && (
            <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm">
              {saving ? 'Saving...' : '💾 Save Stages'}
            </button>
          )}
        </div>

        {successMsg && <div className="alert alert-success" style={{ marginBottom: 16 }}>{successMsg}</div>}
        {errorMsg && <div className="alert alert-error" style={{ marginBottom: 16 }}>{errorMsg}</div>}

        {activeSubTab === 'stages' ? (
          <div>
            {loading ? (
              <div style={{ display: 'flex', height: 120, alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner" style={{ width: 24, height: 24 }} />
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 60, textAlign: 'center' }}>Stage</th>
                      <th>Stage Name</th>
                      <th style={{ textAlign: 'center' }}>Enabled</th>
                      <th style={{ textAlign: 'center' }}>AI Autopilot</th>
                      <th style={{ textAlign: 'center' }}>Passing Mark (%)</th>
                      <th style={{ textAlign: 'center' }}>Auto Shortlist</th>
                      <th style={{ textAlign: 'center' }}>Approval Required</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stages.map(s => (
                      <tr key={s.stage_number} style={{ opacity: !s.enabled ? 0.45 : 1 }}>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-tertiary)' }}>#{s.stage_number}</td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.stage_name}</td>
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox" checked={s.enabled} onChange={() => toggleField(s.stage_number, 'enabled')} style={{ cursor: 'pointer' }} />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox" checked={s.ai_enabled} disabled={!s.enabled} onChange={() => toggleField(s.stage_number, 'ai_enabled')} style={{ cursor: 'pointer' }} />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input type="number" min={0} max={100} value={s.pass_mark} disabled={!s.enabled}
                            onChange={e => updateNumeric(s.stage_number, 'pass_mark', parseInt(e.target.value) || 0)}
                            className="input" style={{ width: '60px', padding: '4px 6px', textAlign: 'center' }} />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox" checked={s.auto_shortlist} disabled={!s.enabled} onChange={() => toggleField(s.stage_number, 'auto_shortlist')} style={{ cursor: 'pointer' }} />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox" checked={s.require_human_approval} disabled={!s.enabled} onChange={() => toggleField(s.stage_number, 'require_human_approval')} style={{ cursor: 'pointer' }} />
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
          <div style={{ border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 48, textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚙️</div>
            <p style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Custom rules for {activeSubTab.replace('_', ' ')} will show here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
