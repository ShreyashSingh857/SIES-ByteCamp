import React from 'react';
import { Link } from 'react-router-dom';
import { GitBranch, Zap, Database, Globe, ArrowRight, CheckCircle2 } from 'lucide-react';
import Logo from '../components/Logo';
import ThemeToggle from '../components/theme/ThemeToggle';

const FEATURES = [
  {
    icon: GitBranch,
    title: 'Cross-Language Graph',
    desc: 'Parses JS, Python, Java, Go and builds a unified dependency graph across all service boundaries.',
    color: '#3b82f6',
  },
  {
    icon: Database,
    title: 'Schema Mapper',
    desc: 'AI extracts and infers OpenAPI and database schemas — no manual annotation required.',
    color: '#f59e0b',
  },
  {
    icon: Zap,
    title: 'Impact Simulator',
    desc: 'Select any node and instantly see every service, API, and field it will ripple through.',
    color: '#ef4444',
  },
  {
    icon: Globe,
    title: 'API Contract Inference',
    desc: 'LLMs analyse route handlers and infer request/response contracts with confidence scores.',
    color: '#22c55e',
  },
];

const STATS = [
  { value: '14+',   label: 'Node types tracked'    },
  { value: '<5s',   label: 'Time to first graph'   },
  { value: '6-hop', label: 'BFS impact traversal'  },
  { value: '4',     label: 'Languages supported'   },
];

const Landing = () => (
  <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
    {/* Navbar */}
    <nav
      className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-8 h-14"
      style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}
    >
      <Logo />
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Link
          to="/login"
          className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
          style={{ color: 'var(--text-muted)' }}
        >
          Sign in
        </Link>
        <Link
          to="/signup"
          className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all"
          style={{ background: '#1e3a8a', color: '#93c5fd' }}
        >
          Get started
        </Link>
      </div>
    </nav>

    {/* Hero */}
    <section className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20 sm:py-28">
      <div
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6"
        style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.25)' }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />
        GenAI Track · GA1
      </div>

      <h1 className="font-display font-bold text-4xl sm:text-5xl max-w-2xl leading-tight" style={{ color: 'var(--text)' }}>
        Map every dependency across your polyglot codebase
      </h1>

      <p className="mt-5 text-base max-w-xl" style={{ color: 'var(--text-muted)' }}>
        PolyglotDepMap parses your services, infers API contracts with AI, and builds an interactive
        cross-language dependency graph — so you see every impact before you commit.
      </p>

      <div className="mt-8 flex items-center gap-3 flex-wrap justify-center">
        <Link
          to="/signup"
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
          style={{ background: '#1e3a8a', color: '#93c5fd' }}
        >
          Start scanning <ArrowRight size={15} />
        </Link>
        <Link
          to="/login"
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
          style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)' }}
        >
          Sign in
        </Link>
      </div>

      {/* Stats strip */}
      <div className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-6 w-full max-w-xl">
        {STATS.map(({ value, label }) => (
          <div key={label} className="text-center">
            <p className="font-display font-bold text-2xl" style={{ color: 'var(--text)' }}>{value}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
          </div>
        ))}
      </div>
    </section>

    {/* Features */}
    <section
      className="py-16 px-4 sm:px-8"
      style={{ borderTop: '1px solid var(--border)' }}
    >
      <div className="max-w-4xl mx-auto">
        <h2
          className="text-xs font-semibold uppercase tracking-widest text-center mb-10"
          style={{ color: 'var(--text-muted)' }}
        >
          Core Capabilities
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {FEATURES.map(({ icon: Icon, title, desc, color }) => (
            <div key={title} className="card flex gap-4">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: `${color}18`, color }}
              >
                <Icon size={18} />
              </div>
              <div>
                <h3 className="font-display font-semibold text-sm" style={{ color: 'var(--text)' }}>{title}</h3>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Value prop list */}
    <section
      className="py-12 px-4 sm:px-8"
      style={{ background: 'var(--card)', borderTop: '1px solid var(--border)' }}
    >
      <div className="max-w-2xl mx-auto text-center space-y-4">
        <h2 className="font-display font-semibold text-lg" style={{ color: 'var(--text)' }}>
          Built for polyglot enterprise teams
        </h2>
        <ul className="space-y-2">
          {[
            'Supports Java · Node.js · Python · Go · TypeScript',
            'Neo4j graph DB — BFS impact traversal in milliseconds',
            'AI-inferred API contracts via Claude Sonnet',
            'See what breaks before you push — not after',
          ].map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm justify-center" style={{ color: 'var(--text-muted)' }}>
              <CheckCircle2 size={14} style={{ color: '#22c55e', flexShrink: 0 }} />
              {item}
            </li>
          ))}
        </ul>
        <Link
          to="/signup"
          className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-lg text-sm font-semibold"
          style={{ background: '#1e3a8a', color: '#93c5fd' }}
        >
          Try the demo <ArrowRight size={15} />
        </Link>
      </div>
    </section>

    {/* Footer */}
    <footer
      className="py-5 px-4 sm:px-8 flex items-center justify-between text-xs"
      style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}
    >
      <Logo />
      <span>Phase 1 · GenAI Track GA1 · 2026</span>
    </footer>
  </div>
);

export default Landing;
