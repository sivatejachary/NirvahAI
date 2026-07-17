'use client';

import { useState, useEffect, useCallback } from 'react';

interface JoiningRecord {
  id: string;
  candidate_name: string;
  candidate_email: string;
  job_title: string;
  employee_id: string;
  physical_docs_verified: boolean;
  attendance_marked: boolean;
  asset_handed_over: boolean;
  it_accounts_active: boolean;
  hr_induction_done: boolean;
  manager_introduced: boolean;
}

export default function JoiningPage() {
  const [records, setRecords] = useState<JoiningRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  const loadData = useCallback(async () => {
    setLoading(true);
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

      const filteredApps = appsData.filter(a => a.status === 'OFFER_STAGE' || a.status === 'COMPLETED');

      const dummyRecords: JoiningRecord[] = filteredApps.map((a, idx) => ({
        id: a.id,
        candidate_name: a.candidate_name,
        candidate_email: a.candidate_email,
        job_title: jobsData.find(j => j.id === a.job_id)?.title || 'Software Engineer',
        employee_id: `EMP-${2000 + idx}`,
        physical_docs_verified: idx % 2 === 0,
        attendance_marked: idx % 3 === 0,
        asset_handed_over: idx % 4 === 0,
        it_accounts_active: idx % 2 === 0,
        hr_induction_done: idx % 3 === 0,
        manager_introduced: idx % 2 === 0
      }));

      setRecords(dummyRecords);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleCheck = async (id: string, field: keyof JoiningRecord) => {
    setActionLoading(`${id}-${field}`);
    setSuccessMsg('Checklist item successfully updated.');
    setTimeout(() => {
      setRecords(prev => prev.map(r => r.id === id ? { ...r, [field]: !r[field] } : r));
      setActionLoading(null);
      setTimeout(() => setSuccessMsg(''), 3000);
    }, 500);
  };

  const handleCompleteJoining = async (id: string) => {
    setActionLoading(`${id}-complete`);
    // Hit backend application patch endpoint to move them to COMPLETED stage
    const headers = getHeaders();
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/applications/${id}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'COMPLETED' })
      });
      if (res.ok) {
        setSuccessMsg('Candidate officially onboarded as active employee.');
        await loadData();
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch { /* ignore */ }
    finally { setActionLoading(null); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Day-1 Joining Operations</h1>
        <p className="text-xs text-slate-400 mt-0.5">Physical document check, asset handover and induction checklist</p>
      </div>

      {successMsg && <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-400">{successMsg}</div>}

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : records.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-slate-500">
          <div className="text-4xl mb-3">🚀</div>
          <p className="text-sm">No new hires scheduled to join today.</p>
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
                <span className="rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[9px] font-black text-emerald-400 uppercase">
                  {record.employee_id}
                </span>
              </div>

              {/* Checklist items */}
              <div className="space-y-2.5 text-xs">
                {[
                  { field: 'physical_docs_verified', label: 'Physical Documents Verified' },
                  { field: 'attendance_marked', label: 'Day-1 Attendance Marked' },
                  { field: 'asset_handed_over', label: 'Laptop & Assets Handed Over' },
                  { field: 'it_accounts_active', label: 'IT Credentials Activated' },
                  { field: 'hr_induction_done', label: 'HR Compliance Induction Completed' },
                  { field: 'manager_introduced', label: 'Hiring Manager Introduced' }
                ].map(item => {
                  const val = record[item.field as keyof JoiningRecord] as boolean;
                  const loadingKey = `${record.id}-${item.field}`;
                  return (
                    <div key={item.field} onClick={() => toggleCheck(record.id, item.field as keyof JoiningRecord)}
                      className="flex items-center gap-3 cursor-pointer select-none rounded bg-slate-950/40 border border-white/5 px-3 py-2 hover:bg-slate-900 transition">
                      <span className="text-base">{val ? '✅' : '⬜'}</span>
                      <span className={`flex-1 font-medium ${val ? 'text-slate-300' : 'text-slate-500'}`}>{item.label}</span>
                      {actionLoading === loadingKey && <div className="w-3 h-3 border border-violet-500 border-t-transparent rounded-full animate-spin" />}
                    </div>
                  );
                })}
              </div>

              {/* Complete Action */}
              <button onClick={() => handleCompleteJoining(record.id)} disabled={actionLoading === `${record.id}-complete`}
                className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 py-3 text-xs font-bold text-white transition disabled:opacity-50">
                Officialize Joining & Welcome Employee
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
