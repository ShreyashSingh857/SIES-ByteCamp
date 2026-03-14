import React from 'react';
import { motion } from 'framer-motion';
import { Network, FileSearch, Sparkles, Zap, Layers, Cpu } from 'lucide-react';

const TECH = [
  {
    name: 'Neo4j',
    role: 'Graph Database',
    desc: 'The industry-standard graph DB for mapping millions of complex dependencies.',
    icon: Network,
    color: '#008cc1'
  },
  {
    name: 'Tree-sitter',
    role: 'Parsing Engine',
    desc: 'Incremenal AST parsing for lightning-fast analysis of multiple languages.',
    icon: FileSearch,
    color: '#3b82f6'
  },
  {
    name: 'Anthropic Claude',
    role: 'Logic Synthesis',
    desc: 'State-of-the-art LLMs to infer API contracts and database schema logic.',
    icon: Sparkles,
    color: '#d97706'
  }
];

export default function TechStack() {
  return (
    <section className="relative py-24 sm:py-32 bg-[#020617] border-t border-slate-800/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 relative z-10">
        
        <div className="text-center mb-16">
          <h2 className="text-orange-400 font-mono text-sm font-bold tracking-[0.2em] uppercase mb-4">
            The Engine
          </h2>
          <h3 className="text-4xl font-display font-extrabold text-white mb-6">
            The Intelligence Stack
          </h3>
          <p className="text-slate-400 text-lg max-w-xl mx-auto font-light leading-relaxed">
            Antigravity leverages cutting-edge open-source and proprietary 
            technologies to provide architectural visibility at scale.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {TECH.map((item, i) => (
            <motion.div 
              key={item.name}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800/60 hover:border-orange-500/20 transition-all flex flex-col items-center text-center group"
            >
              <div 
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(0,0,0,0.3)] group-hover:shadow-orange-500/10 transition-shadow"
                style={{ background: item.color + '10', border: `1px solid ${item.color}30` }}
              >
                <item.icon size={32} style={{ color: item.color }} />
              </div>
              
              <h4 className="text-white font-display font-bold text-xl mb-1">{item.name}</h4>
              <p className="text-orange-400 font-mono text-[10px] font-bold tracking-widest uppercase mb-4">{item.role}</p>
              
              <p className="text-slate-400 text-sm leading-relaxed font-light">
                {item.desc}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Small stats strip or secondary tech list */}
        <div className="mt-20 flex flex-wrap justify-center gap-10 opacity-40">
           <TechLabel icon={Zap} label="Next.js 14" />
           <TechLabel icon={Layers} label="TypeScript" />
           <TechLabel icon={Cpu} label="Node.js Engine" />
        </div>
      </div>
    </section>
  );
}

function TechLabel({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-2 text-white font-mono text-xs font-bold tracking-tighter hover:opacity-100 transition-opacity cursor-default">
      <Icon size={14} />
      <span>{label}</span>
    </div>
  );
}
