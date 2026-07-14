'use client';

import { useState, useEffect } from 'react';

interface Meeting {
  id: string;
  title: string;
  meeting_date: string;
  duration_minutes?: number;
  attendees: string[];
  transcript?: string;
  summary?: string;
  action_items: { item: string; owner: string; due: string }[];
  status: string; // PENDING_SUMMARY | SUMMARIZED
}

const STATUS_COLORS: Record<string, string> = {
  pending_summary: '#f59e0b',
  summarized: '#10b981',
};

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selected, setSelected] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [summarizing, setSummarizing] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formDuration, setFormDuration] = useState('');
  const [formAttendees, setFormAttendees] = useState('');
  const [formTranscript, setFormTranscript] = useState('');

  const loadData = () => {
    setLoading(true);
    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}` };

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/meetings`, { headers })
      .then(r => r.ok ? r.json() : [])
      .then(data => setMeetings(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/meetings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: formTitle,
          meeting_date: formDate ? new Date(formDate).toISOString() : new Date().toISOString(),
          duration_minutes: formDuration ? parseInt(formDuration) : null,
          attendees: formAttendees ? formAttendees.split(',').map(email => email.trim()) : [],
          transcript: formTranscript || null,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        setFormTitle('');
        setFormDate('');
        setFormDuration('');
        setFormAttendees('');
        setFormTranscript('');
        loadData();
      }
    } catch {}
  };

  const handleSummarize = async (meetingId: string) => {
    setSummarizing(true);
    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/meetings/${meetingId}/summarize`, {
        method: 'POST',
        headers,
      });

      if (res.ok) {
        const updated = await res.json();
        setSelected(updated);
        loadData();
      }
    } catch {} finally {
      setSummarizing(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Meeting Intelligence</h1>
          <p>Extract AI-powered summaries, transcripts, action items, and timelines from company sessions</p>
        </div>
        <div className="page-header-right">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            ➕ Record Meeting
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 420px' : '1fr', gap: 24 }}>
        {/* List */}
        <div className="card">
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner" style={{ margin: 'auto', width: 28, height: 28 }} /></div>
          ) : meetings.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎙️</div>
              <p style={{ fontWeight: 600 }}>No meetings logged</p>
              <p style={{ fontSize: 13 }}>Click "Record Meeting" to log a meeting and generate summaries.</p>
            </div>
          ) : (
            meetings.map(m => (
              <div
                key={m.id}
                className="list-item"
                style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px',
                  borderBottom: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  background: selected?.id === m.id ? 'rgba(124,58,237,0.1)' : 'transparent',
                }}
                onClick={() => setSelected(selected?.id === m.id ? null : m)}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--color-primary-900)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: 'var(--color-primary-300)', fontWeight: 700, fontSize: 16,
                }}>
                  👥
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{m.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Attendees: {m.attendees?.length || 0} · Duration: {m.duration_minutes || 'Unknown'} mins
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="badge" style={{
                    background: `${STATUS_COLORS[m.status.toLowerCase()]}20`,
                    color: STATUS_COLORS[m.status.toLowerCase()],
                    border: `1px solid ${STATUS_COLORS[m.status.toLowerCase()]}40`,
                    fontWeight: 700, textTransform: 'uppercase', fontSize: 10,
                  }}>
                    {m.status.replace('_', ' ')}
                  </span>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                    {m.meeting_date ? new Date(m.meeting_date).toLocaleDateString() : 'TBD'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Details Panel */}
        {selected && (
          <div className="card" style={{ padding: 24, alignSelf: 'start', position: 'sticky', top: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>Meeting Logs</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>✕</button>
            </div>
            
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{selected.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>
              {selected.duration_minutes} mins · Attendees: {selected.attendees?.join(', ')}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {selected.status === 'PENDING_SUMMARY' ? (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>Transcript Log</div>
                  <div style={{ 
                    maxHeight: 140, overflowY: 'auto', background: 'var(--bg-surface)', 
                    border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12, fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: 16
                  }}>
                    {selected.transcript || 'No transcript logs loaded.'}
                  </div>
                  <button 
                    className="btn btn-primary" style={{ width: '100%' }}
                    onClick={() => handleSummarize(selected.id)}
                    disabled={summarizing || !selected.transcript}
                  >
                    {summarizing ? 'Analyzing...' : '✨ Summarize with AI'}
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Summary</div>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: 12, borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {selected.summary}
                    </div>
                  </div>
                  {selected.action_items && selected.action_items.length > 0 && (
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Action Items</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {selected.action_items.map((item, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: 8, padding: 10, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 12 }}>
                            <span style={{ color: 'var(--color-accent-500)', fontWeight: 700 }}>{idx + 1}.</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.item}</div>
                              <div style={{ color: 'var(--text-tertiary)', marginTop: 2 }}>Owner: {item.owner} · Due: {item.due}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Record Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ background: 'var(--bg-card)', padding: 32, width: '90%', maxWidth: 480, borderRadius: 'var(--radius-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>Log Meeting</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateMeeting} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Meeting Title</label>
                <input
                  type="text" required
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="e.g. Weekly Sync"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Date & Time</label>
                  <input
                    type="datetime-local" required
                    style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14 }}
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Duration (minutes)</label>
                  <input
                    type="number" required
                    style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
                    value={formDuration}
                    onChange={e => setFormDuration(e.target.value)}
                    placeholder="30"
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Attendees (comma-separated emails)</label>
                <input
                  type="text" required
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
                  value={formAttendees}
                  onChange={e => setFormAttendees(e.target.value)}
                  placeholder="liam@co.com, sarah@co.com"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Transcript text</label>
                <textarea
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
                  rows={4}
                  value={formTranscript}
                  onChange={e => setFormTranscript(e.target.value)}
                  placeholder="Paste meeting transcript log here..."
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }}>
                Save Meeting
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
