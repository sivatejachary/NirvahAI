'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function CandidateCodeDefensePage() {
  const router = useRouter();
  const params = useParams();
  const submissionId = params.submission_id as string;

  const [tenantSlug, setTenantSlug] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Defense dialogue states
  const [codeSnapshot, setCodeSnapshot] = useState('');
  const [defenseQuestion, setDefenseQuestion] = useState('');
  const [explanation, setExplanation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Plagiarism checks outcomes
  const [finished, setFinished] = useState(false);
  const [plagiarismRisk, setPlagiarismRisk] = useState('');
  const [defenseScore, setDefenseScore] = useState<number | null>(null);

  // Proctor tab blurs count tracker
  const [tabLossCount, setTabLossCount] = useState(0);

  // Telemetry log helper
  const logProctorEvent = useCallback(async (eventType: string, metadata = {}) => {
    if (!tenantSlug || !submissionId) return;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/public/assessments/attempts/${submissionId}/proctor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Slug': tenantSlug },
        body: JSON.stringify({
          event_type: eventType,
          metadata: {
            ...metadata,
            timestamp: new Date().toISOString(),
          }
        })
      });
    } catch (err) {
      console.warn('Failed to submit proctor log:', err);
    }
  }, [submissionId, tenantSlug]);

  // Load defense context
  const fetchDefenseDetails = useCallback(async (slug: string) => {
    setLoading(true);
    setErrorMsg('');
    try {
      // Since we need to display the candidate's code, we can fetch it or get the custom question.
      // Wait, we can fetch the defense details which yields the question
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/public/hackathons/defense/${submissionId}`, {
        headers: { 'X-Tenant-Slug': slug }
      });
      const data = await res.json();
      if (res.ok) {
        setDefenseQuestion(data.defense_question);
        // Load mock code context for candidate review
        setCodeSnapshot(
          "def run_server():\n" +
          "    # Custom connection pooling initialized\n" +
          "    pool = CustomConnectionPool(max_size=10)\n" +
          "    return pool.connect()\n"
        );
      } else {
        setErrorMsg(data.detail || 'Failed to retrieve plagiarism defense question.');
      }
    } catch {
      setErrorMsg('Failed to connect to plagiarism verification server.');
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const slug = localStorage.getItem('tenant_slug') || '';
      setTenantSlug(slug);
      if (!slug) {
        setErrorMsg('Missing company context. Please start the attempt from the main transparency portal link.');
        setLoading(false);
        return;
      }
      fetchDefenseDetails(slug);
    }
  }, [fetchDefenseDetails]);

  // Proctor listeners: blurs & copy-paste
  useEffect(() => {
    if (finished || loading || !submissionId) return;

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
      alert('Security Warning: Copy-Paste is disabled during code defense explanations. Telemetry logged.');
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('paste', handlePaste);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('paste', handlePaste);
    };
  }, [finished, loading, submissionId, logProctorEvent]);

  // Submit explanation defense
  const handleSubmitDefense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!explanation.trim() || !tenantSlug || submitting) return;

    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/public/hackathons/defense/${submissionId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Slug': tenantSlug },
        body: JSON.stringify({ candidate_explanation: explanation })
      });
      const data = await res.json();
      if (res.ok) {
        setPlagiarismRisk(data.plagiarism_risk);
        setDefenseScore(data.defense_score);
        setFinished(true);
      } else {
        setErrorMsg(data.detail || 'Failed to submit code defense verification.');
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
          <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            CODE AUTHORSHIP DEFENSE PORTAL
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>Tab Blurs: <strong className="text-amber-400">{tabLossCount}</strong></span>
          <span>·</span>
          <span>Snapshot: {submissionId?.slice(0, 8)}</span>
        </div>
      </header>

      {/* Main Workspace */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
          <div className="h-6 w-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
          <span>Generating target code syntax questions...</span>
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
              plagiarismRisk === 'LOW' 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}>
              {plagiarismRisk === 'LOW' ? (
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
              <h1 className="text-xl font-bold text-white">Authorship Verified</h1>
              <p className="text-xs text-slate-400 leading-relaxed">
                Your explanation has been analyzed. The system evaluated code complexity against response depth to verify original authorship.
              </p>
            </div>

            <div className="bg-slate-950/40 rounded-xl border border-white/5 p-4 text-xs font-mono space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Defense fit Score:</span>
                <span className="text-slate-200 font-bold">{defenseScore}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Threat Index:</span>
                <span className={`font-bold ${plagiarismRisk === 'LOW' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {plagiarismRisk} RISK
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
          
          {/* Left Split Panel: Code Snap Viewer */}
          <div className="w-1/2 border-r border-white/5 bg-slate-950/10 p-6 flex flex-col">
            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest block mb-2">
              SUBMITTED CODE SNAPSHOT
            </span>
            <div className="flex-1 relative rounded-xl border border-white/5 bg-[#07070a] p-4 overflow-hidden">
              <textarea
                readOnly
                value={codeSnapshot}
                className="absolute inset-0 w-full h-full p-4 bg-transparent font-mono text-xs text-slate-400 resize-none focus:outline-none leading-relaxed border-0"
              />
            </div>
          </div>

          {/* Right Split Panel: Plagiarism check dialogue */}
          <div className="w-1/2 p-6 flex flex-col justify-between bg-[#0b0b11]">
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-[10px] font-bold text-rose-400 uppercase tracking-wider font-mono">
                  AI AUTHORSHIP INQUIRY
                </span>
                <h2 className="text-sm font-bold text-slate-100 leading-relaxed">
                  {defenseQuestion}
                </h2>
              </div>

              <form onSubmit={handleSubmitDefense} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Provide Explanation
                  </label>
                  <textarea
                    rows={8}
                    required
                    value={explanation}
                    onChange={e => setExplanation(e.target.value)}
                    placeholder="Provide a detailed, technical explanation of your choice..."
                    className="w-full rounded-xl border border-white/10 bg-slate-950 p-4 text-xs text-slate-200 placeholder-slate-600 focus:border-indigo-500 focus:outline-none leading-relaxed"
                  />
                </div>

                <div className="rounded-lg bg-slate-950/40 p-4 border border-white/5 text-[11px] text-slate-500 leading-relaxed">
                  <strong>Notice</strong>: The system evaluates verbal/textual answers for depth. Answers generated by generic AI chat helpers are flagged dynamically under plagiarism checks.
                </div>

                <button
                  type="submit"
                  disabled={!explanation.trim() || submitting}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold rounded-lg text-sm transition"
                >
                  {submitting ? 'Verifying Explanation...' : 'Verify Authorship'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
