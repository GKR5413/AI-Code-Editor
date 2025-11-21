import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

// Types
export interface User {
  id: number;
  github_id?: string;
  username: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  location?: string;
  website_url?: string;
  created_at: string;
  updated_at: string;
  last_login?: string;
  is_active: boolean;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'AUTH_FAILURE'; payload: string }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'AUTH_CLEAR_ERROR' }
  | { type: 'AUTH_UPDATE_USER'; payload: User };

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (userData: { username: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (userData: Partial<User>) => Promise<void>;
  loginWithGitHub: () => void;
  clearError: () => void;
  handleOAuthSuccess: (user: User, token: string) => void;
  verifyOtp: (email: string, code: string) => Promise<void>;
}

// Initial state
const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  // Start in loading state so refresh doesn't redirect before init completes
  isLoading: true,
  error: null,
};

// Auth reducer
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case 'AUTH_SUCCESS':
      console.log('🎉 AUTH_SUCCESS reducer called with:', {
        user: action.payload.user?.username,
        hasToken: !!action.payload.token,
        isAuthenticated: true,
        userId: action.payload.user?.id
      });
      const newState = {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
      console.log('🔄 New auth state:', {
        isAuthenticated: newState.isAuthenticated,
        hasUser: !!newState.user,
        hasToken: !!newState.token
      });
      return newState;
    case 'AUTH_FAILURE':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      };
    case 'AUTH_LOGOUT':
      return {
        ...initialState,
        isLoading: false,
      };
    case 'AUTH_CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    case 'AUTH_UPDATE_USER':
      return {
        ...state,
        user: action.payload,
      };
    default:
      return state;
  }
};

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth service configuration
// Force all authentication through the Docker container on port 3010
const AUTH_API_URL = 'http://localhost:3010';
const TOKEN_STORAGE_KEY = 'velocide_auth_token';
const USER_STORAGE_KEY = 'velocide_user';

