'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Check,
  X,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/toast';

export default function SignupPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const { success, error: toastError } = useToast();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Real-time password criteria
  const hasMinLength = password.length >= 6;
  const hasConfirmMatch = confirmPassword.length > 0 && password === confirmPassword;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const trimmedName = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedTitle = jobTitle.trim();

    // 1. Validate required inputs
    if (!trimmedName) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    if (!normalizedEmail) {
      setErrorMessage('Please enter your work email.');
      return;
    }

    // 2. Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      setErrorMessage('Please enter a valid email address (e.g. name@company.com).');
      return;
    }

    // 3. Password requirements
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    // 4. Confirm password match
    if (password !== confirmPassword) {
      setErrorMessage('Password and confirmation do not match.');
      return;
    }

    // 5. Verify Supabase configuration
    if (!isSupabaseConfigured()) {
      const msg =
        'Supabase credentials are not configured in .env.local. Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.';
      setErrorMessage(msg);
      toastError('Configuration Required', msg);
      return;
    }

    setIsLoading(true);

    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';

      // 6. Execute Supabase Auth signUp
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: password.trim(),
        options: {
          data: {
            full_name: trimmedName,
            job_title: trimmedTitle || 'Team Member',
          },
          emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
        },
      });

      // 7. Handle Supabase Auth errors
      if (error) {
        let friendlyMessage = error.message;

        if (
          error.message.toLowerCase().includes('already registered') ||
          error.message.toLowerCase().includes('already in use') ||
          (error as any).code === 'user_already_exists'
        ) {
          friendlyMessage = 'An account with this email already exists. Please sign in instead.';
        } else if (error.message.toLowerCase().includes('signup is disabled')) {
          friendlyMessage =
            'Email signups are currently disabled in your Supabase project settings. Please enable them in Authentication > Providers > Email.';
        } else if (error.message.toLowerCase().includes('database error')) {
          friendlyMessage =
            'Database error while setting up user profile. Please ensure database migrations have been executed in Supabase SQL Editor.';
        }

        setErrorMessage(friendlyMessage);
        toastError('Registration Failed', friendlyMessage);
        return;
      }

      // 8. Handle duplicate email with email confirmation enabled (identities array empty)
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        const dupMessage = 'An account with this email already exists. Please sign in or reset your password.';
        setErrorMessage(dupMessage);
        toastError('Account Exists', dupMessage);
        return;
      }

      // 9. Handle successful registration
      if (data.user) {
        // If a session was immediately created (email verification disabled in Supabase)
        if (data.session) {
          // Pre-populate profile in public.profiles to ensure instant foreign-key availability
          try {
            await supabase.from('profiles').upsert(
              {
                id: data.user.id,
                full_name: trimmedName,
                email: normalizedEmail,
                job_title: trimmedTitle || 'Team Member',
                avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(normalizedEmail)}`,
                status: 'online',
              },
              { onConflict: 'id' }
            );
          } catch (profileErr) {
            console.warn('[Signup] Profile upsert notice:', profileErr);
          }

          success('Welcome to ConnectSpace!', 'Your account has been created successfully.');
          router.push('/dashboard');
          router.refresh();
        } else {
          // Email confirmation is required by Supabase settings
          setIsSuccess(true);
          success('Account Created', 'Please check your email for the verification link.');
        }
      }
    } catch (err: any) {
      console.error('[ConnectSpace Registration Error]', err);

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
        setErrorMessage(err.message || 'An unexpected registration error occurred. Please try again.');
        toastError('Registration Error', err.message || 'Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="relative min-h-screen bg-slate-50 flex items-center justify-center p-4 overflow-hidden">
        {/* Faint conference background with subtle color gradient */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: `url('/images/conference_bg.jpg')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/5 via-indigo-500/5 to-transparent pointer-events-none" />

        <div className="relative w-full max-w-md bg-white/95 backdrop-blur-md rounded-3xl border border-slate-200/80 p-8 text-center shadow-card animate-in fade-in zoom-in-95 duration-200">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-100 shadow-sm">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h3 className="text-2xl font-bold tracking-tight text-slate-900">Check Your Email</h3>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            We sent a secure verification link to <strong className="text-slate-800 font-semibold">{email}</strong>.
            Click the link in the message to activate your workspace and start collaborating.
          </p>
          <div className="mt-8 space-y-3">
            <Link href="/login" className="block">
              <Button size="lg" className="w-full shadow-md shadow-blue-600/20">
                Proceed to Sign In
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </Link>
            <p className="text-[11px] text-slate-400">
              Didn&apos;t receive it? Check your spam folder or try registering again.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      {/* Faint conference background with subtle color gradient */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.06] pointer-events-none"
        style={{ backgroundImage: `url('/images/conference_bg.jpg')` }}
      />
      <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/5 via-indigo-500/5 to-transparent pointer-events-none" />

      <div className="relative w-full max-w-md bg-white/95 backdrop-blur-md rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-card my-8">
        {/* Brand header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 mb-3.5">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Create your account</h2>
          <p className="text-xs text-slate-500 mt-1">
            Collaborate in real-time with WebRTC video, synchronized chat, and live whiteboards
          </p>
        </div>

        {/* Error notification banner */}
        {errorMessage && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200/80 flex items-start gap-2.5 text-red-700 text-xs animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
            <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {/* Signup form */}
        <form onSubmit={handleSignup} className="space-y-4">
          <Input
            label="Full Name *"
            placeholder="Jane Doe"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
            disabled={isLoading}
          />

          <Input
            label="Work Email *"
            type="email"
            placeholder="jane@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            disabled={isLoading}
          />

          <Input
            label="Job Title"
            placeholder="Product Designer / Engineer"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            autoComplete="organization-title"
            disabled={isLoading}
          />

          {/* Password field with visibility toggle */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Password *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={isLoading}
                autoComplete="new-password"
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
            {/* Real-time criteria check */}
            <div className="flex items-center gap-1.5 pt-1 text-[11px]">
              {hasMinLength ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300 ml-1 mr-1" />
              )}
              <span className={hasMinLength ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
                At least 6 characters
              </span>
            </div>
          </div>

          {/* Confirm Password field with visibility toggle */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Confirm Password *
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                disabled={isLoading}
                autoComplete="new-password"
                className={`w-full pl-3.5 pr-10 py-2.5 text-sm bg-white border rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 shadow-subtle transition-all disabled:bg-slate-50 disabled:cursor-not-allowed ${
                  confirmPassword && !hasConfirmMatch
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                    : 'border-slate-200 focus:border-blue-600 focus:ring-blue-500/20'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1"
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {/* Real-time match check */}
            {confirmPassword.length > 0 && (
              <div className="flex items-center gap-1.5 pt-1 text-[11px]">
                {hasConfirmMatch ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="text-emerald-700 font-medium">Passwords match</span>
                  </>
                ) : (
                  <>
                    <X className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <span className="text-red-600 font-medium">Passwords do not match</span>
                  </>
                )}
              </div>
            )}
          </div>

          <Button
            type="submit"
            size="lg"
            isLoading={isLoading}
            disabled={isLoading || (confirmPassword.length > 0 && !hasConfirmMatch)}
            className="w-full mt-3 shadow-md shadow-blue-600/20"
          >
            {isLoading ? 'Creating account...' : 'Create Free Account'}
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </form>

        {/* Footer link to login */}
        <div className="mt-6 pt-5 border-t border-slate-100 text-center text-xs text-slate-500">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 font-semibold hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
