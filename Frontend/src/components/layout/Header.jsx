import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, GitBranch } from 'lucide-react';
import { useSelector } from 'react-redux';

import ThemeToggle from '../theme/ThemeToggle';

const PAGE_TITLES = {
  '/home': { label: 'Dashboard', sub: 'Overview of your scanned repositories' },
  '/upload': { label: 'Upload Repos', sub: 'Connect GitHub repositories to scan' },
  '/graph': { label: 'Graph View', sub: 'Interactive dependency graph explorer' },
};

const Header = ({ toggleSidebar }) => {
  const location = useLocation();
  const page = PAGE_TITLES[location.pathname] || { label: 'PolyglotDepMap', sub: '' };
  const scanStatus = useSelector((s) => s.graph.scanStatus);
  const scanProgress = useSelector((s) => s.graph.scanProgress);
  const currentRepoId = useSelector((s) => s.graph.currentRepoId);
  const [syncState, setSyncState] = useState('idle');

  useEffect(() => {
    if (!currentRepoId) {
      setSyncState('idle');
      return undefined;
    }

    const apiBaseUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
    const eventSource = new EventSource(`${apiBaseUrl}/events/${currentRepoId}`);
    let doneTimer = null;

    eventSource.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'GRAPH_PATCH') {
        setSyncState('syncing');
        clearTimeout(doneTimer);
        doneTimer = window.setTimeout(() => setSyncState('done'), 2000);
      }
      if (message.type === 'SYNC_ERROR') {
        setSyncState('error');
      }
    };

    eventSource.onerror = () => {
      setSyncState((state) => (state === 'error' ? state : 'idle'));
    };

    return () => {
      clearTimeout(doneTimer);
      eventSource.close();
    };
  }, [currentRepoId]);

  return (
    <header
      className="sticky top-0 z-30 h-14 flex items-center px-4 sm:px-6 gap-4"
      style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}
    >
      {/* Mobile menu toggle */}
      <button
        onClick={toggleSidebar}
        className="lg:hidden p-1.5 rounded-md transition-colors"
        style={{ color: 'var(--text-muted)' }}
      >
        <Menu size={20} />
      </button>

      {/* Page title */}
      <div className="flex-1 min-w-0">
        <h1 className="font-display font-semibold text-sm sm:text-base truncate" style={{ color: 'var(--text)' }}>
          {page.label}
        </h1>
        {page.sub && (
          <p className="text-xs hidden sm:block truncate" style={{ color: 'var(--text-muted)' }}>
            {page.sub}
          </p>
        )}
      </div>

      {/* Scan status badge */}
      {scanStatus === 'scanning' && (
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
          style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.25)' }}>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          Scanning… {scanProgress}%
        </div>
      )}
      {scanStatus === 'done' && (
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
          style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}>
          <GitBranch size={13} />
          Graph ready
        </div>
      )}
      {currentRepoId && (
        <div
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
          style={{
            background:
              syncState === 'syncing' ? 'rgba(59,130,246,0.1)' :
                syncState === 'done' ? 'rgba(34,197,94,0.1)' :
                  syncState === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(148,163,184,0.12)',
            color:
              syncState === 'syncing' ? '#3b82f6' :
                syncState === 'done' ? '#22c55e' :
                  syncState === 'error' ? '#ef4444' : 'var(--text-muted)',
            border:
              syncState === 'syncing' ? '1px solid rgba(59,130,246,0.25)' :
                syncState === 'done' ? '1px solid rgba(34,197,94,0.25)' :
                  syncState === 'error' ? '1px solid rgba(239,68,68,0.25)' : '1px solid var(--border)',
          }}
        >
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${syncState === 'syncing' ? 'animate-pulse bg-blue-500' : syncState === 'done' ? 'bg-green-500' : syncState === 'error' ? 'bg-red-500' : 'bg-slate-400'}`} />
          {syncState === 'idle' ? 'Live sync ready' : syncState === 'syncing' ? 'Syncing…' : syncState === 'done' ? 'Up to date' : 'Sync error'}
        </div>
      )}

      <ThemeToggle />
    </header>
  );
};

export default Header;
