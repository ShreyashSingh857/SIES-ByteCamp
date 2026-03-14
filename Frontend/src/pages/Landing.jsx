import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import Logo from '../components/Logo';
import DependencyImpactVisualizer from '../components/ui/DependencyImpactVisualizer';
import ExpandableFeatureCards from '../components/ui/ExpandableFeatureCards';
import ProblemSection from '../components/ui/ProblemSection';
import SolutionSection from '../components/ui/SolutionSection';
import HowItWorks from '../components/ui/HowItWorks';
import UseCases from '../components/ui/UseCases';
import FinalCTA from '../components/ui/FinalCTA';

const Landing = () => {
  const [inputValue, setInputValue] = useState('');
  const [isShaking, setIsShaking] = useState(false);

  // Trigger shake effect when typing
  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  const scrollToSection = (e, id) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Navbar */}
      <div className="fixed top-0 w-full z-50 pt-6 px-4 flex justify-center pointer-events-none">
        <nav
          className="pointer-events-auto flex items-center justify-between w-full max-w-5xl h-[60px] px-4 md:px-6 rounded-full border border-white/10 shadow-2xl backdrop-blur-xl bg-[#020617]/50"
        >
          {/* Left: Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Logo />
          </div>

          {/* Center: Navigation Links */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#features" onClick={(e) => scrollToSection(e, 'features')} className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" onClick={(e) => scrollToSection(e, 'how-it-works')} className="hover:text-white transition-colors">How it works</a>
            <a href="#use-cases" onClick={(e) => scrollToSection(e, 'use-cases')} className="hover:text-white transition-colors">Use cases</a>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-5 flex-shrink-0">
            <Link
              to="/login"
              className="hidden sm:block text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              className="px-6 py-2.5 rounded-full text-sm font-semibold transition-all bg-white text-black hover:bg-slate-200"
            >
              Get started
            </Link>
          </div>
        </nav>
      </div>

      {/* Hero - Antigravity */}
      <section className="relative w-full overflow-hidden bg-[#020617] text-white py-24 sm:py-32 flex items-center justify-center border-b border-gray-800/60">
        {/* Background glow effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-900/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-10 xl:gap-14 items-center w-full relative z-10 px-4 sm:px-8">
          {/* Left Side: Text and CTAs */}
          <div className="flex flex-col items-start text-left z-20">
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-display font-medium text-5xl sm:text-6xl lg:text-[4.75rem] tracking-tight leading-[1.05] mb-5 text-slate-100"
            >
              Understand your <br />
              codebase. <br />
              <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-500">
                Before you commit.
              </span>
            </motion.h1>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-base sm:text-lg text-slate-400 mb-10 leading-relaxed max-w-lg font-light flex flex-col gap-3"
            >
              <p>Polyglot maps dependencies across languages and services.</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-white font-medium">Change a variable here</span>
                <input
                  type="text"
                  value={inputValue}
                  onChange={handleInputChange}
                  placeholder="type to breaking change..."
                  className="bg-white/5 border border-white/10 rounded px-3 py-1.5 text-slate-200 outline-none focus:border-red-400/50 focus:ring-1 focus:ring-red-400/30 transition-all font-mono text-xs w-[180px] placeholder-slate-600 block"
                />
                <span>, and instantly</span>
              </div>
              <p>see the impact everywhere — before it reaches production.</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex items-center gap-4 flex-wrap mb-2"
            >
              {/* Bento-box style glowing CTA */}
              <Link
                to="/signup"
                className="group relative inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-base font-semibold text-white bg-[#0f172a] shadow-[0_0_20px_rgba(59,130,246,0.15)] transition-all overflow-hidden hover:scale-105 duration-300 border border-slate-700 hover:shadow-[0_0_30px_rgba(56,189,248,0.3)]"
              >
                <motion.div
                  className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ background: 'conic-gradient(from 0deg, transparent 70%, rgba(56,189,248,0.6) 100%)' }}
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                />
                <div className="absolute inset-[1px] bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl z-0" />
                <span className="relative z-10 flex items-center gap-2">Analyze Repository <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></span>
              </Link>

              {/* Glass-blur transparent CTA */}
              <Link
                to="/demo"
                className="group relative inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-base font-semibold text-blue-400/90 border border-transparent hover:border-white/10 hover:bg-white/5 hover:backdrop-blur-md transition-all duration-300"
              >
                View Demo Graph
              </Link>
            </motion.div>
          </div>

          {/* Right Side: Dependency Impact Visualizer */}
          <div className="relative w-full hidden lg:flex items-center justify-center py-6 pl-6 min-h-[680px]">
            <DependencyImpactVisualizer />
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <ProblemSection />

      {/* Solution Section */}
      <SolutionSection />

      {/* Core Capabilities */}
      <section id="features" className="relative py-24 px-4 sm:px-8 bg-[#020617] border-t border-slate-800/60">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-950/30 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-3xl mx-auto relative z-10">
          {/* Section header */}
          <div className="text-center mb-14">
            <span
              className="inline-block text-xs font-bold uppercase tracking-[0.2em] px-4 py-1.5 rounded-full mb-4"
              style={{ background: 'rgba(59,130,246,0.08)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.2)' }}
            >
              Core Capabilities
            </span>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-white mt-3">
              Everything your team needs
            </h2>
            <p className="text-slate-400 text-base sm:text-lg mt-3 max-w-xl mx-auto font-light">
              Click any capability to explore what Antigravity brings to your workflow.
            </p>
          </div>

          <ExpandableFeatureCards />
        </div>
      </section>

      {/* How It Works */}
      <div id="how-it-works">
        <HowItWorks />
      </div>

      {/* Footer */}
      <footer className="relative bg-[#020617] border-t border-slate-800/60 pt-20 pb-10 overflow-hidden">
        {/* Ambient grid background for footer */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #475569 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

        <div className="max-w-7xl mx-auto px-4 sm:px-8 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 mb-16">
            <div className="col-span-2 lg:col-span-2">
              <Logo />
              <p className="mt-6 text-slate-500 text-sm leading-relaxed max-w-sm">
                The world’s first AI-powered polyglot dependency mapping platform.
                Understand the ripple effects of every change you make.
              </p>
              <div className="flex items-center gap-4 mt-8">
                <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center hover:border-slate-600 transition-colors cursor-pointer">
                  <svg className="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" /></svg>
                </div>
                <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center hover:border-slate-600 transition-colors cursor-pointer">
                  <svg className="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                </div>
              </div>
            </div>

            <div>
              <h5 className="text-white font-bold text-sm mb-6">Product</h5>
              <ul className="space-y-4 text-slate-500 text-sm">
                <li className="hover:text-blue-400 transition-colors cursor-pointer">Features</li>
                <li className="hover:text-blue-400 transition-colors cursor-pointer">How it Works</li>
                <li className="hover:text-blue-400 transition-colors cursor-pointer">Security</li>
                <li className="hover:text-blue-400 transition-colors cursor-pointer">Beta Program</li>
              </ul>
            </div>

            <div>
              <h5 className="text-white font-bold text-sm mb-6">Company</h5>
              <ul className="space-y-4 text-slate-500 text-sm">
                <li className="hover:text-blue-400 transition-colors cursor-pointer">About Us</li>
                <li className="hover:text-blue-400 transition-colors cursor-pointer">Founders</li>
                <li className="hover:text-blue-400 transition-colors cursor-pointer">Careers</li>
                <li className="hover:text-blue-400 transition-colors cursor-pointer">Contact</li>
              </ul>
            </div>

            <div>
              <h5 className="text-white font-bold text-sm mb-6">Legal</h5>
              <ul className="space-y-4 text-slate-500 text-sm">
                <li className="hover:text-blue-400 transition-colors cursor-pointer">Privacy Policy</li>
                <li className="hover:text-blue-400 transition-colors cursor-pointer">Terms of Service</li>
                <li className="hover:text-blue-400 transition-colors cursor-pointer">Cookie Policy</li>
              </ul>
            </div>
          </div>

          <div className="pt-10 border-t border-slate-800/60 flex flex-col md:flex-row items-center justify-between gap-6">
            <span className="text-slate-600 text-xs">
              © 2026 Antigravity. Ported for GenAI Track GA1. All rights reserved.
            </span>
            <div className="flex items-center gap-6 text-slate-600 text-[10px] font-bold tracking-[0.2em] uppercase">
              <span className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                SYSTEMS OPERATIONAL
              </span>
              <span>V1.0.4-STABLE</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;

