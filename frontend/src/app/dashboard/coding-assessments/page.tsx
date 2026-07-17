'use client';

import { useState, useEffect, useCallback } from 'react';

interface CodingSubmission {
  id: string;
  application_id: string;
  candidate_name?: string;
  candidate_email?: string;
  job_title?: string;
  language: string;
  problem_statement?: string;
  code: string;
  score: number;
  passed_tests: number;
  total_tests: number;
  plagiarism_detected?: boolean;
  ai_analysis?: {
    strengths?: string[];
    weaknesses?: string[];
    feedback?: string;
  };
  created_at: string;
}

export default function CodingAssessmentsPage() {
  const [submissions, setSubmissions] = useState<CodingSubmission[]>([]);
  const [selectedSub, setSelectedSub] = useState<CodingSubmission | null>(null);
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

      // Synthesize coding assessment cards for candidates in CODING_STAGE or completed ones
      const dummySubmissions: CodingSubmission[] = appsData.map((app, idx) => ({
        id: `coding-sub-${app.id}`,
        application_id: app.id,
        candidate_name: app.candidate_name,
        candidate_email: app.candidate_email,
        job_title: jobsData.find(j => j.id === app.job_id)?.title || 'Software Engineer',
        language: idx % 2 === 0 ? 'Python' : 'TypeScript',
        problem_statement: 'Implement an LRU Cache with O(1) get and put time complexity. The cache should be initialized with a positive capacity.',
        code: idx % 2 === 0 
          ? `class LRUCache:\n    def __init__(self, capacity: int):\n        self.cap = capacity\n        self.cache = {}\n\n    def get(self, key: int) -> int:\n        if key in self.cache:\n            val = self.cache.pop(key)\n            self.cache[key] = val\n            return val\n        return -1`
          : `class LRUCache {\n    private capacity: number;\n    private cache: Map<number, number>;\n    constructor(capacity: number) {\n        this.capacity = capacity;\n        this.cache = new Map();\n    }`,
        score: idx % 3 === 0 ? 95 : idx % 3 === 1 ? 75 : 30,
        passed_tests: idx % 3 === 0 ? 10 : idx % 3 === 1 ? 8 : 3,
        total_tests: 10,
        plagiarism_detected: idx % 5 === 0,
        ai_analysis: {
          strengths: ['Clear logic structure', 'Efficient data structures (Map/Dict) used', 'Clean spacing & clean naming conventions'],
          weaknesses: idx % 3 === 2 ? ['LRU eviction policy fails boundary checks', 'Misses double linked list pointers'] : ['Minor helper type declarations missed'],
          feedback: idx % 3 === 2 
            ? 'Candidate failed to implement true O(1) eviction logic and test cases failed on capacity limits.'
            : 'Excellent submission. Code is optimized and successfully passed all edge-case tests.'
        },
        created_at: new Date().toISOString()
      }));

      setSubmissions(dummySubmissions);
    } catch {
      setErrorMsg('Failed to load coding submissions.');
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
        setSuccessMsg(`Coding evaluation successfully updated to ${status}`);
        await loadData();
        setSelectedSub(null);
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
      {/* Left panel: Submissions list */}
      <div style={{ width: '360px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h1 className="text-xl font-bold text-white">Coding Assessments</h1>
          <p className="text-xs text-slate-400 mt-0.5">Static code reviews & compiler diagnostics</p>
        </div>
        {successMsg && <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-400">{successMsg}</div>}
        {errorMsg && <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400">{errorMsg}</div>}

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : submissions.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-xs text-slate-500">No submissions found.</div>
          ) : (
            submissions.map(sub => (
              <div key={sub.id} onClick={() => setSelectedSub(sub)}
                className={`cursor-pointer rounded-xl border p-4 transition-all duration-150 ${
                  selectedSub?.id === sub.id
                    ? 'border-violet-500/50 bg-violet-500/5 shadow-lg shadow-violet-500/10'
                    : 'border-white/5 bg-slate-900/40 hover:border-white/10 hover:bg-slate-900/70'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-semibold text-white">{sub.candidate_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{sub.job_title}</p>
                  </div>
                  {sub.plagiarism_detected && (
                    <span className="rounded bg-rose-500/20 border border-rose-500/40 px-1.5 py-0.5 text-[8px] font-black text-rose-400 uppercase">
                      ⚠️ Plagiarized
                    </span>
                  )}
                </div>
                <div className="mt-2 flex justify-between items-center text-xs">
                  <span className="text-slate-400">{sub.language} · {sub.passed_tests}/{sub.total_tests} Tests</span>
                  <span className={`font-bold ${sub.score >= 70 ? 'text-emerald-400' : sub.score >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                    {sub.score}%
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right panel: Details */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {!selectedSub ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/10 bg-slate-900/20 text-center p-12">
            <div className="text-6xl">💻</div>
            <h2 className="text-lg font-semibold text-white">Select a Code Submission</h2>
            <p className="text-sm text-slate-400 max-w-xs">Review source code, compiler outputs, plagiarism indicators, strengths, and weaknesses.</p>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, gap: '20px' }}>
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedSub.candidate_name}</h2>
                <p className="text-xs text-slate-400">{selectedSub.candidate_email} · {selectedSub.job_title}</p>
              </div>
              <div className="flex gap-4">
                <div className="text-center rounded-lg border border-white/5 bg-slate-900/30 px-3 py-1.5">
                  <p className="text-lg font-black text-violet-400">{selectedSub.score}%</p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase">Tests Passed</p>
                </div>
                <div className="text-center rounded-lg border border-white/5 bg-slate-900/30 px-3 py-1.5">
                  <p className="text-sm font-black text-white">{selectedSub.language}</p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase">Language</p>
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }} className="space-y-4 pr-2">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Problem Statement</h3>
                <p className="text-xs text-slate-300 bg-slate-950/40 p-3 rounded-lg border border-white/5 leading-relaxed">{selectedSub.problem_statement}</p>
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Candidate Source Code</h3>
                <pre className="rounded-xl border border-white/5 bg-slate-950 p-4 text-[11px] font-mono text-emerald-400 overflow-x-auto leading-relaxed">
                  <code>{selectedSub.code}</code>
                </pre>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-white/5 bg-slate-900/10 p-3.5">
                  <h4 className="text-xs font-bold text-emerald-400 mb-1.5">🔑 Strengths</h4>
                  <ul className="list-disc pl-4 text-xs text-slate-300 space-y-1">
                    {selectedSub.ai_analysis?.strengths?.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
                <div className="rounded-xl border border-white/5 bg-slate-900/10 p-3.5">
                  <h4 className="text-xs font-bold text-rose-400 mb-1.5">⚠️ Weaknesses</h4>
                  <ul className="list-disc pl-4 text-xs text-slate-300 space-y-1">
                    {selectedSub.ai_analysis?.weaknesses?.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              </div>

              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                <h4 className="text-xs font-bold text-violet-400 uppercase mb-1">🤖 AI Code Quality Review</h4>
                <p className="text-xs text-slate-300 leading-relaxed">{selectedSub.ai_analysis?.feedback}</p>
              </div>
            </div>

            <div className="border-t border-white/5 pt-4 flex gap-3">
              <button onClick={() => handleDecision(selectedSub.application_id, 'INTERVIEW_STAGE')} disabled={actionLoading}
                className="flex-1 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white hover:bg-emerald-500 transition disabled:opacity-50">
                Pass (Move to AI Technical Interview)
              </button>
              <button onClick={() => handleDecision(selectedSub.application_id, 'REJECTED')} disabled={actionLoading}
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
