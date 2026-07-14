'use client';

import { useState, useEffect, useRef } from 'react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatSession {
  id: string;
  employee_id?: string;
  employee_name: string;
  employee_email: string;
  channel: string; // CHAT | VOICE
  topic?: string;
  messages: ChatMessage[];
  status: string; // OPEN | RESOLVED
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  open: '#10b981',
  resolved: '#94a3b8',
};

export default function HRChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formChannel, setFormChannel] = useState('CHAT');
  const [formTopic, setFormTopic] = useState('Leave Query');

  const loadData = () => {
    setLoading(true);
    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}` };

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/hr-chat/sessions`, { headers })
      .then(r => r.ok ? r.json() : [])
      .then(data => setSessions(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadSessionDetails = (id: string) => {
    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}` };

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/hr-chat/sessions/${id}`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setSelectedSession(data);
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (selectedSessionId) {
      loadSessionDetails(selectedSessionId);
    } else {
      setSelectedSession(null);
    }
  }, [selectedSessionId]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/hr-chat/sessions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          employee_name: formName,
          employee_email: formEmail,
          channel: formChannel,
          topic: formTopic,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setShowModal(false);
        setFormName('');
        setFormEmail('');
        loadData();
        setSelectedSessionId(data.id);
      }
    } catch {}
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedSessionId) return;

    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const text = newMessage;
    setNewMessage('');

    // Optimistic UI updates
    const localNow = new Date().toISOString();
    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: localNow };
    
    if (selectedSession) {
      setSelectedSession({
        ...selectedSession,
        messages: [...selectedSession.messages, userMsg],
      });
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/hr-chat/sessions/${selectedSessionId}/message`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content: text }),
      });

      if (res.ok) {
        loadSessionDetails(selectedSessionId);
        loadData(); // update previews
      }
    } catch {}
  };

  const handleResolveSession = async () => {
    if (!selectedSessionId) return;
    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/hr-chat/sessions/${selectedSessionId}/resolve`, {
        method: 'PATCH',
        headers,
      });

      if (res.ok) {
        loadSessionDetails(selectedSessionId);
        loadData();
      }
    } catch {}
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Employee HR Chat</h1>
          <p>Real-time AI chatbot for leaves, payroll, benefits, and policy queries</p>
        </div>
        <div className="page-header-right">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            💬 New Chat Session
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, height: 'calc(100vh - 180px)', minHeight: 480 }}>
        {/* Left Sessions Panel */}
        <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', fontWeight: 600 }}>Active Sessions</div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" style={{ margin: 'auto' }} /></div>
            ) : sessions.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>No sessions found.</div>
            ) : (
              sessions.map(s => (
                <div
                  key={s.id}
                  style={{
                    padding: 16, borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer',
                    background: selectedSessionId === s.id ? 'rgba(124,58,237,0.1)' : 'transparent',
                    borderLeft: selectedSessionId === s.id ? '3px solid var(--color-accent-500)' : 'none',
                  }}
                  onClick={() => setSelectedSessionId(s.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{s.employee_name}</div>
                    <span className="badge" style={{
                      background: `${STATUS_COLORS[s.status.toLowerCase()]}20`,
                      color: STATUS_COLORS[s.status.toLowerCase()],
                      fontSize: 9, fontWeight: 700, padding: '2px 6px'
                    }}>{s.status}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                    {s.channel === 'CHAT' ? '💬 Chat' : '🎙️ Voice'} · {s.topic || 'General'}
                  </div>
                  {s.messages && s.messages.length > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.messages[s.messages.length - 1].content}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Active Chat Area */}
        <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          {selectedSession ? (
            <>
              {/* Chat Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{selectedSession.employee_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{selectedSession.employee_email} · Topic: {selectedSession.topic}</div>
                </div>
                {selectedSession.status === 'OPEN' && (
                  <button className="btn btn-sm btn-ghost" style={{ borderColor: 'var(--border-subtle)' }} onClick={handleResolveSession}>
                    ✓ Resolve Session
                  </button>
                )}
              </div>

              {/* Chat Messages */}
              <div style={{ flex: 1, padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {selectedSession.messages && selectedSession.messages.length > 0 ? (
                  selectedSession.messages.map((msg, idx) => {
                    const isUser = msg.role === 'user';
                    return (
                      <div key={idx} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                          <div style={{
                            padding: '12px 16px', borderRadius: 16, fontSize: 13, lineHeight: 1.5,
                            background: isUser ? 'linear-gradient(135deg, var(--color-accent-600), var(--color-accent-500))' : 'var(--bg-surface)',
                            border: isUser ? 'none' : '1px solid var(--border-subtle)',
                            color: '#fff',
                            borderBottomRightRadius: isUser ? 2 : 16,
                            borderBottomLeftRadius: isUser ? 16 : 2,
                          }}>
                            {msg.content}
                          </div>
                          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
                    <div>Session opened. Send a message to start.</div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input */}
              {selectedSession.status === 'OPEN' ? (
                <form onSubmit={handleSendMessage} style={{ padding: 20, borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', display: 'flex', gap: 12 }}>
                  <input
                    type="text" required
                    style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '12px 16px', color: '#fff', fontSize: 13 }}
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="Type your message here..."
                  />
                  <button type="submit" className="btn btn-primary" style={{ padding: '0 24px' }}>Send</button>
                </form>
              ) : (
                <div style={{ padding: 16, textAlign: 'center', background: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', fontSize: 12, fontStyle: 'italic' }}>
                  This session is resolved and closed.
                </div>
              )}
            </>
          ) : (
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
              <p style={{ fontWeight: 600 }}>Select a session</p>
              <p style={{ fontSize: 13 }}>Choose a chat session from the list to view history and respond.</p>
            </div>
          )}
        </div>
      </div>

      {/* New Session Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ background: 'var(--bg-card)', padding: 32, width: '90%', maxWidth: 480, borderRadius: 'var(--radius-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>New Chat Session</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateSession} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                  <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Channel</label>
                  <select
                    style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14 }}
                    value={formChannel}
                    onChange={e => setFormChannel(e.target.value)}
                  >
                    <option value="CHAT">💬 Chatbot</option>
                    <option value="VOICE">🎙️ Voice Bot</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Inquiry Topic</label>
                  <select
                    style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14 }}
                    value={formTopic}
                    onChange={e => setFormTopic(e.target.value)}
                  >
                    <option value="Leave Query">Leave Policy</option>
                    <option value="Payroll & Salary">Payroll & Salary</option>
                    <option value="Benefits & Medical">Benefits & Insurance</option>
                    <option value="Company Policy">General Policy</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }}>
                Open Chat session
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
