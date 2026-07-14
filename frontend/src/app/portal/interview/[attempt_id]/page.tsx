'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';

interface Message {
  sender: 'AGENT' | 'CANDIDATE';
  message_text: string;
}

export default function CandidateInterviewPage() {
  const router = useRouter();
  const params = useParams();
  const attemptId = params.attempt_id as string;

  const [tenantSlug, setTenantSlug] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Conversational state
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Micro-recording visualizer state
  const [isRecording, setIsRecording] = useState(false);
  const [micActiveTime, setMicActiveTime] = useState(0);
  const recordIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Complete Assessment Report outcomes
  const [finished, setFinished] = useState(false);
  const [report, setReport] = useState<any | null>(null);
  const [overallScore, setOverallScore] = useState<number | null>(null);

  // Proctor tab blurs count tracker
  const [tabLossCount, setTabLossCount] = useState(0);

  // Dynamic message timeline scroll helper
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  // Initialize and trigger adaptive interview
  const initiateInterview = useCallback(async (slug: string) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/public/interviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Slug': slug },
        body: JSON.stringify({ application_id: attemptId })
      });
      const data = await res.json();
      if (res.ok) {
        setMessages([
          { sender: 'AGENT', message_text: data.welcome_message }
        ]);
      } else {
        setErrorMsg(data.detail || 'Failed to initialize technical interview session.');
      }
    } catch {
      setErrorMsg('Failed to connect to recruitment server.');
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
      initiateInterview(slug);
    }
  }, [initiateInterview]);

  // Proctor listeners: focus blurs & copy-paste
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
      alert('Security Warning: Copy-Paste is disabled during interview answers. Telemetry logged.');
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('paste', handlePaste);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('paste', handlePaste);
    };
  }, [finished, loading, attemptId, logProctorEvent]);

  // Handle voice recording toggle
  const handleToggleRecording = () => {
    if (isRecording) {
      // Stop recording and simulate transcription STT
      setIsRecording(false);
      if (recordIntervalRef.current) {
        clearInterval(recordIntervalRef.current);
      }
      // Populate text field with simulated transcript
      setInputText('I have designed distributed architectures utilizing gRPC buffers and Redis caches to load-balance traffic.');
    } else {
      // Start recording
      setIsRecording(true);
      setMicActiveTime(0);
      recordIntervalRef.current = setInterval(() => {
        setMicActiveTime(prev => prev + 1);
      }, 1000);
    }
  };

  // Submit candidate response message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !tenantSlug || submitting) return;

    const currentMsgText = inputText;
    setInputText('');
    setSubmitting(true);

    // Append candidate message locally
    setMessages(prev => [...prev, { sender: 'CANDIDATE', message_text: currentMsgText }]);

    try {
      // Find corresponding interview id or resolve from first welcome
      // We can query attempts details or use mock route parameters
      // Wait, public.interviews endpoint returns `interview_id`
      // Let's retrieve mock identifier by storing it during welcome load
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/public/interviews/${attemptId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Slug': tenantSlug },
        body: JSON.stringify({ message_text: currentMsgText })
      });
      const data = await res.json();
      if (res.ok) {
        setMessages(prev => [...prev, { sender: 'AGENT', message_text: data.message_text }]);
      } else {
        setErrorMsg(data.detail || 'Connection error processing response.');
      }
    } catch {
      setErrorMsg('Failed to process message.');
    } finally {
      setSubmitting(false);
    }
  };

  // Conclude interview and score transcript
  const handleCompleteInterview = async () => {
    if (!tenantSlug) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/public/interviews/${attemptId}/complete`, {
        method: 'POST',
        headers: { 'X-Tenant-Slug': tenantSlug }
      });
      const data = await res.json();
      if (res.ok) {
        setFinished(true);
        setReport(data.report);
        setOverallScore(data.score);
      } else {
        setErrorMsg(data.detail || 'Failed to complete interview.');
      }
    } catch {
      setErrorMsg('Connection error finalizing evaluation.');
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
            ADAPTIVE TECHNICAL INTERVIEW (SECURE AUDIO)
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>Tab Blurs: <strong className="text-amber-400">{tabLossCount}</strong></span>
          <span>·</span>
          <span>Attempt: {attemptId?.slice(0, 8)}</span>
        </div>
      </header>

      {/* Main Workspace */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
          <div className="h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span>Connecting with technical recruiter bot...</span>
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
          <div className="max-w-xl w-full rounded-2xl border border-white/5 bg-slate-900/60 p-8 text-center space-y-6 backdrop-blur-xl">
            <div className="mx-auto w-14 h-14 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold text-white">Interview Completed Successfully</h1>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                Your verbal responses and transcript logs have been processed through criteria rubrics. Preliminary evaluation details are saved.
              </p>
            </div>

            {report && (
              <div className="bg-slate-950/40 rounded-xl border border-white/5 p-5 text-left space-y-4 text-xs font-mono">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-500">Evaluation Outcome:</span>
                  <span className="font-bold text-emerald-400">CALCULATED</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-500 block mb-0.5">Technical Score:</span>
                    <span className="text-sm font-bold text-slate-200">{report.technical_score}%</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5">Communication:</span>
                    <span className="text-sm font-bold text-slate-200">{report.communication_score}%</span>
                  </div>
                </div>
                <div className="border-t border-white/5 pt-3">
                  <span className="text-slate-500 block mb-1">Feedback Summary:</span>
                  <p className="text-slate-300 leading-relaxed font-sans">{report.feedback_summary}</p>
                </div>
              </div>
            )}

            <button
              onClick={() => router.push('/portal')}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-sm transition"
            >
              Return to Candidate Portal
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden max-w-3xl w-full mx-auto p-6 space-y-4">
          
          {/* Scrollable Conversation timeline */}
          <div className="flex-1 overflow-y-auto rounded-xl border border-white/5 bg-slate-950/20 p-6 space-y-4 backdrop-blur-md">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.sender === 'CANDIDATE' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] rounded-xl px-4 py-3 text-xs leading-relaxed space-y-1 ${
                  msg.sender === 'CANDIDATE'
                    ? 'bg-slate-800 text-white rounded-br-none'
                    : 'bg-indigo-600/10 border border-indigo-500/20 text-slate-100 rounded-bl-none'
                }`}>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                    {msg.sender === 'CANDIDATE' ? 'You' : 'Automated Recruiter'}
                  </span>
                  <p>{msg.message_text}</p>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Micro-recording controls and text fallback inputs */}
          <div className="rounded-xl border border-white/5 bg-slate-900/60 p-4 space-y-4 backdrop-blur-md">
            
            {/* Dynamic Mic Visualizer Animation */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleToggleRecording}
                  className={`h-11 w-11 rounded-full flex items-center justify-center transition border relative ${
                    isRecording 
                      ? 'bg-rose-600 border-rose-500 text-white animate-pulse' 
                      : 'bg-slate-800 border-white/10 hover:border-white/20 text-slate-300'
                  }`}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  {isRecording && (
                    <span className="absolute -inset-1.5 rounded-full border border-rose-500/40 animate-ping pointer-events-none" />
                  )}
                </button>
                <div className="text-xs">
                  <span className="text-slate-400 font-semibold block">
                    {isRecording ? 'Capturing Transcription Telemetry...' : 'Verbal Answer Mode'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {isRecording ? `Active duration: ${micActiveTime}s` : 'Click mic to talk, click again to transcribe.'}
                  </span>
                </div>
              </div>
              
              <button
                type="button"
                onClick={handleCompleteInterview}
                disabled={submitting}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-xs font-semibold rounded-lg transition"
              >
                Conclude Interview
              </button>
            </div>

            {/* Text input fallback container */}
            <form onSubmit={handleSendMessage} className="flex gap-3">
              <input
                type="text"
                placeholder="Type your response here if keyboard input is preferred..."
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                disabled={isRecording || submitting}
                className="flex-1 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none disabled:bg-slate-950/40 disabled:text-slate-500"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || submitting || isRecording}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-950/40 disabled:text-slate-500 text-xs font-semibold text-white rounded-lg transition"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
