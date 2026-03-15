import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ThemeProvider from './components/theme/ThemeProvider.jsx';

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

// Lazy loading components
const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const Home = lazy(() => import('./pages/Home'));
const UploadRepo = lazy(() => import('./pages/UploadRepo'));
const Analyze = lazy(() => import('./pages/Analyze'));
const GraphView = lazy(() => import('./pages/GraphView'));
const DirListView = lazy(() => import('./pages/DirListView'));
const FileViewerWithDependencies = lazy(() => import('./pages/FileViewerWithDependencies'));
const Layout = lazy(() => import('./components/layout/Layout'));

function AppRoutes() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/login"  element={<PublicRoute><Login  /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />

        {/* Protected — share Layout */}
        <Route path="/*" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="home"   element={<Home />} />
          <Route path="upload" element={<UploadRepo />} />
          <Route path="analyze" element={<Analyze />} />
          <Route path="analyze/dir/:dirName" element={<DirListView />} />
          <Route path="analyze/dir/:dirName/file/*" element={<FileViewerWithDependencies />} />
          <Route path="graph"  element={<GraphView />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
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
