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

export default function JobsDashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
  const [saving, setSaving] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

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
        
        // Auto-select department matching the name if it exists
        const matched = departments.find(d => d.name.toLowerCase() === genDeptName.toLowerCase());
        if (matched) {
          setNewDeptId(matched.id);
        } else if (departments.length > 0) {
          setNewDeptId(departments[0].id);
        }
        
        setShowCreateModal(true);
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
          requirements: newRequirements.split(',').map(r => r.trim()).filter(Boolean)
        })
      });
      
      if (res.ok) {
        const created = await res.json();
        setJobs([created, ...jobs]);
        setShowCreateModal(false);
        setSuccess('Job posting draft created successfully.');
        
        // Reset fields
        setNewTitle('');
        setNewDesc('');
        setNewRequirements('');
        setNewDeptId('');
        setGenTitle('');
        setGenDeptName('');
        setGenSkills('');
      } else {
        const data = await res.json();
        setError(data.detail || 'Failed to create job posting.');
      }
    } catch (err) {
      setError('Failed to save job posting.');
    } finally {
      setSaving(false);
    }
  };

  const handleApproveJob = async (id: string) => {
    setError('');
    setSuccess('');
    try {
      const res = await clientApprove(id);
      if (res.ok) {
        const updated = await res.json();
        setJobs(jobs.map(j => j.id === id ? updated : j));
        setSuccess('Job posting approved for distribution channels.');
      } else {
        const data = await res.json();
        setError(data.detail || 'Failed to approve job.');
      }
    } catch (err) {
      setError('Connection error.');
    }
  };

  const clientApprove = (id: string) => {
    const headers = getHeaders();
    return fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/jobs/${id}/approve`, {
      method: 'POST',
      headers
    });
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
        const updated = await res.json();
        setJobs(jobs.map(j => j.id === publishingJobId ? updated : j));
        setPublishingJobId(null);
        setSuccess('Job posting distributed to target job boards successfully.');
      } else {
        const data = await res.json();
        setError(data.detail || 'Failed to publish job.');
      }
    } catch (err) {
      setError('Failed to distribute job.');
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return <div className="card text-center" style={{ padding: '40px' }}><p>Loading sourcing boards...</p></div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Recruitment JDs & Channels</h1>
          <p className="text-secondary">Generate policy-compliant job descriptions and distribute tracking referrals across boards.</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)} 
          className="button button-primary"
        >
          âž• Create Job Manually
        </button>
      </div>

      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      {/* AI Job Description Generator Console */}
      <div className="card">
        <h3>Autonomous Job Description Agent</h3>
        <p className="text-secondary" style={{ fontSize: 13, marginTop: -5 }}>
          Generates gender-neutral, demographic-blind job drafts formatted using system registry prompts.
        </p>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 2fr 1fr 1fr', gap: 12, alignItems: 'flex-end', marginTop: 12 }}>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 500, display: 'block', marginBottom: 4 }}>Job Title</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Senior Rust Engineer"
              value={genTitle}
              onChange={e => setGenTitle(e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 500, display: 'block', marginBottom: 4 }}>Department</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Core Platform"
              value={genDeptName}
              onChange={e => setGenDeptName(e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 500, display: 'block', marginBottom: 4 }}>Core Skills (Comma separated)</label>
            <input
              type="text"
              className="form-control"
              placeholder="Rust, Tokio, Concurrency, gRPC"
              value={genSkills}
              onChange={e => setGenSkills(e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 500, display: 'block', marginBottom: 4 }}>Autonomy Level</label>
            <select
              value={genAutonomy}
              onChange={e => setGenAutonomy(e.target.value)}
              className="form-control"
            >
              <option value="ASSISTED">Assisted</option>
              <option value="SEMI_AUTONOMOUS">Semi-Autonomous</option>
              <option value="AUTONOMOUS">Autonomous</option>
            </select>
          </div>
          <button 
            onClick={handleGenerateProposal} 
            className="button button-primary" 
            disabled={generating}
            style={{ width: '100%' }}
          >
            {generating ? 'Drafting...' : 'Draft JD'}
          </button>
        </div>
      </div>

      {/* Main Jobs Listing Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
        {jobs.map(job => (
          <div key={job.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 220 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <span 
                  className="badge" 
                  style={{
                    background: job.status === 'PUBLISHED' ? 'rgba(16,185,129,0.1)' : job.status === 'APPROVED' ? 'rgba(99,102,241,0.1)' : 'rgba(156,163,175,0.1)',
                    color: job.status === 'PUBLISHED' ? '#10b981' : job.status === 'APPROVED' ? '#6366f1' : '#9ca3af',
                  }}
                >
                  {job.status}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {new Date(job.created_at).toLocaleDateString()}
                </span>
              </div>
              <h2 style={{ fontSize: 18, margin: '4px 0' }}>{job.title}</h2>
              <span className="text-secondary" style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>
                Dept Code: {job.department_id.substr(0, 8)}...
              </span>
              
              <div 
                style={{ 
                  fontSize: 13, 
                  maxHeight: 100, 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  display: '-webkit-box', 
                  WebkitLineClamp: 3, 
                  WebkitBoxOrient: 'vertical',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                  marginBottom: 16
                }}
              >
                {job.description}
              </div>
            </div>

            <div>
              <hr style={{ margin: '12px 0' }} />
              
              {/* Sourcing Channel Referral Links */}
              {job.status === 'PUBLISHED' && Object.keys(job.sourcing_channels).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                    Referral Sourcing Channels:
                  </span>
                  {Object.entries(job.sourcing_channels).map(([chan, info]) => (
                    <div key={chan} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                      <span className="badge" style={{ background: 'var(--color-primary-500)', color: '#fff', fontSize: 10 }}>{chan}</span>
                      <input
                        type="text"
                        readOnly
                        value={info.referral_url}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 11, width: '100%', outline: 'none' }}
                        onClick={e => (e.target as HTMLInputElement).select()}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Action Operations */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                {job.status === 'DRAFT' && (
                  <button 
                    onClick={() => handleApproveJob(job.id)} 
                    className="button"
                    style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)' }}
                  >
                    âœ”ï¸ Legal & Admin Approve
                  </button>
                )}
                {job.status === 'APPROVED' && (
                  <button 
                    onClick={() => setPublishingJobId(job.id)} 
                    className="button button-primary"
                  >
                    ðŸš€ Distribute Channels
                  </button>
                )}
                {job.status === 'PUBLISHED' && (
                  <button 
                    onClick={() => alert('Candidates are actively applying to this job. The system gathers demographics Disparate Impact statistics dynamically.')} 
                    className="button"
                    style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}
                  >
                    ðŸ“Š View Applicant Ratios
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 1. Create / Edit Job Modal */}
      {showCreateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: 650, maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2>Create Job Posting Draft</h2>
            <form onSubmit={handleCreateJob} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Job Title</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Target Department</label>
                <select 
                  className="form-control" 
                  required
                  value={newDeptId}
                  onChange={e => setNewDeptId(e.target.value)}
                >
                  <option value="">Select Department...</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Core Requirements (comma separated)</label>
                <input
                  type="text"
                  className="form-control"
                  value={newRequirements}
                  onChange={e => setNewRequirements(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Markdown Job Description</label>
                <textarea
                  rows={8}
                  className="form-control"
                  style={{ fontFamily: 'monospace', fontSize: 13 }}
                  required
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="button">
                  Cancel
                </button>
                <button type="submit" className="button button-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Job Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Publish Sourcing Channels Modal */}
      {publishingJobId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: 450, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2>Distribute Sourcing Channels</h2>
            <p className="text-secondary" style={{ fontSize: 13, marginTop: -10 }}>
              Distribute this approved job posting to external platforms and generate unique referral trackers.
            </p>
            
            <form onSubmit={handlePublishJob} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { id: 'linkedin', label: 'LinkedIn Jobs Portal' },
                  { id: 'indeed', label: 'Indeed Recruitment' },
                  { id: 'glassdoor', label: 'Glassdoor Sourcing' }
                ].map(chan => (
                  <label key={chan.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedChannels.includes(chan.id)}
                      onChange={e => {
                        const next = e.target.checked 
                          ? [...selectedChannels, chan.id] 
                          : selectedChannels.filter(x => x !== chan.id);
                        setSelectedChannels(next);
                      }}
                    />
                    <strong>{chan.label}</strong>
                  </label>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setPublishingJobId(null)} className="button">
                  Cancel
                </button>
                <button type="submit" className="button button-primary" disabled={publishing}>
                  {publishing ? 'Distributing...' : 'Confirm Sourcing Launch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
