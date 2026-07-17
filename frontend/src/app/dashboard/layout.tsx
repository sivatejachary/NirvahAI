'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface SidebarItem {
  href: string;
  label: string;
  emoji?: string;
  exact?: boolean;
  children?: Array<{ href: string; label: string; query?: string }>;
}

const SIDEBAR_STRUCTURE: SidebarItem[] = [
  { href: '/dashboard', label: 'Dashboard', emoji: '🏠', exact: true },
  {
    href: '/dashboard/jobs',
    label: 'Jobs',
    emoji: '💼',
    children: [
      { href: '/dashboard/jobs', label: 'Create Job' },
      { href: '/dashboard/jobs', label: 'Job Listings' },
      { href: '/dashboard/jobs', label: 'Draft Jobs' },
      { href: '/dashboard/jobs', label: 'Published Jobs' },
      { href: '/dashboard/jobs', label: 'Closed Jobs' },
    ]
  },
  {
    href: '/dashboard/candidates',
    label: 'Candidates',
    emoji: '👥',
    children: [
      { href: '/dashboard/candidates', label: 'All Candidates' },
      { href: '/dashboard/applications', label: 'Applications' },
      { href: '/dashboard/pipeline', label: 'Shortlisted' },
      { href: '/dashboard/resume-screening', label: 'Resume Review' },
      { href: '/dashboard/recruiter-screening', label: 'AI Screening Calls' },
      { href: '/dashboard/mcq-assessments', label: 'Assessments' },
      { href: '/dashboard/ai-interviews', label: 'AI Interviews' },
      { href: '/dashboard/interviews', label: 'Technical Interviews' },
      { href: '/dashboard/hiring-manager-reviews', label: 'Hiring Manager Interviews' },
      { href: '/dashboard/hr-chat', label: 'HR Discussion' },
      { href: '/dashboard/offers', label: 'Offers' },
      { href: '/dashboard/bgv', label: 'Background Verification' },
      { href: '/dashboard/joining', label: 'Joined' },
      { href: '/dashboard/hiring-decisions', label: 'Rejected' },
    ]
  },
  {
    href: '/dashboard/settings/workflow',
    label: 'Hiring Workflow',
    emoji: '⚙️',
    children: [
      { href: '/dashboard/settings/workflow', label: 'Workflow Templates' },
      { href: '/dashboard/settings/workflow', label: 'Recruitment Stages' },
      { href: '/dashboard/settings/workflow', label: 'Assessment Configuration' },
      { href: '/dashboard/settings/workflow', label: 'Interview Configuration' },
      { href: '/dashboard/settings/workflow', label: 'AI Resume Rules' },
      { href: '/dashboard/settings/workflow', label: 'AI Screening Rules' },
      { href: '/dashboard/settings/workflow', label: 'Auto Shortlisting Rules' },
      { href: '/dashboard/settings/workflow', label: 'Notification Templates' },
      { href: '/dashboard/settings/workflow', label: 'Approval Workflow' },
    ]
  },
  { href: '/dashboard/calls', label: 'HR Voice', emoji: '🎙️' },
  { href: '/dashboard/analytics', label: 'Reports & Analytics', emoji: '📊' },
  { href: '/dashboard/settings', label: 'Company Settings', emoji: '🏢' },
];

