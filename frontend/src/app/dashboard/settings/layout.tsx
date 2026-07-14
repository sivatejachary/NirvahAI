'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SETTINGS_NAV = [
  { href: '/dashboard/settings', label: 'Company Profile', icon: '🏢' },
  { href: '/dashboard/settings/offices', label: 'Offices', icon: '📍' },
  { href: '/dashboard/settings/departments', label: 'Departments', icon: '🗂️' },
  { href: '/dashboard/settings/teams', label: 'Teams', icon: '👥' },
  { href: '/dashboard/settings/policies', label: 'Policies', icon: '📋' },
  { href: '/dashboard/settings/hiring-rules', label: 'Hiring Rules', icon: '⚙️' },
  { href: '/dashboard/settings/compliance', label: 'Compliance & Privacy', icon: '⚖️' },
  { href: '/dashboard/settings/ai-governance', label: 'AI & Cost Governance', icon: '🤖' },
  { href: '/dashboard/settings/integrations', label: 'Integrations', icon: '🔌' },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Settings</h1>
          <p>Configure your company workspace, policies, and integrations</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Settings Sidebar */}
        <div className="card" style={{ width: 220, flexShrink: 0, padding: '8px', position: 'sticky', top: 80 }}>
          {SETTINGS_NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)',
                fontSize: 13.5,
                fontWeight: 500,
                color: pathname === item.href ? 'var(--color-primary-400)' : 'var(--text-secondary)',
                background: pathname === item.href ? 'rgba(99,102,241,0.10)' : 'transparent',
                textDecoration: 'none',
                marginBottom: 2,
                transition: 'all var(--transition-fast)',
              }}
            >
              <span style={{ fontSize: 15 }}>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>

        {/* Settings Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
