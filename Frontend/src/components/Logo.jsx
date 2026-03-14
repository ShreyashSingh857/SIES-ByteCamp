import React from 'react';

const Logo = ({ className = '', collapsed = false }) => {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="relative flex-shrink-0">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="28" height="28" rx="7" fill="#1e3a8a" />
          <circle cx="8"  cy="14" r="2.5" fill="#3b82f6" />
          <circle cx="20" cy="8"  r="2.5" fill="#22c55e" />
          <circle cx="20" cy="20" r="2.5" fill="#f59e0b" />
          <line x1="10.2" y1="13.1" x2="17.8" y2="9.1"   stroke="#3b82f6" strokeWidth="1.2" strokeDasharray="2 1.5" />
          <line x1="10.2" y1="14.9" x2="17.8" y2="18.9"  stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="2 1.5" />
          <line x1="20"   y1="10.5" x2="20"   y2="17.5"  stroke="#94a3b8" strokeWidth="1.2" />
        </svg>
      </div>
      {!collapsed && (
        <div className="flex flex-col leading-none">
          <span className="font-display font-bold text-sm" style={{ color: 'var(--text)' }}>
            PolyglotDep
          </span>
          <span className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
            Map
          </span>
        </div>
      )}
    </div>
  );
};

export default Logo;
