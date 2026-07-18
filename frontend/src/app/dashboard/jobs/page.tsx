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

  const handleDeleteJob = async (jobId: string) => {
    if (!window.confirm('Are you sure you want to delete this job posting? This will also remove it from VidyaMarg AI.')) return;
    setError('');
    setSuccess('');
    try {
      const headers = getHeaders();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/jobs/${jobId}`, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        setSuccess('Job posting deleted and sync request sent to VidyaMarg AI.');
        await loadData();
      } else {
        const data = await res.json();
        setError(data.detail || 'Failed to delete job posting.');
      }
    } catch {
      setError('Connection error.');
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
      <div style={{ width: '200px', flexShrink: 0, borderRight: '1px solid var(--border-subtle)', paddingRight: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Job Options</h3>
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
            className={`btn ${activeSubTab === t.id ? 'btn-primary' : 'btn-ghost'}`}
            style={{ textAlign: 'left', width: '100%', justifyContent: 'flex-start' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Right Content Panel */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }} className="space-y-4">
        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}

        {activeSubTab === 'create' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* AI Generator */}
            <div className="card" style={{ background: 'rgba(124, 58, 237, 0.05)', borderColor: 'rgba(124, 58, 237, 0.2)' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-primary-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '16px' }}>🤖 AI JD Proposal Generator</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Title</label>
                  <input type="text" placeholder="e.g. Lead React Developer" value={genTitle} onChange={e => setGenTitle(e.target.value)} className="input" />
                </div>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <input type="text" placeholder="e.g. Engineering" value={genDeptName} onChange={e => setGenDeptName(e.target.value)} className="input" />
                </div>
                <div className="form-group">
                  <label className="form-label">Skills</label>
                  <input type="text" placeholder="React, TypeScript" value={genSkills} onChange={e => setGenSkills(e.target.value)} className="input" />
                </div>
              </div>
              <button onClick={handleGenerateProposal} disabled={generating} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                {generating ? 'Generating Proposal...' : 'Create Draft Proposal'}
              </button>
            </div>

            {/* Manual Form */}
            <form onSubmit={handleCreateJob} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Job Specifications</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Designation / Job Title</label>
                  <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} required placeholder="e.g. Senior Software Engineer" className="input" />
                </div>
                <div className="form-group">
                  <label className="form-label">Target Department</label>
                  <select value={newDeptId} onChange={e => setNewDeptId(e.target.value)} required className="input">
                    <option value="">Select Department...</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Experience</label>
                  <input type="text" value={newExp} onChange={e => setNewExp(e.target.value)} placeholder="e.g. 3-5 Years" className="input" />
                </div>
                <div className="form-group">
                  <label className="form-label">Salary</label>
                  <input type="text" value={newSalary} onChange={e => setNewSalary(e.target.value)} placeholder="e.g. 15-20 LPA" className="input" />
                </div>
                <div className="form-group">
                  <label className="form-label">Employment Type</label>
                  <select value={newEmpType} onChange={e => setNewEmpType(e.target.value)} className="input">
                    <option value="Full-Time">Full-Time</option>
                    <option value="Contract">Contract</option>
                    <option value="Internship">Internship</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Level</label>
                  <input type="text" value={newDesignation} onChange={e => setNewDesignation(e.target.value)} placeholder="e.g. Senior" className="input" />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Skills Profile (comma separated)</label>
                <input type="text" value={newRequirements} onChange={e => setNewRequirements(e.target.value)} placeholder="React, TypeScript, Tailwind" className="input" />
              </div>

              <div className="form-group">
                <label className="form-label">Responsibilities & Job Description</label>
                <textarea rows={5} value={newDesc} onChange={e => setNewDesc(e.target.value)} required placeholder="Add full job description details..." className="input" />
              </div>

              <div className="form-group">
                <label className="form-label">Benefits & Perks</label>
                <input type="text" value={newBenefits} onChange={e => setNewBenefits(e.target.value)} placeholder="Medical Insurance, remote setup" className="input" />
              </div>

              <button type="submit" disabled={saving} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                {saving ? 'Saving Job Post...' : 'Save Job Post Draft'}
              </button>
            </form>
          </div>
        ) : (
          /* Grid of Jobs listings */
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {loading ? (
              <div style={{ gridColumn: 'span 2', display: 'flex', height: 160, alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner" style={{ width: 28, height: 28 }} />
              </div>
            ) : getFilteredJobs().length === 0 ? (
              <div style={{ gridColumn: 'span 2', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 48, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>💼</div>
                <p>No jobs registered in this section.</p>
              </div>
            ) : (
              getFilteredJobs().map(job => (
                <div key={job.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{job.title}</h3>
                      <span className={`badge ${job.status === 'PUBLISHED' ? 'badge-success' : 'badge-primary'}`}>{job.status}</span>
                    </div>
                    <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{job.description}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {job.requirements.slice(0, 4).map(req => (
                        <span key={req} className="badge badge-default" style={{ fontSize: '10px' }}>{req}</span>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                    <button onClick={() => handleDeleteJob(job.id)} className="btn btn-danger btn-sm">
                      🗑️ Delete
                    </button>
                    {job.status === 'DRAFT' && (
                      <button onClick={() => handleApproveJob(job.id)} className="btn btn-secondary btn-sm">
                        ✔ Approve JD
                      </button>
                    )}
                    {job.status === 'APPROVED' && (
                      <button onClick={() => setPublishingJobId(job.id)} className="btn btn-primary btn-sm">
                        🚀 Publish
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
                        className="btn btn-secondary btn-sm"
                      >
                        👥 Applicants
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '560px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Job Applicants</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{viewApplicantsJobTitle}</p>
              </div>
              <button onClick={() => { setViewApplicantsJobId(null); setApplicants([]); }} className="btn btn-ghost btn-sm">✕ Close</button>
            </div>

            {applicantsLoading ? (
              <div style={{ display: 'flex', height: 120, alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner" style={{ width: 24, height: 24 }} />
              </div>
            ) : applicants.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '24px 0' }}>No applicants have registered for this posting yet.</p>
            ) : (
              <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {applicants.map(app => (
                  <div key={app.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-3)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{app.candidate_name}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{app.candidate_email}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-primary-400)' }}>{Math.round(app.fit_score)}% AI Fit</p>
                      <span className="badge badge-default" style={{ fontSize: '9px', marginTop: 4 }}>{app.status}</span>
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '380px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Distribute Job Channels</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {['linkedin', 'indeed', 'glassdoor'].map(chan => (
                <label key={chan} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input type="checkbox" checked={selectedChannels.includes(chan)}
                    onChange={e => {
                      if (e.target.checked) setSelectedChannels(prev => [...prev, chan]);
                      else setSelectedChannels(prev => prev.filter(c => c !== chan));
                    }}
                  />
                  <span style={{ textTransform: 'capitalize' }}>{chan}</span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
              <button onClick={() => setPublishingJobId(null)} className="btn btn-ghost btn-sm">Cancel</button>
              <button onClick={handlePublishJob} disabled={publishing} className="btn btn-primary btn-sm">
                {publishing ? 'Publishing...' : 'Confirm Sourcing'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
