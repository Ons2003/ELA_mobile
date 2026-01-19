import React, { useState, useEffect, useCallback } from 'react';
import { Menu, X, LogIn, Eye, EyeOff, AlertCircle, CheckCircle, Loader, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ADMIN_EMAIL } from '../constants/admin';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { Separator } from './ui/separator';

interface NavigationProps {
  onNavigate?: (page: string) => void;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface SignUpData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  experienceLevel: string;
}

interface LoginResponse {
  success: boolean;
  message: string;
  user?: {
    id: string;
    name: string;
    email: string;
    program: string;
    hasAccess: boolean;
  };
}

const Navigation = ({ onNavigate }: NavigationProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignUpModal, setShowSignUpModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [resetNotice, setResetNotice] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: '',
    password: ''
  });

  const [signUpData, setSignUpData] = useState<SignUpData>({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    experienceLevel: 'beginner'
  });

  const desktopNavButtonClasses =
    "relative text-base lg:text-lg px-3 py-2 rounded-md text-gray-300 transition-colors duration-300 ease-out hover:text-white hover:bg-red-700/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60 whitespace-nowrap";

  const scrollToSection = (sectionId: string) => {
    if (onNavigate && sectionId === 'programs-page') {
      onNavigate('programs');
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
      setIsOpen(false);
      return;
    }
    
    if (onNavigate && sectionId !== 'home') {
      onNavigate('home');
      setTimeout(() => {
        const element = document.getElementById(sectionId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
      setIsOpen(false);
    } else {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
        setIsOpen(false);
      }
    }
  };

  const handleHomeClick = () => {
    if (onNavigate) {
      onNavigate('home');
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    }
    setIsOpen(false);
  };

  const handleLoginClick = useCallback(() => {
    setShowLoginModal(true);
    setAuthError(null);
    setCredentials({ email: '', password: '' });
    setShowPassword(false);
  }, []);

  const handleSignUpClick = useCallback(() => {
    setShowSignUpModal(true);
    setAuthError(null);
    setSignUpData({
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
      experienceLevel: 'beginner'
    });
    setShowConfirmPassword(false);
  }, []);

  useEffect(() => {
    const handleExternalLoginOpen = () => handleLoginClick();
    const handleExternalSignUpOpen = () => handleSignUpClick();

    window.addEventListener('ela-open-login', handleExternalLoginOpen);
    window.addEventListener('ela-open-signup', handleExternalSignUpOpen);

    return () => {
      window.removeEventListener('ela-open-login', handleExternalLoginOpen);
      window.removeEventListener('ela-open-signup', handleExternalSignUpOpen);
    };
  }, [handleLoginClick, handleSignUpClick]);

  useEffect(() => {
    if (sessionStorage.getItem('ela-open-login') === '1') {
      sessionStorage.removeItem('ela-open-login');
      handleLoginClick();
    }
  }, [handleLoginClick]);

  const handleCloseModal = () => {
    setShowLoginModal(false);
    setShowSignUpModal(false);
    setAuthError(null);
    setResetNotice(null);
    setCredentials({ email: '', password: '' });
    setSignUpData({
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
      experienceLevel: 'beginner'
    });
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleLoginInputChange = (field: keyof LoginCredentials, value: string) => {
    setCredentials(prev => {
      const newCredentials = { ...prev };
      newCredentials[field] = value;
      return newCredentials;
    });
    if (authError) setAuthError(null);
  };

  const handleSignUpChange = (field: keyof SignUpData, value: string) => {
    setSignUpData(prev => ({ ...prev, [field]: value }));
    if (authError) setAuthError(null); // Clear error when user starts typing
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setResetNotice(null);
    
    if (!credentials.email || !credentials.password) {
      setAuthError('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    setAuthError(null);

    try {
      // Direct Supabase authentication
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password
      });

      if (error) {
        console.error('Login error:', error);
        if (error.message.includes('Invalid login credentials')) {
          setAuthError('Invalid email or password. Please check your credentials.');
        } else if (error.message.includes('Email not confirmed')) {
          setAuthError('Please check your email and confirm your account.');
        } else {
          setAuthError('Login failed. Please try again.');
        }
        setIsLoading(false);
        return;
      }

      if (data.user) {
        // Get user profile to check role
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, first_name, last_name')
          .eq('id', data.user.id)
          .single();

        // Close modal and navigate based on role
        handleCloseModal();
        
        // Check for admin access
        const isAdmin =
          profile?.role === 'admin' ||
          (data.user.email && data.user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
        
        if (isAdmin) {
          handleCloseModal();
          window.location.href = '/admin.html';
          return;
        } else {
          onNavigate && onNavigate('dashboard');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      setAuthError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!credentials.email.trim()) {
      setAuthError('Enter your email to reset your password.');
      return;
    }
    setAuthError(null);
    setIsResetting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(credentials.email.trim(), {
        redirectTo: `${window.location.origin}/#type=recovery`,
      });
      if (error) {
        console.error('Password reset error:', error);
        setAuthError('Unable to send reset link. Please try again.');
      } else {
        setResetNotice('Reset email sent. Check your inbox to set a new password.');
      }
    } catch (resetError) {
      console.error('Unexpected password reset error:', resetError);
      setAuthError('Unable to send reset link. Please try again.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    
    // Validation
    if (!signUpData.email || !signUpData.password || !signUpData.firstName || !signUpData.lastName) {
      setAuthError('Please fill in all required fields.');
      return;
    }

    if (signUpData.password !== signUpData.confirmPassword) {
      setAuthError('Passwords do not match.');
      return;
    }

    if (signUpData.password.length < 6) {
      setAuthError('Password must be at least 6 characters long.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(signUpData.email)) {
      setAuthError('Please enter a valid email address.');
      return;
    }

    const normalizedEmail = signUpData.email.trim().toLowerCase();
    const isAdminAccount = normalizedEmail === ADMIN_EMAIL.toLowerCase();

    if (isAdminAccount) {
      setAuthError('This email is reserved for administrators. Contact support to provision secure access.');
      return;
    }

    setIsLoading(true);
    setAuthError(null);

    try {
      // Direct Supabase signup
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: signUpData.password,
        options: {
          data: {
            first_name: signUpData.firstName,
            last_name: signUpData.lastName,
            experience_level: signUpData.experienceLevel
          }
        }
      });

      if (error) {
        console.error('Signup error:', error);
        if (error.message.includes('User already registered')) {
          setAuthError('An account with this email already exists. Please try logging in instead.');
        } else {
          setAuthError(error.message || 'Signup failed. Please try again.');
        }
        setIsLoading(false);
        return;
      }

      if (data.user) {
        // Create or update profile in database
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert(
            {
              id: data.user.id,
              email: normalizedEmail,
              first_name: signUpData.firstName,
              last_name: signUpData.lastName,
              experience_level: signUpData.experienceLevel,
              role: isAdminAccount ? 'admin' : 'user'
            },
            { onConflict: 'id' }
          );

        let requiresEnrollmentForProfile = false;

        if (profileError) {
          console.error('Profile creation error:', profileError);
          const profileErrorMessage = (profileError.message || '').toLowerCase();
          const enrollmentRequired =
            profileErrorMessage.includes('row-level security') ||
            profileErrorMessage.includes('permission denied') ||
            profileErrorMessage.includes('enroll');

          if (enrollmentRequired) {
            requiresEnrollmentForProfile = true;
            console.warn(
              'Profile creation deferred until enrollment is completed. User can still finish account setup.',
              profileError,
            );
          } else {
            setAuthError('Account created but profile setup failed. Please contact support.');
            setIsLoading(false);
            return;
          }
        }

        let hasEnrollment = false;

        try {
          const { data: linkedEnrollments } = await supabase
            .from('program_enrollments')
            .update({
              user_id: data.user.id,
              lead_first_name: signUpData.firstName,
              lead_last_name: signUpData.lastName,
              lead_email: normalizedEmail,
              lead_experience_level: signUpData.experienceLevel,
            })
            .eq('lead_email', normalizedEmail)
            .is('user_id', null)
            .select('id');

          hasEnrollment = (linkedEnrollments?.length ?? 0) > 0;
        } catch (enrollmentLinkError) {
          console.warn('Unable to link enrollments to new account:', enrollmentLinkError);
        }

        if (!hasEnrollment) {
          try {
            const { data: enrollmentCheck } = await supabase
              .from('program_enrollments')
              .select('id')
              .eq('user_id', data.user.id)
              .limit(1);

            hasEnrollment = (enrollmentCheck?.length ?? 0) > 0;
          } catch (enrollmentLookupError) {
            console.warn('Unable to verify enrollment status for new account:', enrollmentLookupError);
          }
        }

        handleCloseModal();

        if (requiresEnrollmentForProfile && !hasEnrollment) {
          console.info('Profile will be created automatically once the user enrolls in a program.');
        }

        if (isAdminAccount) {
          alert('Administrator account created successfully! You can now log in with your admin credentials.');
        } else {
          const enrollmentReminder =
            'Account created successfully! Please enroll in a program to unlock your personalized training.';

          if (onNavigate) {
            onNavigate('programs', { enrollmentReminder: enrollmentReminder });
          } else {
            scrollToSection('programs-page');
            setTimeout(() => alert(enrollmentReminder), 100);
          }
        }
      } else {
        setAuthError('Signup failed. Please try again.');
      }
    } catch (error) {
      console.error('Signup error:', error);
      setAuthError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewPrograms = () => {
    handleCloseModal();
    scrollToSection('programs-page');
  };

  // Move modal components outside to prevent recreation
const loginModalContent = showLoginModal ? (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleCloseModal}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 p-4 text-center rounded-t-2xl">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <LogIn className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1">Login</h2>
          <p className="text-red-100">Access your training dashboard</p>
        </div>

        {/* Form */}
        <div className="p-4">
          <form onSubmit={handleLogin} className="space-y-3">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={credentials.email}
                onChange={(e) => handleLoginInputChange('email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-red-600 focus:border-transparent transition-colors"
                placeholder="Enter your email"
                disabled={isLoading}
                autoComplete="email"
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                 key="login-password-input"
                  value={credentials.password}
                  onChange={(e) => handleLoginInputChange('password', e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-red-600 focus:border-transparent transition-colors"
                  placeholder="Enter your password"
                  disabled={isLoading}
                 autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {authError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start">
                <AlertCircle className="w-4 h-4 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-800 text-sm">{authError}</p>
                  {(authError.includes('Account not found') || authError.includes('Invalid login credentials')) && (
                    <button
                      type="button"
                      onClick={handleViewPrograms}
                      className="text-red-600 hover:text-red-700 text-xs font-medium mt-1 underline block"
                    >
                      Don't have an account? Enroll in a program to get started.
                    </button>
                  )}
                </div>
              </div>
            )}


            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !credentials.email || !credentials.password}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Signing In...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign In
                </>
              )}
            </button>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={isResetting}
                className="text-red-600 font-semibold hover:underline disabled:opacity-60"
              >
                {isResetting ? 'Sending reset link...' : 'Forgot password?'}
              </button>
              {resetNotice && <span className="text-green-600">{resetNotice}</span>}
            </div>
          </form>

          {isRetrying && (
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-xs text-blue-600">
                This appears to be a temporary issue. Please try again in a few moments.
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-4 pt-3 border-t border-gray-200">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-3">
                New to Elyes Lift Academy?
              </p>
              <button
                onClick={handleViewPrograms}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors text-sm"
              >
                Enroll in a Program
              </button>
            </div>
            
            <div className="mt-2 text-center">
              <button
                onClick={handleCloseModal}
                className="text-gray-500 hover:text-gray-700 text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const signUpModalContent = showSignUpModal ? (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 p-4 text-center rounded-t-2xl">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <User className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1">Create Account</h2>
          <p className="text-red-100">Join Elyes Lift Academy</p>
        </div>

        {/* Form */}
        <div className="p-4">
          <form onSubmit={handleSignUp} className="space-y-3">
            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  id="firstName"
                  value={signUpData.firstName}
                  onChange={(e) => handleSignUpChange('firstName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-red-600 focus:border-transparent transition-colors"
                  placeholder="First name"
                  disabled={isLoading}
                  required
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  id="lastName"
                  value={signUpData.lastName}
                  onChange={(e) => handleSignUpChange('lastName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-red-600 focus:border-transparent transition-colors"
                  placeholder="Last name"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            {/* Email Field */}
            <div>
              <label htmlFor="signupEmail" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              <input
                type="email"
                id="signupEmail"
                value={signUpData.email}
                onChange={(e) => handleSignUpChange('email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-red-600 focus:border-transparent transition-colors"
                placeholder="Enter your email"
                disabled={isLoading}
                autoComplete="email"
              />
            </div>

            {/* Experience Level */}
            <div>
              <label htmlFor="experienceLevel" className="block text-sm font-medium text-gray-700 mb-2">
                Training Experience *
              </label>
              <select
                id="experienceLevel"
                value={signUpData.experienceLevel}
                onChange={(e) => handleSignUpChange('experienceLevel', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-red-600 focus:border-transparent transition-colors"
                disabled={isLoading}
                required
              >
                <option value="beginner">Beginner (0-1 years)</option>
                <option value="intermediate">Intermediate (1-3 years)</option>
                <option value="advanced">Advanced (3+ years)</option>
              </select>
            </div>

            {/* Password Fields */}
            <div>
              <label htmlFor="signupPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Password *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="signupPassword"
                  value={signUpData.password}
                  onChange={(e) => handleSignUpChange('password', e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-red-600 focus:border-transparent transition-colors"
                  placeholder="Create a password"
                  disabled={isLoading}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password *
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  value={signUpData.confirmPassword}
                  onChange={(e) => handleSignUpChange('confirmPassword', e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-red-600 focus:border-transparent transition-colors"
                  placeholder="Confirm your password"
                  disabled={isLoading}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  disabled={isLoading}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {authError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start">
                <AlertCircle className="w-4 h-4 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-800 text-sm">{authError}</p>
                  {isRetrying && (
                    <p className="text-xs text-red-500 mt-1">
                      This appears to be a temporary issue. Please try again in a few moments.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  <User className="w-4 h-4 mr-2" />
                  Create Account
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-4 pt-3 border-t border-gray-200">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-3">
                Already have an account?
              </p>
              <button
                onClick={() => {
                  handleCloseModal();
                  handleLoginClick();
                }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors text-sm"
              >
                Sign In Instead
              </button>
            </div>
            
            <div className="mt-2 text-center">
              <button
                onClick={handleCloseModal}
                className="text-gray-500 hover:text-gray-700 text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <nav className="fixed top-0 w-full bg-gradient-to-r from-red-900 via-red-800 to-gray-900 backdrop-blur-sm z-50 border-b border-red-800/30 pt-[env(safe-area-inset-top)]">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-14 sm:h-16 lg:h-20 gap-3 sm:gap-4">
            <button onClick={handleHomeClick} className="flex items-center space-x-2 mr-auto flex-shrink-0">
              <img
                src="/logoELA.png"
                alt="Elyes Lift Academy Logo"
                className="w-12 h-10 sm:w-16 sm:h-12 md:w-20 md:h-16 lg:w-28 lg:h-24 object-contain"
              />
              <span className="text-white font-bold text-base sm:text-lg md:text-xl lg:text-2xl whitespace-nowrap">
                Elyes Lift Academy
              </span>
            </button>

            <div className="hidden lg:block">
              <div className="ml-10 flex items-baseline space-x-8">
                <button onClick={handleHomeClick} className={desktopNavButtonClasses}>
                  Home
                </button>
                <button onClick={() => onNavigate && onNavigate('services')} className={desktopNavButtonClasses}>
                  Our Services
                </button>
                <button onClick={() => onNavigate && onNavigate('strength-assessment')} className={desktopNavButtonClasses}>
                  Strength Test
                </button>
                <button onClick={() => scrollToSection('programs-page')} className={desktopNavButtonClasses}>
                  Programs
                </button>
                <button onClick={() => scrollToSection('testimonials')} className={desktopNavButtonClasses}>
                  Results
                </button>
                <button onClick={() => scrollToSection('contact')} className={desktopNavButtonClasses}>
                  Contact
                </button>
              </div>
            </div>

            <div className="hidden lg:flex items-center gap-4">
              <Button variant="outline" onClick={handleLoginClick} className="border-white/40 text-white hover:border-white">
                Log in
              </Button>
            </div>

            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <div className="lg:hidden flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    handleLoginClick();
                    setIsOpen(false);
                  }}
                  aria-label="Log in"
                  className="text-white hover:bg-white/10"
                >
                  <LogIn className="w-5 h-5" />
                </Button>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Open menu"
                    className="text-white hover:bg-white/10"
                  >
                    <Menu className="w-6 h-6" />
                  </Button>
                </SheetTrigger>
              </div>
              <SheetContent side="right" className="border-white/10 bg-black/95 text-white">
                <SheetHeader>
                  <SheetTitle className="text-white">Navigate</SheetTitle>
                  <SheetDescription className="text-white/70">
                    Move between sections quickly.
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-2">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-base"
                    onClick={handleHomeClick}
                  >
                    Home
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-base"
                    onClick={() => {
                      onNavigate && onNavigate('services');
                      setIsOpen(false);
                    }}
                  >
                    Our Services
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-base"
                    onClick={() => {
                      onNavigate && onNavigate('strength-assessment');
                      setIsOpen(false);
                    }}
                  >
                    Strength Test
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-base"
                    onClick={() => scrollToSection('programs-page')}
                  >
                    Programs
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-base"
                    onClick={() => scrollToSection('testimonials')}
                  >
                    Results
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-base"
                    onClick={() => scrollToSection('contact')}
                  >
                    Contact
                  </Button>
                </div>
                <Separator className="my-5 bg-white/10" />
                <Button
                  className="w-full"
                  onClick={() => {
                    handleLoginClick();
                    setIsOpen(false);
                  }}
                >
                  Log in
                </Button>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>

      {/* Login Modal */}
      {loginModalContent}
      {signUpModalContent}

    </>
  );
};

export default Navigation;

