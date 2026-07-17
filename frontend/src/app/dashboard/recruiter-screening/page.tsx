'use client';

import { useState, useEffect, useCallback } from 'react';

interface RecruiterCall {
  id: string;
  application_id: string;
  candidate_name: string;
  candidate_email: string;
  job_title: string;
  status: string;
  transcript: Array<{ role: string; content: string }> | string;
  metadata: {
    communication_score?: number;
    confidence_score?: number;
    eligibility_score?: number;
    expected_salary?: string;
    notice_period?: string;
    joining_availability?: string;
  };
  created_at: string;
}

export default function RecruiterScreeningPage() {
  const [calls, setCalls] = useState<RecruiterCall[]>([]);
  const [selectedCall, setSelectedCall] = useState<RecruiterCall | null>(null);
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/public_calls`, { headers });
      if (res.ok) {
        const data = await res.json();
        setCalls(data);
      } else {
        setErrorMsg('Failed to load recruiter screening calls.');
      }
    } catch {
      setErrorMsg('Connection error.');
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
        setSuccessMsg(`Screening marked as ${status}`);
        await loadData();
        setSelectedCall(null);
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
      {/* Left panel: list of calls */}
      <div style={{ width: '360px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h1 className="text-xl font-bold text-white">Recruiter Screening Calls</h1>
          <p className="text-xs text-slate-400 mt-0.5">Voice calls & candidate profile verification</p>
        </div>
        {successMsg && <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-400">{successMsg}</div>}
        {errorMsg && <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400">{errorMsg}</div>}

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : calls.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-xs text-slate-500">No screen calls recorded.</div>
          ) : (
            calls.map(call => (
              <div key={call.id} onClick={() => setSelectedCall(call)}
                className={`cursor-pointer rounded-xl border p-4 transition-all duration-150 ${
                  selectedCall?.id === call.id
                    ? 'border-violet-500/50 bg-violet-500/5 shadow-lg shadow-violet-500/10'
                    : 'border-white/5 bg-slate-900/40 hover:border-white/10 hover:bg-slate-900/70'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-semibold text-white">{call.candidate_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{call.job_title}</p>
                  </div>
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-400 uppercase">{call.status}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right panel: Details & transcripts */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {!selectedCall ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/10 bg-slate-900/20 text-center p-12">
            <div className="text-6xl">📞</div>
            <h2 className="text-lg font-semibold text-white">Select a Screening Log</h2>
            <p className="text-sm text-slate-400 max-w-xs">Listen, view transcripts, eligibility metrics and verify expectations.</p>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, gap: '20px' }}>
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedCall.candidate_name}</h2>
                <p className="text-xs text-slate-400">{selectedCall.candidate_email} · {selectedCall.job_title}</p>
              </div>
              <div className="flex gap-4">
                <div className="text-center rounded-lg border border-white/5 bg-slate-900/30 px-3 py-1.5">
                  <p className="text-sm font-black text-violet-400">{selectedCall.metadata?.communication_score ?? 'N/A'}/100</p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase">Comm</p>
                </div>
                <div className="text-center rounded-lg border border-white/5 bg-slate-900/30 px-3 py-1.5">
                  <p className="text-sm font-black text-emerald-400">{selectedCall.metadata?.confidence_score ?? 'N/A'}/100</p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase">Confidence</p>
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }} className="space-y-4 pr-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Candidate Expectations</h3>
              <div className="grid grid-cols-3 gap-4 rounded-xl border border-white/5 bg-slate-950/40 p-4">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase">Expected Salary</p>
                  <p className="text-sm font-semibold text-white">{selectedCall.metadata?.expected_salary || 'Negotiable'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase">Notice Period</p>
                  <p className="text-sm font-semibold text-white">{selectedCall.metadata?.notice_period || 'Immediate'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase">Joining Availability</p>
                  <p className="text-sm font-semibold text-white">{selectedCall.metadata?.joining_availability || 'Immediate'}</p>
                </div>
              </div>

              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Call Transcript</h3>
              <div className="rounded-xl border border-white/5 bg-slate-950/20 p-4 space-y-3 font-mono text-xs">
                {Array.isArray(selectedCall.transcript) ? (
                  selectedCall.transcript.map((msg, idx) => (
                    <div key={idx} className="space-y-1">
                      <span className={msg.role === 'assistant' ? 'text-violet-400 font-bold' : 'text-emerald-400 font-bold'}>
                        {msg.role === 'assistant' ? '🤖 Recruiter AI' : '👤 Candidate'}:
                      </span>
                      <p className="text-slate-300 pl-4">{msg.content}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 whitespace-pre-line">{selectedCall.transcript || 'No transcript generated.'}</p>
                )}
              </div>
            </div>

            <div className="border-t border-white/5 pt-4 flex gap-3">
              <button onClick={() => handleDecision(selectedCall.application_id, 'MCQ_STAGE')} disabled={actionLoading}
                className="flex-1 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white hover:bg-emerald-500 transition disabled:opacity-50">
                Pass Screening
              </button>
              <button onClick={() => handleDecision(selectedCall.application_id, 'REJECTED')} disabled={actionLoading}
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
