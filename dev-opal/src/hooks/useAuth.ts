import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

interface LoginCredentials {
  email: string;
  password: string;
}

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('auth_token') !== null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Add event listener for storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'github_token') {
        setIsAuthenticated(e.newValue !== null);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Add listener for browser navigation
  useEffect(() => {
    const handlePopState = () => {
      // Check if we're authenticated when user navigates
      const isAuth = localStorage.getItem('github_token') !== null;
      if (!isAuth) {
        navigate('/');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [navigate]);

  const signIn = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    setError(null);
    try {
      await authService.signInWithEmail(credentials);
      setIsAuthenticated(true);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithGitHub = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await authService.signInWithGitHub();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in with GitHub');
      setIsLoading(false);
    }
  };

  const forgotPassword = async (email: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await authService.forgotPassword(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process password reset');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isAuthenticated,
    isLoading,
    error,
    signIn,
    signInWithGitHub,
    forgotPassword
  };
}
