import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitBranch, Zap, Database, Globe, ArrowRight, CheckCircle2 } from 'lucide-react';

const FEATURES = [
  {
    icon: GitBranch,
    title: 'Cross-Language Graph',
    tagline: 'One graph. Every language.',
    desc: 'Parses JS, Python, Java, Go and builds a unified dependency graph across all service boundaries.',
    color: '#3b82f6',
    gradient: 'from-blue-600/20 to-blue-900/10',
    border: 'rgba(59,130,246,0.35)',
    glow: 'rgba(59,130,246,0.15)',
    bullets: [
      'Supports JS, TS, Python, Java, Go',
      'Cross-service edge detection',
      'Unified graph view across repos',
      'Real-time graph updates on push',
    ],
  },
  {
    icon: Database,
    title: 'Schema Mapper',
    tagline: 'Zero annotation. Full coverage.',
    desc: 'AI extracts and infers OpenAPI and database schemas — no manual annotation required.',
    color: '#f59e0b',
    gradient: 'from-amber-600/20 to-amber-900/10',
    border: 'rgba(245,158,11,0.35)',
    glow: 'rgba(245,158,11,0.15)',
    bullets: [
      'Auto-infers OpenAPI schemas',
      'DB schema extraction (SQL + NoSQL)',
      'Contract diffing across versions',
      'No manual annotation needed',
    ],
  },
  {
    icon: Zap,
    title: 'Impact Simulator',
    tagline: 'See ripples before you commit.',
    desc: 'Select any node and instantly see every service, API, and field it will ripple through.',
    color: '#ef4444',
    gradient: 'from-red-600/20 to-red-900/10',
    border: 'rgba(239,68,68,0.35)',
    glow: 'rgba(239,68,68,0.15)',
    bullets: [
      '6-hop BFS traversal engine',
      'Instant change propagation view',
      'Risk scoring per affected node',
      'Visual diff on impact graph',
    ],
  },
  {
    icon: Globe,
    title: 'API Contract Inference',
    tagline: 'AI-inferred. Confidence-scored.',
    desc: 'LLMs analyse route handlers and infer request/response contracts with confidence scores.',
    color: '#22c55e',
    gradient: 'from-green-600/20 to-green-900/10',
    border: 'rgba(34,197,94,0.35)',
    glow: 'rgba(34,197,94,0.15)',
    bullets: [
      'LLM-powered route analysis',
      'Request/response shape inference',
      'Confidence score per contract',
      'REST + GraphQL support',
    ],
  },
];

export default function ExpandableFeatureCards() {
  const [activeIndex, setActiveIndex] = useState(null);

  const toggle = (i) => setActiveIndex(activeIndex === i ? null : i);

  return (
    <div className="flex flex-col gap-4">
      {FEATURES.map(({ icon: Icon, title, tagline, desc, color, gradient, border, glow, bullets }, i) => {
        const isOpen = activeIndex === i;

        return (
          <motion.div
            key={title}
            layout
            onMouseEnter={() => setActiveIndex(i)}
            onMouseLeave={() => setActiveIndex(null)}
            className={`relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300`}
            style={{
              background: isOpen
                ? `linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(15,23,42,0.85) 100%)`
                : 'rgba(15, 23, 42, 0.60)',
              backdropFilter: 'blur(16px)',
              border: `1px solid ${isOpen ? border : 'rgba(100,116,139,0.20)'}`,
              boxShadow: isOpen
                ? `0 0 40px ${glow}, 0 8px 32px rgba(0,0,0,0.4)`
                : '0 2px 12px rgba(0,0,0,0.2)',
            }}
            whileHover={{
              borderColor: border,
              boxShadow: `0 0 20px ${glow}, 0 4px 16px rgba(0,0,0,0.3)`,
            }}
            transition={{ layout: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } }}
          >
            {/* Gradient wash when open */}
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`absolute inset-0 bg-gradient-to-br ${gradient} pointer-events-none`}
                />
              )}
            </AnimatePresence>

            {/* Header row — always visible */}
            <div className="relative z-10 flex items-center gap-5 px-6 py-5">
              {/* Icon orb */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg transition-transform duration-300"
                style={{
                  background: `${color}18`,
                  border: `1px solid ${color}35`,
                  boxShadow: isOpen ? `0 0 16px ${color}40` : 'none',
                  transform: isOpen ? 'scale(1.1)' : 'scale(1)',
                }}
              >
                <Icon size={22} style={{ color }} />
              </div>

              {/* Title + tagline */}
              <div className="flex-1 min-w-0">
                <h3
                  className="font-display font-bold text-base sm:text-lg leading-tight"
                  style={{ color: isOpen ? '#f1f5f9' : '#cbd5e1' }}
                >
                  {title}
                </h3>
                <p
                  className="text-xs sm:text-sm mt-0.5 font-medium"
                  style={{ color: isOpen ? color : '#64748b' }}
                >
                  {tagline}
                </p>
              </div>

              {/* Expand chevron */}
              <motion.div
                animate={{ rotate: isOpen ? 45 : 0 }}
                transition={{ duration: 0.25 }}
                className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                style={{
                  background: isOpen ? `${color}20` : 'rgba(100,116,139,0.15)',
                  border: `1px solid ${isOpen ? color + '50' : 'rgba(100,116,139,0.2)'}`,
                }}
              >
                <ArrowRight size={14} style={{ color: isOpen ? color : '#64748b' }} />
              </motion.div>
            </div>

            {/* Expanded body */}
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                  className="overflow-hidden relative z-10"
                >
                  {/* Divider */}
                  <div
                    className="mx-6 mb-5"
                    style={{ height: '1px', background: `${color}25` }}
                  />

                  <div className="px-6 pb-6 flex flex-col sm:flex-row gap-6">
                    {/* Description */}
                    <p className="text-sm text-slate-400 leading-relaxed sm:w-1/2">
                      {desc}
                    </p>

                    {/* Bullet list */}
                    <ul className="flex flex-col gap-2.5 sm:w-1/2">
                      {bullets.map((b) => (
                        <li key={b} className="flex items-start gap-2.5 text-sm text-slate-300">
                          <CheckCircle2
                            size={14}
                            className="flex-shrink-0 mt-0.5"
                            style={{ color }}
                          />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}
