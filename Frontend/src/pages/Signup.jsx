import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/Logo';
import ThemeToggle from '../components/theme/ThemeToggle';

const Signup = () => {
  const navigate = useNavigate();
  const { signup } = useAuth();

  const [form,    setForm]    = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      const result = await signup({ fullName: form.fullName, email: form.email, password: form.password });
      if (result.success) navigate('/home');
      else setError(result.error || 'Signup failed.');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-8"
      style={{ background: 'var(--bg)' }}
    >
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <Logo />
        </div>

        <div className="card space-y-5">
          <div>
            <h1 className="font-display font-bold text-xl" style={{ color: 'var(--text)' }}>
              Create account
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Already have one?{' '}
              <Link to="/login" className="font-medium" style={{ color: 'var(--primary-500)' }}>
                Sign in
              </Link>
            </p>
          </div>

          {error && (
            <div
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm"
              style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              <AlertCircle size={14} className="flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {[
              { field: 'fullName',        label: 'Full Name',       type: 'text',     placeholder: 'Alex Chen',       icon: User },
              { field: 'email',           label: 'Email',           type: 'email',    placeholder: 'you@acme.io',     icon: Mail },
              { field: 'password',        label: 'Password',        type: 'password', placeholder: '6+ characters',   icon: Lock },
              { field: 'confirmPassword', label: 'Confirm Password',type: 'password', placeholder: 'Repeat password', icon: Lock },
            ].map(({ field, label, type, placeholder, icon: Icon }) => (
              <div key={field}>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {label}
                </label>
                <div className="relative">
                  <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                  <input
                    type={type}
                    value={form[field]}
                    onChange={handleChange(field)}
                    required
                    placeholder={placeholder}
                    autoComplete={field === 'email' ? 'email' : field === 'fullName' ? 'name' : 'new-password'}
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm outline-none transition-all"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  />
                </div>
              </div>
            ))}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-60 mt-1"
              style={{ background: '#1e3a8a', color: '#93c5fd' }}
            >
              {loading ? <><Loader2 size={15} className="animate-spin" /> Creating account…</> : 'Create account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Signup;
