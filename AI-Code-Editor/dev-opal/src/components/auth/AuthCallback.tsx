import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const AuthCallback: React.FC = () => {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing authentication...');
  const navigate = useNavigate();
  const { handleOAuthSuccess } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        const error = urlParams.get('error');
        
        console.log('AuthCallback processing:', {
          url: window.location.href,
          hasToken: !!token,
          hasError: !!error,
          token: token ? token.substring(0, 20) + '...' : 'none'
        });

        if (error) {
          setStatus('error');
          setMessage(`Authentication failed: ${error}`);
          setTimeout(() => navigate('/auth/login'), 3000);
          return;
        }

        if (!token) {
          setStatus('error');
          setMessage('No authentication token received');
          setTimeout(() => navigate('/auth/login'), 3000);
          return;
        }

        // Store token temporarily for this callback
        localStorage.setItem('velocide_auth_token', token);

        const response = await fetch('http://localhost:3010/api/user', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch user data');
        }

        const data = await response.json();

        if (data.user) {
          console.log('🎉 OAuth callback success, user data:', data.user);
          
          // Use the auth context to handle OAuth success
          handleOAuthSuccess(data.user, token);
          
          console.log('✅ Auth context updated, redirecting to main app...');
          
          setStatus('success');
          setMessage('Authentication successful! Redirecting...');
          
          // Use React Router navigation instead of window.location.href
          setTimeout(() => {
            console.log('🔄 Navigating to main app...');
            navigate('/', { replace: true });
          }, 500);
        } else {
          throw new Error('User data not found');
        }

      } catch (error: any) {
        console.error('OAuth callback error:', error);
        setStatus('error');
        setMessage(error.message || 'Authentication failed');
        setTimeout(() => navigate('/auth/login'), 3000);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center space-y-6">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
            <Zap className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* Status Content */}
        {status === 'processing' && (
          <>
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Processing Authentication
              </h1>
              <p className="text-gray-600 dark:text-gray-400">{message}</p>
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-green-600">Success!</h1>
              <p className="text-gray-600 dark:text-gray-400">{message}</p>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-red-600">Authentication Failed</h1>
              <p className="text-gray-600 dark:text-gray-400">{message}</p>
              <p className="text-sm text-gray-500">Redirecting to login...</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;