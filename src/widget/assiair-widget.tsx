'use client';

import React from 'react';
import type { AssiAirWidgetProps } from './widget-types';
import { WidgetProvider, useWidget } from './widget-provider';
import { TabNavigation } from '@/ui/tabs/tab-navigation';
import { TabContainer } from '@/ui/tabs/tab-container';

export function AssiAirWidget(props: AssiAirWidgetProps) {
  const { width, height, className } = props;

  return (
    <WidgetProvider props={props}>
      <WidgetShell width={width} height={height} className={className} />
    </WidgetProvider>
  );
}

function WidgetShell({ width, height, className }: { width?: string; height?: string; className?: string }) {
  const { config, hasValidToken } = useWidget();

  return (
    <div
      className={`assiair-widget ${className || ''}`}
      data-theme={config.theme}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: width || '100%',
        height: height || '600px',
        background: 'var(--background)',
        border: '1px solid var(--border)',
        borderRadius: '1rem',
        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
        overflow: 'hidden',
      }}
    >
      {hasValidToken ? (
        <>
          <TabNavigation />
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <TabContainer />
          </div>
        </>
      ) : (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
          gap: '1rem',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24,
          }}>
            !
          </div>
          <div>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: 4 }}>
              app 토큰을 확인하세요
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              URL에 <code style={{ background: 'var(--secondary)', padding: '2px 6px', borderRadius: 4, fontSize: '0.75rem' }}>app_token</code> 파라미터가 필요합니다.
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
              예: ?app_token=AbCdEf
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
