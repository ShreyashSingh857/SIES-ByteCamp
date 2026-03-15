import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');

    if (token) {
      localStorage.setItem('accessToken', token);
      navigate('/home', { replace: true });
      return;
    }

    navigate('/login', { replace: true });
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        <Loader2 size={16} className="animate-spin" />
        Completing sign in...
      </div>
    </div>
  );
}
