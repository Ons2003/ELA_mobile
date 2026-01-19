import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import Navigation from './components/Navigation';
import Hero from './components/Hero';
import About from './components/About';
import Programs from './components/Programs';
import Testimonials from './components/Testimonials';
import Contact from './components/Contact';
import Footer from './components/Footer';
import ProgramsPage from './components/ProgramsPage';
import StrengthAssessmentPage from './components/StrengthAssessmentPage';
import Dashboard from './components/Dashboard';
import ProgressInsightsPage from './components/ProgressInsightsPage';
import PageTransitionOverlay from './components/PageTransitionOverlay';
import { supabase } from './lib/supabase';
import AccountSetup from './components/AccountSetup';
import ProfileSettingsPage from './components/ProfileSettingsPage';
import ServicesPage from './components/ServicesPage';
import MobileTabBar from './components/MobileTabBar';
import DashboardTabBar from './components/DashboardTabBar';

type PageKey =
  | 'home'
  | 'programs'
  | 'dashboard'
  | 'dashboard-calendar'
  | 'dashboard-progress'
  | 'dashboard-messages'
  | 'dashboard-physician'
  | 'dashboard-discounts'
  | 'dashboard-settings'
  | 'strength-assessment'
  | 'account-setup'
  | 'profile-settings'
  | 'progress-insights'
  | 'services';

type ProgressContext = {
  athleteId?: string | null;
  athleteName?: string | null;
} | null;

type EnrollmentReminderContext = {
  message: string;
} | null;

const DEFAULT_PAGE: PageKey = 'home';
const VALID_PAGES = new Set<PageKey>([
  'home',
  'programs',
  'dashboard',
  'dashboard-calendar',
  'dashboard-progress',
  'dashboard-messages',
  'dashboard-physician',
  'dashboard-discounts',
  'dashboard-settings',
  'strength-assessment',
  'account-setup',
  'profile-settings',
  'progress-insights',
  'services',
]);

const DASHBOARD_PAGES = new Set<PageKey>([
  'dashboard',
  'dashboard-calendar',
  'dashboard-progress',
  'dashboard-messages',
  'dashboard-physician',
  'dashboard-discounts',
  'dashboard-settings',
]);

const DEFAULT_DASHBOARD_PAGE: PageKey = 'dashboard-calendar';

const isValidPage = (value: unknown): value is PageKey =>
  typeof value === 'string' && VALID_PAGES.has(value as PageKey);

