'use client';

import { useState, useEffect } from 'react';

interface PerformanceReview {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_email: string;
  review_period: string;
  reviewer_name: string;
  goals: Record<string, any>;
  ratings: Record<string, number>;
  overall_score?: number;
  summary?: string;
  status: string; // DRAFT | SUBMITTED | APPROVED
}

interface PerformanceGoal {
  id: string;
  employee_id: string;
  employee_name: string;
  title: string;
  description?: string;
  due_date?: string;
  progress: number; // 0-100
  status: string; // ACTIVE | COMPLETED | CANCELLED
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#f59e0b',
  submitted: '#6366f1',
  approved: '#10b981',
  active: '#6366f1',
  completed: '#10b981',
  cancelled: '#ef4444',
};

export default function PerformancePage() {
  const [activeTab, setActiveTab] = useState<'REVIEWS' | 'GOALS'>('REVIEWS');
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [goals, setGoals] = useState<PerformanceGoal[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selected Details
  const [selectedReview, setSelectedReview] = useState<PerformanceReview | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [goalProgress, setGoalProgress] = useState(0);

  // Modals
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);

  // Review Form
  const [revName, setRevName] = useState('');
  const [revEmail, setRevEmail] = useState('');
  const [revPeriod, setRevPeriod] = useState('FY 2026 Q1');
  const [revReviewer, setRevReviewer] = useState('');

  // Goal Form
  const [goalName, setGoalName] = useState('');
  const [goalEmail, setGoalEmail] = useState('');
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDesc, setGoalDesc] = useState('');
  const [goalDate, setGoalDate] = useState('');

  // Ratings sliders states
  const [techRating, setTechRating] = useState(3);
  const [commRating, setCommRating] = useState(3);
  const [leadRating, setLeadRating] = useState(3);
  const [teamRating, setTeamRating] = useState(3);
  const [summaryText, setSummaryText] = useState('');

  const loadData = () => {
    setLoading(true);
    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/performance/reviews`, { headers }),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/performance/goals`, { headers }),
    ]).then(async ([revRes, goalRes]) => {
      const revData = revRes.ok ? await revRes.json() : [];
      const goalData = goalRes.ok ? await goalRes.json() : [];
      setReviews(revData);
      setGoals(goalData);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedReview) {
      setTechRating(selectedReview.ratings?.technical || 3);
      setCommRating(selectedReview.ratings?.communication || 3);
      setLeadRating(selectedReview.ratings?.leadership || 3);
      setTeamRating(selectedReview.ratings?.teamwork || 3);
      setSummaryText(selectedReview.summary || '');
    }
  }, [selectedReview]);

  const handleCreateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/performance/reviews`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          employee_name: revName,
          employee_email: revEmail,
          review_period: revPeriod,
          reviewer_name: revReviewer,
        }),
      });

      if (res.ok) {
        setShowReviewModal(false);
        setRevName('');
        setRevEmail('');
        setRevReviewer('');
        loadData();
      }
    } catch {}
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/performance/goals`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          employee_name: goalName,
          employee_email: goalEmail,
          title: goalTitle,
          description: goalDesc || null,
          due_date: goalDate ? new Date(goalDate).toISOString() : null,
        }),
      });

      if (res.ok) {
        setShowGoalModal(false);
        setGoalName('');
        setGoalEmail('');
        setGoalTitle('');
        setGoalDesc('');
        setGoalDate('');
        loadData();
      }
    } catch {}
  };

  const handleUpdateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReview) return;
    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const score = (techRating + commRating + leadRating + teamRating) / 4;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/performance/reviews/${selectedReview.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          ratings: { technical: techRating, communication: commRating, leadership: leadRating, teamwork: teamRating },
          summary: summaryText,
          overall_score: score,
          status: 'SUBMITTED',
        }),
      });

      if (res.ok) {
        setSelectedReview(null);
        loadData();
      }
    } catch {}
  };

  const handleUpdateGoalProgress = async (goalId: string) => {
    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/performance/goals/${goalId}/progress`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ progress: goalProgress }),
      });

      if (res.ok) {
        setSelectedGoalId(null);
        loadData();
      }
    } catch {}
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Performance Management</h1>
          <p>Establish employee goals, conduct reviews, and monitor organizational talent development</p>
        </div>
        <div className="page-header-right">
          <div style={{ display: 'flex', gap: 12 }}>
            <button 
              className={`btn btn-sm ${activeTab === 'REVIEWS' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => { setActiveTab('REVIEWS'); setSelectedGoalId(null); }}
            >
              📝 Reviews
            </button>
            <button 
              className={`btn btn-sm ${activeTab === 'GOALS' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => { setActiveTab('GOALS'); setSelectedReview(null); }}
            >
              🎯 Goals
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'REVIEWS' ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
            <button className="btn btn-primary" onClick={() => setShowReviewModal(true)}>
              ➕ Initiate Review Cycle
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: selectedReview ? '1fr 400px' : '1fr', gap: 24 }}>
            {/* List Reviews */}
            <div className="card">
              {loading ? (
                <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner" style={{ margin: 'auto', width: 28, height: 28 }} /></div>
              ) : reviews.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
                  <p style={{ fontWeight: 600 }}>No review cycles active</p>
                  <p style={{ fontSize: 13 }}>Click "Initiate Review Cycle" to start evaluations.</p>
                </div>
              ) : (
                reviews.map(r => (
                  <div
                    key={r.id}
                    className="list-item"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px',
                      borderBottom: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      background: selectedReview?.id === r.id ? 'rgba(124,58,237,0.1)' : 'transparent',
                    }}
                    onClick={() => setSelectedReview(selectedReview?.id === r.id ? null : r)}
                  >
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                      background: 'var(--color-primary-900)', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', color: 'var(--color-primary-300)', fontWeight: 700, fontSize: 16,
                    }}>
                      {r.employee_name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>{r.employee_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        Period: {r.review_period} · Evaluator: {r.reviewer_name}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="badge" style={{
                        background: `${STATUS_COLORS[r.status.toLowerCase()]}20`,
                        color: STATUS_COLORS[r.status.toLowerCase()],
                        border: `1px solid ${STATUS_COLORS[r.status.toLowerCase()]}40`,
                        fontWeight: 700, textTransform: 'uppercase', fontSize: 10,
                      }}>
                        {r.status}
                      </span>
                      {r.overall_score !== undefined && (
                        <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600, marginTop: 4 }}>
                          ★ {r.overall_score.toFixed(1)} / 5
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Edit Review Side Panel */}
            {selectedReview && (
              <div className="card" style={{ padding: 24, alignSelf: 'start', position: 'sticky', top: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h3 style={{ margin: 0 }}>Review Evaluation</h3>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelectedReview(null)}>✕</button>
                </div>
                
                <div style={{ fontWeight: 700, fontSize: 16 }}>{selectedReview.employee_name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>{selectedReview.employee_email}</div>

                {selectedReview.status === 'DRAFT' ? (
                  <form onSubmit={handleUpdateReview} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {[
                      { label: 'Technical Skills', val: techRating, set: setTechRating },
                      { label: 'Communication', val: commRating, set: setCommRating },
                      { label: 'Leadership', val: leadRating, set: setLeadRating },
                      { label: 'Teamwork', val: teamRating, set: setTeamRating },
                    ].map((rating, idx) => (
                      <div key={idx}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                          <span>{rating.label}</span>
                          <span style={{ fontWeight: 700 }}>{rating.val} / 5</span>
                        </div>
                        <input
                          type="range" min="1" max="5" step="1"
                          style={{ width: '100%', accentColor: 'var(--color-accent-500)' }}
                          value={rating.val}
                          onChange={e => rating.set(parseInt(e.target.value))}
                        />
                      </div>
                    ))}
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Review Summary</label>
                      <textarea
                        style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 13, boxSizing: 'border-box' }}
                        rows={4} required
                        value={summaryText}
                        onChange={e => setSummaryText(e.target.value)}
                        placeholder="Detail performance highlights, achievements, and feedback..."
                      />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                      Submit Evaluation
                    </button>
                  </form>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: 12, borderRadius: 8, fontSize: 13 }}>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>Final Ratings</div>
                      {Object.entries(selectedReview.ratings || {}).map(([cat, score]) => (
                        <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                          <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{cat}</span>
                          <span style={{ fontWeight: 600 }}>{score} / 5</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Summary Feed</div>
                      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: 12, borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        "{selectedReview.summary || 'No feedback details.'}"
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
            <button className="btn btn-primary" onClick={() => setShowGoalModal(true)}>
              ➕ Set Employee Goal
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: selectedGoalId ? '1fr 380px' : '1fr', gap: 24 }}>
            {/* List Goals */}
            <div className="card">
              {loading ? (
                <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner" style={{ margin: 'auto', width: 28, height: 28 }} /></div>
              ) : goals.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
                  <p style={{ fontWeight: 600 }}>No goals registered</p>
                  <p style={{ fontSize: 13 }}>Click "Set Employee Goal" to track growth goals.</p>
                </div>
              ) : (
                goals.map(goal => (
                  <div
                    key={goal.id}
                    className="list-item"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px',
                      borderBottom: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      background: selectedGoalId === goal.id ? 'rgba(124,58,237,0.1)' : 'transparent',
                    }}
                    onClick={() => { setSelectedGoalId(selectedGoalId === goal.id ? null : goal.id); setGoalProgress(goal.progress); }}
                  >
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                      background: 'var(--color-primary-900)', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', color: 'var(--color-primary-300)', fontWeight: 700, fontSize: 16,
                    }}>
                      {goal.employee_name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>{goal.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        Assignee: {goal.employee_name} · Due: {goal.due_date ? new Date(goal.due_date).toLocaleDateString() : 'No Limit'}
                      </div>
                      {/* Progress Bar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${goal.progress}%`, height: '100%', background: 'var(--color-accent-500)' }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{goal.progress}%</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', marginLeft: 16 }}>
                      <span className="badge" style={{
                        background: `${STATUS_COLORS[goal.status.toLowerCase()]}20`,
                        color: STATUS_COLORS[goal.status.toLowerCase()],
                        border: `1px solid ${STATUS_COLORS[goal.status.toLowerCase()]}40`,
                        fontWeight: 700, textTransform: 'uppercase', fontSize: 10,
                      }}>
                        {goal.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Goal details */}
            {selectedGoalId && (
              <div className="card" style={{ padding: 24, alignSelf: 'start', position: 'sticky', top: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h3 style={{ margin: 0 }}>Goal Progress</h3>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelectedGoalId(null)}>✕</button>
                </div>
                
                {(() => {
                  const goal = goals.find(g => g.id === selectedGoalId);
                  if (!goal) return null;
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{goal.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Assignee: {goal.employee_name}</div>
                      </div>
                      {goal.description && (
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'var(--bg-surface)', padding: 10, borderRadius: 6 }}>
                          {goal.description}
                        </div>
                      )}
                      
                      {goal.status === 'ACTIVE' && (
                        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                            <span>Adjust Progress</span>
                            <span style={{ fontWeight: 700 }}>{goalProgress}%</span>
                          </div>
                          <input
                            type="range" min="0" max="100" step="5"
                            style={{ width: '100%', accentColor: 'var(--color-accent-500)', marginBottom: 16 }}
                            value={goalProgress}
                            onChange={e => setGoalProgress(parseInt(e.target.value))}
                          />
                          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => handleUpdateGoalProgress(goal.id)}>
                            Update Progress
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </>
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ background: 'var(--bg-card)', padding: 32, width: '90%', maxWidth: 480, borderRadius: 'var(--radius-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>Initiate Performance Review</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowReviewModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateReview} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Employee Name</label>
                <input
                  type="text" required
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
                  value={revName}
                  onChange={e => setRevName(e.target.value)}
                  placeholder="e.g. Liam Parker"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Employee Email</label>
                <input
                  type="email" required
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
                  value={revEmail}
                  onChange={e => setRevEmail(e.target.value)}
                  placeholder="liam.p@company.com"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Review Period</label>
                  <input
                    type="text" required
                    style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
                    value={revPeriod}
                    onChange={e => setRevPeriod(e.target.value)}
                    placeholder="Q1 2026"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Reviewer Name</label>
                  <input
                    type="text" required
                    style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
                    value={revReviewer}
                    onChange={e => setRevReviewer(e.target.value)}
                    placeholder="Reviewer Name"
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }}>
                Create Review Record
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Goal Modal */}
      {showGoalModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ background: 'var(--bg-card)', padding: 32, width: '90%', maxWidth: 480, borderRadius: 'var(--radius-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>Set Employee Goal</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowGoalModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateGoal} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Employee Name</label>
                <input
                  type="text" required
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
                  value={goalName}
                  onChange={e => setGoalName(e.target.value)}
                  placeholder="e.g. Liam Parker"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Employee Email</label>
                <input
                  type="email" required
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
                  value={goalEmail}
                  onChange={e => setGoalEmail(e.target.value)}
                  placeholder="liam.p@company.com"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Goal Title</label>
                <input
                  type="text" required
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
                  value={goalTitle}
                  onChange={e => setGoalTitle(e.target.value)}
                  placeholder="e.g. Close 5 client leads"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Description</label>
                <textarea
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
                  rows={3}
                  value={goalDesc}
                  onChange={e => setGoalDesc(e.target.value)}
                  placeholder="Detail goal conditions and expectations..."
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Target Completion Date</label>
                <input
                  type="date" required
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14 }}
                  value={goalDate}
                  onChange={e => setGoalDate(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }}>
                Confirm Goal
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
