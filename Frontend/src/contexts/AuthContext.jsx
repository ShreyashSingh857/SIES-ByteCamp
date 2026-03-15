import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

function decodeJwtPayload(token) {
  try {
    const payload = token.split('.')[1] || '';
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const storeToken = (token) => localStorage.setItem('accessToken', token);
  const clearToken = () => localStorage.removeItem('accessToken');

  const fetchCurrentUser = useCallback(async (token) => {
    const response = await fetch(`${API_BASE}/users/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    });

    if (!response.ok) {
      const error = new Error(`Failed to fetch current user (${response.status})`);
      error.status = response.status;
      throw error;
    }

    const payload = await response.json().catch(() => ({}));
    return payload?.data || payload;
  }, []);

  const attemptRefresh = useCallback(async () => {
    const response = await fetch(`${API_BASE}/auth/refresh-token`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) return null;
    const payload = await response.json().catch(() => ({}));
    return payload?.data?.accessToken || null;
  }, []);

  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      try {
        const me = await fetchCurrentUser(token);
        if (mounted) {
          setUser(me || { id: decodeJwtPayload(token)?.sub || null });
          setLoading(false);
        }
        return;
      } catch (error) {
        if (error?.status !== 401 && error?.status !== 403 && error?.status !== 404) {
          if (mounted) {
            setUser(null);
            setLoading(false);
          }
          return;
        }
      }

      const refreshedToken = await attemptRefresh();
      if (!refreshedToken) {
        clearToken();
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      storeToken(refreshedToken);
      try {
        const me = await fetchCurrentUser(refreshedToken);
        if (mounted) {
          setUser(me || { id: decodeJwtPayload(refreshedToken)?.sub || null });
        }
      } catch (error) {
        if (mounted) {
          if (error?.status === 404) {
            setUser({ id: decodeJwtPayload(refreshedToken)?.sub || null });
          } else {
            clearToken();
            setUser(null);
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    hydrate();
    return () => {
      mounted = false;
    };
  }, [attemptRefresh, fetchCurrentUser]);

  const login = useCallback(async () => {
    window.location.assign(`${API_BASE}/auth/github`);
    return { success: true };
  }, []);

  // Keep a compatibility method because Signup page still calls signup in current app routes.
  const signup = useCallback(async () => {
    return { success: false, error: 'Signup is disabled. Use GitHub login.' };
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      // no-op; local cleanup still applies
    }

    clearToken();
    setUser(null);
  }, []);

  const value = useMemo(() => ({
    user,
    login,
    signup,
    logout,
    loading,
    isAuthenticated: !!user,
  }), [user, login, signup, logout, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};