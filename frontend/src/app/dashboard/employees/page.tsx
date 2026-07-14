'use client';

import { useState, useEffect } from 'react';

interface Employee {
  id: string;
  name: string;
  email: string;
  department?: string;
  role?: string;
  status: string;
  hire_date?: string;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/applications`, { headers }),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/company/departments`, { headers }),
    ]).then(async ([appRes, deptRes]) => {
      const apps: { id: string; candidate_name: string; candidate_email: string; status: string; created_at: string; job_id: string }[] = appRes.ok ? await appRes.json() : [];
      const depts: { id: string; name: string }[] = deptRes.ok ? await deptRes.json() : [];
      setDepartments(depts);

      // Employees = hired applications
      const hired = apps
        .filter(a => a.status?.toLowerCase() === 'hired')
        .map(a => ({
          id: a.id,
          name: a.candidate_name,
          email: a.candidate_email,
          status: 'active',
          hire_date: a.created_at,
        }));
      setEmployees(hired);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = employees.filter(e =>
    (e.name?.toLowerCase().includes(search.toLowerCase()) || e.email?.toLowerCase().includes(search.toLowerCase())) &&
    (deptFilter === 'ALL' || e.department === deptFilter)
  );

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Employees</h1>
          <p>{employees.length} active employees</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid-4 mb-6">
        {[
          { label: 'Total Employees', value: employees.length, icon: '👥', color: '#6366f1' },
          { label: 'Active', value: employees.filter(e => e.status === 'active').length, icon: '✅', color: '#10b981' },
          { label: 'Departments', value: departments.length, icon: '🗂️', color: '#8b5cf6' },
          { label: 'New This Month', value: employees.filter(e => {
            const d = new Date(e.hire_date || '');
            const now = new Date();
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          }).length, icon: '🎉', color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color, marginBottom: 4 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <input
          type="text"
          className="input"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, maxWidth: 340 }}
        />
        <select className="input" value={deptFilter} onChange={e => setDeptFilter(e.target.value)} style={{ width: 200 }}>
          <option value="ALL">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner" style={{ margin: 'auto', width: 28, height: 28 }} /></div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>👥</div>
            <p style={{ fontWeight: 600 }}>No employees yet</p>
            <p style={{ fontSize: 13 }}>Employees appear here when candidates are marked as Hired.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {['Employee', 'Email', 'Department', 'Status', 'Hire Date'].map(h => (
                  <th key={h} style={{ padding: '12px 24px', textAlign: 'left', fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(emp => (
                <tr key={emp.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background var(--transition-base)' }}>
                  <td style={{ padding: '14px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', background: 'var(--color-primary-900)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--color-primary-300)', fontWeight: 700, fontSize: 14, flexShrink: 0,
                      }}>
                        {emp.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <span style={{ fontWeight: 600 }}>{emp.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 24px', color: 'var(--text-secondary)', fontSize: 13 }}>{emp.email}</td>
                  <td style={{ padding: '14px 24px', color: 'var(--text-secondary)', fontSize: 13 }}>{emp.department || '—'}</td>
                  <td style={{ padding: '14px 24px' }}>
                    <span className="badge badge-success">Active</span>
                  </td>
                  <td style={{ padding: '14px 24px', color: 'var(--text-secondary)', fontSize: 13 }}>
                    {emp.hire_date ? new Date(emp.hire_date).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
