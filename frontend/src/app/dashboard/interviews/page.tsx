'use client';

import { useState, useEffect } from 'react';

interface Interview {
  id: string;
  application_id: string;
  candidate_name?: string;
  job_title?: string;
  status: string;
  interview_type: string;
  ai_feedback?: string;
  created_at: string;
}

interface ManagerRound {
  id: string;
  application_id: string;
  round_type: string;
  interviewer_name: string;
  interviewer_email?: string;
  scheduled_at?: string;
  feedback?: string;
  rating?: number;
  decision: string;
  created_at: string;
}

interface Candidate {
  id: string;
  candidate_name: string;
  candidate_email: string;
  job_title?: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  active: '#6366f1',
  completed: '#10b981',
  abandoned: '#ef4444',
  pass: '#10b981',
  fail: '#ef4444',
  hold: '#f59e0b',
};

export default function InterviewsPage() {
  const [activeTab, setActiveTab] = useState<'AI' | 'MANAGER'>('AI');
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [managerRounds, setManagerRounds] = useState<ManagerRound[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [applications, setApplications] = useState<Record<string, { candidate_name: string; job_title?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Interview | null>(null);
  const [selectedRound, setSelectedRound] = useState<ManagerRound | null>(null);
  const [filter, setFilter] = useState('ALL');
  
  // Schedule Form State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [formAppId, setFormAppId] = useState('');
  const [formRoundType, setFormRoundType] = useState('HR');
  const [formInterviewerName, setFormInterviewerName] = useState('');
  const [formInterviewerEmail, setFormInterviewerEmail] = useState('');
  const [formScheduledAt, setFormScheduledAt] = useState('');

  // Grading Form State
  const [gradeDecision, setGradeDecision] = useState('PASS');
  const [gradeRating, setGradeRating] = useState(5);
  const [gradeFeedback, setGradeFeedback] = useState('');

  const loadData = () => {
    setLoading(true);
    const token = localStorage.getItem('access_token');
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/applications`, { headers }),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/jobs`, { headers }),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/selection/rounds`, { headers }),
    ]).then(async ([appRes, jobRes, selectionRes]) => {
      const apps = appRes.ok ? await appRes.json() : [];
      const jobs = jobRes.ok ? await jobRes.json() : [];
      const rounds = selectionRes.ok ? await selectionRes.json() : [];
      
      const appMap: Record<string, { candidate_name: string; job_title?: string }> = {};
      const candsList: Candidate[] = [];
      
      apps.forEach((a: any) => {
        const job = jobs.find((j: any) => j.id === a.job_id);
        appMap[a.id] = { candidate_name: a.candidate_name, job_title: job?.title };
        candsList.push({
          id: a.id,
          candidate_name: a.candidate_name,
          candidate_email: a.candidate_email,
          job_title: job?.title
        });
      });
      setApplications(appMap);
      setCandidates(candsList);
      setManagerRounds(rounds);

      // Derive AI interviews from applications
      const interviewApps = apps
        .filter((a: any) => a.status?.toLowerCase().includes('interview') || a.status?.toLowerCase().includes('mcq') || a.status?.toLowerCase().includes('coding'))
        .map((a: any) => ({
          id: `interview-${a.id}`,
          application_id: a.id,
          candidate_name: a.candidate_name,
          job_title: jobs.find((j: any) => j.id === a.job_id)?.title || 'Unknown',
          status: 'completed' as string, // Show as completed so they can view proctoring feedback
          interview_type: 'AI_ASYNC',
          ai_feedback: a.screening_feedback || 'AI screening completed successfully.',
          created_at: a.created_at || new Date().toISOString(),
        }));
      setInterviews(interviewApps);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/selection/schedule`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          application_id: formAppId,
          round_type: formRoundType,
          interviewer_name: formInterviewerName,
          interviewer_email: formInterviewerEmail || null,
          scheduled_at: formScheduledAt ? new Date(formScheduledAt).toISOString() : null,
        }),
      });
      
      if (res.ok) {
        setShowScheduleModal(false);
        setFormAppId('');
        setFormInterviewerName('');
        setFormInterviewerEmail('');
        setFormScheduledAt('');
        loadData();
      }
    } catch {}
  };

  const handleGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRound) return;
    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/selection/${selectedRound.id}/decision`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          decision: gradeDecision,
          rating: gradeRating,
          feedback: gradeFeedback,
        }),
      });
      
      if (res.ok) {
        setSelectedRound(null);
        setGradeFeedback('');
        loadData();
      }
    } catch {}
  };

  const filtered = filter === 'ALL' ? interviews : interviews.filter(i => i.status === filter.toLowerCase());

  const counts = {
    ALL: interviews.length,
    PENDING: interviews.filter(i => i.status === 'pending').length,
    ACTIVE: interviews.filter(i => i.status === 'active').length,
    COMPLETED: interviews.filter(i => i.status === 'completed').length,
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Interviews</h1>
          <p>Monitor AI sessions and coordinate manager/HR evaluation rounds</p>
        </div>
        <div className="page-header-right">
          <div style={{ display: 'flex', gap: 12 }}>
            <button 
              className={`btn btn-sm ${activeTab === 'AI' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => { setActiveTab('AI'); setSelectedRound(null); }}
            >
              🤖 AI Interviews
            </button>
            <button 
              className={`btn btn-sm ${activeTab === 'MANAGER' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => { setActiveTab('MANAGER'); setSelected(null); }}
            >
              👥 Manager Rounds
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'AI' ? (
        <>
          {/* AI Filter tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            {(['ALL', 'PENDING', 'ACTIVE', 'COMPLETED'] as const).map(f => (
              <button
                key={f}
                className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setFilter(f)}
              >
                {f} <span className="badge badge-secondary" style={{ marginLeft: 6 }}>{counts[f]}</span>
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 24 }}>
            <div className="card">
              {loading ? (
                <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner" style={{ margin: 'auto', width: 28, height: 28 }} /></div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🎥</div>
                  <p style={{ fontWeight: 600 }}>No AI interviews yet</p>
                  <p style={{ fontSize: 13 }}>AI interviews are triggered automatically in the candidate lifecycle.</p>
                </div>
              ) : (
                filtered.map(iv => (
                  <div
                    key={iv.id}
                    className="list-item"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px',
                      borderBottom: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      background: selected?.id === iv.id ? 'rgba(124,58,237,0.1)' : 'transparent',
                    }}
                    onClick={() => setSelected(selected?.id === iv.id ? null : iv)}
                  >
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                      background: 'var(--color-primary-900)', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', color: 'var(--color-primary-300)', fontWeight: 700, fontSize: 16,
                    }}>
                      {iv.candidate_name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>{iv.candidate_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{iv.job_title}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="badge" style={{
                        background: `${STATUS_COLORS[iv.status]}20`,
                        color: STATUS_COLORS[iv.status],
                        border: `1px solid ${STATUS_COLORS[iv.status]}40`,
                        fontWeight: 600, textTransform: 'capitalize',
                      }}>
                        {iv.status}
                      </span>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{iv.interview_type}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {selected && (
              <div className="card" style={{ padding: 24, alignSelf: 'start', position: 'sticky', top: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h3 style={{ margin: 0 }}>AI evaluation</h3>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>✕</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: '50%', background: 'var(--color-primary-900)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--color-primary-300)', fontWeight: 700, fontSize: 20,
                  }}>
                    {selected.candidate_name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{selected.candidate_name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{selected.job_title}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { label: 'Status', value: selected.status },
                    { label: 'Type', value: selected.interview_type },
                    { label: 'Created', value: new Date(selected.created_at).toLocaleDateString() },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>{label}</span>
                      <span style={{ fontWeight: 600, fontSize: 13, textTransform: 'capitalize' }}>{value}</span>
                    </div>
                  ))}
                </div>
                {selected.ai_feedback && (
                  <div style={{ marginTop: 20 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>AI Screening Feedback</div>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 12, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {selected.ai_feedback}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Manager Rounds Action Header */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
            <button className="btn btn-primary" onClick={() => setShowScheduleModal(true)}>
              🗓️ Schedule Manager Round
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: selectedRound ? '1fr 380px' : '1fr', gap: 24 }}>
            <div className="card">
              {loading ? (
                <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner" style={{ margin: 'auto', width: 28, height: 28 }} /></div>
              ) : managerRounds.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
                  <p style={{ fontWeight: 600 }}>No manager rounds scheduled</p>
                  <p style={{ fontSize: 13 }}>Click "Schedule Manager Round" to create one.</p>
                </div>
              ) : (
                managerRounds.map(round => {
                  const details = applications[round.application_id];
                  return (
                    <div
                      key={round.id}
                      className="list-item"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px',
                        borderBottom: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        background: selectedRound?.id === round.id ? 'rgba(124,58,237,0.1)' : 'transparent',
                      }}
                      onClick={() => setSelectedRound(selectedRound?.id === round.id ? null : round)}
                    >
                      <div style={{
                        width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                        background: 'var(--color-primary-900)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', color: 'var(--color-primary-300)', fontWeight: 700, fontSize: 16,
                      }}>
                        {details?.candidate_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, marginBottom: 2 }}>{details?.candidate_name || 'Loading Name...'}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {round.round_type} Round · Interviewer: {round.interviewer_name}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className="badge" style={{
                          background: `${STATUS_COLORS[round.decision.toLowerCase()]}20`,
                          color: STATUS_COLORS[round.decision.toLowerCase()],
                          border: `1px solid ${STATUS_COLORS[round.decision.toLowerCase()]}40`,
                          fontWeight: 700, textTransform: 'uppercase', fontSize: 10,
                        }}>
                          {round.decision}
                        </span>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                          {round.scheduled_at ? new Date(round.scheduled_at).toLocaleDateString() : 'Unsched'}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {selectedRound && (
              <div className="card" style={{ padding: 24, alignSelf: 'start', position: 'sticky', top: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h3 style={{ margin: 0 }}>Review Evaluation</h3>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelectedRound(null)}>✕</button>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Round Type</span>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{selectedRound.round_type}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Interviewer</span>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{selectedRound.interviewer_name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Decision</span>
                    <span style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', color: STATUS_COLORS[selectedRound.decision.toLowerCase()] }}>
                      {selectedRound.decision}
                    </span>
                  </div>
                  {selectedRound.rating && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Score</span>
                      <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: 13 }}>
                        {'⭐'.repeat(selectedRound.rating)}
                      </span>
                    </div>
                  )}
                </div>

                {selectedRound.decision === 'PENDING' ? (
                  <form onSubmit={handleGrade} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Rating</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            type="button"
                            key={star}
                            onClick={() => setGradeRating(star)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: star <= gradeRating ? '#f59e0b' : 'var(--text-tertiary)' }}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Feedback / Summary</label>
                      <textarea
                        style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 13, boxSizing: 'border-box' }}
                        rows={4}
                        required
                        value={gradeFeedback}
                        onChange={e => setGradeFeedback(e.target.value)}
                        placeholder="Key observations from this round..."
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Decision</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                        <button
                          type="button"
                          className={`btn btn-sm ${gradeDecision === 'PASS' ? 'btn-primary' : 'btn-ghost'}`}
                          style={{ background: gradeDecision === 'PASS' ? '#10b981' : undefined, color: gradeDecision === 'PASS' ? '#fff' : undefined }}
                          onClick={() => setGradeDecision('PASS')}
                        >
                          Pass
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm ${gradeDecision === 'HOLD' ? 'btn-primary' : 'btn-ghost'}`}
                          style={{ background: gradeDecision === 'HOLD' ? '#f59e0b' : undefined, color: gradeDecision === 'HOLD' ? '#fff' : undefined }}
                          onClick={() => setGradeDecision('HOLD')}
                        >
                          Hold
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm ${gradeDecision === 'FAIL' ? 'btn-primary' : 'btn-ghost'}`}
                          style={{ background: gradeDecision === 'FAIL' ? '#ef4444' : undefined, color: gradeDecision === 'FAIL' ? '#fff' : undefined }}
                          onClick={() => setGradeDecision('FAIL')}
                        >
                          Fail
                        </button>
                      </div>
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }}>
                      Submit Evaluation
                    </button>
                  </form>
                ) : (
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>Interviewer Feedback</div>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 12, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {selectedRound.feedback || 'No feedback recorded.'}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ background: 'var(--bg-card)', padding: 32, width: '90%', maxWidth: 480, borderRadius: 'var(--radius-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>Schedule Interview</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowScheduleModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSchedule} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Candidate</label>
                <select
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14 }}
                  required
                  value={formAppId}
                  onChange={e => setFormAppId(e.target.value)}
                >
                  <option value="">Select Candidate...</option>
                  {candidates.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.candidate_name} ({c.job_title || 'Unknown Role'})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Round Type</label>
                <select
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14 }}
                  required
                  value={formRoundType}
                  onChange={e => setFormRoundType(e.target.value)}
                >
                  <option value="HR">HR Round</option>
                  <option value="MANAGER">Manager Round</option>
                  <option value="PANEL">Panel Interview</option>
                  <option value="TECHNICAL">Technical Round</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Interviewer Name</label>
                <input
                  type="text"
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
                  required
                  value={formInterviewerName}
                  onChange={e => setFormInterviewerName(e.target.value)}
                  placeholder="e.g. Sarah Jenkins"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Interviewer Email (Optional)</label>
                <input
                  type="email"
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
                  value={formInterviewerEmail}
                  onChange={e => setFormInterviewerEmail(e.target.value)}
                  placeholder="sarah.j@company.com"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Date & Time</label>
                <input
                  type="datetime-local"
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14 }}
                  value={formScheduledAt}
                  onChange={e => setFormScheduledAt(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }}>
                Confirm Schedule
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
