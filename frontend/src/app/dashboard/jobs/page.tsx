'use client';

import { useState, useEffect, FormEvent } from 'react';

interface Job {
  id: string;
  title: string;
  description: string;
  requirements: string[];
  status: string;
  sourcing_channels: Record<string, { status: string; published_at: string; referral_url: string }>;
  created_at: string;
  department_id: string;
}

interface Department {
  id: string;
  name: string;
}

interface Applicant {
  id: string;
  candidate_name: string;
  candidate_email: string;
  status: string;
  fit_score: number;
  created_at: string;
  screening_feedback?: string;
}

export default function JobsDashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Active sub-option tab
  const [activeSubTab, setActiveSubTab] = useState<'create' | 'all' | 'draft' | 'published' | 'closed'>('all');

  // JD generator inputs
  const [genTitle, setGenTitle] = useState('');
  const [genDeptName, setGenDeptName] = useState('');
  const [genSkills, setGenSkills] = useState('');
  const [genAutonomy, setGenAutonomy] = useState('SEMI_AUTONOMOUS');
  const [generating, setGenerating] = useState(false);

  // Job creation inputs
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newRequirements, setNewRequirements] = useState('');
  const [newDeptId, setNewDeptId] = useState('');
  const [newSalary, setNewSalary] = useState('');
  const [newExp, setNewExp] = useState('');
  const [newEmpType, setNewEmpType] = useState('Full-Time');
  const [newDesignation, setNewDesignation] = useState('');
  const [newBenefits, setNewBenefits] = useState('');
  const [saving, setSaving] = useState(false);

  // Applicants modal
  const [viewApplicantsJobId, setViewApplicantsJobId] = useState<string | null>(null);
  const [viewApplicantsJobTitle, setViewApplicantsJobTitle] = useState('');
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [applicantsLoading, setApplicantsLoading] = useState(false);

  // Publish inputs
  const [publishingJobId, setPublishingJobId] = useState<string | null>(null);
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['linkedin', 'indeed']);
  const [publishing, setPublishing] = useState(false);

  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  const loadData = async () => {
    const headers = getHeaders();
    try {
      const [jobsRes, deptsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/jobs`, { headers }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/company/departments`, { headers }),
      ]);
      
      if (jobsRes.ok) {
        setJobs(await jobsRes.json());
      }
      if (deptsRes.ok) {
        setDepartments(await deptsRes.json());
      }
    } catch (err) {
      setError('Connection error loading recruitment details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGenerateProposal = async () => {
    if (!genTitle || !genDeptName || !genSkills) {
      setError('Provide Title, Department, and Skills to generate JD.');
      return;
    }
    
    setGenerating(true);
    setError('');
    
    try {
      const headers = getHeaders();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/jobs/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: genTitle,
          department_name: genDeptName,
          skills: genSkills.split(',').map(s => s.trim()),
          autonomy_level: genAutonomy
        })
      });
      
      if (res.ok) {
        const proposal = await res.json();
        setNewTitle(proposal.title);
        setNewDesc(proposal.description);
        setNewRequirements(proposal.requirements.join(', '));
        
        const matched = departments.find(d => d.name.toLowerCase() === genDeptName.toLowerCase());
        if (matched) {
          setNewDeptId(matched.id);
        } else if (departments.length > 0) {
          setNewDeptId(departments[0].id);
        }
        
        setSuccess('JD Proposal generated successfully! Review and save below.');
      } else {
        const data = await res.json();
        setError(data.detail || 'Failed to generate proposal.');
      }
    } catch (err) {
      setError('Failed to connect to generator agent.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateJob = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newDesc || !newDeptId) {
      setError('Title, Description, and Department are required.');
      return;
    }
    
    setSaving(true);
    setError('');
    setSuccess('');
    
    try {
      const headers = getHeaders();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/jobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: newTitle,
          description: newDesc,
          department_id: newDeptId,
          requirements: newRequirements.split(',').map(r => r.trim()).filter(Boolean),
          metadata: {
            salary: newSalary,
            experience: newExp,
            employment_type: newEmpType,
            designation: newDesignation,
            benefits: newBenefits
          }
        })
      });
      
      if (res.ok) {
        setSuccess('Job Posting draft created successfully!');
        setNewTitle('');
        setNewDesc('');
        setNewRequirements('');
        setNewSalary('');
        setNewExp('');
        setNewDesignation('');
        setNewBenefits('');
        await loadData();
        setActiveSubTab('all');
      } else {
        const data = await res.json();
        setError(data.detail || 'Failed to create job.');
      }
    } catch (err) {
      setError('Connection error saving job posting.');
    } finally {
      setSaving(false);
    }
  };

  const handleApproveJob = async (jobId: string) => {
    setError('');
    setSuccess('');
    try {
      const headers = getHeaders();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/jobs/${jobId}/approve`, {
        method: 'POST',
        headers
      });
      if (res.ok) {
        setSuccess('Job Posting legal approval logged.');
        await loadData();
      } else {
        setError('Failed to complete job post approval.');
      }
    } catch {
      setError('Connection error.');
    }
  };

  const handlePublishJob = async (e: FormEvent) => {
    e.preventDefault();
    if (!publishingJobId) return;
    
    setPublishing(true);
    setError('');
    setSuccess('');
    
    try {
      const headers = getHeaders();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/jobs/${publishingJobId}/publish`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ channels: selectedChannels })
      });
      
      if (res.ok) {
        setSuccess('Job Distributed to sourcing partners and referral links established.');
        setPublishingJobId(null);
        await loadData();
      } else {
        setError('Sourcing distribution failed.');
      }
    } catch {
      setError('Connection error.');
    } finally {
      setPublishing(false);
    }
  };

  const getFilteredJobs = () => {
    if (activeSubTab === 'draft') return jobs.filter(j => j.status === 'DRAFT');
    if (activeSubTab === 'published') return jobs.filter(j => j.status === 'PUBLISHED');
    if (activeSubTab === 'closed') return jobs.filter(j => j.status === 'CLOSED');
    return jobs;
  };

  return (
    <div style={{ display: 'flex', gap: '24px', height: 'calc(100vh - 120px)', minHeight: 0 }}>
      {/* Left sub-options panel */}
      <div style={{ width: '220px', flexShrink: 0, borderRight: '1px solid var(--border-color)', paddingRight: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Job Options</h2>
        {[
          { id: 'create', label: '➕ Create Job' },
          { id: 'all', label: '💼 Job Listings' },
          { id: 'draft', label: '📝 Draft Jobs' },
          { id: 'published', label: '🚀 Published Jobs' },
          { id: 'closed', label: '🔒 Closed Jobs' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveSubTab(t.id as any)}
            style={{
              textAlign: 'left',
              width: '100%',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: activeSubTab === t.id ? 700 : 400,
              color: activeSubTab === t.id ? '#fff' : 'var(--text-secondary)',
              background: activeSubTab === t.id ? 'rgba(99,102,241,0.15)' : 'transparent',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Right Content Panel */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }} className="space-y-4">
        {error && <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs text-rose-400">{error}</div>}
        {success && <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs text-emerald-400">{success}</div>}

        {activeSubTab === 'create' ? (
          <div className="space-y-6">
            {/* AI Generator */}
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-5 space-y-4">
              <h3 className="text-xs font-bold text-violet-400 uppercase tracking-wider">🤖 AI JD Proposal Generator</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input type="text" placeholder="Title: e.g. Lead React Developer" value={genTitle} onChange={e => setGenTitle(e.target.value)}
                  className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none" />
                <input type="text" placeholder="Department: e.g. Frontend Engineering" value={genDeptName} onChange={e => setGenDeptName(e.target.value)}
                  className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none" />
                <input type="text" placeholder="Skills: React, TypeScript, Redux" value={genSkills} onChange={e => setGenSkills(e.target.value)}
                  className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none col-span-1" />
              </div>
              <button onClick={handleGenerateProposal} disabled={generating}
                className="w-full rounded-lg bg-violet-600 hover:bg-violet-500 py-2.5 text-xs font-bold text-white transition disabled:opacity-50">
                {generating ? 'Generating Proposal...' : 'Create Draft Proposal'}
              </button>
            </div>

            {/* Manual Form */}
            <form onSubmit={handleCreateJob} className="rounded-xl border border-white/5 bg-slate-900/40 p-5 space-y-4 text-xs">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Job Specifications</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400">Designation / Job Title</label>
                  <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} required placeholder="e.g. Senior Software Engineer"
                    className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white placeholder-slate-500 focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400">Target Department</label>
                  <select value={newDeptId} onChange={e => setNewDeptId(e.target.value)} required
                    className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white focus:outline-none">
                    <option value="">Select Department...</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400">Experience Required</label>
                  <input type="text" value={newExp} onChange={e => setNewExp(e.target.value)} placeholder="e.g. 3-5 Years"
                    className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400">Salary Package</label>
                  <input type="text" value={newSalary} onChange={e => setNewSalary(e.target.value)} placeholder="e.g. 15-20 LPA"
                    className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400">Employment Type</label>
                  <select value={newEmpType} onChange={e => setNewEmpType(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white focus:outline-none">
                    <option value="Full-Time">Full-Time</option>
                    <option value="Contract">Contract</option>
                    <option value="Internship">Internship</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400">Designation Level</label>
                  <input type="text" value={newDesignation} onChange={e => setNewDesignation(e.target.value)} placeholder="e.g. Senior"
                    className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white focus:outline-none" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400">Skills Profile (comma separated)</label>
                <input type="text" value={newRequirements} onChange={e => setNewRequirements(e.target.value)} placeholder="React, TypeScript, Tailwind"
                  className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white focus:outline-none" />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400">Responsibilities & Job Description</label>
                <textarea rows={6} value={newDesc} onChange={e => setNewDesc(e.target.value)} required placeholder="Add full job description details..."
                  className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white focus:outline-none resize-none" />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400">Benefits & Perks</label>
                <input type="text" value={newBenefits} onChange={e => setNewBenefits(e.target.value)} placeholder="Medical Insurance, 401k match, remote setup"
                  className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white focus:outline-none" />
              </div>

              <button type="submit" disabled={saving}
                className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 py-3 text-xs font-bold text-white transition disabled:opacity-50">
                {saving ? 'Saving Job Post...' : 'Save Job Post Draft'}
              </button>
            </form>
          </div>
        ) : (
          /* Grid of Jobs listings */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loading ? (
              <div className="col-span-2 flex h-40 items-center justify-center">
                <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : getFilteredJobs().length === 0 ? (
              <div className="col-span-2 rounded-2xl border border-dashed border-white/10 p-12 text-center text-slate-500">
                <div className="text-4xl mb-3">💼</div>
                <p className="text-sm">No jobs registered in this section.</p>
              </div>
            ) : (
              getFilteredJobs().map(job => (
                <div key={job.id} className="rounded-xl border border-white/5 bg-slate-900/40 p-5 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-base font-bold text-white">{job.title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Status: <span className="text-emerald-400 font-bold">{job.status}</span></p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">{job.description}</p>

                  <div className="flex flex-wrap gap-1">
                    {job.requirements.slice(0, 4).map(req => (
                      <span key={req} className="rounded bg-slate-800 border border-white/5 px-2 py-0.5 text-[10px] text-slate-300">{req}</span>
                    ))}
                  </div>

                  <div className="border-t border-white/5 pt-3 flex gap-2 justify-end">
                    {job.status === 'DRAFT' && (
                      <button onClick={() => handleApproveJob(job.id)}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-500 transition">
                        ✔ Legal & Admin Approve
                      </button>
                    )}
                    {job.status === 'APPROVED' && (
                      <button onClick={() => setPublishingJobId(job.id)}
                        className="rounded-lg bg-violet-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-violet-500 transition">
                        🚀 Distribute Channels
                      </button>
                    )}
                    {job.status === 'PUBLISHED' && (
                      <button
                        onClick={async () => {
                          setViewApplicantsJobId(job.id);
                          setViewApplicantsJobTitle(job.title);
                          setApplicants([]);
                          setApplicantsLoading(true);
                          try {
                            const res = await fetch(
                              `${process.env.NEXT_PUBLIC_API_URL}/api/v1/applications?job_id=${job.id}`,
                              { headers: getHeaders() }
                            );
                            if (res.ok) setApplicants(await res.json());
                          } catch {}
                          finally { setApplicantsLoading(false); }
                        }}
                        className="rounded-lg bg-slate-800 border border-white/10 px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:text-white transition"
                      >
                        👥 View Applicants
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* View Applicants Modal */}
      {viewApplicantsJobId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="rounded-xl border border-white/10 bg-slate-900 p-6 w-[640px] max-h-[80vh] flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <div>
                <h3 className="text-base font-bold text-white">Job Applicants</h3>
                <p className="text-xs text-slate-500 mt-0.5">{viewApplicantsJobTitle}</p>
              </div>
              <button onClick={() => { setViewApplicantsJobId(null); setApplicants([]); }} className="text-slate-400 hover:text-white font-bold">✕ Close</button>
            </div>

            {applicantsLoading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="w-6 h-6 border border-violet-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : applicants.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">No applicants have registered for this posting yet.</p>
            ) : (
              <div className="overflow-y-auto space-y-2 flex-1 pr-1">
                {applicants.map(app => (
                  <div key={app.id} className="flex justify-between items-center bg-slate-950/40 p-3 rounded-lg border border-white/5 text-xs">
                    <div>
                      <p className="font-semibold text-white">{app.candidate_name}</p>
                      <p className="text-slate-500 text-[10px]">{app.candidate_email}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-violet-400">{Math.round(app.fit_score)}% AI Fit</p>
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[8px] font-black text-slate-400 uppercase">{app.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Publish Channels Modal */}
      {publishingJobId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="rounded-xl border border-white/10 bg-slate-900 p-6 w-[400px] space-y-4">
            <h3 className="text-base font-bold text-white">Distribute Job Channels</h3>
            <div className="space-y-2 text-xs">
              {['linkedin', 'indeed', 'glassdoor'].map(chan => (
                <label key={chan} className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input type="checkbox" checked={selectedChannels.includes(chan)}
                    onChange={e => {
                      if (e.target.checked) setSelectedChannels(prev => [...prev, chan]);
                      else setSelectedChannels(prev => prev.filter(c => c !== chan));
                    }}
                  />
                  <span className="capitalize">{chan}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 text-xs">
              <button onClick={() => setPublishingJobId(null)} className="rounded border border-white/10 px-3 py-1.5 text-slate-400 hover:text-white transition">Cancel</button>
              <button onClick={handlePublishJob} disabled={publishing} className="rounded bg-violet-600 px-4 py-1.5 font-bold text-white hover:bg-violet-500 transition">
                {publishing ? 'Publishing...' : 'Confirm Sourcing'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
