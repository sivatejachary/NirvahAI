'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';

interface Question {
  id: string;
  question_text: string;
  options: string[];
  difficulty: string;
}

export default function CandidateAssessmentPortalPage() {
  const router = useRouter();
  const params = useParams();
  const attemptId = params.attempt_id as string;

  // Retrieve tenant slug from localStorage (stored during application or login) or default query params
  const [tenantSlug, setTenantSlug] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  // MCQ state
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Proctor statistics (for UI display)
  const [tabLossCount, setTabLossCount] = useState(0);
  const [pasteCount, setPasteCount] = useState(0);

  // Fetch next question helper
  const fetchNextQuestion = useCallback(async (slug: string) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/public/assessments/attempts/${attemptId}/next`, {
        headers: { 'X-Tenant-Slug': slug }
      });
      const data = await res.json();
      if (res.ok) {
        if (data.finished) {
          setFinished(true);
        } else {
          setCurrentQuestion(data.question);
          setSelectedAnswer('');
        }
      } else {
        setErrorMsg(data.detail || 'Failed to fetch next question.');
      }
    } catch (err) {
      setErrorMsg('Failed to connect to assessment server.');
    } finally {
      setLoading(false);
    }
  }, [attemptId]);

  // Load configuration & set listeners
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const slug = localStorage.getItem('tenant_slug') || '';
      setTenantSlug(slug);
      if (!slug) {
        setErrorMsg('Missing company context. Please start the attempt from the main transparency portal link.');
        setLoading(false);
        return;
      }
      fetchNextQuestion(slug);
    }
  }, [fetchNextQuestion]);

  // Proctoring telemetry logging function
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
      console.warn('Failed to submit proctor telemetry logs:', err);
    }
  }, [attemptId, tenantSlug]);

  // Proctor listeners: Window Tab Blurs
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
      setPasteCount(prev => {
        const next = prev + 1;
        logProctorEvent('PASTE_DETECTED', { count: next });
        return next;
      });
      alert('Security Warning: Copy-Paste is disabled during assessments. Telemetry logged to proctor board.');
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      logProctorEvent('RIGHT_CLICK_ATTEMPTED');
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('paste', handlePaste);
    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [finished, loading, attemptId, logProctorEvent]);

  // Submit response handler
  const handleSubmitResponse = async () => {
    if (!selectedAnswer || !currentQuestion || !tenantSlug) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/public/assessments/attempts/${attemptId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Slug': tenantSlug },
        body: JSON.stringify({
          question_id: currentQuestion.id,
          candidate_answer: selectedAnswer
        })
      });
      const data = await res.json();
      if (res.ok) {
        if (data.status === 'COMPLETED') {
          setFinished(true);
          setScore(data.score);
        } else {
          // Fetch next
          await fetchNextQuestion(tenantSlug);
        }
      } else {
        setErrorMsg(data.detail || 'Failed to submit response.');
      }
    } catch (err) {
      setErrorMsg('Connection error.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-100 flex flex-col items-center justify-center p-6 font-sans">
      
      {/* Background Neon Glow Effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] bg-emerald-500/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative w-full max-w-2xl rounded-2xl border border-white/5 bg-slate-900/60 backdrop-blur-xl p-8 shadow-lg space-y-6">
        
        {/* Header Indicator */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
              SECURE ASSESSMENT ENVIRONMENT (PROCTORED)
            </span>
          </div>
          <span className="text-xs text-slate-500 font-mono">Attempt: {attemptId?.slice(0, 8)}</span>
        </div>

        {/* Dynamic State Rendering */}
        {loading ? (
          <div className="h-60 flex flex-col items-center justify-center gap-3 text-slate-400">
            <div className="h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">Retrieving technical questions bank...</span>
          </div>
        ) : errorMsg ? (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-6 text-center space-y-4">
            <span className="text-sm text-rose-400 font-medium block">{errorMsg}</span>
            <button
              onClick={() => router.push('/portal')}
              className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 transition"
            >
              Return to Candidate Portal
            </button>
          </div>
        ) : finished ? (
          <div className="text-center py-10 space-y-6 animate-fade">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-white">Assessment Submitted</h1>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                Thank you for completing your evaluation. Your score has been securely saved and processed into the hiring pipeline.
              </p>
            </div>

            {score !== null && (
              <div className="inline-block rounded-xl bg-slate-950/40 border border-white/5 px-6 py-3">
                <span className="text-xs text-slate-500 uppercase font-semibold tracking-wider block mb-1">
                  PRELIMINARY SCORE
                </span>
                <span className="text-3xl font-black text-emerald-400">{Math.round(score)}%</span>
              </div>
            )}

            <div className="pt-4">
              <button
                onClick={() => router.push('/portal')}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-sm shadow-lg transition"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        ) : currentQuestion ? (
          <div className="space-y-6 animate-fade">
            {/* Question Text */}
            <div className="space-y-2">
              <span className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-semibold text-indigo-400 uppercase font-mono tracking-wide">
                DIFFICULTY: {currentQuestion.difficulty}
              </span>
              <h2 className="text-lg font-bold text-white leading-relaxed">
                {currentQuestion.question_text}
              </h2>
            </div>

            {/* Answer Options */}
            <div className="space-y-3 pt-2">
              {currentQuestion.options.map((option) => (
                <label
                  key={option}
                  className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer transition ${
                    selectedAnswer === option
                      ? 'border-indigo-500 bg-indigo-500/5 text-white'
                      : 'border-white/5 bg-slate-950/20 hover:border-white/10 hover:bg-slate-950/40 text-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="mcq-option"
                    value={option}
                    checked={selectedAnswer === option}
                    onChange={(e) => setSelectedAnswer(e.target.value)}
                    className="h-4 w-4 border-slate-700 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900"
                  />
                  <span className="text-sm font-medium">{option}</span>
                </label>
              ))}
            </div>

            {/* Actions & Warnings */}
            <div className="flex flex-col gap-4 pt-4 border-t border-white/5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-4 text-xs text-slate-500">
                <span>Tab Blurs: <strong className={tabLossCount > 2 ? 'text-amber-400' : 'text-slate-400'}>{tabLossCount}</strong></span>
                <span>Warnings: <strong className={pasteCount > 0 ? 'text-rose-400' : 'text-slate-400'}>{pasteCount}</strong></span>
              </div>
              <button
                onClick={handleSubmitResponse}
                disabled={!selectedAnswer || submitting}
                className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold rounded-lg text-sm transition shadow-lg flex items-center justify-center gap-2"
              >
                {submitting ? 'Submitting...' : 'Submit & Continue'}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-10 text-slate-400">
            No questions available for this assessment attempt.
          </div>
        )}
      </div>
    </div>
  );
}
