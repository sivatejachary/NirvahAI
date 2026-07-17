'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

/* ─────────────────────────────────────────────────────────────────
   NAV STRUCTURE
───────────────────────────────────────────────────────────────── */
const NAV_SECTIONS = [
  {
    section: null, // Dashboard (no section header)
    items: [
      { href: '/dashboard', label: 'Dashboard', emoji: '🏠', exact: true },
    ],
  },
  {
    section: 'RECRUITMENT',
    items: [
      { href: '/dashboard/hiring-requests',         label: 'Hiring Requests',           emoji: '📋' },
      { href: '/dashboard/jobs',                    label: 'Jobs',                      emoji: '💼' },
      { href: '/dashboard/job-publishing',          label: 'Job Publishing',            emoji: '🌍' },
      { href: '/dashboard/candidates',              label: 'Candidates',                emoji: '👥' },
      { href: '/dashboard/applications',            label: 'Applications',              emoji: '📥' },
      { href: '/dashboard/resume-screening',        label: 'Resume Screening',          emoji: '📄' },
      { href: '/dashboard/recruiter-screening',     label: 'Recruiter Screening',       emoji: '📞' },
      { href: '/dashboard/mcq-assessments',         label: 'MCQ Assessments',           emoji: '📝' },
      { href: '/dashboard/coding-assessments',      label: 'Coding Assessments',        emoji: '💻' },
      { href: '/dashboard/ai-interviews',           label: 'AI Technical Interviews',   emoji: '🎙' },
      { href: '/dashboard/hackathons',              label: 'Hackathons / Assignments',  emoji: '🏆' },
      { href: '/dashboard/interview-coordination',  label: 'Interview Coordination',    emoji: '📅' },
      { href: '/dashboard/interviews',              label: 'Technical Interviews',      emoji: '👨‍💻' },
      { href: '/dashboard/hiring-manager-reviews',  label: 'Hiring Manager Reviews',    emoji: '👨‍💼' },
      { href: '/dashboard/hr-chat',                 label: 'HR Discussions',            emoji: '💬' },
    ],
  },
  {
    section: 'HIRING',
    items: [
      { href: '/dashboard/hiring-decisions',        label: 'Hiring Decisions',          emoji: '✅' },
      { href: '/dashboard/offers',                  label: 'Offer Management',          emoji: '💰' },
      { href: '/dashboard/bgv',                     label: 'Background Verification',   emoji: '📑' },
      { href: '/dashboard/document-verification',   label: 'Document Verification',     emoji: '📂' },
      { href: '/dashboard/pre-boarding',            label: 'Pre-Boarding',              emoji: '🎉' },
      { href: '/dashboard/joining',                 label: 'Joining',                   emoji: '🚀' },
      { href: '/dashboard/onboarding',              label: 'Onboarding',                emoji: '🏢' },
    ],
  },
  {
    section: 'OPERATIONS',
    items: [
      { href: '/dashboard/meetings',                label: 'Interview Calendar',         emoji: '📅' },
      { href: '/dashboard/calls',                   label: 'Call Center',               emoji: '📞' },
      { href: '/dashboard/email-center',            label: 'Email Center',              emoji: '📨' },
      { href: '/dashboard/whatsapp',                label: 'WhatsApp Center',           emoji: '💬' },
      { href: '/dashboard/notifications',           label: 'Notifications',             emoji: '📢' },
      { href: '/dashboard/documents',               label: 'Documents',                 emoji: '📄' },
    ],
  },
  {
    section: 'AI CENTER',
    items: [
      { href: '/dashboard/ai/recruiter',            label: 'AI Recruiter',              emoji: '🤖' },
      { href: '/dashboard/ai/resume',               label: 'Resume AI',                 emoji: '📄' },
      { href: '/dashboard/ai/matching',             label: 'Matching AI',               emoji: '🎯' },
      { href: '/dashboard/ai/assessment',           label: 'Assessment AI',             emoji: '📝' },
      { href: '/dashboard/ai/coding',               label: 'Coding AI',                 emoji: '💻' },
      { href: '/dashboard/ai/interview',            label: 'Interview AI',              emoji: '🎙' },
      { href: '/dashboard/ai/coordinator',          label: 'Interview Coordinator AI',  emoji: '📅' },
      { href: '/dashboard/ai/hr',                   label: 'HR AI',                     emoji: '👔' },
      { href: '/dashboard/ai/offer',                label: 'Offer AI',                  emoji: '💰' },
      { href: '/dashboard/ai/bgv',                  label: 'BGV AI',                    emoji: '📑' },
      { href: '/dashboard/ai/onboarding',           label: 'Onboarding AI',             emoji: '🎓' },
      { href: '/dashboard/ai/analytics',            label: 'AI Analytics',              emoji: '📊' },
    ],
  },
  {
    section: 'ANALYTICS',
    items: [
      { href: '/dashboard/analytics',               label: 'Recruitment Dashboard',     emoji: '📊' },
      { href: '/dashboard/analytics/hiring',        label: 'Hiring Analytics',          emoji: '📈' },
      { href: '/dashboard/analytics/funnel',        label: 'Recruitment Funnel',        emoji: '📉' },
      { href: '/dashboard/analytics/sources',       label: 'Source Analytics',          emoji: '🎯' },
      { href: '/dashboard/analytics/recruiters',    label: 'Recruiter Performance',     emoji: '👥' },
      { href: '/dashboard/analytics/time-to-hire',  label: 'Time to Hire',              emoji: '⏱' },
      { href: '/dashboard/analytics/cost',          label: 'Hiring Cost',               emoji: '💰' },
    ],
  },
  {
    section: 'SETTINGS',
    items: [
      { href: '/dashboard/settings/company',        label: 'Company',                   emoji: '🏢' },
      { href: '/dashboard/settings/workflow',       label: 'Workflow Builder',          emoji: '⚙' },
      { href: '/dashboard/settings/job-templates',  label: 'Job Templates',             emoji: '📄' },
      { href: '/dashboard/settings/assessment-templates', label: 'Assessment Templates', emoji: '📝' },
      { href: '/dashboard/settings/interview-templates',  label: 'Interview Templates',  emoji: '🎙' },
      { href: '/dashboard/settings/users',          label: 'Users & Roles',             emoji: '👥' },
      { href: '/dashboard/settings/permissions',    label: 'Permissions',               emoji: '🔐' },
      { href: '/dashboard/settings/integrations',   label: 'Integrations',              emoji: '🔗' },
      { href: '/dashboard/settings/email',          label: 'Email',                     emoji: '📨' },
      { href: '/dashboard/settings/telephony',      label: 'Telephony',                 emoji: '📞' },
      { href: '/dashboard/settings/whatsapp',       label: 'WhatsApp',                  emoji: '💬' },
      { href: '/dashboard/settings/calendar',       label: 'Calendar',                  emoji: '📅' },
      { href: '/dashboard/settings/ai',             label: 'AI Configuration',          emoji: '🤖' },
      { href: '/dashboard/settings/audit-logs',     label: 'Audit Logs',                emoji: '📝' },
    ],
  },
];

