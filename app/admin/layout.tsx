'use client';

import React from 'react';

export type Section = 'sessions' | 'settings' | 'dashboard';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(120% 75% at 50% 12%, rgba(209,224,236,0.86) 0%, rgba(209,224,236,0) 64%), linear-gradient(180deg, #d9dced 0%, #d8e1ec 42%, #e5e4f0 100%)',
      fontFamily: "'Pretendard','Inter',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      color: '#111532',
      padding: '0.5rem',
    }}>
      {children}
    </div>
  );
}
