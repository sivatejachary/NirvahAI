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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-white">All Applications</h1>
          <p className="text-xs text-slate-400 mt-0.5">Comprehensive view of all candidate applications received</p>
        </div>
        <input type="text" placeholder="Search applications..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          className="rounded-lg border border-white/10 bg-slate-900 px-4 py-2 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none w-64" />
      </div>

      {errorMsg && <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400">{errorMsg}</div>}

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-slate-500">
          <div className="text-4xl mb-3">📥</div>
          <p className="text-sm">No applications found.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/5 bg-slate-900/20 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 font-semibold uppercase border-b border-white/5">
              <tr>
                <th className="p-4">Candidate</th>
                <th className="p-4">Job Role</th>
                <th className="p-4">ATS Match</th>
                <th className="p-4">Status</th>
                <th className="p-4">Applied Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {filtered.map(app => (
                <tr key={app.id} className="hover:bg-white/3 transition">
                  <td className="p-4 font-medium text-white">
                    <div>{app.candidate_name}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{app.candidate_email}</div>
                  </td>
                  <td className="p-4">{app.job_title}</td>
                  <td className="p-4 font-bold text-violet-400">{Math.round(app.fit_score)}%</td>
                  <td className="p-4">
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[9px] font-black uppercase text-slate-300 border border-white/5">
                      {app.status.replace('_STAGE', '')}
                    </span>
                  </td>
                  <td className="p-4 text-slate-500">{new Date(app.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
