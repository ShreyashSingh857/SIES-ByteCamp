import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCcw, UserPlus, Scissors, ShieldAlert, ArrowUpRight, Search, GitPullRequest, Layers, Code2, Database, ShieldCheck, CheckCircle2 } from 'lucide-react';

const CASES = [
  {
    id: 'refactoring',
    icon: RefreshCcw,
    title: 'Safe Refactoring',
    desc: 'Rename a field in your shared library and immediately see every API consumer that will break across 20+ repos.',
    color: '#3b82f6',
    workflow: [
      { icon: Search, text: "Search for the specific struct/class node in Polyglot map." },
      { icon: Code2, text: "View incoming dependency edges from API consumers." },
      { icon: GitPullRequest, text: "Generate cross-repo patch guidelines automatically." }
    ]
  },
  {
    id: 'onboarding',
    icon: UserPlus,
    title: 'Developer Onboarding',
    desc: 'New hires can visualize how our Python backend talks to our Go microservices without reading 1000 lines of code.',
    color: '#10b981',
    workflow: [
      { icon: Layers, text: "Filter map by 'Service' or 'Domain' tags." },
      { icon: Database, text: "Hover over edges to view payload interfaces & DB calls." },
      { icon: CheckCircle2, text: "Export a bounded context diagram to engineering Wiki." }
    ]
  },
  {
    id: 'monolith',
    icon: Scissors,
    title: 'Breaking Monoliths',
    desc: 'Identify clean boundaries for extraction by visualizing which components have the fewest outgoing dependencies.',
    color: '#f59e0b',
    workflow: [
      { icon: Scissors, text: "Run cluster analysis to find loosely coupled logical groups." },
      { icon: Code2, text: "Highlight cyclic dependency traps blocking extraction." },
      { icon: GitPullRequest, text: "Simulate architecture changes in 'What IF' branch mode." }
    ]
  },
  {
    id: 'security',
    icon: ShieldAlert,
    title: 'Security Patching',
    desc: 'When a vulnerability is found in a sub-dependency, see exactly which production services are vulnerable.',
    color: '#ef4444',
    workflow: [
      { icon: Search, text: "Query the specific CVE-flagged package version." },
      { icon: Layers, text: "Trace paths backwards from the library to internet-facing APIs." },
      { icon: ShieldCheck, text: "Prioritize teams/services based on actual threat exposure." }
    ]
  }
];

export default function UseCases() {
  const [activeWorkflowId, setActiveWorkflowId] = useState(null);

  const toggleWorkflow = (id) => {
    if (activeWorkflowId === id) {
      setActiveWorkflowId(null);
    } else {
      setActiveWorkflowId(id);
    }
  };

  return (
    <section className="relative py-24 sm:py-32 bg-[#020617] border-t border-slate-800/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 relative z-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-8 text-center md:text-left">
          <div className="max-w-2xl">
            <h2 className="text-emerald-400 font-mono text-sm font-bold tracking-[0.2em] uppercase mb-4">
              Use Cases
            </h2>
            <h3 className="text-4xl sm:text-5xl font-display font-extrabold text-white leading-tight">
              Built for <span className="italic font-light text-slate-400 font-sans">Extreme</span> Engineering Velocity
            </h3>
          </div>
        </div>

        {/* Use Cases Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {CASES.map((item, i) => (
            <motion.div 
              key={item.title}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group relative p-8 rounded-3xl bg-slate-900/30 border border-slate-800/50 hover:bg-slate-900/50 hover:border-slate-700 transition-all duration-300 overflow-hidden"
            >
              {/* Corner accent */}
              <div 
                className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br opacity-[0.03] group-hover:opacity-[0.08] transition-opacity"
                style={{ background: `linear-gradient(135deg, transparent 50%, ${item.color} 100%)` }}
              />

              <div className="flex flex-col h-full relative z-10">
                <div 
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-xl"
                  style={{ background: item.color + '15', color: item.color, border: `1px solid ${item.color}30` }}
                >
                  <item.icon size={28} />
                </div>
                
                <h4 className="text-2xl font-display font-bold text-white mb-4 group-hover:text-blue-400 transition-colors">
                  {item.title}
                </h4>
                
                <p className="text-slate-400 text-lg leading-relaxed mb-8 font-light">
                  {item.desc}
                </p>

                <div 
                  onClick={() => toggleWorkflow(item.id)}
                  className="mt-auto flex items-center gap-2 text-slate-500 font-bold text-xs tracking-widest uppercase group-hover:text-white transition-colors cursor-pointer w-max"
                  style={{ color: activeWorkflowId === item.id ? item.color : '' }}
                >
                  <span className="select-none">{activeWorkflowId === item.id ? 'Hide workflow' : 'Learn the workflow'}</span>
                  <motion.div
                    animate={{ rotate: activeWorkflowId === item.id ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </motion.div>
                </div>

                <AnimatePresence>
                  {activeWorkflowId === item.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0, marginTop: 0 }}
                      animate={{ height: 'auto', opacity: 1, marginTop: 24 }}
                      exit={{ height: 0, opacity: 0, marginTop: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="overflow-hidden border-t border-slate-800/60 pt-6"
                    >
                      <ul className="space-y-4">
                        {item.workflow.map((step, idx) => (
                          <motion.li 
                            key={idx}
                            initial={{ x: -10, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: idx * 0.1 + 0.1 }}
                            className="flex items-start gap-3"
                          >
                            <div 
                              className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center border"
                              style={{ 
                                backgroundColor: item.color + '15', 
                                borderColor: item.color + '40',
                                color: item.color 
                              }}
                            >
                              <step.icon size={12} strokeWidth={3} />
                            </div>
                            <span className="text-slate-300 text-sm font-light leading-relaxed">
                              {step.text}
                            </span>
                          </motion.li>
                        ))}
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Decorative circle glow */}
              <div 
                className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full blur-[60px] opacity-0 group-hover:opacity-[0.05] transition-opacity"
                style={{ background: item.color }}
              />
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
