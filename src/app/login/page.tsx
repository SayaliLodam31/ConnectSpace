'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Sparkles,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/toast';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/dashboard';
  const urlError = searchParams.get('error');

  const supabase = getSupabaseBrowserClient();
  const { success, error: toastError } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState(
    urlError === 'auth_callback_failed'
      ? 'Email verification link expired or is invalid. Please request a new link or sign in.'
      : ''
  );

  // Countdown timer for brute-force rate-limiting lockout
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;
    setErrorMessage('');

    const normalizedEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!normalizedEmail || !cleanPassword) {
      setErrorMessage('Please provide both your work email and password.');
      return;
    }

    if (!isSupabaseConfigured()) {
      const msg =
        'Supabase credentials are not configured in .env.local. Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.';
      setErrorMessage(msg);
      toastError('Configuration Required', msg);
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: cleanPassword,
      });

      if (error) {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);

        let friendlyMessage = error.message;

        if (error.message.toLowerCase().includes('invalid login credentials')) {
          friendlyMessage = 'Invalid email or password. Please verify your credentials and try again.';
          if (newAttempts >= 5) {
            setLockoutSeconds(30);
            friendlyMessage = 'Too many failed login attempts. For security, please wait 30 seconds before trying again.';
          }
        } else if (error.message.toLowerCase().includes('email not confirmed')) {
          friendlyMessage =
            'Your email address has not been confirmed yet. Please check your inbox for the verification link.';
        }

        setErrorMessage(friendlyMessage);
        toastError('Login Failed', friendlyMessage);
        return;
      }

      // Reset failed attempts on success
      setFailedAttempts(0);

      if (data.user && data.session) {
        success('Welcome back!', 'Signed in successfully.');
        router.push(redirectTo);
        router.refresh();
      } else {
        setErrorMessage('Unable to establish an authenticated session. Please check your credentials.');
      }
    } catch (err: any) {
      console.error('[ConnectSpace Login Error]', err);

      const isNetworkError =
        err.name === 'TypeError' ||
        err.message?.toLowerCase().includes('failed to fetch') ||
        err.message?.toLowerCase().includes('network') ||
        err.message?.toLowerCase().includes('load failed');

      if (isNetworkError) {
        setErrorMessage(
          'Cannot reach the Supabase authentication server. Please check your internet connection or verify your Supabase project URL.'
        );
        toastError('Network Connection Error', 'Unable to reach the authentication service.');
      } else {
        setErrorMessage(err.message || 'An unexpected error occurred during sign in.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative w-full max-w-md bg-white/95 backdrop-blur-md rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-card my-8">
      {/* Brand header */}
      <div className="flex flex-col items-center text-center mb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 mb-3.5">
          <Sparkles className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Sign in to ConnectSpace</h2>
        <p className="text-xs text-slate-500 mt-1">
          Access your video meetings, active channels, and collaborative whiteboards
        </p>
      </div>

      {/* Error notification banner */}
      {errorMessage && (
        <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200/80 flex items-start gap-2.5 text-red-700 text-xs animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
          <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
        </div>
      )}

      {/* Login form */}
      <form onSubmit={handleLogin} className="space-y-4">
        <Input
          label="Work Email"
          type="email"
          placeholder="name@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          disabled={isLoading || lockoutSeconds > 0}
        />

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading || lockoutSeconds > 0}
              autoComplete="current-password"
              className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-subtle transition-all disabled:bg-slate-50 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Remember Session Option */}
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-600">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500/20 cursor-pointer"
            />
            <span>Remember this device</span>
          </label>
        </div>

        <Button
          type="submit"
          size="lg"
          isLoading={isLoading}
          disabled={isLoading || lockoutSeconds > 0}
          className="w-full mt-3 shadow-md shadow-blue-600/20"
        >
          {isLoading
            ? 'Signing in...'
            : lockoutSeconds > 0
            ? `Too many attempts (wait ${lockoutSeconds}s)`
            : 'Sign In'}
          <ArrowRight className="w-4 h-4 ml-1.5" />
        </Button>
      </form>

      {/* Footer link to signup */}
      <div className="mt-6 pt-5 border-t border-slate-100 text-center text-xs text-slate-500">
        Don&apos;t have an account yet?{' '}
        <Link href="/signup" className="text-blue-600 font-semibold hover:underline">
          Create free account
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="relative min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      {/* Faint conference background with subtle color gradient */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.06] pointer-events-none"
        style={{ backgroundImage: `url('/images/conference_bg.jpg')` }}
      />
      <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/5 via-indigo-500/5 to-transparent pointer-events-none" />

      <Suspense
        fallback={
          <div className="w-full max-w-md bg-white rounded-3xl p-12 flex flex-col items-center justify-center shadow-card">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-xs text-slate-400 mt-3">Loading ConnectSpace...</p>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
