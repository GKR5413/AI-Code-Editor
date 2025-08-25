import React, { useState, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Zap, ShieldCheck, AlertCircle, RefreshCcw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Alert, AlertDescription } from '../ui/alert';

const VerifyOtpPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { verifyOtp } = useAuth();

  const emailParam = searchParams.get('email') || '';
  const [email, setEmail] = useState(emailParam);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!email || !code) {
      setError('Please enter your email and the 6-digit code.');
      return;
    }
    if (code.length !== 6) {
      setError('Code must be 6 digits.');
      return;
    }
    setLoading(true);
    try {
      await verifyOtp(email, code);
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = useCallback(async () => {
    setError(null);
    setMessage(null);
    if (!email) {
      setError('Enter your email to resend OTP.');
      return;
    }
    try {
      const resp = await fetch('http://localhost:3010/api/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error || 'Failed to resend OTP');
      }
      setMessage('A new verification code was sent.');
    } catch (err: any) {
      setError(err?.message || 'Failed to resend OTP');
    }
  }, [email]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Verify your email</h1>
          <p className="text-gray-600 dark:text-gray-400">Enter the 6-digit code we sent you</p>
        </div>

        <Card className="border-0 shadow-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-center">Email Verification</CardTitle>
            <CardDescription className="text-center">
              Complete verification to activate your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive" className="border-red-200 bg-red-50 dark:bg-red-900/20">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {message && (
              <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
                <ShieldCheck className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700 dark:text-green-400">{message}</AlertDescription>
              </Alert>
            )}
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div className="space-y-2">
                <label htmlFor="code" className="text-sm font-medium text-gray-700 dark:text-gray-300">6-digit code</label>
                <Input id="code" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-11 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium">
                {loading ? 'Verifying...' : 'Verify'}
              </Button>
            </form>
            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" onClick={resendOtp} className="h-10">
                <RefreshCcw className="w-4 h-4 mr-2" /> Resend code
              </Button>
              <Link to="/auth/login" className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400">Back to sign in</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VerifyOtpPage;


