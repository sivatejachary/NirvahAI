'use client';

import { useState, useEffect, useCallback } from 'react';

interface PreBoardingRecord {
  id: string;
  candidate_name: string;
  candidate_email: string;
  job_title: string;
  welcome_email_sent: boolean;
  collected_docs: string[]; // ID, Degree, Experience, Photo
  laptop_provisioned: boolean;
  official_email: string | null;
  employee_id: string | null;
}

export default function PreBoardingPage() {
  const [records, setRecords] = useState<PreBoardingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
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

      let appsData: Array<{ id: string; candidate_name: string; candidate_email: string; job_id: string; status: string }> = [];
      let jobsData: Array<{ id: string; title: string }> = [];

      if (appRes.ok) appsData = await appRes.json();
      if (jobsRes.ok) jobsData = await jobsRes.json();

      // Show candidates who are in OFFER_STAGE / COMPLETED / pre-boarding
      const filteredApps = appsData.filter(a => a.status === 'OFFER_STAGE' || a.status === 'COMPLETED');

      const dummyRecords: PreBoardingRecord[] = filteredApps.map((a, idx) => ({
        id: a.id,
        candidate_name: a.candidate_name,
        candidate_email: a.candidate_email,
        job_title: jobsData.find(j => j.id === a.job_id)?.title || 'Software Engineer',
        welcome_email_sent: idx % 2 === 0,
        collected_docs: idx % 3 === 0 ? ['Government ID', 'Degree Certificate', 'Relieving Letter'] : ['Government ID'],
        laptop_provisioned: idx % 4 === 0,
        official_email: idx % 2 === 0 ? `${a.candidate_name.toLowerCase().replace(' ', '.')}@company.com` : null,
        employee_id: idx % 2 === 0 ? `EMP-${1000 + idx}` : null
      }));

      setRecords(dummyRecords);
    } catch {
      setErrorMsg('Failed to load pre-boarding records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleWelcomeEmail = async (id: string) => {
    setActionLoading(id);
    setSuccessMsg('Welcome email successfully dispatched to candidate.');
    setTimeout(() => {
      setRecords(prev => prev.map(r => r.id === id ? { ...r, welcome_email_sent: true } : r));
      setActionLoading(null);
      setTimeout(() => setSuccessMsg(''), 3000);
    }, 1000);
  };

  const handleProvisionIT = async (id: string, name: string) => {
    setActionLoading(id);
    setSuccessMsg('IT provisioning request submitted. Employee ID and email allocated.');
    setTimeout(() => {
      setRecords(prev => prev.map(r => r.id === id ? {
        ...r,
        laptop_provisioned: true,
        employee_id: `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
        official_email: `${name.toLowerCase().replace(' ', '.')}@company.com`
      } : r));
      setActionLoading(null);
      setTimeout(() => setSuccessMsg(''), 3000);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Pre-Boarding & Provisioning</h1>
        <p className="text-xs text-slate-400 mt-0.5">Asset requests, email generation, and pre-joining candidate checklists</p>
      </div>

      {successMsg && <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-400">{successMsg}</div>}
      {errorMsg && <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400">{errorMsg}</div>}

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : records.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-slate-500">
          <div className="text-4xl mb-3">🎉</div>
          <p className="text-sm">No candidates currently in pre-boarding stage.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {records.map(record => (
            <div key={record.id} className="rounded-xl border border-white/5 bg-slate-900/40 p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-sm font-semibold text-white">{record.candidate_name}</h3>
                  <p className="text-xs text-slate-500">{record.job_title}</p>
                </div>
                <span className="rounded bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 text-[9px] font-black text-violet-400 uppercase">
                  {record.employee_id || 'PRE-JOIN'}
                </span>
              </div>

              {/* Progress Checklist */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-2 border-r border-white/5 pr-4">
                  <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Operations Check</h4>
                  <div className="flex items-center gap-2">
                    <span className={record.welcome_email_sent ? 'text-emerald-400' : 'text-slate-500'}>
                      {record.welcome_email_sent ? '✅' : '⏳'} Welcome Email
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={record.laptop_provisioned ? 'text-emerald-400' : 'text-slate-500'}>
                      {record.laptop_provisioned ? '✅' : '⏳'} Laptop Ordered
                    </span>
                  </div>
                </div>

                <div className="space-y-2 pl-2">
                  <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">IT & Profile Details</h4>
                  <p className="text-slate-400">ID: <span className="text-slate-200">{record.employee_id || 'Pending'}</span></p>
                  <p className="text-slate-400">Email: <span className="text-slate-200">{record.official_email || 'Pending'}</span></p>
                </div>
              </div>

              {/* Documents collected */}
              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Document Ingestion Checklist</h4>
                <div className="flex flex-wrap gap-1.5">
                  {['Government ID', 'Degree Certificate', 'Relieving Letter'].map(doc => {
                    const hasDoc = record.collected_docs.includes(doc);
                    return (
                      <span key={doc} className={`rounded px-2 py-0.5 text-[10px] border ${
                        hasDoc 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : 'bg-slate-950 border-white/5 text-slate-500'
                      }`}>
                        {hasDoc ? '✓' : '✗'} {doc}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 border-t border-white/5 pt-3">
                {!record.welcome_email_sent && (
                  <button onClick={() => toggleWelcomeEmail(record.id)} disabled={actionLoading === record.id}
                    className="flex-1 rounded bg-violet-600 hover:bg-violet-500 text-[10px] font-bold text-white py-1.5 transition">
                    Send Welcome Email
                  </button>
                )}
                {!record.laptop_provisioned && (
                  <button onClick={() => handleProvisionIT(record.id, record.candidate_name)} disabled={actionLoading === record.id}
                    className="flex-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 py-1.5 transition">
                    Provision Laptop & Email
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
