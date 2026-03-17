'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { ConfigGui } from './config-gui';

type Section = 'sessions' | 'settings' | 'dashboard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SessionListItem {
  id: string;
  session_id: string;
  app: string;
  user: string;
  turn_count: number;
  created_at: string;
  updated_at: string;
}

interface SessionDetail {
  id: string;
  session_id: string;
  app: string;
  user: string;
  messages: Array<{ role: string; content: string; messageType?: string; timestamp: string }>;
  config_snapshot: Record<string, unknown>;
  logs: Array<{ category: string; level: string; message: string; timestamp: string }>;
  turn_count: number;
  created_at: string;
  updated_at: string;
}

interface SettingsItem {
  id: string;
  app: string;
  user: string;
  config: Record<string, unknown>;
  token?: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Shared styles matching AssiWorks admin design
// ---------------------------------------------------------------------------
const s = {
  card: {
    background: '#fff',
    border: '1px solid rgba(17, 21, 50, 0.09)',
    borderRadius: 16,
    padding: '0.9rem',
    marginBottom: '0.7rem',
  } as React.CSSProperties,

  statCard: {
    background: 'linear-gradient(155deg, #f9faff, #f0f2ff)',
    border: '1px solid rgba(77, 88, 176, 0.13)',
    borderRadius: 16,
    padding: '0.9rem',
  } as React.CSSProperties,

  statValue: {
    display: 'block',
    marginTop: '0.35rem',
    fontSize: '1.7rem',
    fontWeight: 700,
  } as React.CSSProperties,

  statLabel: {
    margin: 0,
    color: '#5d6698',
    fontSize: '0.84rem',
  } as React.CSSProperties,

  input: {
    width: '100%',
    borderRadius: 14,
    border: '1px solid rgba(72, 84, 172, 0.3)',
    background: '#ffffff',
    padding: '0.75rem 0.95rem',
    color: '#111532',
    fontSize: '0.95rem',
    fontFamily: 'inherit',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.9)',
    outline: 'none',
  } as React.CSSProperties,

  select: {
    borderRadius: 12,
    padding: '0.7rem 0.75rem',
    fontFamily: 'inherit',
    border: '1px solid rgba(72, 84, 172, 0.3)',
    background: '#ffffff',
    color: '#111532',
    fontSize: '0.9rem',
    outline: 'none',
  } as React.CSSProperties,

  btnPrimary: {
    border: 'none',
    borderRadius: 999,
    padding: '0.65rem 1.4rem',
    fontWeight: 600,
    background: 'linear-gradient(90deg, #636bff, #404dff)',
    color: 'white',
    cursor: 'pointer',
    fontSize: '0.88rem',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  } as React.CSSProperties,

  btnSecondary: {
    border: '1px solid rgba(44, 53, 111, 0.24)',
    borderRadius: 16,
    padding: '0.65rem 1.2rem',
    background: 'transparent',
    color: '#2c356f',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.85rem',
  } as React.CSSProperties,

