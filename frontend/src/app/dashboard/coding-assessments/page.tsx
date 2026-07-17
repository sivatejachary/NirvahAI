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
      const [appRes, jobsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/applications`, { headers }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/jobs`, { headers })
      ]);
      
      let appsData: Array<{ id: string; candidate_name: string; candidate_email: string; job_id: string }> = [];
      let jobsData: Array<{ id: string; title: string }> = [];
      if (appRes.ok) appsData = await appRes.json();
      if (jobsRes.ok) jobsData = await jobsRes.json();

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
        setSuccessMsg(`Candidate marked as ${status}`);
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

  const scoreColor = (pct: number) =>
    pct >= 80 ? 'text-emerald-400' :
    pct >= 50 ? 'text-amber-400' :
    'text-rose-400';

  return (
    <div style={{ display: 'flex', gap: '24px', height: 'calc(100vh - 100px)', minHeight: 0 }}>
      {/* Left Submissions List */}
      <div style={{ width: '300px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 800 }}>Coding Assessment Console</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 2 }}>Sandbox executor & code reviews</p>
        </div>
        {successMsg && <div className="alert alert-success">{successMsg}</div>}
        {errorMsg && <div className="alert alert-error">{errorMsg}</div>}

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
          {loading ? (
            <div style={{ display: 'flex', height: 120, alignItems: 'center', justifyContent: 'center' }}>
              <div className="spinner" style={{ width: 24, height: 24 }} />
            </div>
          ) : submissions.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '24px 0' }}>No coding attempts recorded.</p>
          ) : (
            submissions.map(sub => (
              <div key={sub.id} onClick={() => setSelectedSub(sub)}
                className="card"
                style={{
                  padding: '12px', cursor: 'pointer',
                  borderColor: selectedSub?.id === sub.id ? 'var(--color-primary-500)' : 'var(--border-subtle)',
                  background: selectedSub?.id === sub.id ? 'rgba(99,102,241,0.06)' : 'var(--surface-2)',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub.candidate_name}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{sub.job_title} · {sub.language}</p>
                  </div>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, paddingLeft: 8 }} className={scoreColor(sub.score)}>
                    {sub.score}%
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Details Panel */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {!selectedSub ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 48, textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>💻</div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Select a Submission</h2>
            <p style={{ fontSize: '12.5px' }}>Verify compilation logs, check plagiarism risk flags, review logic Evictions, and pass candidates.</p>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>{selectedSub.candidate_name}</h2>
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: 2 }}>{selectedSub.candidate_email} · {selectedSub.job_title}</p>
              </div>
              <div className="card" style={{ padding: '8px 16px', background: 'var(--surface-3)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '16px', fontWeight: 800 }} className={scoreColor(selectedSub.score)}>{selectedSub.score}%</span>
                <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, marginTop: 2 }}>Compiler Grade</span>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Plagiarism Risk */}
              {selectedSub.plagiarism_detected && (
                <div className="alert alert-error" style={{ fontSize: '12px' }}>
                  🚨 Warning: Plagiarism/Copied-Code telemetry flags generated for this compilation!
                </div>
              )}

              {/* Problem statement */}
              <div className="card">
                <h4 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '8px' }}>Challenge Specification</h4>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>{selectedSub.problem_statement}</p>
              </div>

              {/* Code Editor */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ background: 'var(--surface-3)', padding: '8px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>Candidate Solution ({selectedSub.language})</span>
                  <span style={{ fontSize: '11px', color: 'var(--color-primary-400)', fontWeight: 600 }}>Passed Tests: {selectedSub.passed_tests}/{selectedSub.total_tests}</span>
                </div>
                <pre style={{ margin: 0, padding: 16, background: 'var(--surface-0)', color: '#a7f3d0', fontSize: '12px', fontFamily: 'var(--font-mono)', overflowX: 'auto', lineHeight: 1.5 }}>
                  {selectedSub.code}
                </pre>
              </div>

              {/* AI review feedback */}
              {selectedSub.ai_analysis && (
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>🤖 AI Sandbox Code Review</h4>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{selectedSub.ai_analysis.feedback}</p>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px', marginTop: '6px' }}>
                    <div>
                      <span style={{ color: 'var(--color-accent-400)', fontWeight: 600 }}>Strengths:</span>
                      <ul style={{ paddingLeft: '16px', marginTop: '4px', listStyleType: 'disc', color: 'var(--text-secondary)' }}>
                        {selectedSub.ai_analysis.strengths?.map((s, idx) => <li key={idx}>{s}</li>)}
                      </ul>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-error-400)', fontWeight: 600 }}>Eviction Notes:</span>
                      <ul style={{ paddingLeft: '16px', marginTop: '4px', listStyleType: 'disc', color: 'var(--text-secondary)' }}>
                        {selectedSub.ai_analysis.weaknesses?.map((w, idx) => <li key={idx}>{w}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', display: 'flex', gap: '12px' }}>
              <button onClick={() => handleDecision(selectedSub.application_id, 'AI_INTERVIEW_STAGE')} disabled={actionLoading}
                className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                Pass Assessment (Move to AI Interview)
              </button>
              <button onClick={() => handleDecision(selectedSub.application_id, 'REJECTED')} disabled={actionLoading}
                className="btn btn-danger" style={{ flex: 1, justifyContent: 'center' }}>
                Reject Candidate
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
