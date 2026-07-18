'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface SidebarItem {
  href: string;
  label: string;
  emoji: string;
  exact?: boolean;
}

const SIDEBAR_STRUCTURE: SidebarItem[] = [
  { href: '/dashboard', label: 'Dashboard', emoji: '🏠', exact: true },
  { href: '/dashboard/jobs', label: 'Jobs', emoji: '💼' },
  { href: '/dashboard/candidates', label: 'Candidates', emoji: '👥' },
  { href: '/dashboard/settings/workflow', label: 'Hiring Workflow', emoji: '⚙️' },
  { href: '/dashboard/calls', label: 'HR Voice', emoji: '🎙️' },
  { href: '/dashboard/analytics', label: 'Reports & Analytics', emoji: '📊' },
  { href: '/dashboard/settings', label: 'Company Settings', emoji: '🏢' },
  { href: '/dashboard/super-admin', label: 'Super Admin', emoji: '👑' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [companyName, setCompanyName] = useState('Loading...');
  const [userInitials, setUserInitials] = useState('U');
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [collapsed, setCollapsed] = useState(false);

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
          setIsPlatformAdmin(r.includes('platform_admin'));
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

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    if (href === '/dashboard/settings' && pathname.startsWith('/dashboard/settings/workflow')) return false;
    return pathname === href || pathname.startsWith(href + '/');
  };

  const sidebarW = collapsed ? 64 : 248;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0a0f', fontFamily: 'Inter, sans-serif' }}>
      {/* Sidebar */}
      <aside style={{ width: sidebarW, minHeight: '100vh', background: '#111118', borderRight: '1px solid rgba(255,255,255,0.06)', position: 'fixed', left: 0, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', zIndex: 100, transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)', overflow: 'hidden' }}>
        {/* Logo Area */}
        <div style={{ padding: '16px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10, minHeight: 64, flexShrink: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #7c3aed, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 16, flexShrink: 0, boxShadow: '0 0 16px rgba(124,58,237,0.4)', cursor: 'pointer' }} onClick={() => setCollapsed(c => !c)}>
            H
          </div>
          {!collapsed && (
            <div style={{ overflow: 'hidden', animation: 'fadeIn 0.2s ease' }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>{companyName}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2, lineHeight: 1 }}>NirvahAI · Recruitment OS</div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 8px', paddingBottom: 8 }}>
          {SIDEBAR_STRUCTURE.filter(item => {
            if (isPlatformAdmin) {
              return item.href === '/dashboard' || item.href === '/dashboard/super-admin';
            } else {
              return item.href !== '/dashboard/super-admin';
            }
          }).map((item, idx) => {
            const active = isActive(item.href, item.exact);
            return (
              <Link key={idx} href={item.href}
                title={collapsed ? item.label : undefined}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '10px 12px' : '9px 12px', margin: '1px 0', borderRadius: 10, fontSize: 13, fontWeight: active ? 600 : 400, color: active ? '#fff' : 'rgba(255,255,255,0.5)', background: active ? 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(99,102,241,0.15))' : 'transparent', border: active ? '1px solid rgba(124,58,237,0.3)' : '1px solid transparent', textDecoration: 'none', transition: 'all 0.15s ease', position: 'relative', whiteSpace: 'nowrap', overflow: 'hidden', justifyContent: collapsed ? 'center' : 'flex-start' }}>
                {active && (
                  <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 3, background: 'linear-gradient(180deg, #7c3aed, #6366f1)', borderRadius: '0 3px 3px 0' }} />
                )}
                <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{item.emoji}</span>
                {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
              </Link>
            );
          })}
        </nav>



        {/* User Footer */}
        <div style={{ padding: '10px 10px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <div onClick={handleLogout} role="button" title="Sign out" style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 8px', borderRadius: 10, cursor: 'pointer', transition: 'background 0.15s', justifyContent: collapsed ? 'center' : 'flex-start' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #34d399)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{userInitials}</div>
            {!collapsed && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', textTransform: 'capitalize', lineHeight: 1.2 }}>{userRole || 'Admin'}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>Click to sign out</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div style={{ marginLeft: sidebarW, flex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column', transition: 'margin-left 0.25s cubic-bezier(0.4,0,0.2,1)' }}>
        {/* Top Header */}
        <header style={{ height: 56, background: 'rgba(17,17,24,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', position: 'sticky', top: 0, zIndex: 50 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>NirvahAI</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.15)' }}>/</span>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: 500, textTransform: 'capitalize' }}>
              {pathname === '/dashboard' ? 'Dashboard' : pathname.split('/').pop()?.replace(/-/g, ' ')}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px rgba(52,211,153,0.6)' }} />
              All systems operational
            </div>
          </div>
        </header>

        {/* Content */}
        <div style={{ flex: 1, padding: '28px', maxWidth: 1400 }}>
          {children}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        nav a:hover { background: rgba(255,255,255,0.04) !important; color: rgba(255,255,255,0.85) !important; }
      `}</style>
    </div>
  );
}
