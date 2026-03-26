import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import './styles/layout.css';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ChatbotPage = lazy(() => import('./pages/ChatbotPage'));
const WatchlistPage = lazy(() => import('./pages/WatchlistPage'));
const BtcAnalysisPage = lazy(() => import('./pages/BtcAnalysisPage'));
const PortfolioAnalysisPage = lazy(() => import('./pages/PortfolioAnalysisPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));

// Protected route wrapper
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="app-loading-screen">Loading market workspace...</div>;
  }
  return user ? children : <Navigate to="/login" />;
};


function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'rgba(14, 22, 40, 0.95)',
              color: '#F0F6FF',
              border: '1px solid rgba(99, 179, 237, 0.24)',
            },
          }}
        />
        <Suspense fallback={<div className="app-loading-screen">Loading market workspace...</div>}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chatbot"
              element={
                <ProtectedRoute>
                  <ChatbotPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/watchlist"
              element={
                <ProtectedRoute>
                  <WatchlistPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/btc-analysis"
              element={
                <ProtectedRoute>
                  <BtcAnalysisPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/portfolio-analysis"
              element={
                <ProtectedRoute>
                  <PortfolioAnalysisPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
}

export default App;
