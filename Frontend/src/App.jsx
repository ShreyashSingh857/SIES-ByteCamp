import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ThemeProvider from './components/theme/ThemeProvider.jsx';
import Layout from './components/layout/Layout';
import { Landing, Login, Signup, Home, UploadRepo, GraphView, ImpactPanel } from './pages/index';

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
    <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--primary-500)' }} />
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <Spinner />;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <Spinner />;
  return !isAuthenticated ? children : <Navigate to="/home" replace />;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route path="/login"  element={<PublicRoute><Login  /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />

      {/* Protected — share Layout */}
      <Route
        path="/*"
        element={<ProtectedRoute><Layout /></ProtectedRoute>}
      >
        <Route path="home"   element={<Home        />} />
        <Route path="upload" element={<UploadRepo  />} />
        <Route path="graph"  element={<GraphView   />} />
        <Route path="impact" element={<ImpactPanel />} />
        <Route path="*"      element={<Navigate to="/home" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <ThemeProvider>
          <AppRoutes />
        </ThemeProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
