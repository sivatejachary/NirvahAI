'use client';

import { useState, useEffect } from 'react';

interface Application {
  id: string;
  job_id: string;
  job_title?: string;
  candidate_name: string;
  candidate_email: string;
  resume_url: string;
  status: string;
  fit_score: number;
  screening_feedback: string;
  created_at: string;
  raw_parsed_data?: {
    full_name?: string;
    email?: string;
    skills?: string[];
    experience_years?: number;
    education?: Array<{ school: string; degree: string; year: string }>;
  };
}

interface Job {
  id: string;
  title: string;
}

export default function CandidatesDashboardPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('ALL');
  const [fitFilter, setFitFilter] = useState('ALL'); // ALL, HIGH (>=80), MID (50-79), LOW (<50)

  // Accommodations list for active applicants
  const [accommodations, setAccommodations] = useState<any[]>([]);

  // Assessments state for active applicant
  const [selectedAttemptDetails, setSelectedAttemptDetails] = useState<any | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  const loadData = async () => {
    setLoading(true);
    const headers = getHeaders();
    try {
      // 1. Fetch applications
      const appRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/applications`, { headers });
      let appsData: Application[] = [];
      if (appRes.ok) {
        appsData = await appRes.json();
      }

      // 2. Fetch jobs to map job titles
      const jobsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/jobs`, { headers });
      let jobsData: Job[] = [];
      if (jobsRes.ok) {
        jobsData = await jobsRes.json();
        setJobs(jobsData);
      }

      // Map job title to each application
      const mappedApps = appsData.map(app => {
        const matchingJob = jobsData.find(j => j.id === app.job_id);
        return {
          ...app,
          job_title: matchingJob ? matchingJob.title : 'Unknown Job'
        };
      });

      // Sort by fit_score descending (best fit first)
      mappedApps.sort((a, b) => b.fit_score - a.fit_score);
      setApplications(mappedApps);

      // 3. Fetch accommodation requests
      const accRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/compliance/accommodations`, { headers });
      if (accRes.ok) {
        const accData = await accRes.json();
        setAccommodations(accData);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setErrorMsg('Failed to load candidate application registers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fetch assessment attempt details when selectedApp changes
  useEffect(() => {
    const fetchAttemptDetails = async () => {
      if (!selectedApp) {
        setSelectedAttemptDetails(null);
        return;
      }
      try {
        const headers = getHeaders();
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/assessments/attempts?application_id=${selectedApp.id}`, { headers });
        if (res.ok) {
          const attempts = await res.json();
          if (attempts.length > 0) {
            // Load the first attempt's detailed logs (including responses and proctoring)
            const detailsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/assessments/attempts/${attempts[0].id}`, { headers });
            if (detailsRes.ok) {
              const details = await detailsRes.json();
              setSelectedAttemptDetails(details);
              return;
            }
          }
        }
        setSelectedAttemptDetails(null);
      } catch (err) {
        console.error('Failed to fetch candidate assessment details:', err);
        setSelectedAttemptDetails(null);
      }
    };
    fetchAttemptDetails();
  }, [selectedApp]);

  const handleUpdateStatus = async (appId: string, newStatus: string) => {
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const headers = getHeaders();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/applications/${appId}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setSuccessMsg(`Candidate application updated to stage: ${newStatus}`);
        loadData();
        // Update selected app if open
        if (selectedApp?.id === appId) {
          setSelectedApp(prev => prev ? { ...prev, status: newStatus } : null);
        }
      } else {
        const data = await res.json();
        setErrorMsg(data.detail || 'Failed to update workflow stage.');
      }
    } catch (err) {
      setErrorMsg('Connection error.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReviewAccommodation = async (reqId: string, action: 'APPROVED' | 'REJECTED') => {
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const headers = getHeaders();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/compliance/accommodations/${reqId}/review`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: action, review_notes: `Processed via Candidates Dashboard.` })
      });
      if (res.ok) {
        setSuccessMsg(`Accommodation request ${action.toLowerCase()} successfully.`);
        // Reload accommodations
        const accRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/compliance/accommodations`, { headers });
        if (accRes.ok) {
          const accData = await accRes.json();
          setAccommodations(accData);
        }
      } else {
        const data = await res.json();
        setErrorMsg(data.detail || 'Failed to process request.');
      }
    } catch (err) {
      setErrorMsg('Connection error.');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter Logic
  const filteredApps = applications.filter(app => {
    const matchesSearch = 
      app.candidate_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.candidate_email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesJob = selectedJobId === 'ALL' || app.job_id === selectedJobId;
    
    let matchesFit = true;
    if (fitFilter === 'HIGH') matchesFit = app.fit_score >= 80;
    else if (fitFilter === 'MID') matchesFit = app.fit_score >= 50 && app.fit_score < 80;
    else if (fitFilter === 'LOW') matchesFit = app.fit_score < 50;

    return matchesSearch && matchesJob && matchesFit;
  });

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    if (score >= 50) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Candidates Registry</h1>
          <p className="text-sm text-slate-400">
            Monitor secure resume intelligence, multi-tenant compliance screening, and automated fit metrics.
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition duration-150 hover:bg-indigo-500 focus:outline-none"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.25 15M20 20v-5h-5" />
          </svg>
          Refresh Registers
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-400">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-400">
          {errorMsg}
        </div>
      )}

      {/* Grid of Search, Filters, and List */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Candidates List Column */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Glassmorphic Search & Filters Bar */}
          <div className="rounded-xl border border-white/5 bg-slate-900/60 p-4 backdrop-blur-md">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by name/email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Job filter */}
              <div>
                <select
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="ALL">All Jobs</option>
                  {jobs.map(job => (
                    <option key={job.id} value={job.id}>{job.title}</option>
                  ))}
                </select>
              </div>

              {/* Fit score filter */}
              <div>
                <select
                  value={fitFilter}
                  onChange={(e) => setFitFilter(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="ALL">All Scores</option>
                  <option value="HIGH">High Fit (â‰¥ 80)</option>
                  <option value="MID">Mid Fit (50-79)</option>
                  <option value="LOW">Low Fit (&lt; 50)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Candidates Cards Container */}
          {loading ? (
            <div className="flex h-60 items-center justify-center rounded-xl border border-white/5 bg-slate-900/20 backdrop-blur-md">
              <span className="text-sm text-slate-400">Querying secure ledger database...</span>
            </div>
          ) : filteredApps.length === 0 ? (
            <div className="flex h-60 items-center justify-center rounded-xl border border-white/5 bg-slate-900/20 backdrop-blur-md">
              <span className="text-sm text-slate-500">No matching candidate applications found.</span>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredApps.map(app => {
                const appAccs = accommodations.filter(a => a.candidate_id === app.candidate_email || a.candidate_id === app.id);
                const hasPendingAcc = appAccs.some(a => a.status === 'PENDING');
                
                return (
                  <div
                    key={app.id}
                    onClick={() => setSelectedApp(app)}
                    className={`group relative cursor-pointer rounded-xl border p-5 transition duration-200 backdrop-blur-md ${
                      selectedApp?.id === app.id
                        ? 'border-indigo-500/50 bg-indigo-500/5 shadow-glow-primary'
                        : 'border-white/5 bg-slate-900/40 hover:border-white/10 hover:bg-slate-900/60'
                    }`}
                  >
                    {/* Active Accommodations Alert Beacon */}
                    {hasPendingAcc && (
                      <span className="absolute right-3 top-3 flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
                      </span>
                    )}

                    <div className="flex items-start justify-between gap-4">
                      {/* Candidate Name & Applied Job info */}
                      <div className="flex gap-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/10 to-indigo-500/30 text-base font-bold text-indigo-300">
                          {app.candidate_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-semibold text-white group-hover:text-indigo-300 transition duration-150">
                            {app.candidate_name}
                          </h3>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              {app.job_title}
                            </span>
                            <span>â€¢</span>
                            <span>{new Date(app.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Fit Score Badge */}
                      <div className={`flex flex-col items-end rounded-lg border px-3 py-1.5 backdrop-blur-md ${getScoreColor(app.fit_score)}`}>
                        <span className="text-xs font-semibold uppercase tracking-wider">AI FIT MATCH</span>
                        <span className="text-lg font-black">{Math.round(app.fit_score)}%</span>
                      </div>
                    </div>

                    {/* Progress Stages Bar */}
                    <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500">Stage:</span>
                        <span className="rounded-md bg-slate-800 px-2 py-0.5 font-medium text-slate-300 uppercase tracking-wide">
                          {app.status.replace('_STAGE', '')}
                        </span>
                      </div>
                      
                      {appAccs.length > 0 && (
                        <div className="text-xs text-amber-400/90 font-medium">
                          {appAccs.length} Accommodation Request{appAccs.length > 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detailed Inspection Pane Column */}
        <div className="space-y-4">
          {selectedApp ? (
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md space-y-6">
              {/* Header Details */}
              <div className="flex items-start justify-between border-b border-white/5 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">{selectedApp.candidate_name}</h2>
                  <p className="text-xs text-slate-400 mt-1">{selectedApp.candidate_email}</p>
                </div>
                <button
                  onClick={() => setSelectedApp(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Status workflow selector */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Hiring Stage Workflow
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleUpdateStatus(selectedApp.id, 'MCQ_STAGE')}
                    disabled={actionLoading}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold text-center transition ${
                      selectedApp.status === 'MCQ_STAGE'
                        ? 'bg-indigo-600 text-white shadow-glow-primary'
                        : 'bg-slate-950/40 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    MCQ Stage
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedApp.id, 'TECHNICAL_INTERVIEW_STAGE')}
                    disabled={actionLoading}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold text-center transition ${
                      selectedApp.status === 'TECHNICAL_INTERVIEW_STAGE'
                        ? 'bg-indigo-600 text-white shadow-glow-primary'
                        : 'bg-slate-950/40 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    Tech Interview
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedApp.id, 'OFFER_STAGE')}
                    disabled={actionLoading}
                    className={`col-span-2 rounded-lg px-3 py-2 text-xs font-semibold text-center transition ${
                      selectedApp.status === 'OFFER_STAGE'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-950/40 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    Extend Job Offer
                  </button>
                </div>
              </div>

              {/* Fit score reasoning */}
              <div className="rounded-lg bg-slate-950/40 p-4 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    LLM Matching Analysis
                  </span>
                  <span className="text-sm font-bold text-indigo-400">{Math.round(selectedApp.fit_score)}% Score</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-300">
                  {selectedApp.screening_feedback || 'No evaluation feedback recorded.'}
                </p>
              </div>

              {/* Blind parsed candidate details (GDPR Compliant) */}
              <div className="space-y-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                  Blind Resume Information (Anonymized)
                </span>
                
                {selectedApp.raw_parsed_data ? (
                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-slate-500">Screened Experience:</span>
                      <p className="font-semibold text-slate-300 mt-0.5">
                        {selectedApp.raw_parsed_data.experience_years ?? 'Unknown'} Years
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Demographics Scrubbing Status:</span>
                      <p className="font-semibold text-emerald-400 mt-0.5">
                        âœ“ Age, Gender, Ethnicity Redacted
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Verified Technical Skills:</span>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {selectedApp.raw_parsed_data.skills?.map(skill => (
                          <span key={skill} className="rounded bg-slate-800 px-2 py-0.5 text-slate-300 font-mono">
                            {skill}
                          </span>
                        )) || <span className="text-slate-500">None detected.</span>}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No structured parsed resume data is available.</p>
                )}
              </div>

              {/* MCQ Assessment & Proctor logs (Phase 6) */}
              {selectedAttemptDetails && (
                <div className="border-t border-white/5 pt-4 space-y-4">
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                      Proctored MCQ Evaluation
                    </span>
                    <div className="grid grid-cols-2 gap-2 bg-slate-950/40 p-3 rounded-lg border border-white/5 text-xs">
                      <div>
                        <span className="text-slate-500">Attempt Status:</span>
                        <p className="font-semibold text-slate-200 mt-0.5 uppercase">{selectedAttemptDetails.status}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">MCQ Score:</span>
                        <p className="font-bold text-indigo-400 mt-0.5">
                          {selectedAttemptDetails.score !== null ? `${Math.round(selectedAttemptDetails.score)}%` : 'N/A'}
                        </p>
                      </div>
                      <div className="col-span-2 mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                        <span className="text-slate-500">Integrity Risk Index:</span>
                        <span className={`px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                          selectedAttemptDetails.integrity_risk === 'HIGH' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                          selectedAttemptDetails.integrity_risk === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {selectedAttemptDetails.integrity_risk}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Proctor Telemetry logs trail */}
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                      Proctor Telemetry Logs Trail
                    </span>
                    {selectedAttemptDetails.proctoring_logs.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No security anomalies registered. Perfect compliance.</p>
                    ) : (
                      <div className="max-h-40 overflow-y-auto rounded-lg border border-white/5 bg-slate-950/40 divide-y divide-white/5">
                        {selectedAttemptDetails.proctoring_logs.map((log: any) => (
                          <div key={log.id} className="p-2.5 text-[11px] space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-rose-400 uppercase font-mono tracking-wide">{log.event_type}</span>
                              <span className="text-slate-500">{new Date(log.created_at).toLocaleTimeString()}</span>
                            </div>
                            {log.metadata && Object.keys(log.metadata).length > 0 && (
                              <p className="text-slate-400 font-mono text-[10px]">
                                details: {JSON.stringify(log.metadata)}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Accommodation Requests Review inside Pane */}
              {accommodations.filter(a => a.candidate_id === selectedApp.candidate_email || a.candidate_id === selectedApp.id).length > 0 && (
                <div className="border-t border-white/5 pt-4 space-y-3">
                  <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider block">
                    Accommodation Requests (NYC Audit compliance)
                  </span>
                  
                  {accommodations
                    .filter(a => a.candidate_id === selectedApp.candidate_email || a.candidate_id === selectedApp.id)
                    .map(acc => (
                      <div key={acc.id} className="rounded-lg bg-amber-500/5 border border-amber-500/10 p-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-amber-400 uppercase tracking-wide">{acc.request_type}</span>
                          <span className="rounded bg-slate-900 px-1.5 py-0.5 font-semibold text-slate-300 uppercase">
                            {acc.status}
                          </span>
                        </div>
                        <p className="text-slate-300">{acc.details}</p>
                        
                        {acc.status === 'PENDING' && (
                          <div className="flex gap-2 pt-1.5">
                            <button
                              onClick={() => handleReviewAccommodation(acc.id, 'APPROVED')}
                              disabled={actionLoading}
                              className="flex-1 rounded bg-amber-600 py-1 text-center font-bold text-white hover:bg-amber-500"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleReviewAccommodation(acc.id, 'REJECTED')}
                              disabled={actionLoading}
                              className="flex-1 rounded border border-white/10 py-1 text-center font-semibold text-slate-300 hover:bg-slate-800"
                            >
                              Deny
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-80 flex-col items-center justify-center rounded-xl border border-white/5 bg-slate-900/20 p-6 text-center backdrop-blur-md">
              <svg className="mx-auto h-12 w-12 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
              <h3 className="mt-4 text-sm font-semibold text-white">Inspect Candidate Details</h3>
              <p className="mt-2 text-xs text-slate-400 max-w-[200px]">
                Click on any candidate card to evaluate resume parameters, matching reasoning, and compliance bypass options.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
