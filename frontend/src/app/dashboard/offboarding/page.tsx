'use client';

import { useState, useEffect } from 'react';

interface OffboardingPlan {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_email: string;
  last_day: string;
  reason: string;  // RESIGNATION | TERMINATION | RETIREMENT | CONTRACT_END
  exit_interview_done: boolean;
  exit_feedback?: string;
  status: string;
  total_tasks: number;
  completed_tasks: number;
}

interface OffboardingTask {
  id: string;
  plan_id: string;
  task_name: string;
  category: string;  // IT | FINANCE | HR | KNOWLEDGE | ASSETS
  status: string;    // PENDING | DONE
  completed_at?: string;
  notes?: string;
}

const STATUS_COLORS: Record<string, string> = {
  initiated: '#f59e0b',
  in_progress: '#6366f1',
  complete: '#10b981',
  done: '#10b981',
  pending: '#f59e0b',
};

export default function OffboardingPage() {
  const [plans, setPlans] = useState<OffboardingPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedPlanDetails, setSelectedPlanDetails] = useState<{ plan: OffboardingPlan; tasks: OffboardingTask[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formReason, setFormReason] = useState('RESIGNATION');

  // Exit Interview Feedback
  const [exitFeedback, setExitFeedback] = useState('');

  const loadData = () => {
    setLoading(true);
    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}` };

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/offboarding/plans`, { headers })
      .then(r => r.ok ? r.json() : [])
      .then(data => setPlans(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadPlanDetails = (id: string) => {
    setDetailLoading(true);
    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}` };

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/offboarding/plans/${id}`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(data => setSelectedPlanDetails(data))
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  };

  useEffect(() => {
    if (selectedPlanId) {
      loadPlanDetails(selectedPlanId);
    } else {
      setSelectedPlanDetails(null);
    }
  }, [selectedPlanId]);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/offboarding/plans`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          employee_name: formName,
          employee_email: formEmail,
          last_day: formDate ? new Date(formDate).toISOString() : null,
          reason: formReason,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        setFormName('');
        setFormEmail('');
        setFormDate('');
        loadData();
      }
    } catch {}
  };

  const handleCompleteTask = async (taskId: string) => {
    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/offboarding/tasks/${taskId}/complete`, {
        method: 'PATCH',
        headers,
      });

      if (res.ok && selectedPlanId) {
        loadPlanDetails(selectedPlanId);
        loadData(); // update lists counts
      }
    } catch {}
  };

  const handleSubmitExitInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId) return;
    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/offboarding/${selectedPlanId}/exit-interview`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ feedback: exitFeedback }),
      });

      if (res.ok) {
        setExitFeedback('');
        loadPlanDetails(selectedPlanId);
        loadData();
      }
    } catch {}
  };

  // Group tasks by category
  const groupedTasks = selectedPlanDetails?.tasks.reduce((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {} as Record<string, OffboardingTask[]>) || {};

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Offboarding</h1>
          <p>Coordinate exit operations, system deprivileging, asset collections, and final payouts</p>
        </div>
        <div className="page-header-right">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            🚪 Initiate Offboarding
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedPlanId ? '1fr 440px' : '1fr', gap: 24 }}>
        {/* List */}
        <div className="card">
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner" style={{ margin: 'auto', width: 28, height: 28 }} /></div>
          ) : plans.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🚪</div>
              <p style={{ fontWeight: 600 }}>No offboarding processes active</p>
              <p style={{ fontSize: 13 }}>Click "Initiate Offboarding" to schedule employee departures.</p>
            </div>
          ) : (
            plans.map(p => {
              const progress = p.total_tasks > 0 ? Math.round((p.completed_tasks / p.total_tasks) * 100) : 0;
              return (
                <div
                  key={p.id}
                  className="list-item"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px',
                    borderBottom: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    background: selectedPlanId === p.id ? 'rgba(124,58,237,0.1)' : 'transparent',
                  }}
                  onClick={() => setSelectedPlanId(selectedPlanId === p.id ? null : p.id)}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--color-primary-900)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: 'var(--color-primary-300)', fontWeight: 700, fontSize: 16,
                  }}>
                    {p.employee_name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{p.employee_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      Reason: {p.reason} · Interview: {p.exit_interview_done ? '✅ Complete' : '⚠️ Pending'}
                    </div>
                    {/* Progress Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${progress}%`, height: '100%', background: 'var(--color-accent-500)' }} />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{progress}% ({p.completed_tasks}/{p.total_tasks})</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', marginLeft: 16 }}>
                    <span className="badge" style={{
                      background: `${STATUS_COLORS[p.status.toLowerCase()]}20`,
                      color: STATUS_COLORS[p.status.toLowerCase()],
                      border: `1px solid ${STATUS_COLORS[p.status.toLowerCase()]}40`,
                      fontWeight: 700, textTransform: 'uppercase', fontSize: 10,
                    }}>
                      {p.status}
                    </span>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                      Last Day: {p.last_day ? new Date(p.last_day).toLocaleDateString() : 'TBD'}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Details Panel */}
        {selectedPlanId && selectedPlanDetails && (
          <div className="card" style={{ padding: 24, alignSelf: 'start', position: 'sticky', top: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>Offboarding Plan</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedPlanId(null)}>✕</button>
            </div>
            
            {detailLoading ? (
              <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" style={{ margin: 'auto' }} /></div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%', background: 'var(--color-primary-900)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700
                  }}>
                    {selectedPlanDetails.plan.employee_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{selectedPlanDetails.plan.employee_name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{selectedPlanDetails.plan.employee_email}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>Last Day</span>
                    <span style={{ fontWeight: 600 }}>{selectedPlanDetails.plan.last_day ? new Date(selectedPlanDetails.plan.last_day).toLocaleDateString() : 'TBD'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>Reason</span>
                    <span style={{ fontWeight: 600 }}>{selectedPlanDetails.plan.reason}</span>
                  </div>
                </div>

                {/* Exit Interview section */}
                <div style={{ marginBottom: 20, padding: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Exit Interview</div>
                  {selectedPlanDetails.plan.exit_interview_done ? (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                      "{selectedPlanDetails.plan.exit_feedback || 'No feedback recorded.'}"
                    </div>
                  ) : (
                    <form onSubmit={handleSubmitExitInterview} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <textarea
                        style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: 8, color: '#fff', fontSize: 12, boxSizing: 'border-box' }}
                        rows={2} required
                        value={exitFeedback}
                        onChange={e => setExitFeedback(e.target.value)}
                        placeholder="Provide feedback on the exit interview topics..."
                      />
                      <button type="submit" className="btn btn-sm btn-primary">Save Feedback</button>
                    </form>
                  )}
                </div>

                {/* Task categories */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 220, overflowY: 'auto' }}>
                  {Object.entries(groupedTasks).map(([category, tasks]) => (
                    <div key={category}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                        {category} ({tasks.filter(t => t.status === 'DONE').length}/{tasks.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {tasks.map(task => (
                          <div 
                            key={task.id} 
                            style={{ 
                              display: 'flex', alignItems: 'flex-start', gap: 10, padding: 8, 
                              background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8 
                            }}
                          >
                            <input
                              type="checkbox"
                              style={{ marginTop: 2, cursor: task.status === 'DONE' ? 'default' : 'pointer' }}
                              checked={task.status === 'DONE'}
                              disabled={task.status === 'DONE'}
                              onChange={() => handleCompleteTask(task.id)}
                            />
                            <div style={{ flex: 1, fontSize: 12, textDecoration: task.status === 'DONE' ? 'line-through' : 'none', color: task.status === 'DONE' ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
                              {task.task_name}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Add Plan Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ background: 'var(--bg-card)', padding: 32, width: '90%', maxWidth: 480, borderRadius: 'var(--radius-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>Initiate Departure Plan</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreatePlan} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Employee Name</label>
                <input
                  type="text" required
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. Liam Parker"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Employee Email</label>
                <input
                  type="email" required
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                  placeholder="liam.p@company.com"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Last Day</label>
                  <input
                    type="date" required
                    style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14 }}
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Reason</label>
                  <select
                    style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14 }}
                    value={formReason}
                    onChange={e => setFormReason(e.target.value)}
                  >
                    <option value="RESIGNATION">Resignation</option>
                    <option value="TERMINATION">Termination</option>
                    <option value="RETIREMENT">Retirement</option>
                    <option value="CONTRACT_END">Contract End</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }}>
                Confirm Offboarding
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
