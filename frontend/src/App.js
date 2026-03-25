import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ChatbotPage from './pages/ChatbotPage';
import WatchlistPage from './pages/WatchlistPage';
import BtcAnalysisPage from './pages/BtcAnalysisPage';
import PortfolioAnalysisPage from './pages/PortfolioAnalysisPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import './layout.css';

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
              background: 'rgba(18, 30, 49, 0.95)',
              color: '#e8efff',
              border: '1px solid rgba(136, 168, 209, 0.24)',
            },
          }}
        />
        <Routes>
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
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
