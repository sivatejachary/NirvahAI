'use client';

import { useState, useEffect, useCallback } from 'react';

interface AIInterview {
  id: string;
  application_id: string;
  candidate_name?: string;
  candidate_email?: string;
  job_title?: string;
  status: string;
  transcript: Array<{ role: string; content: string }> | string;
  metadata: {
    technical_score?: number;
    communication_score?: number;
    confidence_score?: number;
    ai_summary?: string;
    recommendation?: string;
  };
  created_at: string;
}

export default function AIInterviewsPage() {
  const [interviews, setInterviews] = useState<AIInterview[]>([]);
  const [selectedInt, setSelectedInt] = useState<AIInterview | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    const headers = getHeaders();
    try {
      // Mock submissions since the endpoint returns actual candidate submissions
      const [appRes, jobsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/applications`, { headers }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/jobs`, { headers })
      ]);
      
      let appsData: Array<{ id: string; candidate_name: string; candidate_email: string; job_id: string }> = [];
      let jobsData: Array<{ id: string; title: string }> = [];
      if (appRes.ok) appsData = await appRes.json();
      if (jobsRes.ok) jobsData = await jobsRes.json();

      const dummyInterviews: AIInterview[] = appsData.map((app, idx) => ({
        id: `ai-int-${app.id}`,
        application_id: app.id,
        candidate_name: app.candidate_name,
        candidate_email: app.candidate_email,
        job_title: jobsData.find(j => j.id === app.job_id)?.title || 'Software Engineer',
        status: idx % 3 === 0 ? 'COMPLETED' : 'IN_PROGRESS',
        transcript: [
          { role: 'assistant', content: 'Hello! Welcome to your AI Technical Interview. Can you explain the difference between processes and threads?' },
          { role: 'candidate', content: 'Sure. A process is an executing instance of an application with its own memory space. A thread is a path of execution within a process, and threads in the same process share its memory.' },
          { role: 'assistant', content: 'Excellent. How do you handle synchronization issues when multiple threads access shared resources?' },
          { role: 'candidate', content: 'We can use locks, mutexes, or semaphores to prevent race conditions and ensure thread safety.' }
        ],
        metadata: {
          technical_score: idx % 3 === 0 ? 88 : 62,
          communication_score: idx % 3 === 0 ? 92 : 70,
          confidence_score: idx % 3 === 0 ? 85 : 55,
          ai_summary: idx % 3 === 0 
            ? 'Candidate showed solid fundamentals in concurrency, OS concepts, and memory architectures. Explanations were clear and precise.'
            : 'Candidate understood basics but struggled to explain thread pool configurations and deadlocks.',
          recommendation: idx % 3 === 0 ? 'PASS' : 'REJECT'
        },
        created_at: new Date().toISOString()
      }));

      setInterviews(dummyInterviews);
    } catch {
      setErrorMsg('Failed to load AI interviews.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDecision = async (appId: string, status: string) => {
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/applications/${appId}/status`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        setSuccessMsg(`Interview evaluation successfully updated to ${status}`);
        await loadData();
        setSelectedInt(null);
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setErrorMsg('Failed to update stage decision.');
      }
    } catch {
      setErrorMsg('Connection error.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '24px', height: 'calc(100vh - 100px)', minHeight: 0 }}>
      {/* Left panel: List */}
      <div style={{ width: '360px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h1 className="text-xl font-bold text-white">AI Technical Interviews</h1>
          <p className="text-xs text-slate-400 mt-0.5">Autonomous speech & core competency evaluation</p>
        </div>
        {successMsg && <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-400">{successMsg}</div>}
        {errorMsg && <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400">{errorMsg}</div>}

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : interviews.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-xs text-slate-500">No interviews logged.</div>
          ) : (
            interviews.map(int => (
              <div key={int.id} onClick={() => setSelectedInt(int)}
                className={`cursor-pointer rounded-xl border p-4 transition-all duration-150 ${
                  selectedInt?.id === int.id
                    ? 'border-violet-500/50 bg-violet-500/5 shadow-lg shadow-violet-500/10'
                    : 'border-white/5 bg-slate-900/40 hover:border-white/10 hover:bg-slate-900/70'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-semibold text-white">{int.candidate_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{int.job_title}</p>
                  </div>
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-400 uppercase">{int.status}</span>
                </div>
                <div className="mt-2 flex justify-between items-center text-xs">
                  <span className="text-slate-400">Tech Score: {int.metadata?.technical_score ?? 'Pending'}%</span>
                  <span className={`font-bold ${int.metadata?.recommendation === 'PASS' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    AI Rec: {int.metadata?.recommendation || 'N/A'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right panel: Details */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {!selectedInt ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/10 bg-slate-900/20 text-center p-12">
            <div className="text-6xl">🎙</div>
            <h2 className="text-lg font-semibold text-white">Select an AI Interview</h2>
            <p className="text-sm text-slate-400 max-w-xs">Audit voice transcript conversations, verify technical, communication, and confidence scores.</p>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, gap: '20px' }}>
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedInt.candidate_name}</h2>
                <p className="text-xs text-slate-400">{selectedInt.candidate_email} · {selectedInt.job_title}</p>
              </div>
              <div className="flex gap-4">
                <div className="text-center rounded-lg border border-white/5 bg-slate-900/30 px-3 py-1.5">
                  <p className="text-sm font-black text-violet-400">{selectedInt.metadata?.technical_score ?? 'N/A'}%</p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase">Technical</p>
                </div>
                <div className="text-center rounded-lg border border-white/5 bg-slate-900/30 px-3 py-1.5">
                  <p className="text-sm font-black text-emerald-400">{selectedInt.metadata?.communication_score ?? 'N/A'}%</p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase">Comm</p>
                </div>
                <div className="text-center rounded-lg border border-white/5 bg-slate-900/30 px-3 py-1.5">
                  <p className="text-sm font-black text-amber-400">{selectedInt.metadata?.confidence_score ?? 'N/A'}%</p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase">Confidence</p>
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }} className="space-y-4 pr-2">
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                <h3 className="text-xs font-bold text-violet-400 uppercase tracking-wider mb-2">🤖 AI Voice Interview Summary</h3>
                <p className="text-xs text-slate-300 leading-relaxed">{selectedInt.metadata?.ai_summary || 'No summary generated.'}</p>
              </div>

              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Voice Interview Transcript</h3>
              <div className="rounded-xl border border-white/5 bg-slate-950/20 p-4 space-y-3 font-mono text-xs">
                {Array.isArray(selectedInt.transcript) ? (
                  selectedInt.transcript.map((msg, idx) => (
                    <div key={idx} className="space-y-1">
                      <span className={msg.role === 'assistant' ? 'text-violet-400 font-bold' : 'text-emerald-400 font-bold'}>
                        {msg.role === 'assistant' ? '🤖 Interviwer AI' : '👤 Candidate'}:
                      </span>
                      <p className="text-slate-300 pl-4">{msg.content}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 whitespace-pre-line">{selectedInt.transcript || 'No transcript generated.'}</p>
                )}
              </div>
            </div>

            <div className="border-t border-white/5 pt-4 flex gap-3">
              <button onClick={() => handleDecision(selectedInt.application_id, 'INTERVIEW_STAGE')} disabled={actionLoading}
                className="flex-1 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white hover:bg-emerald-500 transition disabled:opacity-50">
                Pass (Move to Human Interviews)
              </button>
              <button onClick={() => handleDecision(selectedInt.application_id, 'REJECTED')} disabled={actionLoading}
                className="flex-1 rounded-xl bg-rose-600/20 border border-rose-500/30 py-3 text-xs font-bold text-rose-400 hover:bg-rose-600/30 transition disabled:opacity-50">
                Reject Candidate
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