  btnDelete: {
    border: '1px solid rgba(214, 54, 54, 0.25)',
    background: 'rgba(214, 54, 54, 0.08)',
    color: '#a83535',
    borderRadius: 999,
    padding: '0.36rem 0.75rem',
    fontSize: '0.82rem',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  btnAdd: {
    border: '1px solid rgba(68, 80, 179, 0.3)',
    background: 'rgba(99, 107, 255, 0.1)',
    color: '#3d4aad',
    borderRadius: 999,
    padding: '0.45rem 1rem',
    fontSize: '0.85rem',
    fontWeight: 700,
    cursor: 'pointer',
  } as React.CSSProperties,

  btnSmall: {
    border: '1px solid rgba(44, 53, 111, 0.18)',
    borderRadius: 8,
    padding: '0.2rem 0.5rem',
    background: 'transparent',
    color: '#5d6698',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.75rem',
    lineHeight: 1.4,
  } as React.CSSProperties,

  th: {
    textAlign: 'left' as const,
    padding: '0.45rem 0.4rem',
    borderBottom: '1px solid rgba(17, 21, 50, 0.1)',
    fontSize: '0.75rem',
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    color: '#6670a6',
    fontWeight: 600,
  } as React.CSSProperties,

  td: {
    textAlign: 'left' as const,
    padding: '0.45rem 0.4rem',
    borderBottom: '1px solid rgba(17, 21, 50, 0.1)',
    fontSize: '0.82rem',
    color: '#23284f',
    verticalAlign: 'top' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  eyebrow: {
    fontSize: '0.85rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    color: '#6a6f95',
    margin: 0,
  } as React.CSSProperties,

  sectionTitle: {
    margin: '0.25rem 0 0',
    fontSize: '1.25rem',
    fontWeight: 700,
  } as React.CSSProperties,

  statusText: {
    margin: '0.3rem 0 0',
    color: '#303763',
    fontWeight: 600,
    minHeight: '1.1rem',
    fontSize: '0.88rem',
  } as React.CSSProperties,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}시간 전`;
  const days = Math.floor(hrs / 24);
  return `${days}일 전`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ko-KR');
}

// ---------------------------------------------------------------------------
// Dashboard Section
// ---------------------------------------------------------------------------
function DashboardSection() {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/sessions?app=all&user=all');
        const { data } = await res.json();
        setSessions(data || []);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <p style={{ ...s.statusText, textAlign: 'center', padding: 40 }}>데이터를 불러오는 중...</p>;
  }

  const total = sessions.length;
  const recent24h = sessions.filter(ss => Date.now() - new Date(ss.updated_at).getTime() < 86400000).length;
  const totalTurns = sessions.reduce((sum, ss) => sum + ss.turn_count, 0);

  const byApp: Record<string, number> = {};
  const byUser: Record<string, number> = {};
  for (const ss of sessions) {
    byApp[ss.app] = (byApp[ss.app] || 0) + 1;
    byUser[ss.user] = (byUser[ss.user] || 0) + 1;
  }

  const recentFive = sessions.slice(0, 5);

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.7rem', marginBottom: '0.8rem' }}>
        {[
          { label: '총 세션', value: total },
          { label: '최근 24시간', value: recent24h },
          { label: '총 대화 턴', value: totalTurns },
          { label: '앱 수', value: Object.keys(byApp).length },
        ].map(stat => (
          <article key={stat.label} style={s.statCard}>
            <p style={s.statLabel}>{stat.label}</p>
            <strong style={s.statValue}>{stat.value}</strong>
          </article>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.7rem', marginBottom: '0.7rem' }}>
        {/* By App */}
        <article style={s.card}>
          <h4 style={{ margin: '0 0 0.8rem', fontSize: '1rem', color: '#202753' }}>앱별 세션 수</h4>
          {Object.entries(byApp).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([app, count]) => {
            const max = Math.max(...Object.values(byApp));
            const pct = Math.round((count / max) * 100);
            return (
              <div key={app} style={{ display: 'grid', gridTemplateColumns: 'minmax(95px, 1fr) 2fr auto', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                <p style={{ margin: 0, color: '#3a4276', fontSize: '0.85rem', wordBreak: 'break-all' }}>{app}</p>
                <div style={{ borderRadius: 999, height: 9, background: 'rgba(95, 106, 255, 0.11)' }}>
                  <span style={{ display: 'block', height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #7a83ff, #5d67f8)', width: `${pct}%` }} />
                </div>
                <strong style={{ fontSize: '0.8rem' }}>{count}</strong>
              </div>
            );
          })}
          {Object.keys(byApp).length === 0 && <p style={{ color: '#7480ad', margin: 0 }}>데이터 없음</p>}
        </article>

        {/* By User */}
        <article style={s.card}>
          <h4 style={{ margin: '0 0 0.8rem', fontSize: '1rem', color: '#202753' }}>사용자별 세션 수</h4>
          {Object.entries(byUser).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([user, count]) => {
            const max = Math.max(...Object.values(byUser));
            const pct = Math.round((count / max) * 100);
            return (
              <div key={user} style={{ display: 'grid', gridTemplateColumns: 'minmax(95px, 1fr) 2fr auto', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                <p style={{ margin: 0, color: '#3a4276', fontSize: '0.85rem', wordBreak: 'break-all', fontFamily: 'monospace' }}>{user}</p>
                <div style={{ borderRadius: 999, height: 9, background: 'rgba(95, 106, 255, 0.11)' }}>
                  <span style={{ display: 'block', height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #7a83ff, #5d67f8)', width: `${pct}%` }} />
                </div>
                <strong style={{ fontSize: '0.8rem' }}>{count}</strong>
              </div>
            );
          })}
          {Object.keys(byUser).length === 0 && <p style={{ color: '#7480ad', margin: 0 }}>데이터 없음</p>}
        </article>
      </div>

      {/* Recent sessions */}
      <article style={s.card}>
        <h4 style={{ margin: '0 0 0.8rem', fontSize: '1rem', color: '#202753' }}>최근 세션 5건</h4>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          {recentFive.map(ss => (
            <li key={ss.id} style={{
              border: '1px solid rgba(16, 22, 59, 0.08)',
              borderRadius: 12,
              padding: '0.65rem 0.7rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <div>
                <strong style={{ display: 'block', color: '#232a55', fontSize: '0.88rem' }}>{ss.app} / {ss.user}</strong>
                <p style={{ margin: '0.18rem 0 0', color: '#5e6697', fontSize: '0.82rem' }}>
                  {ss.turn_count}턴 · {ss.session_id.slice(0, 24)}...
                </p>
              </div>
              <span style={{ fontSize: '0.8rem', color: '#7780af', whiteSpace: 'nowrap' }}>{timeAgo(ss.updated_at)}</span>
            </li>
          ))}
          {recentFive.length === 0 && (
            <li style={{ color: '#7480ad', fontSize: '0.88rem' }}>최근 세션 데이터가 없습니다.</li>
          )}
        </ul>
      </article>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sessions Section
// ---------------------------------------------------------------------------
function SessionsSection() {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [allSessions, setAllSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterApp, setFilterApp] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [appSearch, setAppSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [showAppDrop, setShowAppDrop] = useState(false);
  const [showUserDrop, setShowUserDrop] = useState(false);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [statusMsg, setStatusMsg] = useState('');

  // Derive unique app/user lists from all sessions
  const appList = Array.from(new Set(allSessions.map(s => s.app))).sort();
  const userList = Array.from(new Set(
    allSessions.filter(s => !filterApp || s.app === filterApp).map(s => s.user)
  )).sort();

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sessions?app=all&user=all');
      const { data } = await res.json();
      const all: SessionListItem[] = data || [];
      setAllSessions(all);
      // Apply local filters
      let filtered = all;
      if (filterApp) filtered = filtered.filter(s => s.app === filterApp);
      if (filterUser) filtered = filtered.filter(s => s.user === filterUser);
      setSessions(filtered);
      setStatusMsg(`${filtered.length}건을 불러왔습니다.`);
    } catch {
      setStatusMsg('조회에 실패했습니다.');
    }
    setLoading(false);
  }, [filterApp, filterUser]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const openDetail = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`);
      const { data } = await res.json();
      setDetail(data);
    } catch {
      setStatusMsg('세션 상세 조회에 실패했습니다.');
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!confirm(`세션을 삭제하시겠습니까?\n${sessionId}`)) return;
    await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
    setDetail(null);
    setStatusMsg('삭제되었습니다.');
    fetchSessions();
  };

  // Detail view
  if (detail) {
    return (
      <div>
        <button onClick={() => setDetail(null)} style={s.btnSecondary}>← 목록으로</button>

        <article style={{ ...s.card, marginTop: '0.7rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '1rem', color: '#202753' }}>세션 상세</h4>
              <p style={{ margin: '0.2rem 0 0', color: '#5d6698', fontSize: '0.84rem' }}>
                {detail.app} / {detail.user} · {detail.turn_count}턴 · {formatDate(detail.created_at)}
              </p>
              <p style={{ margin: '0.15rem 0 0', color: '#7780af', fontSize: '0.78rem', fontFamily: 'monospace' }}>
                {detail.session_id}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => {
                  const url = `${window.location.origin}/?restore_session=${encodeURIComponent(detail.session_id)}`;
                  navigator.clipboard.writeText(url);
                  setStatusMsg('복원 URL이 복사되었습니다.');
                }}
                style={s.btnPrimary}
              >
                복원 URL 복사
              </button>
              <button onClick={() => deleteSession(detail.session_id)} style={s.btnDelete}>삭제</button>
            </div>
          </div>

          {/* Messages */}
          <h4 style={{ margin: '0.8rem 0 0.5rem', fontSize: '0.92rem', color: '#202753' }}>
            대화 내역 ({detail.messages.length})
          </h4>
          <div style={{ maxHeight: 380, overflowY: 'auto', border: '1px solid rgba(17,21,50,0.08)', borderRadius: 12 }}>
            {detail.messages.map((msg, i) => (
              <div key={i} style={{
                padding: '0.6rem 0.8rem',
                borderBottom: '1px solid rgba(17,21,50,0.06)',
                background: msg.role === 'user' ? 'rgba(99,107,255,0.04)' : '#fff',
              }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 3 }}>
                  <span style={{
                    fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                    color: msg.role === 'user' ? '#636bff' : '#1e7e34',
                  }}>
                    {msg.role === 'user' ? '사용자' : '어시스턴트'}
                  </span>
                  {msg.messageType && <span style={{ fontSize: '0.72rem', color: '#8f97c2' }}>[{msg.messageType}]</span>}
                </div>
                <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#23284f' }}>
                  {msg.content.slice(0, 500)}{msg.content.length > 500 ? '...' : ''}
                </p>
              </div>
            ))}
            {detail.messages.length === 0 && <p style={{ padding: 16, color: '#7480ad', fontSize: '0.84rem' }}>메시지 없음</p>}
          </div>

          {/* Logs */}
          <h4 style={{ margin: '0.8rem 0 0.5rem', fontSize: '0.92rem', color: '#202753' }}>
            로그 ({detail.logs.length})
          </h4>
          <div style={{ maxHeight: 250, overflowY: 'auto', border: '1px solid rgba(17,21,50,0.08)', borderRadius: 12 }}>
            {detail.logs.map((log, i) => (
              <div key={i} style={{
                padding: '0.35rem 0.8rem',
                borderBottom: '1px solid rgba(17,21,50,0.05)',
                fontSize: '0.78rem',
                fontFamily: 'monospace',
                color: log.level === 'error' ? '#a83535' : log.level === 'warn' ? '#8a5200' : '#23284f',
              }}>
                <span style={{ color: '#8f97c2' }}>[{log.category}]</span> {log.message}
              </div>
            ))}
            {detail.logs.length === 0 && <p style={{ padding: 16, color: '#7480ad', fontSize: '0.84rem' }}>로그 없음</p>}
          </div>

          {/* Config */}
          <h4 style={{ margin: '0.8rem 0 0.5rem', fontSize: '0.92rem', color: '#202753' }}>설정 스냅샷</h4>
          <pre style={{
            background: 'rgba(13, 18, 63, 0.94)',
            color: '#d8ddff',
            padding: '0.9rem',
            borderRadius: 12,
            fontSize: '0.78rem',
            overflow: 'auto',
            maxHeight: 250,
          }}>
            {JSON.stringify(detail.config_snapshot, null, 2)}
          </pre>
        </article>
      </div>
    );
  }

  const filteredAppList = appSearch
    ? appList.filter(a => a.toLowerCase().includes(appSearch.toLowerCase()))
    : appList;
  const filteredUserList = userSearch
    ? userList.filter(u => u.toLowerCase().includes(userSearch.toLowerCase()))
    : userList;

  const dropdownWrap: React.CSSProperties = { position: 'relative' };
  const dropdownMenu: React.CSSProperties = {
    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
    background: '#fff', border: '1px solid rgba(72,84,172,0.25)',
    borderRadius: 12, marginTop: 4, maxHeight: 220, overflowY: 'auto',
    boxShadow: '0 8px 24px rgba(25,32,92,0.15)',
  };
  const dropdownItem = (active: boolean): React.CSSProperties => ({
    padding: '0.55rem 0.8rem', cursor: 'pointer', fontSize: '0.85rem',
    background: active ? 'rgba(99,107,255,0.08)' : 'transparent',
    color: active ? '#636bff' : '#23284f', fontWeight: active ? 600 : 400,
    borderBottom: '1px solid rgba(17,21,50,0.04)',
  });

  return (
    <div onClick={() => { setShowAppDrop(false); setShowUserDrop(false); }}>
      {/* Filters */}
      <article style={s.card}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr auto', gap: '0.5rem', alignItems: 'end' }}>
          {/* App dropdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontWeight: 600, fontSize: '0.9rem', color: '#333a66' }}>앱</label>
            <div style={dropdownWrap}>
              <input
                placeholder="전체 앱"
                value={showAppDrop ? appSearch : (filterApp || '')}
                onChange={e => { setAppSearch(e.target.value); setShowAppDrop(true); }}
                onFocus={e => { e.stopPropagation(); setShowAppDrop(true); setShowUserDrop(false); setAppSearch(''); }}
                onClick={e => e.stopPropagation()}
                style={s.input}
                autoComplete="off"
              />
              {showAppDrop && (
                <div style={dropdownMenu} onClick={e => e.stopPropagation()}>
                  <div
                    style={dropdownItem(!filterApp)}
                    onClick={() => { setFilterApp(''); setFilterUser(''); setShowAppDrop(false); setAppSearch(''); }}
                  >
                    전체 앱
                  </div>
                  {filteredAppList.map(app => (
                    <div
                      key={app}
                      style={dropdownItem(filterApp === app)}
                      onClick={() => { setFilterApp(app); setFilterUser(''); setShowAppDrop(false); setAppSearch(''); }}
                    >
                      {app}
                      <span style={{ float: 'right', fontSize: '0.75rem', color: '#8f97c2' }}>
                        {allSessions.filter(ss => ss.app === app).length}건
                      </span>
                    </div>
                  ))}
                  {filteredAppList.length === 0 && (
                    <div style={{ padding: '0.6rem 0.8rem', color: '#8f97c2', fontSize: '0.82rem' }}>검색 결과 없음</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* User dropdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontWeight: 600, fontSize: '0.9rem', color: '#333a66' }}>사용자</label>
            <div style={dropdownWrap}>
              <input
                placeholder="전체 사용자"
                value={showUserDrop ? userSearch : (filterUser || '')}
                onChange={e => { setUserSearch(e.target.value); setShowUserDrop(true); }}
                onFocus={e => { e.stopPropagation(); setShowUserDrop(true); setShowAppDrop(false); setUserSearch(''); }}
                onClick={e => e.stopPropagation()}
                style={s.input}
                autoComplete="off"
              />
              {showUserDrop && (
                <div style={dropdownMenu} onClick={e => e.stopPropagation()}>
                  <div
                    style={dropdownItem(!filterUser)}
                    onClick={() => { setFilterUser(''); setShowUserDrop(false); setUserSearch(''); }}
                  >
                    전체 사용자
                  </div>
                  {filteredUserList.map(user => (
                    <div
                      key={user}
                      style={dropdownItem(filterUser === user)}
                      onClick={() => { setFilterUser(user); setShowUserDrop(false); setUserSearch(''); }}
                    >
                      {user}
                      <span style={{ float: 'right', fontSize: '0.75rem', color: '#8f97c2' }}>
                        {allSessions.filter(ss => ss.user === user && (!filterApp || ss.app === filterApp)).length}건
                      </span>
                    </div>
                  ))}
                  {filteredUserList.length === 0 && (
                    <div style={{ padding: '0.6rem 0.8rem', color: '#8f97c2', fontSize: '0.82rem' }}>검색 결과 없음</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <button onClick={fetchSessions} style={s.btnPrimary}>검색</button>
        </div>

        {/* Active filter chips */}
        {(filterApp || filterUser) && (
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            {filterApp && (
              <span style={{
                fontSize: '0.78rem', background: 'rgba(99,107,255,0.1)', color: '#636bff',
                padding: '0.25rem 0.6rem', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                앱: {filterApp}
                <span onClick={() => setFilterApp('')} style={{ cursor: 'pointer', fontWeight: 700 }}>&times;</span>
              </span>
            )}
            {filterUser && (
              <span style={{
                fontSize: '0.78rem', background: 'rgba(99,107,255,0.1)', color: '#636bff',
                padding: '0.25rem 0.6rem', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                사용자: {filterUser}
                <span onClick={() => setFilterUser('')} style={{ cursor: 'pointer', fontWeight: 700 }}>&times;</span>
              </span>
            )}
            <span
              onClick={() => { setFilterApp(''); setFilterUser(''); }}
              style={{ fontSize: '0.78rem', color: '#8f97c2', cursor: 'pointer', padding: '0.25rem 0.4rem' }}
            >
              전체 초기화
            </span>
          </div>
        )}
      </article>

      <p style={s.statusText}>{statusMsg || (loading ? '데이터를 불러오는 중...' : '')}</p>

      {/* Table */}
      <article style={s.card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={s.th}>Session ID</th>
                <th style={s.th}>앱</th>
                <th style={s.th}>사용자</th>
                <th style={s.th}>턴</th>
                <th style={s.th}>생성일</th>
                <th style={s.th}>최근 활동</th>
                <th style={s.th}>관리</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(ss => (
                <tr key={ss.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(ss.session_id)}>
                  <td style={{ ...s.td, fontFamily: 'monospace', fontSize: '0.78rem' }}>{ss.session_id.slice(0, 22)}...</td>
                  <td style={s.td}>{ss.app}</td>
                  <td style={s.td}>{ss.user}</td>
                  <td style={s.td}>{ss.turn_count}</td>
                  <td style={s.td}>{formatDate(ss.created_at)}</td>
                  <td style={s.td}>{timeAgo(ss.updated_at)}</td>
                  <td style={s.td}>
                    <button onClick={e => { e.stopPropagation(); deleteSession(ss.session_id); }} style={s.btnDelete}>삭제</button>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && !loading && (
                <tr><td colSpan={7} style={{ ...s.td, textAlign: 'center', color: '#7480ad', padding: 40 }}>세션 데이터가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings Section
// ---------------------------------------------------------------------------
function SettingsSection() {
  const [settings, setSettings] = useState<SettingsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editJson, setEditJson] = useState('');
  const [showNewApp, setShowNewApp] = useState(false);
  const [newAppName, setNewAppName] = useState('');
  const [newAppJson, setNewAppJson] = useState('{\n  "theme": "light",\n  "maxPlanSteps": 5\n}');
  const [statusMsg, setStatusMsg] = useState('');
  const [viewMode, setViewMode] = useState<'json' | 'gui'>('gui');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [guiDraft, setGuiDraft] = useState<Record<string, any> | null>(null);
  const [guiDraftItemId, setGuiDraftItemId] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings?list=true&app=all&user=all');
      if (res.ok) {
        const { data } = await res.json();
        setSettings(Array.isArray(data) ? data : []);
      }
    } catch {
      setStatusMsg('설정 조회에 실패했습니다.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const saveEdit = async (item: SettingsItem) => {
    try {
      const config = JSON.parse(editJson);
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app: item.app, user: item.user, config }),
      });
      setEditingId(null);
      setStatusMsg('설정이 저장되었습니다.');
      fetchSettings();
    } catch {
      setStatusMsg('잘못된 JSON 형식입니다.');
    }
  };

  const createAppDefault = async () => {
    if (!newAppName.trim()) { setStatusMsg('앱 이름을 입력하세요.'); return; }
    try {
      const config = JSON.parse(newAppJson);
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app: newAppName.trim(), user: 'default', config }),
      });
      setShowNewApp(false);
      setNewAppName('');
      setStatusMsg(`"${newAppName.trim()}" 앱이 생성되었습니다.`);
      fetchSettings();
    } catch {
      setStatusMsg('잘못된 JSON 형식입니다.');
    }
  };

  // GUI mode helpers
  const handleGuiChange = (itemId: string, newConfig: Record<string, unknown>) => {
    setGuiDraft(newConfig);
    setGuiDraftItemId(itemId);
  };

  const saveGuiDraft = async () => {
    if (!guiDraft || !guiDraftItemId) return;
    const item = settings.find(si => si.id === guiDraftItemId);
    if (!item) return;
    try {
      // For non-base apps, save only the overrides (diff from base)
      const configToSave = item.app !== 'default' && baseAppConfig
        ? computeOverrides(guiDraft, baseAppConfig)
        : guiDraft;
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app: item.app, user: item.user, config: configToSave }),
      });
      setGuiDraft(null);
      setGuiDraftItemId(null);
      setStatusMsg('설정이 저장되었습니다.');
      fetchSettings();
    } catch {
      setStatusMsg('저장에 실패했습니다.');
    }
  };

  const discardGuiDraft = () => {
    setGuiDraft(null);
    setGuiDraftItemId(null);
  };

  // Derive app list from settings with user='default'
  const appDefaults = settings.filter(item => item.user === 'default');
  const baseAppItem = settings.find(item => item.app === 'default' && item.user === 'default');
  const baseAppConfig = baseAppItem?.config ?? {};
  const selectedAppDefault = selectedApp ? settings.find(item => item.app === selectedApp && item.user === 'default') : null;
  const isBaseApp = selectedApp === 'default';

  // For non-base apps, compute merged config (base + overrides)
  const mergedConfig = selectedAppDefault
    ? isBaseApp
      ? selectedAppDefault.config
      : { ...baseAppConfig, ...(selectedAppDefault.config ?? {}) }
    : null;

  /** Compute only the fields that differ from base config */
  const computeOverrides = (config: Record<string, unknown>, base: Record<string, unknown>): Record<string, unknown> => {
    const overrides: Record<string, unknown> = {};
    for (const key of Object.keys(config)) {
      if (JSON.stringify(config[key]) !== JSON.stringify(base[key])) {
        overrides[key] = config[key];
      }
    }
    return overrides;
  };

  const renderJsonEditor = (item: SettingsItem, label: string) => {
    const editing = editingId === item.id;
    return (
      <div key={item.id} style={{
        border: '1px solid rgba(16, 22, 59, 0.08)',
        borderRadius: 12,
        padding: '0.7rem',
        marginBottom: '0.55rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editing ? 12 : 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong style={{ color: '#232a55', fontSize: '0.88rem' }}>{label}</strong>
            <span style={{ color: '#7780af', fontSize: '0.78rem' }}>{timeAgo(item.updated_at)}</span>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {editing ? (
              <>
                <button onClick={() => saveEdit(item)} style={s.btnPrimary}>저장</button>
                <button onClick={() => setEditingId(null)} style={s.btnSecondary}>취소</button>
              </>
            ) : (
              <button onClick={() => { setEditingId(item.id); setEditJson(JSON.stringify(item.config, null, 2)); }} style={s.btnSecondary}>수정</button>
            )}
          </div>
        </div>
        {editing ? (
          <textarea
            value={editJson}
            onChange={e => setEditJson(e.target.value)}
            style={{
              width: '100%', minHeight: 280,
              fontFamily: 'monospace', fontSize: '0.82rem',
              padding: '0.8rem', borderRadius: 12,
              border: '1px solid rgba(72, 84, 172, 0.3)',
              color: '#111532', background: '#fff',
              resize: 'vertical', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        ) : (
          <pre style={{
            background: 'rgba(13, 18, 63, 0.94)',
            color: '#d8ddff',
            padding: '0.8rem',
            borderRadius: 12,
            fontSize: '0.78rem',
            overflow: 'auto',
            maxHeight: 250,
            margin: 0,
          }}>
            {JSON.stringify(item.config, null, 2)}
          </pre>
        )}
      </div>
    );
  };

  // ── App list view ──
  if (!selectedApp) {
    return (
      <div>
        <p style={s.statusText}>{statusMsg}</p>

        <article style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '1rem', color: '#202753' }}>앱 목록</h4>
              <p style={{ margin: '0.15rem 0 0', color: '#5d6698', fontSize: '0.8rem' }}>베이스 앱(default)이 기본값이며, 다른 앱은 베이스 앱에서 변경사항만 저장합니다.</p>
            </div>
            <button onClick={() => { setShowNewApp(!showNewApp); }} style={s.btnAdd}>+ 새 앱 추가</button>
          </div>

          {showNewApp && (
            <div style={{ marginBottom: '0.7rem', border: '2px solid rgba(99, 107, 255, 0.4)', borderRadius: 12, padding: '0.8rem', background: 'rgba(99, 107, 255, 0.03)' }}>
              <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'center', marginBottom: '0.6rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#333a66' }}>앱 이름:</label>
                <input value={newAppName} onChange={e => setNewAppName(e.target.value)} style={{ ...s.input, width: 200 }} placeholder="my-app" />
              </div>
              <p style={{ margin: '0 0 0.4rem', color: '#5d6698', fontSize: '0.8rem' }}>앱 기본 설정 (JSON):</p>
              <textarea
                value={newAppJson}
                onChange={e => setNewAppJson(e.target.value)}
                style={{
                  width: '100%', minHeight: 150,
                  fontFamily: 'monospace', fontSize: '0.82rem',
                  padding: '0.8rem', borderRadius: 12,
                  border: '1px solid rgba(72, 84, 172, 0.3)',
                  color: '#111532', background: '#fff',
                  resize: 'vertical', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowNewApp(false)} style={s.btnSecondary}>취소</button>
                <button onClick={createAppDefault} style={s.btnPrimary}>생성</button>
              </div>
            </div>
          )}

          {loading ? (
            <p style={{ color: '#5d6698', fontSize: '0.84rem', textAlign: 'center', padding: 20 }}>로딩 중...</p>
          ) : appDefaults.length === 0 ? (
            <p style={{ color: '#7480ad', fontSize: '0.84rem', textAlign: 'center', padding: 24 }}>
              등록된 앱이 없습니다. &quot;+ 새 앱 추가&quot;를 클릭하세요.
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.6rem' }}>
              {/* Sort so 'default' base app always comes first */}
              {[...appDefaults].sort((a, b) => a.app === 'default' ? -1 : b.app === 'default' ? 1 : 0).map(item => {
                const isBase = item.app === 'default';
                return (
                  <div
                    key={item.id}
                    onClick={() => { setSelectedApp(item.app); setStatusMsg(''); }}
                    style={{
                      border: isBase ? '2px solid rgba(99,107,255,0.5)' : '1px solid rgba(16, 22, 59, 0.1)',
                      borderRadius: 14,
                      padding: '1rem',
                      cursor: 'pointer',
                      background: isBase
                        ? 'linear-gradient(155deg, #eef0ff, #e0e4ff)'
                        : 'linear-gradient(155deg, #f9faff, #f0f2ff)',
                      transition: 'box-shadow 0.15s, transform 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,107,255,0.18)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
                  >
                    <h5 style={{ margin: '0 0 0.4rem', fontSize: '1rem', color: '#202753', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {item.app}
                      {isBase && (
                        <span style={{
                          fontSize: '0.6rem', fontWeight: 700,
                          background: 'linear-gradient(90deg, #636bff, #404dff)', color: '#fff',
                          padding: '0.1rem 0.4rem', borderRadius: 999, textTransform: 'uppercase',
                        }}>
                          BASE
                        </span>
                      )}
                    </h5>
                    {isBase && (
                      <p style={{ margin: '0 0 0.3rem', fontSize: '0.7rem', color: '#636bff', lineHeight: 1.3 }}>
                        모든 앱의 기본 설정
                      </p>
                    )}
                    {!isBase && (
                      <p style={{ margin: '0 0 0.3rem', fontSize: '0.68rem', color: '#8f97c2', lineHeight: 1.3 }}>
                        base(default)에서 상속
                      </p>
                    )}
                    {item.token && (
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        background: 'rgba(99,107,255,0.08)', borderRadius: 6,
                        padding: '0.1rem 0.4rem', marginBottom: '0.3rem',
                      }}>
                        <span style={{ fontSize: '0.65rem', color: '#8f97c2' }}>app_token:</span>
                        <span style={{ fontSize: '0.7rem', color: '#636bff', fontFamily: 'monospace', fontWeight: 600 }}>{item.token}</span>
                        <span
                          onClick={e => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(item.token!);
                          }}
                          style={{ fontSize: '0.65rem', color: '#8f97c2', cursor: 'pointer' }}
                        >
                          복사
                        </span>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.6rem', fontSize: '0.78rem', color: '#5d6698' }}>
                      <span>{timeAgo(item.updated_at)}</span>
                    </div>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        const param = item.token ? `app_token=${item.token}` : `app=${encodeURIComponent(item.app)}`;
                        window.open(`${window.location.origin}/?${param}`, '_blank');
                      }}
                      style={{
                        marginTop: '0.5rem', border: 'none', borderRadius: 8,
                        padding: '0.3rem 0.65rem', fontSize: '0.75rem', fontWeight: 600,
                        background: 'linear-gradient(90deg, #636bff, #404dff)', color: '#fff',
                        cursor: 'pointer', width: '100%',
                      }}
                    >
                      사용하기
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </div>
    );
  }

  // ── App detail view ──
  return (
    <div>
      <p style={s.statusText}>{statusMsg}</p>

      {/* Back button */}
      <button
        onClick={() => { setSelectedApp(null); setEditingId(null); setStatusMsg(''); }}
        style={{
          border: 0, background: 'none', color: '#636bff', cursor: 'pointer',
          fontSize: '0.85rem', fontWeight: 600, padding: '0.3rem 0', marginBottom: '0.6rem',
          display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        &larr; 앱 목록으로
      </button>

      {/* View mode toggle */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem' }}>
        {(['gui', 'json'] as const).map(m => (
          <button
            key={m}
            onClick={() => { setViewMode(m); discardGuiDraft(); setEditingId(null); }}
            style={{
              border: 'none', borderRadius: 8, padding: '0.3rem 0.7rem',
              fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
              background: viewMode === m ? 'linear-gradient(90deg, #636bff, #404dff)' : 'rgba(99,107,255,0.08)',
              color: viewMode === m ? '#fff' : '#5d6698',
              transition: 'all 0.15s',
            }}
          >
            {m === 'gui' ? 'GUI 편집' : 'JSON 편집'}
          </button>
        ))}
      </div>

      {/* App default config */}
      <article style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h4 style={{ margin: '0 0 0.15rem', fontSize: '1.05rem', color: '#202753' }}>
              {selectedApp}
              <span style={{
                marginLeft: 8, fontSize: '0.68rem', fontWeight: 700,
                background: 'linear-gradient(90deg, #636bff, #404dff)', color: '#fff',
                padding: '0.15rem 0.5rem', borderRadius: 999, textTransform: 'uppercase',
                verticalAlign: 'middle',
              }}>
                {selectedApp === 'default' ? 'BASE' : 'APP CONFIG'}
              </span>
              {selectedAppDefault?.token && (
                <span style={{
                  marginLeft: 6, fontSize: '0.72rem', fontFamily: 'monospace', fontWeight: 600,
                  background: 'rgba(99,107,255,0.08)', color: '#636bff',
                  padding: '0.12rem 0.45rem', borderRadius: 6, verticalAlign: 'middle',
                }}>
                  app_token: {selectedAppDefault.token}
                </span>
              )}
            </h4>
            <p style={{ margin: '0 0 0.6rem', color: '#5d6698', fontSize: '0.8rem' }}>
              {selectedApp === 'default'
                ? '베이스 앱입니다. 여기서 설정한 값이 모든 앱의 기본값이 됩니다.'
                : 'base(default) 앱을 상속합니다. 변경된 항목만 저장됩니다.'}
            </p>
          </div>
          {selectedAppDefault?.token && (
            <button
              onClick={() => {
                const url = `${window.location.origin}/?app_token=${selectedAppDefault.token}`;
                navigator.clipboard.writeText(url);
                setStatusMsg('app_token URL이 복사되었습니다.');
              }}
              style={s.btnSmall}
            >
              app_token URL 복사
            </button>
          )}
        </div>
        {selectedAppDefault ? (
          viewMode === 'json' ? renderJsonEditor(selectedAppDefault, isBaseApp ? '베이스 설정' : '앱 설정 (오버라이드)') : (
            <div>
              <ConfigGui
                config={guiDraftItemId === selectedAppDefault.id ? guiDraft! : (mergedConfig ?? selectedAppDefault.config)}
                onChange={(cfg) => handleGuiChange(selectedAppDefault.id, cfg)}
                mode="admin"
                baseConfig={isBaseApp ? undefined : baseAppConfig}
              />
              {guiDraftItemId === selectedAppDefault.id && (
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
                  <button onClick={discardGuiDraft} style={s.btnSecondary}>취소</button>
                  <button onClick={saveGuiDraft} style={s.btnPrimary}>변경사항 저장</button>
                </div>
              )}
            </div>
          )
        ) : (
          <p style={{ color: '#7480ad', fontSize: '0.84rem' }}>기본 설정이 없습니다.</p>
        )}
      </article>

    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function AdminPage() {
  const [section, setSection] = useState<Section>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const menuItems: { id: Section; label: string }[] = [
    { id: 'dashboard', label: '대시보드' },
    { id: 'sessions', label: '세션 조회' },
    { id: 'settings', label: '설정' },
  ];

  const titles: Record<Section, { eyebrow: string; title: string }> = {
    dashboard: { eyebrow: 'Overview', title: '운영 대시보드' },
    sessions: { eyebrow: 'Session Management', title: '세션 조회' },
    settings: { eyebrow: 'Configuration', title: '설정 관리' },
  };

  const { eyebrow, title } = titles[section];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: sidebarOpen ? '200px 1fr' : '56px 1fr',
      gap: '0.5rem',
      minHeight: 'calc(100vh - 1rem)',
      transition: 'grid-template-columns 0.25s ease',
    }}>
      {/* Sidebar */}
      <aside style={{
        background: 'rgba(13, 18, 63, 0.94)',
        borderRadius: 16,
        padding: sidebarOpen ? '1rem' : '0.6rem',
        color: '#f2f3ff',
        boxShadow: '0 20px 45px rgba(25, 32, 92, 0.3)',
        overflow: 'hidden',
        transition: 'padding 0.25s ease',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            border: 0,
            background: 'rgba(255,255,255,0.1)',
            color: '#d8ddff',
            borderRadius: 10,
            width: 40,
            height: 40,
            fontSize: '1.2rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          ☰
        </button>

        {sidebarOpen && (
          <div style={{ marginTop: 12 }}>
            <p style={{
              fontSize: '0.85rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'rgba(210,215,255,0.75)',
              margin: 0,
            }}>
              Admin Console
            </p>
            <h2 style={{ margin: '0.3rem 0 1rem', fontSize: '1.2rem' }}>AssiAir 관리</h2>
          </div>
        )}

        <nav style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
          marginTop: sidebarOpen ? 0 : '0.5rem',
        }}>
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              style={{
                border: 0,
                borderRadius: 10,
                background: section === item.id
                  ? 'linear-gradient(90deg, #7278ff, #505af5)'
                  : 'rgba(255,255,255,0.08)',
                color: section === item.id ? '#fff' : '#d8ddff',
                padding: sidebarOpen ? '0.55rem 0.7rem' : '0.55rem 0',
                textAlign: sidebarOpen ? 'left' : 'center',
                fontWeight: 600,
                fontSize: sidebarOpen ? '0.88rem' : '0.75rem',
                cursor: 'pointer',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: sidebarOpen ? 'ellipsis' : 'clip',
              }}
            >
              {sidebarOpen ? item.label : item.label.charAt(0)}
            </button>
          ))}
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: 16 }}>
          <a
            href="/"
            style={{
              fontSize: sidebarOpen ? '0.82rem' : '0.7rem',
              color: 'rgba(210,215,255,0.6)',
              textDecoration: 'none',
              textAlign: sidebarOpen ? 'left' : 'center',
              display: 'block',
            }}
          >
            {sidebarOpen ? '← 위젯으로 돌아가기' : '←'}
          </a>
        </div>
      </aside>

      {/* Main content */}
      <section style={{
        background: 'rgba(255, 255, 255, 0.92)',
        borderRadius: 16,
        padding: '1rem 0.8rem 0.8rem',
        boxShadow: '0 25px 60px rgba(78, 84, 130, 0.25)',
        overflow: 'auto',
      }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', alignItems: 'flex-start', marginBottom: '0.9rem' }}>
          <div>
            <p style={s.eyebrow}>{eyebrow}</p>
            <h3 style={s.sectionTitle}>{title}</h3>
          </div>
        </header>

        {section === 'dashboard' && <DashboardSection />}
        {section === 'sessions' && <SessionsSection />}
        {section === 'settings' && <SettingsSection />}
      </section>
    </div>
  );
}
