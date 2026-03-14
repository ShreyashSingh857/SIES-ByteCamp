import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Database, Cpu, Search, CheckCircle2, Workflow, Layers } from 'lucide-react';

export default function SolutionSection() {
  return (
    <section className="relative py-24 sm:py-32 bg-[#020617] border-t border-slate-800/40 overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[20%] right-0 w-[600px] h-[600px] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-16 items-center">
          
          {/* Right: Content moved to Left in grid for text-first flow, or keep as prompt suggests */}
          <div className="flex flex-col">
            <h2 className="text-cyan-400 font-mono text-sm font-bold tracking-widest uppercase mb-4">
              Our Solution
            </h2>
            <h3 className="text-4xl sm:text-5xl font-display font-extrabold text-white leading-tight mb-8">
              AI‑Powered <br /> 
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Dependency Intelligence</span>
            </h3>

            <p className="text-lg text-slate-400 leading-relaxed mb-10 max-w-xl">
              Antigravity automatically scans your repository and builds a unified dependency graph. 
              We don't just look at files; we understand the <span className="text-slate-200">contractual logic</span> 
              connecting your services.
            </p>

            <ul className="grid gap-5">
              {[
                { icon: Cpu, text: 'AST Analysis powered by Tree-sitter', sub: 'Deep syntax parsing for 4+ languages' },
                { icon: Database, text: 'Neo4j Graph Backbone', sub: 'Million-node impact traversal in milliseconds' },
                { icon: Workflow, text: 'Cross-Service Tracing', sub: 'Follow Request/Response flows across APIs' }
              ].map((item, i) => (
                <motion.li 
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex gap-4 items-start"
                >
                  <div className="mt-1 w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="text-blue-400" size={14} />
                  </div>
                  <div>
                    <h4 className="text-slate-200 font-medium text-base">{item.text}</h4>
                    <p className="text-slate-500 text-sm italic">{item.sub}</p>
                  </div>
                </motion.li>
              ))}
            </ul>

            <div className="mt-12 flex items-center gap-2 text-blue-400 font-bold text-sm tracking-wide">
               <Zap size={16} className="fill-blue-400" />
               <span>CHANGE ONE COMPONENT, INSTANTLY SEE EVERYTHING AFFECTED</span>
            </div>
          </div>

          {/* Right/Left side: Visual (The Connected Graph) */}
          <div className="relative h-[450px] sm:h-[550px] bg-[#030712] rounded-3xl border border-slate-800/60 p-8 flex items-center justify-center isolate overflow-hidden shadow-2xl">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-transparent to-transparent pointer-events-none" />
            
            <div className="relative w-full h-full flex items-center justify-center">
               
               {/* Glowing Center Node (Search) */}
               <motion.div 
                 animate={{ scale: [1, 1.05, 1], boxShadow: ['0 0 40px rgba(37,99,235,0.2)', '0 0 80px rgba(37,99,235,0.4)', '0 0 40px rgba(37,99,235,0.2)'] }}
                 transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-3xl bg-[#0f172a] border border-blue-500/20 flex items-center justify-center z-30"
               >
                 <Search size={40} className="text-blue-500" strokeWidth={2.5} />
               </motion.div>

               {/* Connections */}
               <svg className="absolute inset-0 w-full h-full pointer-events-none z-20" overflow="visible">
                 <defs>
                   <filter id="line-glow" x="-20%" y="-20%" width="140%" height="140%">
                     <feGaussianBlur stdDeviation="4" result="blur" />
                     <feComposite in="SourceGraphic" in2="blur" operator="over" />
                   </filter>
                 </defs>
                 <ConnectedLine x1="50%" y1="50%" x2="20%" y2="25%" color="#06b6d4" delay={0} />
                 <ConnectedLine x1="50%" y1="50%" x2="80%" y2="25%" color="#3b82f6" delay={0.2} />
                 <ConnectedLine x1="50%" y1="50%" x2="20%" y2="75%" color="#6366f1" delay={0.4} />
                 <ConnectedLine x1="50%" y1="50%" x2="80%" y2="75%" color="#10b981" delay={0.6} />
               </svg>

               {/* Perimeter Nodes */}
               <PeripheralNode x="-30%" y="-25%" label="CLIENT-UI" color="cyan" icon={Layers} />
               <PeripheralNode x="30%" y="-25%" label="API-GATEWAY" color="blue" icon={Workflow} />
               <PeripheralNode x="-30%" y="25%" label="USER-SERVICE" color="indigo" icon={Cpu} />
               <PeripheralNode x="30%" y="25%" label="DASHBOARD-DB" color="emerald" icon={Database} />

            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

function PeripheralNode({ x, y, label, color, icon: Icon }) {
  const themes = {
    cyan: { bg: '#0b162c', border: '#06b6d4', text: '#06b6d4' },
    blue: { bg: '#0b162c', border: '#3b82f6', text: '#3b82f6' },
    indigo: { bg: '#0e122a', border: '#6366f1', text: '#818cf8' },
    emerald: { bg: '#071a20', border: '#10b981', text: '#10b981' }
  };
  const theme = themes[color];

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      style={{ left: `calc(50% + ${x})`, top: `calc(50% + ${y})`, backgroundColor: theme.bg, borderColor: `${theme.border}40` }}
      className={`absolute w-[140px] h-[100px] -translate-x-1/2 -translate-y-1/2 border rounded-2xl flex flex-col items-center justify-center gap-3 backdrop-blur-md shadow-2xl z-40 transition-transform duration-300`}
    >
      <Icon size={26} color={theme.text} strokeWidth={1.5} />
      <span className="text-[11px] font-display font-bold tracking-widest uppercase whitespace-nowrap" style={{ color: theme.text }}>
        {label}
      </span>
      
      {/* Static glowing dot top right */}
      <div 
        className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full"
        style={{ backgroundColor: theme.border, boxShadow: `0 0 10px ${theme.border}` }}
      />
    </motion.div>
  );
}

function ConnectedLine({ x1, y1, x2, y2, color, delay }) {
  return (
    <motion.path
      d={`M ${x1} ${y1} L ${x2} ${y2}`}
      stroke={color}
      strokeWidth="1.5"
      strokeDasharray="4 6"
      strokeOpacity="0.3"
      fill="none"
      initial={{ pathLength: 0, opacity: 0 }}
      whileInView={{ pathLength: 1, opacity: 1 }}
      transition={{ delay: delay + 0.5, duration: 1.5, ease: "easeInOut" }}
      filter="url(#line-glow)"
    />
  );
}
