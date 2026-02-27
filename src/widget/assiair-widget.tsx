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
  const { config } = useWidget();

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
      <TabNavigation />
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <TabContainer />
      </div>
    </div>
  );
}
