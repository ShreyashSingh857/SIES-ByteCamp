import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, GitBranch, Zap, Database, FileCode, ArrowRight } from 'lucide-react';
import { useSelector } from 'react-redux';
import { useAuth } from '../contexts/AuthContext';

const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className="card flex items-center gap-4">
    <div
      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
      style={{ background: `${color}18`, color }}
    >
      <Icon size={20} />
    </div>
    <div>
      <p className="text-2xl font-display font-bold" style={{ color: 'var(--text)' }}>{value}</p>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </div>
  </div>
);

const QuickAction = ({ icon: Icon, label, sub, to, color, navigate }) => (
  <button
    onClick={() => navigate(to)}
    className="card text-left hover:border-blue-500 transition-all group w-full"
  >
    <div className="flex items-start gap-3">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: `${color}18`, color }}
      >
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>
      </div>
      <ArrowRight size={15} className="flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color }} />
    </div>
  </button>
);

const Home = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const repos = useSelector((s) => s.graph.repos);
  const graphData = useSelector((s) => s.graph.graphData);

  const scannedRepos = repos.filter((r) => r.status === 'scanned');

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Greeting */}
      <div>
        <h2 className="font-display font-semibold text-lg" style={{ color: 'var(--text)' }}>
          Welcome back, {user?.name?.split(' ')[0] || 'there'} 👋
        </h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Here's a snapshot of your polyglot dependency landscape.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={GitBranch}  label="Repos Scanned"  value={scannedRepos.length}             color="#3b82f6" />
        <StatCard icon={FileCode}   label="Graph Nodes"    value={graphData.nodes.length}           color="#22c55e" />
        <StatCard icon={Database}   label="Graph Edges"    value={graphData.edges.length}           color="#f59e0b" />
        <StatCard icon={Zap}        label="Services"       value={graphData.nodes.filter((n) => n.type === 'service').length} color="#a855f7" />
      </div>

      {/* Quick actions */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
          Quick Actions
        </h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <QuickAction
            icon={Upload}     label="Upload Repos"   sub="Connect a GitHub repo to scan"
            to="/upload"      color="#3b82f6"        navigate={navigate}
          />
          <QuickAction
            icon={GitBranch}  label="View Graph"     sub="Explore the dependency graph"
            to="/graph"       color="#22c55e"        navigate={navigate}
          />
        </div>
      </div>

      {/* Recent repos */}
      {repos.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
            Recent Repositories
          </h3>
          <div className="space-y-2">
            {repos.slice(0, 3).map((repo) => (
              <div key={repo.id} className="card flex items-center gap-4 py-3">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    background:
                      repo.status === 'scanned'  ? '#22c55e' :
                      repo.status === 'scanning' ? '#3b82f6' : '#94a3b8',
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium code-text truncate" style={{ color: 'var(--text)' }}>
                    {repo.name}
                  </p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    {repo.langs.join(' · ')}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                    {repo.nodes} nodes
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {repo.edges} edges
                  </p>
                </div>
                <span
                  className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{
                    background: repo.status === 'scanned' ? 'rgba(34,197,94,0.12)' : 'rgba(59,130,246,0.12)',
                    color:      repo.status === 'scanned' ? '#22c55e'               : '#3b82f6',
                  }}
                >
                  {repo.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