// Auth provider component
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const initializingRef = React.useRef(false);
  const idleIntervalRef = React.useRef<number | null>(null);

  // Idle timeout configuration (5 minutes)
  const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
  const LAST_ACTIVITY_KEY = 'velocide_last_activity';

  const markActivity = React.useCallback(() => {
    try {
      localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    } catch {}
  }, []);

  // Initialize auth state and handle OAuth callback
  useEffect(() => {
    if (initializingRef.current) {
      console.log('Auth initialization already in progress, skipping');
      return;
    }
    
    const initialize = async () => {
      console.log('Starting auth initialization');
      initializingRef.current = true;
      
      // Start loading state
      dispatch({ type: 'AUTH_START' });
      
      // Check for existing stored credentials
      const existingToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      const userData = localStorage.getItem(USER_STORAGE_KEY);

      console.log('Checking existing credentials:', {
        hasToken: !!existingToken,
        hasUserData: !!userData,
        token: existingToken ? existingToken.substring(0, 10) + '...' : 'none'
      });

      if (existingToken && userData) {
        console.log('Found stored credentials, verifying with server...');
        try {
          JSON.parse(userData); // Parse to validate JSON format
          
          // Verify token with server
          const response = await fetch(`${AUTH_API_URL}/api/user`, {
            headers: {
              'Authorization': `Bearer ${existingToken}`,
            },
          });

          if (response.ok) {
            const { user: currentUser } = await response.json();
            dispatch({ 
              type: 'AUTH_SUCCESS', 
              payload: { user: currentUser, token: existingToken } 
            });
            // Initialize last activity timestamp on successful auth
            markActivity();
            console.log('Existing token verified successfully');
          } else {
            console.log('Stored token is invalid, clearing...');
            // Token is invalid, clear storage
            localStorage.removeItem(TOKEN_STORAGE_KEY);
            localStorage.removeItem(USER_STORAGE_KEY);
            dispatch({ type: 'AUTH_LOGOUT' });
          }
        } catch (error) {
          console.error('Error verifying stored credentials:', error);
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          localStorage.removeItem(USER_STORAGE_KEY);
          dispatch({ type: 'AUTH_LOGOUT' });
        }
      } else {
        // No stored credentials, finish loading
        dispatch({ type: 'AUTH_LOGOUT' });
      }
      
      initializingRef.current = false;
    };

    initialize();
  }, []); // Remove markActivity dependency to prevent infinite loops - GitHub OAuth fix

  // Idle timeout management: sign out after 5 minutes of inactivity
  useEffect(() => {
    // Activity listeners
    const events: Array<keyof DocumentEventMap> = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    const onActivity = () => markActivity();
    events.forEach(evt => window.addEventListener(evt, onActivity, { passive: true }));

    // Start interval checker
    if (idleIntervalRef.current) {
      window.clearInterval(idleIntervalRef.current);
    }
    idleIntervalRef.current = window.setInterval(() => {
      try {
        const last = parseInt(localStorage.getItem(LAST_ACTIVITY_KEY) || '0', 10);
        const now = Date.now();
        if (state.isAuthenticated && last > 0 && now - last > IDLE_TIMEOUT_MS) {
          console.log('⌛ Idle timeout reached, logging out');
          // Trigger logout flow
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          localStorage.removeItem(USER_STORAGE_KEY);
          dispatch({ type: 'AUTH_LOGOUT' });
        }
      } catch {}
    }, 30 * 1000); // check every 30s

    // Initialize last activity on mount
    markActivity();

    return () => {
      events.forEach(evt => window.removeEventListener(evt, onActivity));
      if (idleIntervalRef.current) {
        window.clearInterval(idleIntervalRef.current);
        idleIntervalRef.current = null;
      }
    };
  }, [state.isAuthenticated, markActivity]);

  const makeAuthRequest = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(`${AUTH_API_URL}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  };

  const login = async (email: string, password: string) => {
    dispatch({ type: 'AUTH_START' });
    
    try {
      const resp = await makeAuthRequest('/api/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (resp.user && resp.token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, resp.token);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(resp.user));
        dispatch({ type: 'AUTH_SUCCESS', payload: { user: resp.user, token: resp.token } });
        return;
      }
      throw new Error('Invalid response from server');
    } catch (error: any) {
      dispatch({ type: 'AUTH_FAILURE', payload: error.message });
      throw error;
    }
  };

  const register = async (userData: { username: string; email: string; password: string }) => {
    dispatch({ type: 'AUTH_START' });
    
    try {
      const resp = await makeAuthRequest('/api/register', {
        method: 'POST',
        body: JSON.stringify(userData),
      });
      // Expect success message; caller should redirect to verify page
      if (resp.message) {
        dispatch({ type: 'AUTH_CLEAR_ERROR' });
        return resp;
      }
      throw new Error('Unexpected response from server');
    } catch (error: any) {
      dispatch({ type: 'AUTH_FAILURE', payload: error.message });
      throw error;
    }
  };

  const verifyOtp = async (email: string, code: string) => {
    dispatch({ type: 'AUTH_START' });
    try {
      const resp = await makeAuthRequest('/api/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      });
      if (resp.user && resp.token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, resp.token);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(resp.user));
        dispatch({ type: 'AUTH_SUCCESS', payload: { user: resp.user, token: resp.token } });
        return;
      }
      throw new Error('Invalid verification response');
    } catch (error: any) {
      dispatch({ type: 'AUTH_FAILURE', payload: error.message });
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Call logout endpoint
      if (state.token) {
        await makeAuthRequest('/api/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${state.token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage and state regardless of API call result
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
      dispatch({ type: 'AUTH_LOGOUT' });
      // Prevent back navigation to authenticated pages
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', '/auth/login');
      }
    }
  };

  const resetPassword = async (email: string) => {
    dispatch({ type: 'AUTH_START' });

    try {
      const response = await makeAuthRequest('/api/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      dispatch({ type: 'AUTH_CLEAR_ERROR' });
      return response;
    } catch (error: any) {
      dispatch({ type: 'AUTH_FAILURE', payload: error.message });
      throw error;
    }
  };

  const updateProfile = async (userData: Partial<User>) => {
    if (!state.token) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await makeAuthRequest('/api/user', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${state.token}`,
        },
        body: JSON.stringify(userData),
      });

      if (response.user) {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.user));
        dispatch({ type: 'AUTH_UPDATE_USER', payload: response.user });
      }
    } catch (error: any) {
      dispatch({ type: 'AUTH_FAILURE', payload: error.message });
      throw error;
    }
  };

  const loginWithGitHub = () => {
    // Clear any existing credentials before OAuth
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    dispatch({ type: 'AUTH_START' });
    
    // Redirect to GitHub OAuth
    window.location.href = `${AUTH_API_URL}/auth/github`;
  };

  const clearError = () => {
    dispatch({ type: 'AUTH_CLEAR_ERROR' });
  };

  const handleOAuthSuccess = (user: User, token: string) => {
    console.log('🎉 OAuth success handler called with:', {
      user: user.username,
      hasToken: !!token,
      userId: user.id
    });
    
    // Store credentials
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    
    console.log('💾 Credentials stored in localStorage');
    
    // Update auth state
    dispatch({ type: 'AUTH_SUCCESS', payload: { user, token } });
    
    console.log('✅ Auth state updated, should be authenticated now');
    console.log('🔍 Current auth state after dispatch:', {
      isAuthenticated: true,
      hasUser: !!user,
      hasToken: !!token
    });
    
    // Reset idle timer
    try { localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString()); } catch {}
  };

  const contextValue: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    resetPassword,
    updateProfile,
    loginWithGitHub,
    clearError,
    handleOAuthSuccess,
    verifyOtp,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Protected route component
interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, user, token } = useAuth();
  
  console.log('🔒 ProtectedRoute check:', {
    isAuthenticated,
    isLoading,
    hasUser: !!user,
    tokenInContext: token ? 'present' : 'missing',
    tokenInStorage: localStorage.getItem('velocide_auth_token') ? 'present' : 'missing',
    currentPath: window.location.pathname,
    userInfo: user ? { id: user.id, username: user.username } : 'none',
    timestamp: new Date().toISOString()
  });
  
  // Additional debugging for auth state
  console.log('🔍 Auth state details:', {
    isAuthenticated,
    isLoading,
    hasUser: !!user,
    localStorage: {
      token: localStorage.getItem('velocide_auth_token') ? 'present' : 'missing',
      user: localStorage.getItem('velocide_user') ? 'present' : 'missing'
    }
  });
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    console.log('❌ Not authenticated, redirecting to login');
    return <Navigate to="/auth/login" replace />;
  }
  
  console.log('✅ Authentication successful, rendering protected content');
  return <>{children}</>;
};

export default AuthContext;