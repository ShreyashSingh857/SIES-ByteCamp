import React, { createContext, useContext, useState, useEffect } from 'react';
import { MOCK_USER } from '../assets/mockdata';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('pdm_user');
    const token = localStorage.getItem('pdm_token');
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('pdm_user');
        localStorage.removeItem('pdm_token');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    await delay(800);
    if (!email || !password) {
      return { success: false, error: 'Email and password are required.' };
    }
    const userData = { ...MOCK_USER, email };
    localStorage.setItem('pdm_token', 'mock-jwt-token-phase1');
    localStorage.setItem('pdm_user', JSON.stringify(userData));
    setUser(userData);
    return { success: true, user: userData };
  };

  const signup = async (data) => {
    await delay(900);
    if (!data.email || !data.password) {
      return { success: false, error: 'All fields are required.' };
    }
    const userData = {
      ...MOCK_USER,
      email: data.email,
      name: data.fullName || data.name || MOCK_USER.name,
    };
    localStorage.setItem('pdm_token', 'mock-jwt-token-phase1');
    localStorage.setItem('pdm_user', JSON.stringify(userData));
    setUser(userData);
    return { success: true, user: userData };
  };

  const logout = async () => {
    await delay(300);
    localStorage.removeItem('pdm_token');
    localStorage.removeItem('pdm_user');
    setUser(null);
  };

  const value = {
    user,
    login,
    signup,
    logout,
    loading,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};