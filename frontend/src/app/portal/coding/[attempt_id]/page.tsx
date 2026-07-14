'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';

interface Challenge {
  id: string;
  title: string;
  description: string;
  starter_code: Record<string, string>;
  test_cases: Array<{ input: string; hidden: boolean }>;
}

export default function CandidateCodingWorkspacePage() {
  const router = useRouter();
  const params = useParams();
  const attemptId = params.attempt_id as string;

  const [tenantSlug, setTenantSlug] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Sandbox states
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [activeChallengeIndex, setActiveChallengeIndex] = useState(0);
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState('');
  const [consoleOutput, setConsoleOutput] = useState('');
  const [runningDraft, setRunningDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Outcome stats
  const [testResults, setTestResults] = useState<any[]>([]);
  const [overallStatus, setOverallStatus] = useState('');
  const [finished, setFinished] = useState(false);

  // Proctor stats
  const [tabLossCount, setTabLossCount] = useState(0);

  // Telemetry log helper
  const logProctorEvent = useCallback(async (eventType: string, metadata = {}) => {
    if (!tenantSlug || !attemptId) return;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/public/assessments/attempts/${attemptId}/proctor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Slug': tenantSlug },
        body: JSON.stringify({
          event_type: eventType,
          metadata: {
            ...metadata,
            timestamp: new Date().toISOString(),
            screen_width: typeof window !== 'undefined' ? window.innerWidth : null,
            screen_height: typeof window !== 'undefined' ? window.innerHeight : null,
          }
        })
      });
    } catch (err) {
      console.warn('Failed to submit proctor log:', err);
    }
  }, [attemptId, tenantSlug]);

  // Load challenges
  const fetchChallenges = useCallback(async (slug: string) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/public/challenges/${attemptId}`, {
        headers: { 'X-Tenant-Slug': slug }
      });
      const data = await res.json();
      if (res.ok) {
        setChallenges(data);
        if (data.length > 0) {
          // Initialize with Python starter code
          const starter = data[0].starter_code;
          setCode(starter.python || '');
        } else {
          setErrorMsg('No coding challenges configured for this test stage.');
        }
      } else {
        setErrorMsg(data.detail || 'Failed to retrieve coding challenge details.');
      }
    } catch (err) {
      setErrorMsg('Failed to connect to assessment server.');
    } finally {
      setLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const slug = localStorage.getItem('tenant_slug') || '';
      setTenantSlug(slug);
      if (!slug) {
        setErrorMsg('Missing company context. Please start the attempt from the main transparency portal link.');
        setLoading(false);
        return;
      }
      fetchChallenges(slug);
    }
  }, [fetchChallenges]);

  // Update editor starter code on language change
  useEffect(() => {
    const activeChall = challenges[activeChallengeIndex];
    if (activeChall) {
      setCode(activeChall.starter_code[language] || '');
    }
  }, [language, activeChallengeIndex, challenges]);

  // Proctor listeners: blurs & pastes
  useEffect(() => {
    if (finished || loading || !attemptId) return;

    const handleBlur = () => {
      setTabLossCount(prev => {
        const next = prev + 1;
        logProctorEvent('TAB_FOCUS_LOST', { count: next });
        return next;
      });
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      logProctorEvent('PASTE_DETECTED');
      alert('Security Warning: Copy-Paste is disabled during code assessments. Telemetry logged to proctor board.');
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('paste', handlePaste);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('paste', handlePaste);
    };
  }, [finished, loading, attemptId, logProctorEvent]);

  // Run Draft against first testcase
  const handleRunDraft = async () => {
    const activeChall = challenges[activeChallengeIndex];
    if (!activeChall || !tenantSlug) return;
    setRunningDraft(true);
    setConsoleOutput('Executing sandbox run...');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/public/challenges/${attemptId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Slug': tenantSlug },
        body: JSON.stringify({
          challenge_id: activeChall.id,
          code,
          language,
          run_draft_only: true
        })
      });
      const data = await res.json();
      if (res.ok) {
        const tr = data.results[0];
        if (tr.passed) {
          setConsoleOutput(`✓ Test Case Passed\nInput: ${activeChall.test_cases[0]?.input || 'N/A'}\nExpected: ${tr.expected}\nGot: ${tr.got}`);
        } else {
          setConsoleOutput(`✗ Test Case Failed\nInput: ${activeChall.test_cases[0]?.input || 'N/A'}\nExpected: ${tr.expected}\nGot: ${tr.got}\nError: ${tr.error || 'None'}`);
        }
      } else {
        setConsoleOutput(data.detail || 'Execution compilation failed.');
      }
    } catch {
      setConsoleOutput('Connection error.');
    } finally {
      setRunningDraft(false);
    }
  };

  // Submit Final Solution
  const handleSubmitSolution = async () => {
    const activeChall = challenges[activeChallengeIndex];
    if (!activeChall || !tenantSlug) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/public/challenges/${attemptId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Slug': tenantSlug },
        body: JSON.stringify({
          challenge_id: activeChall.id,
          code,
          language,
          run_draft_only: false
        })
      });
      const data = await res.json();
      if (res.ok) {
        setOverallStatus(data.status);
        setTestResults(data.results);
        setFinished(true);
      } else {
        setErrorMsg(data.detail || 'Failed to submit solution.');
      }
    } catch {
      setErrorMsg('Connection error.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-100 flex flex-col font-sans">
      
      {/* Header Bar */}
      <header className="flex h-14 items-center justify-between border-b border-white/5 bg-slate-900/80 px-6 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            SANDBOX ENVIRONMENT
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>Tab Blurs: <strong className="text-amber-400">{tabLossCount}</strong></span>
          <span>·</span>
          <span>Attempt: {attemptId?.slice(0, 8)}</span>
        </div>
      </header>

      {/* Main split dashboard pane */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
          <div className="h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span>Mounting secure execution jail...</span>
        </div>
      ) : errorMsg ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-xl border border-rose-500/25 bg-rose-500/5 p-6 text-center space-y-4">
            <p className="text-sm text-rose-400 font-medium">{errorMsg}</p>
            <button
              onClick={() => router.push('/portal')}
              className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 transition"
            >
              Back to Portal
            </button>
          </div>
        </div>
      ) : finished ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl border border-white/5 bg-slate-900/60 p-8 text-center space-y-6 backdrop-blur-xl">
            <div className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center border ${
              overallStatus === 'ACCEPTED' 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}>
              {overallStatus === 'ACCEPTED' ? (
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold text-white">Solution Scored</h1>
              <p className="text-xs text-slate-400 leading-relaxed">
                Your code submission has been compiled and run against all hidden test cases. Grading outcome has been updated.
              </p>
            </div>

            <div className="bg-slate-950/40 rounded-xl border border-white/5 p-4 text-xs font-mono space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Evaluation Outcome:</span>
                <span className={`font-bold ${overallStatus === 'ACCEPTED' ? 'text-emerald-400' : 'text-rose-400'}`}>{overallStatus}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Passed Test cases:</span>
                <span className="text-slate-300 font-semibold">
                  {testResults.filter(r => r.passed).length} / {testResults.length}
                </span>
              </div>
            </div>

            <button
              onClick={() => router.push('/portal')}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-sm transition"
            >
              Return to Candidate Portal
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Split Panel: Instructions */}
          <div className="w-1/2 border-r border-white/5 bg-slate-950/10 p-6 overflow-y-auto space-y-6">
            <div>
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-1">
                CODING TASK {activeChallengeIndex + 1}
              </span>
              <h2 className="text-lg font-bold text-white">{challenges[activeChallengeIndex]?.title}</h2>
            </div>
            
            {/* Markdown Problems description */}
            <div className="text-xs leading-relaxed text-slate-300 whitespace-pre-line border-t border-white/5 pt-4">
              {challenges[activeChallengeIndex]?.description}
            </div>

            {/* Test cases list preview */}
            <div className="space-y-2 pt-4 border-t border-white/5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase">Visible Test Cases</h3>
              {challenges[activeChallengeIndex]?.test_cases.map((tc, idx) => (
                <div key={idx} className="rounded-lg bg-slate-900/40 border border-white/5 p-3 text-xs font-mono flex items-center justify-between text-slate-400">
                  <span>Test Case #{idx + 1}</span>
                  <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">
                    {tc.hidden ? 'Hidden case' : 'Input visible'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Split Panel: Editor Workspace */}
          <div className="w-1/2 flex flex-col bg-[#0b0b11]">
            {/* Editor Control bar */}
            <div className="flex h-12 items-center justify-between border-b border-white/5 bg-slate-900/40 px-4">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="rounded-lg border border-white/10 bg-slate-950 px-2.5 py-1 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="python">Python 3.10</option>
                <option value="javascript">Node.js 18</option>
              </select>
            </div>

            {/* Code inputs Area */}
            <div className="flex-1 relative">
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="absolute inset-0 w-full h-full p-4 bg-transparent font-mono text-xs text-slate-200 resize-none focus:outline-none leading-relaxed border-0"
                style={{ fontFamily: 'var(--font-mono)' }}
                placeholder="# Write your secure solution here..."
              />
            </div>

            {/* Execution Console Area */}
            <div className="h-44 border-t border-white/5 bg-slate-950/60 flex flex-col">
              <div className="flex h-8 items-center justify-between border-b border-white/5 px-4 bg-slate-900/30">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CONSOLE OUTPUT</span>
                <div className="flex gap-2">
                  <button
                    onClick={handleRunDraft}
                    disabled={runningDraft || submitting}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-semibold text-slate-300"
                  >
                    {runningDraft ? 'Running...' : 'Run Test Case'}
                  </button>
                  <button
                    onClick={handleSubmitSolution}
                    disabled={submitting || runningDraft}
                    className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-[10px] font-semibold text-white"
                  >
                    {submitting ? 'Submitting...' : 'Submit Code'}
                  </button>
                </div>
              </div>
              <textarea
                readOnly
                value={consoleOutput}
                className="flex-1 w-full p-3 bg-transparent font-mono text-[11px] text-slate-400 resize-none focus:outline-none leading-relaxed"
                style={{ fontFamily: 'var(--font-mono)' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
