'use client';

import { useState, useEffect, useCallback } from 'react';

interface Application {
  id: string;
  job_id: string;
  candidate_name: string;
  candidate_email: string;
  job_title?: string;
  status: string;
  fit_score: number;
  created_at: string;
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
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
      let appsData: Application[] = [];
      let jobsData: Array<{ id: string; title: string }> = [];

      if (appRes.ok) appsData = await appRes.json();
      if (jobsRes.ok) jobsData = await jobsRes.json();

      const mapped = appsData.map(a => ({
        ...a,
        job_title: jobsData.find(j => j.id === a.job_id)?.title || 'Software Engineer'
      }));

      setApplications(mapped);
    } catch {
      setErrorMsg('Failed to load applications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = applications.filter(app =>
    app.candidate_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.candidate_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.job_title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 800 }}>All Applications</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 2 }}>Comprehensive view of all candidate applications received</p>
        </div>
        <input type="text" placeholder="Search applications..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          className="input" style={{ width: '260px' }} />
      </div>

      {errorMsg && <div className="alert alert-error">{errorMsg}</div>}

      {loading ? (
        <div style={{ display: 'flex', height: 120, alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner" style={{ width: 24, height: 24 }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 48, textAlign: 'center', color: 'var(--text-tertiary)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📥</div>
          <p>No applications found.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Job Role</th>
                <th>ATS Match</th>
                <th>Status</th>
                <th>Applied Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(app => (
                <tr key={app.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    <div>{app.candidate_name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 400 }}>{app.candidate_email}</div>
                  </td>
                  <td>{app.job_title}</td>
                  <td style={{ fontWeight: 700, color: app.fit_score >= 80 ? 'var(--color-accent-400)' : 'var(--color-primary-400)' }}>
                    {Math.round(app.fit_score)}%
                  </td>
                  <td>
                    <span className="badge badge-primary">{app.status}</span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {new Date(app.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
