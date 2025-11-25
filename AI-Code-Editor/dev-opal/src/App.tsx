import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Index from './pages/Index';
import GitHubCallback from './pages/GitHubCallback';
import LoginPage from './components/auth/LoginPage';
import RegisterPage from './components/auth/RegisterPage';
import ForgotPasswordPage from './components/auth/ForgotPasswordPage';
import AuthCallback from './components/auth/AuthCallback';
import VerifyOtpPage from './components/auth/VerifyOtpPage';
import { ThemeProvider } from './contexts/ThemeContext';
import { IDEProvider } from './contexts/IDEContext';
import { GitHubProvider } from './contexts/GitHubContext';
import { AuthProvider, ProtectedRoute, useAuth } from './contexts/AuthContext';
import { TerminalProvider } from './contexts/TerminalContext';
import './index.css';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <IDEProvider>
          <GitHubProvider>
            <TerminalProvider>
              <Router>
                <Routes>
                  {/* Authentication Routes */}
                  <Route path="/auth/login" element={<LoginPage />} />
                  <Route path="/auth/register" element={<RegisterPage />} />
                  <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="/auth/verify" element={<VerifyOtpPage />} />

                  {/* Protected IDE Routes */}
                  <Route path="/" element={
                    <ProtectedRoute>
                      <Index />
                    </ProtectedRoute>
                  } />

                  {/* Legacy GitHub callback */}
                  <Route path="/github/callback" element={<GitHubCallback />} />

                  {/* Fallback route based on auth */}
                  <Route path="*" element={<FallbackRoute />} />
                </Routes>
              </Router>
            </TerminalProvider>
          </GitHubProvider>
        </IDEProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

const FallbackRoute: React.FC = () => {
  const { isAuthenticated } = useAuth();
  return <Navigate to={isAuthenticated ? '/' : '/auth/login'} replace />;
};
