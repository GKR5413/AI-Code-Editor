interface AuthCredentials {
  email: string;
  password: string;
}

interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name?: string;
  };
}

export class AuthService {
  private readonly API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  async signInWithEmail(credentials: AuthCredentials): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
        credentials: 'include', // Include cookies
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to sign in');
      }

      const data = await response.json();
      this.setSession(data);
      return data;
    } catch (error) {
      console.error('Sign in error:', error);
      throw new Error(error instanceof Error ? error.message : 'Network error occurred');
    }
  }

  async signInWithGitHub(): Promise<void> {
    try {
      const response = await fetch(`${this.API_URL}/api/auth/github`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to initiate GitHub sign in');
      }

      const { authUrl } = await response.json();
      window.location.replace(authUrl);
    } catch (error) {
      console.error('GitHub sign in error:', error);
      throw new Error('Failed to connect to GitHub');
    }
  }

  private setSession(authData: AuthResponse): void {
    localStorage.setItem('auth_token', authData.token);
    localStorage.setItem('user', JSON.stringify(authData.user));
  }

  clearSession(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  }

  async forgotPassword(email: string): Promise<void> {
    try {
      const response = await fetch(`${this.API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to process password reset');
      }
    } catch (error) {
      console.error('Password reset error:', error);
      throw new Error('Failed to send password reset email');
    }
  }
}

export const authService = new AuthService();
