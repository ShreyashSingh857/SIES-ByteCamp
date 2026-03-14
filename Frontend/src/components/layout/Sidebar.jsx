import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Upload, LayoutGrid, GitBranch, Zap, Home, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import Logo from '../Logo';
import { useAuth } from '../../contexts/AuthContext';

const NAV_ITEMS = [
  { to: '/home',          icon: Home,       label: 'Dashboard'    },
  { to: '/upload',        icon: Upload,     label: 'Upload Repos' },
  { to: '/analyze',       icon: LayoutGrid, label: 'Analyze'      },
  { to: '/graph',         icon: GitBranch,  label: 'Graph View'   },
];

const Sidebar = ({ isOpen, onClose, isCollapsed, toggleCollapse }) => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          fixed top-0 left-0 z-30 h-full flex flex-col
          transition-all duration-300 ease-in-out
          ${isCollapsed ? 'w-16' : 'w-64'}
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{ background: 'var(--card)', borderRight: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 h-14 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <Logo collapsed={isCollapsed} />
          <button
            onClick={toggleCollapse}
            className="hidden lg:flex items-center justify-center w-6 h-6 rounded transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'active' : ''} ${isCollapsed ? 'justify-center px-0' : ''}`
              }
              title={isCollapsed ? label : undefined}
            >
              <Icon size={17} className="flex-shrink-0" />
              {!isCollapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer — user + logout */}
        <div
          className="px-2 py-3 flex-shrink-0"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          {!isCollapsed && (
            <div className="flex items-center gap-2.5 px-3 py-2 mb-1 rounded-lg" style={{ background: 'var(--bg-muted)' }}>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: '#1e3a8a', color: '#93c5fd' }}
              >
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>
                  {user?.name || 'User'}
                </p>
                <p className="text-[10px] truncate code-text" style={{ color: 'var(--text-muted)' }}>
                  {user?.email || ''}
                </p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`nav-link w-full ${isCollapsed ? 'justify-center px-0' : ''}`}
            title={isCollapsed ? 'Log out' : undefined}
          >
            <LogOut size={17} className="flex-shrink-0" />
            {!isCollapsed && <span>Log out</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
