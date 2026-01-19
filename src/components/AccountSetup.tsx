import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AccountSetupProps {
  email?: string | null;
  onComplete: () => void;
  onCancel: () => void;
}

interface PasswordRule {
  label: string;
  isValid: (value: string) => boolean;
}

const passwordRules: PasswordRule[] = [
  { label: 'At least 8 characters', isValid: (value) => value.length >= 8 },
  { label: 'Contains a number', isValid: (value) => /\d/.test(value) },
  { label: 'Contains a lowercase letter', isValid: (value) => /[a-z]/.test(value) },
  { label: 'Contains an uppercase letter', isValid: (value) => /[A-Z]/.test(value) },
];

const AccountSetup = ({ email, onComplete, onCancel }: AccountSetupProps) => {
  const [currentEmail, setCurrentEmail] = useState<string | null>(email ?? null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let mounted = true;
    const resolveUserEmail = async () => {
      if (currentEmail) {
        return;
      }
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError) {
          console.error('Unable to load user during account setup:', userError);
        }
        if (mounted) {
          setCurrentEmail(user?.email ?? null);
        }
      } catch (resolveError) {
        console.error('Unexpected error loading user during account setup:', resolveError);
      }
    };

    resolveUserEmail();

    return () => {
      mounted = false;
    };
  }, [currentEmail]);

  const ruleStates = useMemo(
    () =>
      passwordRules.map((rule) => ({
        ...rule,
        passed: rule.isValid(password),
      })),
    [password],
  );

  const canSubmit = useMemo(() => {
    if (!password || password !== confirmPassword) {
      return false;
    }
    return ruleStates.every((rule) => rule.passed);
  }, [confirmPassword, password, ruleStates]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!canSubmit || loading) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) {
          console.error('Error updating password during account setup:', updateError);
          setError(updateError.message ?? 'Unable to set password. Please try again.');
          return;
        }

        setSuccess(true);
        setTimeout(() => {
          onComplete();
        }, 800);
      } catch (submitError: any) {
        console.error('Unexpected error completing account setup:', submitError);
        setError(submitError?.message ?? 'Unable to complete account setup. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [canSubmit, loading, onComplete, password],
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full bg-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-white/10">
        <div className="flex items-center justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center shadow-md">
            {success ? <ShieldCheck className="w-8 h-8 text-green-600" /> : <Lock className="w-8 h-8 text-red-600" />}
          </div>
        </div>
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Secure Your Elyes Lift Academy Account</h1>
          {currentEmail && <p className="text-sm text-slate-300 mt-2">{currentEmail}</p>}
          <p className="text-slate-300 mt-4">
            You&apos;re almost ready to start training. Create a password and you&apos;ll be redirected to your member
            dashboard.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2" htmlFor="password">
              New Password
            </label>
            <input
              id="password"
              type="password"
              className="w-full rounded-xl border border-white/10 bg-white/10 text-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2" htmlFor="confirm-password">
              Confirm Password
            </label>
            <input
              id="confirm-password"
              type="password"
              className="w-full rounded-xl border border-white/10 bg-white/10 text-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </div>

          <div className="bg-black/20 rounded-xl p-4 border border-white/10">
            <p className="text-sm font-semibold text-slate-100 mb-3">Password Requirements</p>
            <ul className="space-y-2">
              {ruleStates.map((rule) => (
                <li
                  key={rule.label}
                  className={`text-sm flex items-center ${rule.passed ? 'text-green-300' : 'text-slate-300'}`}
                >
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-white/20 mr-2">
                    {rule.passed ? '✓' : '•'}
                  </span>
                  {rule.label}
                </li>
              ))}
            </ul>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
          )}

          {success ? (
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200">
              Password saved. Redirecting you to your dashboard...
            </div>
          ) : (
            <div className="flex items-center justify-between space-x-3">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-3 rounded-xl border border-white/10 text-slate-200 hover:bg-white/10 transition-colors w-full"
                disabled={loading}
              >
                Back to Home
              </button>
              <button
                type="submit"
                className="px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors w-full disabled:bg-red-600/60"
                disabled={!canSubmit || loading}
              >
                {loading ? 'Saving...' : 'Start Training'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default AccountSetup;
