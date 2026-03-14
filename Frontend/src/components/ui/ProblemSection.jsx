import React from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, Split, Search, Timer, Layers, CloudOff } from 'lucide-react';

const PAIN_POINTS = [
  {
    icon: CloudOff,
    title: 'Hidden Dependencies',
    desc: 'Changes in a Python service break your React frontend in ways static analysis can’t see.',
    color: '#f87171'
  },
  {
    icon: Timer,
    title: 'High Debugging Time',
    desc: 'Engineering hours wasted tracing API failures across distributed microservices.',
    color: '#fbbf24'
  },
  {
    icon: ShieldAlert,
    title: 'Production Risks',
    desc: 'Every refactor is a gamble when you don’t know who consumes your internal APIs.',
    color: '#ef4444'
  }
];

export default function ProblemSection() {
  return (
    <section className="relative py-24 sm:py-32 bg-[#020617] overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/2 left-0 w-[500px] h-[500px] bg-red-900/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          {/* Left: Content */}
          <div className="flex flex-col">
            <h2 className="text-red-500 font-mono text-sm font-bold tracking-widest uppercase mb-4">
              The Pain Point
            </h2>
            <h3 className="text-4xl sm:text-5xl font-display font-extrabold text-white leading-tight mb-8">
              The Hidden Complexity <br /> 
              <span className="text-slate-500 font-light italic">of Modern Codebases</span>
            </h3>
            
            <p className="text-lg text-slate-400 leading-relaxed mb-10 max-w-xl">
              Modern systems are polyglot. A single user action ripples through 
              <span className="text-slate-200 px-1 font-medium italic">React</span>, 
              <span className="text-slate-200 px-1 font-medium italic">Node.js</span>, and 
              <span className="text-slate-200 px-1 font-medium italic">Python</span>. 
              But traditional tools are siloed. They stop at the language boundary, 
              leaving you blind to cross-service impact.
            </p>

            <div className="grid gap-6">
              {PAIN_POINTS.map((point) => (
                <motion.div 
                  key={point.title}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className="flex gap-4 p-5 rounded-2xl bg-slate-900/40 border border-slate-800/60 hover:border-red-900/30 transition-colors group"
                >
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: point.color + '15', color: point.color }}
                  >
                    <point.icon size={20} />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold text-base mb-1">{point.title}</h4>
                    <p className="text-slate-400 text-sm">{point.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Right: Visual "Broken Visibility" Enhanced */}
          <div className="relative w-full h-[400px] sm:h-[500px] mt-8 lg:mt-0 flex items-center justify-center">
            
            {/* Background Ambient Glow */}
            <motion.div 
              animate={{ 
                scale: [1, 1.1, 1],
                opacity: [0.3, 0.4, 0.3]
              }}
              transition={{ duration: 4, repeat: Infinity }}
              className="absolute w-[350px] h-[350px] bg-red-900/20 rounded-full blur-[100px]"
            />

            <div className="relative w-full max-w-[500px] h-full">

              {/* Connecting Line (SVG) */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
                <defs>
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="6" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <filter id="glow-strong" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* The main dashed line - clearly visible */}
                <path 
                  d="M 140 135 L 370 395" 
                  stroke="#ef4444" 
                  strokeOpacity="0.8"
                  strokeWidth="2" 
                  strokeDasharray="8 8" 
                  fill="none" 
                />

                {/* Animated traveling particle that travels the path clearly */}
                <motion.circle
                  r="5"
                  fill="#ffffff"
                  filter="url(#glow-strong)"
                  animate={{
                    cx: [140, 255, 255, 140],
                    cy: [135, 265, 265, 135],
                    opacity: [1, 1, 0, 0]
                  }}
                  transition={{
                    duration: 3,
                    times: [0, 0.4, 0.5, 1], // Stops at middle, fades out
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <animate 
                    attributeName="r"
                    values="4;6;4"
                    dur="1s"
                    repeatCount="indefinite"
                  />
                </motion.circle>
              </svg>

              {/* Node: React Frontend */}
              <motion.div 
                className="absolute top-[85px] left-[30px] w-[220px] p-5 rounded-[16px] bg-[#121726]/90 backdrop-blur-xl border border-slate-800/80 shadow-2xl z-10"
                whileHover={{ y: -5, borderColor: 'rgba(148, 163, 184, 0.3)' }}
              >
                <div className="text-[11px] text-[#6b7280] font-mono tracking-widest font-bold mb-4 uppercase">REACT FRONTEND</div>
                <div className="space-y-2.5">
                  <div className="w-[85%] h-2.5 bg-[#1e293b] rounded-full" />
                  <div className="w-[65%] h-2.5 bg-[#1e293b] rounded-full" />
                </div>
              </motion.div>

              {/* Node: Python Service */}
              <motion.div 
                className="absolute top-[345px] left-[260px] w-[220px] p-5 rounded-[16px] bg-[#121726]/90 backdrop-blur-xl border border-slate-800/80 shadow-2xl z-10"
                whileHover={{ y: -5, borderColor: 'rgba(148, 163, 184, 0.3)' }}
              >
                <div className="text-[11px] text-[#6b7280] font-mono tracking-widest font-bold mb-4 uppercase">PYTHON FASTAPI</div>
                <div className="space-y-2.5">
                  <div className="w-[75%] h-2.5 bg-[#1e293b] rounded-full" />
                  <div className="w-[95%] h-2.5 bg-[#1e293b] rounded-full" />
                </div>
              </motion.div>

              {/* Center: Visibility Gap Badge */}
              <div className="absolute top-[265px] left-[255px] -translate-x-1/2 -translate-y-1/2 z-20">
                
                {/* Visual "Target" rings behind the badge (from the reference image) */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full border border-slate-500/30 -z-10" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border border-slate-400/30 -z-10" />
                
                <motion.div 
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="relative group"
                >
                  {/* Heavy Red Glow behind the badge */}
                  <div className="absolute inset-[-15px] bg-red-600/50 rounded-full blur-[25px] -z-10" />
                  
                  <div className="relative px-6 py-2.5 rounded-full bg-[#3a0a14] border border-red-500/60 text-red-400 text-[12px] sm:text-[13px] font-mono font-bold tracking-[0.2em] shadow-[0_0_35px_rgba(239,68,68,0.5)] whitespace-nowrap overflow-hidden">
                    VISIBILITY GAP
                  </div>
                </motion.div>
                
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
