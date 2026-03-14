import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, FileCode2, Database, Globe } from 'lucide-react';

const OLD_VAR = 'API_ENDPOINT';
const NEW_VAR = 'USERS_API_URL';

const CHILD_FILES = [
  {
    id: 1,
    icon: FileCode2,
    filename: 'web-client/api.ts',
    lang: 'TS',
    langColor: '#3b82f6',
    snippet: [
      { text: 'const res = await fetch(', normal: true },
      { text: 'config.', normal: true, highlight: false },
      { text: OLD_VAR, isVar: true },
      { text: ')', normal: true },
    ],
  },
  {
    id: 2,
    icon: Database,
    filename: 'mobile-app/UserRepo.kt',
    lang: 'KT',
    langColor: '#f59e0b',
    snippet: [
      { text: 'val url = Config.', normal: true },
      { text: OLD_VAR, isVar: true },
    ],
  },
  {
    id: 3,
    icon: Globe,
    filename: 'services/auth/gateway.py',
    lang: 'PY',
    langColor: '#22c55e',
    snippet: [
      { text: 'endpoint = settings.', normal: true },
      { text: OLD_VAR, isVar: true },
    ],
  },
];

function WindowChrome({ filename, langColor, lang, children, isError }) {
  return (
    <div
      className="rounded-2xl overflow-hidden shadow-2xl flex flex-col relative"
      style={{
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: isError
          ? '1px solid rgba(239, 68, 68, 0.5)'
          : '1px solid rgba(100, 116, 139, 0.30)',
        boxShadow: isError
          ? '0 0 36px rgba(239,68,68,0.15), inset 0 0 0 1px rgba(239,68,68,0.08)'
          : '0 12px 48px rgba(0,0,0,0.5)',
      }}
    >
      {/* Title bar */}
      <div
        className="flex items-center gap-2.5 px-5 py-3.5"
        style={{
          background: isError
            ? 'rgba(127,29,29,0.35)'
            : 'rgba(30, 41, 59, 0.55)',
          borderBottom: isError
            ? '1px solid rgba(239,68,68,0.25)'
            : '1px solid rgba(100,116,139,0.18)',
        }}
      >
        {/* Traffic lights */}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-amber-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <span
          className="text-[11px] font-bold rounded px-2 py-0.5 tracking-wider ml-1"
          style={{ background: langColor + '22', color: langColor }}
        >
          {lang}
        </span>
        <span className="text-xs text-slate-400 font-mono truncate">{filename}</span>
        {isError && (
          <span className="ml-auto flex items-center gap-1.5 text-red-400 text-xs font-semibold">
            <AlertTriangle size={11} />
            broken ref
          </span>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function DependencyImpactVisualizer() {
  /* Cycle: idle(2s) → typing(1.5s) → error(3s) → reset */
  const [phase, setPhase] = useState('idle'); // idle | typing | error

  useEffect(() => {
    const cycle = () => {
      setPhase('idle');
      setTimeout(() => setPhase('typing'), 2000);
      setTimeout(() => setPhase('error'), 3800);
      setTimeout(cycle, 8000);
    };
    cycle();
    return () => {};
  }, []);

  const showNew = phase === 'typing' || phase === 'error';
  const showError = phase === 'error';

  return (
    <div className="relative w-full h-full flex items-center justify-center select-none">
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: showError
            ? 'radial-gradient(ellipse 60% 40% at 60% 50%, rgba(239,68,68,0.07) 0%, transparent 80%)'
            : 'radial-gradient(ellipse 60% 40% at 60% 50%, rgba(59,130,246,0.07) 0%, transparent 80%)',
          transition: 'background 0.8s ease',
        }}
      />

      <div className="w-full flex flex-col gap-6 relative z-10">
        {/* ── PARENT / MAIN FILE ── */}
        <WindowChrome filename="api-service/config.ts" lang="TS" langColor="#3b82f6" isError={false}>
          <div className="font-mono text-sm leading-6 sm:text-base">
            <div className="text-slate-500 mb-2">
              <span className="text-slate-600">{`// Service configuration — core settings`}</span>
            </div>
            <div className="text-slate-400 mb-2">
              <span className="text-blue-400">export const</span>{' '}
              <span className="text-slate-300">config</span>{' '}
              <span className="text-slate-500">= {'{'}</span>
            </div>

            <div className="pl-6 text-slate-400 mb-2">
              <span className="text-purple-400">port</span>
              <span className="text-slate-500">: </span>
              <span className="text-orange-400">8080</span>
              <span className="text-slate-500">,</span>
            </div>
            <div className="pl-6 text-slate-400 mb-2">
              <span className="text-purple-400">version</span>
              <span className="text-slate-500">: </span>
              <span className="text-green-400">"v2"</span>
              <span className="text-slate-500">,</span>
            </div>

            {/* The changing variable line */}
            <div
              className="pl-6 py-2 px-3 rounded-lg flex items-center gap-0 flex-wrap mb-2"
              style={{
                background: showError
                  ? 'rgba(239,68,68,0.08)'
                  : showNew
                  ? 'rgba(34,197,94,0.08)'
                  : 'rgba(59,130,246,0.08)',
                border: showError
                  ? '1px solid rgba(239,68,68,0.25)'
                  : showNew
                  ? '1px solid rgba(34,197,94,0.2)'
                  : '1px solid rgba(59,130,246,0.2)',
                transition: 'all 0.4s ease',
              }}
            >
              <span className="text-purple-400 font-mono mr-1">
                <AnimatePresence mode="wait">
                  {showNew ? (
                    <motion.span
                      key="new"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.3 }}
                      className="text-emerald-400"
                    >
                      {NEW_VAR}
                    </motion.span>
                  ) : (
                    <motion.span
                      key="old"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {OLD_VAR}
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
              <span className="text-slate-500">: </span>
              <span className="text-green-400 ml-1">"/api/v2/users"</span>
              <span className="text-slate-500">,</span>

              {/* Typing cursor */}
              {phase === 'typing' && (
                <motion.span
                  className="inline-block w-0.5 h-3 bg-emerald-400 ml-0.5 rounded"
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ repeat: Infinity, duration: 0.7 }}
                />
              )}
            </div>

            <div className="pl-6 text-slate-400 mb-2">
              <span className="text-purple-400">timeout</span>
              <span className="text-slate-500">: </span>
              <span className="text-orange-400">5000</span>
              <span className="text-slate-500">,</span>
            </div>
            <div className="pl-6 text-slate-400 mb-2">
              <span className="text-purple-400">retries</span>
              <span className="text-slate-500">: </span>
              <span className="text-orange-400">3</span>
              <span className="text-slate-500">,</span>
            </div>

            <div className="text-slate-500">{'};'}</div>
          </div>

          {/* Scanning shimmer */}
          <motion.div
            className="absolute inset-0 pointer-events-none rounded-xl"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(99,179,237,0.04) 50%, transparent 100%)',
            }}
            animate={{ x: ['-100%', '200%'] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'linear', repeatDelay: 1 }}
          />
        </WindowChrome>

        {/* Impact label */}
          <AnimatePresence>
          {showError && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-sm text-red-400 font-semibold pl-1"
            >
              <AlertTriangle size={14} />
              3 files affected by this rename
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── CHILD FILES ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {CHILD_FILES.map((file, i) => {
            const Icon = file.icon;
            return (
              <motion.div
                key={file.id}
                initial={false}
                animate={
                  showError
                    ? { scale: [1, 1.025, 1], transition: { delay: i * 0.12, duration: 0.35 } }
                    : {}
                }
              >
                <WindowChrome
                  filename={file.filename}
                  lang={file.lang}
                  langColor={file.langColor}
                  isError={showError}
                >
                  <div className="font-mono text-xs sm:text-sm leading-6 flex flex-wrap items-baseline gap-0">
                    {file.snippet.map((part, j) =>
                      part.isVar ? (
                        <AnimatePresence mode="wait" key={j}>
                          {showError ? (
                            <motion.span
                              key="errvar"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="relative"
                            >
                              <span
                                className="text-red-400 font-semibold"
                                style={{
                                  textDecoration: 'underline',
                                  textDecorationStyle: 'wavy',
                                  textDecorationColor: '#f87171',
                                  textUnderlineOffset: '3px',
                                }}
                              >
                                {OLD_VAR}
                              </span>
                              <motion.span
                                initial={{ opacity: 0, scale: 0, x: 4 }}
                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                transition={{ delay: 0.15 + i * 0.1 }}
                                className="ml-1 inline-flex items-center"
                              >
                                <AlertTriangle size={9} className="text-red-500" />
                              </motion.span>
                            </motion.span>
                          ) : (
                            <motion.span
                              key="okvar"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="text-purple-400 font-semibold"
                            >
                              {OLD_VAR}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      ) : (
                        <span key={j} className="text-slate-400">
                          {part.text}
                        </span>
                      )
                    )}
                  </div>

                  {/* Red shimmer on error */}
                  {showError && (
                    <motion.div
                      className="absolute inset-0 pointer-events-none rounded-xl"
                      style={{
                        background:
                          'linear-gradient(90deg, transparent 0%, rgba(239,68,68,0.05) 50%, transparent 100%)',
                      }}
                      animate={{ x: ['-100%', '200%'] }}
                      transition={{
                        repeat: Infinity,
                        duration: 2.5,
                        ease: 'linear',
                        repeatDelay: 0.5,
                        delay: i * 0.3,
                      }}
                    />
                  )}
                </WindowChrome>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
