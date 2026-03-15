import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Github, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/Logo';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleGithubLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await login();
    } catch {
      setError('Failed to redirect to GitHub. Please try again.');
      setLoading(false);
      return;
    } finally {
      // In successful flow browser is redirected, so state reset only matters on failure.
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex justify-center">
          <Logo />
        </div>

        {/* Card */}
        <div className="card space-y-5">
          <div>
            <h1 className="font-display font-bold text-xl" style={{ color: 'var(--text)' }}>
              Sign in
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Use your GitHub account to continue.
            </p>
          </div>

          {error && (
            <div
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm"
              style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              <AlertCircle size={14} className="shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGithubLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-60"
              style={{ background: '#1e3a8a', color: '#93c5fd' }}
            >
              {loading ? (
                <><Loader2 size={15} className="animate-spin" /> Redirecting...</>
              ) : (
                <><Github size={15} /> Continue with GitHub</>
              )}
            </button>

            <p className="text-center text-xs" style={{ color: 'var(--text-muted)' }}>
              No password required.
            </p>
            <p className="text-center text-xs" style={{ color: 'var(--text-muted)' }}>
              Need an account?{' '}
              <Link to="/signup" className="font-medium" style={{ color: 'var(--primary-500)' }}>
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
