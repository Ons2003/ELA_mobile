import React, { useEffect, useMemo, useState } from 'react';
import { Loader, Lock } from 'lucide-react';
import AdminDashboard from './components/AdminDashboard';
import { supabase } from './lib/supabase';
import { ADMIN_EMAIL } from './constants/admin';

const AdminApp = () => {
  const [authUser, setAuthUser] =
    useState<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']['user']>(null);
  const [loading, setLoading] = useState(true);
  const [authTimeout, setAuthTimeout] = useState(false);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      if (active) {
        setAuthTimeout(true);
        setLoading(false);
      }
    }, 8000);

    const bootstrap = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!active) {
          return;
        }

        if (error) {
          console.error('Error fetching admin session:', error);
        }

        setAuthUser(data.session?.user ?? null);
      } catch (error) {
        console.error('Unexpected error fetching admin session:', error);
        if (active) {
          setAuthUser(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    bootstrap();

    const {
      data: authListener,
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);

  const isAdmin = useMemo(() => {
    if (!authUser?.email) {
      return false;
    }

    return authUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  }, [authUser]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader className="w-10 h-10 text-red-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">
            {authTimeout ? 'Still waiting on authentication… please refresh.' : 'Preparing admin console...'}
          </p>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-8 text-center border border-gray-100">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <Lock className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Admin Sign In Required</h1>
          <p className="text-gray-600 mb-6">
            Visit the main Elyes Lift Academy site and sign in with your administrator credentials, then return to
            this page.
          </p>
          <a
            href="/"
            className="inline-flex items-center justify-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
          >
            Go to Main Site
          </a>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-8 text-center border border-gray-100">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <Lock className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Access Restricted</h1>
          <p className="text-gray-600 mb-6">
            Your account does not have administrator permissions. If you believe this is an error, contact Elyes Lift
            Academy support.
          </p>
          <a
            href="/"
            className="inline-flex items-center justify-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
          >
            Return to Main Site
          </a>
        </div>
      </div>
    );
  }

  return <AdminDashboard onNavigateBack={() => (window.location.href = '/')} />;
};

export default AdminApp;