const LIVE_ROUTES = new Set([
  '/dashboard',
  '/dashboard/jobs',
  '/dashboard/candidates',
  '/dashboard/pipeline',
  '/dashboard/interviews',
  '/dashboard/calls',
  '/dashboard/employees',
  '/dashboard/workforce',
  '/dashboard/offers',
  '/dashboard/bgv',
  '/dashboard/onboarding',
  '/dashboard/offboarding',
  '/dashboard/hr-chat',
  '/dashboard/performance',
  '/dashboard/meetings',
  '/dashboard/warning-letters',
  '/dashboard/analytics',
  '/dashboard/sandbox',
  '/dashboard/settings',
  '/dashboard/settings/workflow',
  '/dashboard/resume-screening',
  '/dashboard/recruiter-screening',
  '/dashboard/mcq-assessments',
  '/dashboard/coding-assessments',
  '/dashboard/ai-interviews',
  '/dashboard/interview-coordination',
  '/dashboard/hiring-manager-reviews',
  '/dashboard/hiring-decisions',
  '/dashboard/applications',
  '/dashboard/pre-boarding',
  '/dashboard/joining',
]);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [companyName, setCompanyName] = useState('Loading...');
  const [userInitials, setUserInitials] = useState('U');
  const [userRole, setUserRole] = useState('');
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    'Jobs': true,
    'Candidates': true,
    'Hiring Workflow': false
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token');
      if (!token) { router.push('/'); return; }
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

  const toggleFolder = (label: string) => {
    setOpenFolders(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <div className="app-layout">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="app-sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Logo / Company */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark" style={{
            background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
            width: 34, height: 34, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 900, color: '#fff', flexShrink: 0,
          }}>H</div>
          <div>
            <div className="sidebar-company">{companyName}</div>
            <div className="sidebar-plan">NirvahAI · Recruitment OS</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav" style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
          {SIDEBAR_STRUCTURE.map((item, idx) => {
            const hasChildren = !!item.children;
            const active = isActive(item.href, item.exact);
            const folderOpen = openFolders[item.label];

            return (
              <div key={idx} className="space-y-0.5">
                {hasChildren ? (
                  <div>
                    {/* Collapsible Folder Header */}
                    <button
                      onClick={() => toggleFolder(item.label)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '8px 14px',
                        fontSize: 13,
                        fontWeight: 600,
                        color: active ? '#fff' : 'var(--text-secondary)',
                        textAlign: 'left',
                        gap: 9,
                        outline: 'none'
                      }}
                    >
                      <span style={{ fontSize: 14, flexShrink: 0 }}>{item.emoji}</span>
                      <span style={{ flex: 1 }}>{item.label}</span>
                      <span style={{ fontSize: 10, opacity: 0.5, transition: 'transform 0.2s', transform: folderOpen ? 'rotate(0)' : 'rotate(-90deg)' }}>▾</span>
                    </button>

                    {/* Collapsible Children */}
                    {folderOpen && (
                      <div className="pl-4 space-y-0.5 border-l border-white/5 ml-5 mt-0.5 mb-1.5">
                        {item.children!.map((child, cIdx) => {
                          const childActive = pathname === child.href;
                          return (
                            <Link
                              key={cIdx}
                              href={child.href}
                              className={`sidebar-item${childActive ? ' active' : ''}`}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '5px 12px',
                                borderRadius: 6,
                                fontSize: 12.5,
                                fontWeight: childActive ? 600 : 400,
                                color: childActive ? '#fff' : 'var(--text-tertiary)',
                                background: childActive ? 'rgba(99,102,241,0.15)' : 'transparent',
                                border: '1px solid transparent',
                                textDecoration: 'none',
                              }}
                            >
                              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{child.label}</span>
                              {item.label === 'Hiring Workflow' && (
                                <span style={{
                                  fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
                                  letterSpacing: '0.05em', color: 'rgba(99,102,241,0.6)',
                                  background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                                  borderRadius: 4, padding: '1px 3px', flexShrink: 0,
                                }}>Soon</span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Single Item */
                  <Link
                    href={item.href}
                    className={`sidebar-item${active ? ' active' : ''}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      padding: '8px 14px',
                      margin: '1px 8px',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: active ? 600 : 400,
                      color: active ? '#fff' : 'var(--text-secondary)',
                      background: active
                        ? 'linear-gradient(135deg, rgba(124,58,237,0.35), rgba(99,102,241,0.2))'
                        : 'transparent',
                      border: active ? '1px solid rgba(124,58,237,0.35)' : '1px solid transparent',
                      textDecoration: 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>{item.emoji}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                    {item.label === 'HR Voice' && (
                      <span style={{
                        fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.05em', color: 'rgba(99,102,241,0.6)',
                        background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                        borderRadius: 4, padding: '1px 3px', flexShrink: 0,
                      }}>Soon</span>
                    )}
                  </Link>
                )}
              </div>
            );
          })}
        </nav>

        {/* VidyamargAI Integration Banner */}
        <div style={{
          margin: '8px 12px', padding: '12px 14px',
          background: 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(99,102,241,0.15))',
          border: '1px solid rgba(124,58,237,0.4)', borderRadius: 12,
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
            🎓 VidyaMarg AI
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 10, lineHeight: 1.5 }}>
            Candidates browse &amp; apply from VidyaMarg AI portal
          </div>
          <a
            href="https://vidyamarg-ai.vercel.app/candidate/job-agent"
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

        {/* User / Logout */}
        <div className="sidebar-footer" style={{ flexShrink: 0 }}>
          <div className="sidebar-user" onClick={handleLogout} role="button" title="Sign out">
            <div className="sidebar-avatar">{userInitials}</div>
            <div>
              <div className="sidebar-user-name" style={{ textTransform: 'capitalize' }}>{userRole || 'Admin'}</div>
              <div className="sidebar-user-role">Click to sign out</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────── */}
      <div className="app-main">
        <header className="app-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{pathname === '/dashboard' ? 'Dashboard' : pathname.split('/').pop()?.replace(/-/g, ' ')}</span>
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