/* ─────────────────────────────────────────────────────────────────
   All unique hrefs that already have real pages — others show
   a "coming soon" placeholder via the catch-all
───────────────────────────────────────────────────────────────── */
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
]);

/* ─────────────────────────────────────────────────────────────────
   LAYOUT
───────────────────────────────────────────────────────────────── */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [companyName, setCompanyName] = useState('Loading...');
  const [userInitials, setUserInitials] = useState('U');
  const [userRole, setUserRole] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

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

  const toggleSection = (section: string) => {
    setCollapsed(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Find current page label for header
  const allItems = NAV_SECTIONS.flatMap(s => s.items);
  const currentLabel = allItems.find(i => i.href === pathname)?.label
    || allItems.find(i => pathname.startsWith(i.href) && i.href !== '/dashboard')?.label
    || 'Dashboard';

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
          {NAV_SECTIONS.map((group, gi) => (
            <div key={gi}>
              {/* Section Header */}
              {group.section && (
                <button
                  onClick={() => toggleSection(group.section!)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                    padding: '10px 14px 4px',
                    color: 'var(--text-tertiary)',
                    fontSize: 10, fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase' as const,
                  }}
                >
                  <span>{group.section}</span>
                  <span style={{ fontSize: 10, opacity: 0.5, transition: 'transform 0.2s', display: 'inline-block', transform: collapsed[group.section!] ? 'rotate(-90deg)' : 'rotate(0)' }}>▾</span>
                </button>
              )}

              {/* Items */}
              {!collapsed[group.section!] && group.items.map(item => {
                const active = isActive(item.href, 'exact' in item ? item.exact : false);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`sidebar-item${active ? ' active' : ''}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      padding: '6px 14px',
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
                      letterSpacing: active ? '0.01em' : 'normal',
                    }}
                  >
                    <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>{item.emoji}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                    {!LIVE_ROUTES.has(item.href) && (
                      <span style={{
                        fontSize: 8, fontWeight: 700, textTransform: 'uppercase' as const,
                        letterSpacing: '0.05em', color: 'rgba(99,102,241,0.6)',
                        background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                        borderRadius: 4, padding: '1px 4px', flexShrink: 0,
                      }}>Soon</span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
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
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{currentLabel}</span>
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
