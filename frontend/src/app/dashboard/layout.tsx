'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV_ITEMS = [
  {
    section: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: 'grid' },
      { href: '/dashboard/settings/wizard', label: 'Setup Wizard', icon: 'zap' },
    ]
  },
  {
    section: 'Hiring',
    items: [
      { href: '/dashboard/jobs', label: 'Jobs', icon: 'briefcase' },
      { href: '/dashboard/candidates', label: 'Candidates', icon: 'users' },
      { href: '/dashboard/pipeline', label: 'Pipeline', icon: 'activity' },
      { href: '/dashboard/interviews', label: 'Interviews', icon: 'video' },
      { href: '/dashboard/calls', label: 'Calls', icon: 'phone' },
    ]
  },
  {
    section: 'Workforce',
    items: [
      { href: '/dashboard/employees', label: 'Employees', icon: 'user-check' },
      { href: '/dashboard/workforce', label: 'Workforce Plan', icon: 'bar-chart-2' },
      { href: '/dashboard/offers', label: 'Offers', icon: 'file-text' },
    ]
  },
  {
    section: 'Analytics',
    items: [
      { href: '/dashboard/analytics', label: 'Analytics', icon: 'trending-up' },
    ]
  },
  {
    section: 'Configuration',
    items: [
      { href: '/dashboard/settings', label: 'Settings', icon: 'settings' },
    ]
  },
];

const ICONS: Record<string, React.ReactNode> = {
  grid: <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  zap: <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  briefcase: <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>,
  users: <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  activity: <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  video: <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>,
  phone: <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6.08 6.08l1.35-1.35a2 2 0 0 1 2.12-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  'user-check': <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>,
  'bar-chart-2': <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  'file-text': <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  'trending-up': <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  settings: <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>,
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [companyName, setCompanyName] = useState('Loading...');
  const [userInitials, setUserInitials] = useState('U');
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token');
      if (!token) { router.push('/'); return; }
      // Parse token payload for display (not for security)
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const sub = payload.sub as string || '';
        setUserInitials(sub.charAt(0).toUpperCase());
        const roles = localStorage.getItem('roles');
        if (roles) {
          const r = JSON.parse(roles);
          setUserRole(r[0]?.replace(/_/g, ' ') || '');
        }
      } catch { /* ignore */ }

      // Load tenant info
      const tenantId = localStorage.getItem('tenant_id');
      if (tenantId) {
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/tenants/me`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.json()).then(d => {
          if (d.company_name) setCompanyName(d.company_name);
        }).catch(() => setCompanyName('Your Company'));
      }
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.clear();
    router.push('/');
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="app-sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">H</div>
          <div>
            <div className="sidebar-company">{companyName}</div>
            <div className="sidebar-plan">HR OS · Autonomous</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(section => (
            <div key={section.section}>
              <div className="sidebar-section-label">{section.section}</div>
              {section.items.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-item ${pathname === item.href ? 'active' : ''}`}
                >
                  {ICONS[item.icon]}
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {/* VidyamargAI Integration Banner */}
        <div style={{
          margin: '8px 12px', padding: '12px 14px',
          background: 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(99,102,241,0.15))',
          border: '1px solid rgba(124,58,237,0.4)', borderRadius: 12,
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
            🎓 VidyaMarg AI
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 10, lineHeight: 1.5 }}>
            Candidates browse &amp; apply from VidyaMarg AI portal
          </div>
          <a
            href="http://localhost:3001/candidate/jobs"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block', textAlign: 'center', padding: '7px 0',
              background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
              borderRadius: 8, color: '#fff', fontSize: 11, fontWeight: 700,
              textDecoration: 'none', letterSpacing: '0.02em',
            }}
          >
            Open Candidate Portal →
          </a>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user" onClick={handleLogout} role="button" title="Sign out">
            <div className="sidebar-avatar">{userInitials}</div>
            <div>
              <div className="sidebar-user-name" style={{ textTransform: 'capitalize' }}>{userRole || 'Admin'}</div>
              <div className="sidebar-user-role">Click to sign out</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="app-main">
        <header className="app-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
              {NAV_ITEMS.flatMap(s => s.items).find(i => i.href === pathname)?.label || 'Dashboard'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-accent-500)', boxShadow: 'var(--shadow-glow-accent)' }} title="All systems operational" />
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>All systems operational</span>
          </div>
        </header>
        <div className="app-content animate-fade">
          {children}
        </div>
      </div>
    </div>
  );
}
