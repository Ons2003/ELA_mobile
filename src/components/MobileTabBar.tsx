import React from 'react';
import { Activity, Dumbbell, Home, LayoutGrid, Sparkles } from 'lucide-react';

type MobileTabBarProps = {
  currentPage: string;
  onNavigate: (page: string) => void;
};

const tabs = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'programs', label: 'Programs', icon: Dumbbell },
  { key: 'services', label: 'Services', icon: Sparkles },
  { key: 'strength-assessment', label: 'Test', icon: Activity },
  { key: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
];

const MobileTabBar = ({ currentPage, onNavigate }: MobileTabBarProps) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden" aria-label="Primary">
      <div className="mx-auto w-full max-w-lg px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
        <div className="grid grid-cols-5 gap-2 rounded-3xl border border-white/10 bg-black/80 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur">
          {tabs.map(({ key, label, icon: Icon }) => {
            const isActive = currentPage === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onNavigate(key)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold transition ${
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? 'text-white' : 'text-white/70'}`} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default MobileTabBar;