const getPageFromLocation = (): PageKey => {
  if (typeof window === 'undefined') {
    return DEFAULT_PAGE;
  }

  const url = new URL(window.location.href);
  const pageParam = url.searchParams.get('page');

  if (isValidPage(pageParam)) {
    return pageParam;
  }

  const hashValue = url.hash.replace(/^#/, '');
  if (isValidPage(hashValue)) {
    return hashValue;
  }

  const statePage = window.history.state?.page;
  if (isValidPage(statePage)) {
    return statePage;
  }

  return DEFAULT_PAGE;
};

const updateBrowserHistory = (page: PageKey, method: 'push' | 'replace') => {
  if (typeof window === 'undefined') {
    return;
  }

  const url = new URL(window.location.href);

  if (page === DEFAULT_PAGE) {
    url.searchParams.delete('page');
  } else {
    url.searchParams.set('page', page);
  }

  const newUrl = `${url.pathname}${url.search}${url.hash}`;

  if (method === 'push') {
    window.history.pushState({ page }, '', newUrl);
  } else {
    window.history.replaceState({ page }, '', newUrl);
  }
};

function App() {
  const [currentPage, setCurrentPage] = useState<PageKey>(() => {
    const initialPage = getPageFromLocation();
    updateBrowserHistory(initialPage, 'replace');
    return initialPage;
  });
  const [showTransition, setShowTransition] = useState(false);
  const [authUser, setAuthUser] = useState<Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user']>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [progressContext, setProgressContext] = useState<ProgressContext>(null);
  const [enrollmentReminder, setEnrollmentReminder] = useState<EnrollmentReminderContext>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentPage]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
    const searchParams = url.searchParams;
    const readParam = (key: string) => hashParams.get(key) ?? searchParams.get(key);

    const accessToken = readParam('access_token');
    const refreshToken = readParam('refresh_token');
    const typeParam = readParam('type');
    const shouldShowSetup = typeParam === 'invite' || typeParam === 'recovery';
    const hasTokens = Boolean(accessToken && refreshToken);

    if (hasTokens) {
      supabase.auth
        .setSession({
          access_token: accessToken!,
          refresh_token: refreshToken!,
        })
        .catch((sessionError) => {
          console.error('Error applying auth session from invite link:', sessionError);
        });
    }

    if (shouldShowSetup) {
      updateBrowserHistory('account-setup', 'replace');
      setCurrentPage('account-setup');
    }

    if (hasTokens || shouldShowSetup) {
      const paramsToPrune = [
        'access_token',
        'refresh_token',
        'expires_in',
        'token_type',
        'type',
        'provider_token',
        'provider_refresh_token',
      ];

      let mutated = false;
      paramsToPrune.forEach((key) => {
        if (hashParams.has(key)) {
          hashParams.delete(key);
          mutated = true;
        }
        if (searchParams.has(key)) {
          searchParams.delete(key);
          mutated = true;
        }
      });

      if (mutated) {
        const newHash = hashParams.toString();
        const nextUrl = `${url.pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}${
          newHash ? `#${newHash}` : ''
        }`;
        window.history.replaceState(window.history.state, '', nextUrl);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handlePopState = (event: PopStateEvent) => {
      const statePage = event.state?.page;

      if (isValidPage(statePage)) {
        setCurrentPage(statePage);
      } else {
        setCurrentPage(getPageFromLocation());
      }

      setShowTransition(false);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    let mounted = true;

    const bootstrapAuth = async () => {
      setAuthLoading(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) {
          return;
        }

        setAuthUser(session?.user ?? null);
      } catch (error) {
        console.error('Error initializing auth session:', error);
        if (mounted) {
          setAuthUser(null);
        }
      } finally {
        if (mounted) {
          setAuthLoading(false);
        }
      }
    };

    bootstrapAuth();

    const {
      data: authListener,
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authLoading || !authUser) {
      return;
    }
    if (currentPage === 'account-setup') {
      return;
    }
    if (!DASHBOARD_PAGES.has(currentPage)) {
      updateBrowserHistory(DEFAULT_DASHBOARD_PAGE, 'replace');
      setCurrentPage(DEFAULT_DASHBOARD_PAGE);
    }
  }, [authLoading, authUser, currentPage]);

  const handleNavigate = useCallback(
    (
      page: string,
      options?: { progressContext?: ProgressContext; enrollmentReminder?: string | null },
    ) => {
      const nextPage: PageKey = isValidPage(page) ? page : DEFAULT_PAGE;

      if (nextPage === 'progress-insights' || nextPage === 'dashboard-progress') {
        setProgressContext(options?.progressContext ?? null);
      } else if (progressContext) {
        setProgressContext(null);
      }

      if (options?.enrollmentReminder) {
        setEnrollmentReminder({ message: options.enrollmentReminder });
      } else if (nextPage !== 'programs') {
        setEnrollmentReminder(null);
      }

      if (nextPage === currentPage) {
        updateBrowserHistory(nextPage, 'replace');
        return;
      }

      updateBrowserHistory(nextPage, 'push');
      setCurrentPage(nextPage);
      setShowTransition(true);
    },
    [currentPage, progressContext],
  );

  useEffect(() => {
    if (!showTransition) {
      return;
    }

    const timeoutId = window.setTimeout(() => setShowTransition(false), 700);
    return () => window.clearTimeout(timeoutId);
  }, [showTransition]);

  const handleAccountSetupComplete = useCallback(() => {
    updateBrowserHistory(DEFAULT_DASHBOARD_PAGE, 'replace');
    setCurrentPage(DEFAULT_DASHBOARD_PAGE);
    setShowTransition(false);
  }, []);

  const handleAccountSetupCancel = useCallback(() => {
    updateBrowserHistory('home', 'replace');
    setCurrentPage('home');
    setShowTransition(false);
  }, []);

  const AuthMessage = useMemo(() => {
    const Requirement = ({
      title,
      description,
    }: {
      title: string;
      description: string;
    }) => (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-8 text-center border border-gray-100">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <Lock className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">{title}</h2>
          <p className="text-gray-600 mb-6">{description}</p>
          <div className="space-y-3">
            <button
              onClick={() => {
                sessionStorage.setItem('ela-open-login', '1');
                handleNavigate('home');
              }}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium transition-colors"
            >
              Sign in
            </button>
            <p className="text-sm text-gray-500">
              Use the home screen to sign in with your Elyes Lift Academy account.
            </p>
          </div>
        </div>
      </div>
    );

    return (
      <Requirement
        title="Sign In Required"
        description="Please sign in to access your personal dashboard and weekly programming."
      />
    );
  }, [handleNavigate]);

  const AuthLoader = (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-red-600 mx-auto mb-4" />
        <p className="text-gray-600">Checking credentials...</p>
      </div>
    </div>
  );

  const renderDashboardPage = (view?: 'calendar' | 'messages' | 'physician' | 'discounts') => {
    if (authLoading) {
      return AuthLoader;
    }

    if (!authUser) {
      return AuthMessage;
    }

    return (
      <Dashboard
        view={view}
        onNavigateHome={() => handleNavigate(DEFAULT_DASHBOARD_PAGE)}
        onNavigateSettings={() => handleNavigate('dashboard-settings')}
        onNavigateProgress={(options) =>
          handleNavigate('dashboard-progress', { progressContext: options ?? null })
        }
      />
    );
  };

  const renderProgressPage = () => {
    if (authLoading) {
      return AuthLoader;
    }

    if (!authUser) {
      return AuthMessage;
    }

    return (
      <ProgressInsightsPage
        onNavigateBack={() => handleNavigate(DEFAULT_DASHBOARD_PAGE)}
        athleteIdOverride={progressContext?.athleteId ?? null}
        athleteNameOverride={progressContext?.athleteName ?? null}
      />
    );
  };

  const renderSettingsPage = () => {
    if (authLoading) {
      return AuthLoader;
    }

    if (!authUser) {
      return AuthMessage;
    }

    return <ProfileSettingsPage onNavigateBack={() => handleNavigate(DEFAULT_DASHBOARD_PAGE)} />;
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'programs':
        return (
          <div className="min-h-screen pb-24 lg:pb-0">
            <Navigation onNavigate={handleNavigate} />
            <ProgramsPage />
            <Footer />
          </div>
        );
      case 'services':
        return (
          <div className="min-h-screen pb-24 lg:pb-0">
            <Navigation onNavigate={handleNavigate} />
            <ServicesPage />
            <Footer />
          </div>
        );
      case 'account-setup':
        return (
          <AccountSetup
            email={authUser?.email ?? null}
            onComplete={handleAccountSetupComplete}
            onCancel={handleAccountSetupCancel}
          />
        );
      case 'dashboard':
        return renderDashboardPage('calendar');
      case 'dashboard-calendar':
        return renderDashboardPage('calendar');
      case 'dashboard-messages':
        return renderDashboardPage('messages');
      case 'dashboard-physician':
        return renderDashboardPage('physician');
      case 'dashboard-discounts':
        return renderDashboardPage('discounts');
      case 'dashboard-progress':
        return renderProgressPage();
      case 'dashboard-settings':
        return renderSettingsPage();
      case 'profile-settings':
        return renderSettingsPage();
      case 'progress-insights':
        return renderProgressPage();
      case 'strength-assessment':
        return <StrengthAssessmentPage onNavigateBack={() => handleNavigate('home')} />;
      default:
        return (
          <div className="min-h-screen pb-24 lg:pb-0">
            <Navigation onNavigate={handleNavigate} />
            <Hero onNavigate={handleNavigate} />
            <About />
            <Programs />
            <Testimonials />
            <Contact />
            <Footer />
          </div>
        );
    }
  };

  const showDashboardTabBar = !authLoading && Boolean(authUser) && currentPage !== 'account-setup';
  const showMarketingTabBar = !authLoading && !authUser && currentPage !== 'account-setup';

  return (
    <>
      {renderPage()}
      {enrollmentReminder && currentPage === 'programs' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="max-w-lg w-full rounded-2xl bg-white shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-red-100 p-2">
                <Lock className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Complete your enrollment</h2>
                <p className="text-sm text-gray-600 mt-1">{enrollmentReminder.message}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEnrollmentReminder(null)}
              className="w-full inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700"
            >
              Choose a program
            </button>
          </div>
        </div>
      )}
      {showMarketingTabBar && <MobileTabBar currentPage={currentPage} onNavigate={handleNavigate} />}
      {showDashboardTabBar && <DashboardTabBar currentPage={currentPage} onNavigate={handleNavigate} />}
      <PageTransitionOverlay isVisible={showTransition} />
    </>
  );
}

export default App;
