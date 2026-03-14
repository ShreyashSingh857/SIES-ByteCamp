import React from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, GitBranch } from 'lucide-react';
import ThemeToggle from '../theme/ThemeToggle';
import { useSelector } from 'react-redux';

const PAGE_TITLES = {
  '/home':   { label: 'Dashboard',    sub: 'Overview of your scanned repositories' },
  '/upload': { label: 'Upload Repos', sub: 'Connect GitHub repositories to scan'   },
  '/graph':  { label: 'Graph View',   sub: 'Interactive dependency graph explorer'  },
  '/impact': { label: 'Impact Panel', sub: 'Simulate change propagation'            },
};

const Header = ({ toggleSidebar }) => {
  const location = useLocation();
  const page = PAGE_TITLES[location.pathname] || { label: 'PolyglotDepMap', sub: '' };
  const scanStatus = useSelector((s) => s.graph.scanStatus);
  const scanProgress = useSelector((s) => s.graph.scanProgress);

  return (
    <header
      className="sticky top-0 z-10 h-14 flex items-center px-4 sm:px-6 gap-4"
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

      <ThemeToggle />
    </header>
  );
};

export default Header;
