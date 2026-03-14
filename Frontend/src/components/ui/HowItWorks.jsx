import React from 'react';
import { motion } from 'framer-motion';
import { Github, Search, Database, BrainCircuit, Activity, ArrowRight } from 'lucide-react';

const STEPS = [
  {
    icon: Github,
    title: 'Connect Repos',
    desc: 'Integrate with GitHub or GitLab. We scan your source code securely.',
    color: '#94a3b8'
  },
  {
    icon: Search,
    title: 'AST Parsing',
    desc: 'Tree-sitter extracts symbols, function calls, and API handlers in real-time.',
    color: '#3b82f6'
  },
  {
    icon: Database,
    title: 'Graph Storage',
    desc: 'Everything is mapped into Neo4j for lightning-fast impact traversal.',
    color: '#6366f1'
  },
  {
    icon: BrainCircuit,
    title: 'AI Synthesis',
    desc: 'Claude infers API contracts and database schemas automatically.',
    color: '#a855f7'
  },
  {
    icon: Activity,
    title: 'Impact Analysis',
    desc: 'Detect ripple effects and breaking changes before you even push.',
    color: '#ec4899'
  }
];

export default function HowItWorks() {
  return (
    <section className="relative py-24 sm:py-32 bg-[#020617] border-t border-slate-800/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 relative z-10">
        
        {/* Header */}
        <div className="text-center mb-20">
          <h2 className="text-blue-400 font-mono text-sm font-bold tracking-[0.2em] uppercase mb-4">
            The Workflow
          </h2>
          <h3 className="text-4xl sm:text-5xl font-display font-extrabold text-white mb-6">
            From Code to Graph in Seconds
          </h3>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto font-light leading-relaxed">
            Antigravity automates the entire process of architectural discovery. 
            No manual documentation, no outdated diagrams.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 relative">
          
          {/* Connecting Line (Horizontal on Desktop) */}
          <div className="hidden md:block absolute top-[44px] left-[10%] right-[10%] h-[1px] bg-gradient-to-r from-transparent via-slate-800 to-transparent z-0" />

          {STEPS.map((step, i) => (
            <motion.div 
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
              className="flex flex-col items-center text-center relative z-10 group"
            >
              {/* Icon Container */}
              <div 
                className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 relative transition-all duration-300 group-hover:scale-110"
                style={{ 
                   background: 'rgba(15, 23, 42, 0.8)',
                   border: `1px solid rgba(100, 116, 139, 0.2)`,
                   boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)'
                }}
              >
                 {/* Glow effect on hover */}
                 <div 
                   className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl"
                   style={{ background: step.color + '30' }}
                 />
                 
                 <step.icon size={32} style={{ color: step.color }} />
                 
                 {/* Step Number */}
                 <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-bold flex items-center justify-center text-slate-500">
                   0{i + 1}
                 </div>
              </div>

              <h4 className="text-white font-display font-bold text-lg mb-3 tracking-tight group-hover:text-blue-400 transition-colors">
                {step.title}
              </h4>
              <p className="text-slate-500 text-sm leading-relaxed px-2">
                {step.desc}
              </p>

              {/* Arrow for mobile / hidden on desktop connecting line handled above */}
              {i < STEPS.length - 1 && (
                <div className="md:hidden mt-8 mb-4">
                  <ArrowRight className="text-slate-800 rotate-90" size={24} />
                </div>
              )}
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
