'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';

interface Message {
  sender: 'AGENT' | 'CANDIDATE';
  message_text: string;
}

export default function CandidateRecruiterCallPage() {
  const router = useRouter();
  const params = paramsHook();
  const callId = params.call_id as string;

  const [tenantSlug, setTenantSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Call status: DIALING | CONNECTED | DISCONNECTED
  const [callStatus, setCallStatus] = useState<'DIALING' | 'CONNECTED' | 'DISCONNECTED'>('DIALING');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Time tracker
  const [callTime, setCallTime] = useState(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Scroll helper
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Hook fallback for Next params
  function paramsHook() {
    return useParams();
  }

  // Dial call event
  const handleDialCall = async () => {
    if (!tenantSlug || !callId) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/public/calls/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Slug': tenantSlug },
        body: JSON.stringify({ application_id: callId })
      });
      const data = await res.json();
      if (res.ok) {
        setCallStatus('CONNECTED');
        setMessages([
          { sender: 'AGENT', message_text: data.greeting_message }
        ]);

        // Start call duration timer
        setCallTime(0);
        timerIntervalRef.current = setInterval(() => {
          setCallTime(prev => prev + 1);
        }, 1000);
      } else {
        setErrorMsg(data.detail || 'Outbound connection failed.');
        setCallStatus('DISCONNECTED');
      }
    } catch {
      setErrorMsg('Failed to establish connection with recruiter phone gateway.');
      setCallStatus('DISCONNECTED');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const slug = localStorage.getItem('tenant_slug') || '';
      setTenantSlug(slug);
      if (!slug) {
        setErrorMsg('Missing company context. Please start the attempt from the main transparency portal link.');
        return;
      }
    }
  }, []);

  // Send candidate response stream
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !tenantSlug || submitting) return;

    const currentMsg = inputText;
    setInputText('');
    setSubmitting(true);

    // Add candidate bubble locally
    setMessages(prev => [...prev, { sender: 'CANDIDATE', message_text: currentMsg }]);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/public/calls/${callId}/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Slug': tenantSlug },
        body: JSON.stringify({ message_text: currentMsg })
      });
      const data = await res.json();
      if (res.ok) {
        setMessages(prev => [...prev, { sender: 'AGENT', message_text: data.message_text }]);
      } else {
        setErrorMsg(data.detail || 'Failed to sync conversation.');
      }
    } catch {
      setErrorMsg('Failed to stream audio chunk.');
    } finally {
      setSubmitting(false);
    }
  };

  // Hangup call
  const handleHangupCall = async () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    setCallStatus('DISCONNECTED');
    setSubmitting(true);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/public/calls/${callId}/disconnect`, {
        method: 'POST',
        headers: { 'X-Tenant-Slug': tenantSlug }
      });
    } catch (err) {
      console.warn('Failed to submit call summary:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Helper formatting mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="min-h-screen bg-[#07070a] text-slate-200 flex flex-col font-sans">
      
      {/* Dialer Top Indicator */}
      <header className="flex h-14 items-center justify-between border-b border-white/5 bg-slate-900/60 px-6 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className={`h-2.5 w-2.5 rounded-full ${
            callStatus === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'
          }`} />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            SIMULATED PHONE OUTBOUND CALL
          </span>
        </div>
        {callStatus === 'CONNECTED' && (
          <div className="text-xs font-mono text-emerald-400">
            ACTIVE SESSION: {formatTime(callTime)}
          </div>
        )}
      </header>

      {/* Workspace split view */}
      <div className="flex-1 flex overflow-hidden max-w-4xl w-full mx-auto p-6 gap-6">
        
        {/* Left Side: Call controls dialer UI */}
        <div className="w-1/3 rounded-2xl border border-white/5 bg-slate-900/40 p-6 flex flex-col justify-between backdrop-blur-xl">
          
          <div className="space-y-6 text-center">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
              DIALER DEVICE
            </span>

            {/* Wave animation if connected */}
            {callStatus === 'CONNECTED' ? (
              <div className="h-28 flex items-center justify-center gap-1.5 bg-slate-950/40 rounded-xl border border-white/5 relative overflow-hidden">
                <div className="w-1.5 h-12 bg-indigo-500 rounded animate-[bounce_1s_infinite_100ms]" />
                <div className="w-1.5 h-16 bg-indigo-400 rounded animate-[bounce_1s_infinite_200ms]" />
                <div className="w-1.5 h-8 bg-indigo-500 rounded animate-[bounce_1s_infinite_300ms]" />
                <div className="w-1.5 h-14 bg-indigo-400 rounded animate-[bounce_1s_infinite_400ms]" />
                <div className="w-1.5 h-6 bg-indigo-500 rounded animate-[bounce_1s_infinite_500ms]" />
              </div>
            ) : (
              <div className="h-28 flex items-center justify-center bg-slate-950/20 rounded-xl border border-dashed border-white/5 text-xs text-slate-600 font-mono">
                [GATEWAY IDLE]
              </div>
            )}

            <div className="space-y-1">
              <span className="text-sm font-semibold block text-slate-300">Outbound Bot Recruiter</span>
              <span className="text-xs text-slate-500 font-mono">+1 (800) AI-RECRUIT</span>
            </div>
          </div>

          {/* Compliance Consent Warning Card */}
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-[10px] text-amber-400 leading-relaxed">
            <strong>Legal Notice</strong>: To comply with local privacy regulations (e.g. CCPA, NY LL144), calling starts are logged and recorded conversations are transcribed. Consent is required.
          </div>

          {/* Action triggers */}
          <div className="space-y-3">
            {callStatus === 'DIALING' ? (
              <button
                type="button"
                onClick={handleDialCall}
                disabled={loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition"
              >
                {loading ? 'Establishing Trunk...' : 'Answer & Connect Call'}
              </button>
            ) : callStatus === 'CONNECTED' ? (
              <button
                type="button"
                onClick={handleHangupCall}
                className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition animate-pulse"
              >
                Disconnect / Hangup
              </button>
            ) : (
              <div className="space-y-3">
                <div className="text-center text-xs text-rose-400 font-semibold py-1">
                  Call Disconnected
                </div>
                <button
                  type="button"
                  onClick={() => router.push('/portal')}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs transition"
                >
                  Return to Dashboard
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Conversation subtitles timeline captions */}
        <div className="w-2/3 flex flex-col justify-between space-y-4">
          
          {/* Captions scrollbox */}
          <div className="flex-1 overflow-y-auto rounded-2xl border border-white/5 bg-[#0a0a0f] p-6 space-y-4 font-mono text-xs max-h-[500px]">
            {callStatus === 'DIALING' && (
              <div className="text-slate-600 text-center py-12">
                Click "Answer & Connect Call" to start the recruiting conversation.
              </div>
            )}
            
            {messages.map((msg, index) => (
              <div key={index} className="space-y-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                  msg.sender === 'AGENT' ? 'text-indigo-400' : 'text-emerald-400'
                }`}>
                  {msg.sender === 'AGENT' ? '[AI RECRUITER VOICE]' : '[CANDIDATE TRANSCRIPTION]'}
                </span>
                <p className="text-slate-300 leading-relaxed">{msg.message_text}</p>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Subtitles controls */}
          {callStatus === 'CONNECTED' && (
            <form onSubmit={handleSendMessage} className="flex gap-3">
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="Type spoken response fallback transcription here..."
                disabled={submitting}
                className="flex-1 rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-xs text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || submitting}
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-xs font-semibold text-white rounded-xl transition"
              >
                Speak
              </button>
            </form>
          )}

          {errorMsg && (
            <div className="text-xs text-rose-400 text-center">{errorMsg}</div>
          )}
        </div>
      </div>
    </div>
  );
}
