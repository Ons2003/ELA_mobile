import React from 'react';
import { BarChart3, CalendarDays, MessageCircle, Settings, Stethoscope, Tag } from 'lucide-react';

type DashboardTabBarProps = {
  currentPage: string;
  onNavigate: (page: string) => void;
};

const dashboardTabs = [
  { key: 'dashboard-calendar', label: 'Calendar', icon: CalendarDays },
  { key: 'dashboard-progress', label: 'Progress', icon: BarChart3 },
  { key: 'dashboard-messages', label: 'Messages', icon: MessageCircle },
  { key: 'dashboard-physician', label: 'Physician', icon: Stethoscope },
  { key: 'dashboard-discounts', label: 'Discounts', icon: Tag },
  { key: 'dashboard-settings', label: 'Settings', icon: Settings },
];

const DashboardTabBar = ({ currentPage, onNavigate }: DashboardTabBarProps) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden" aria-label="Dashboard">
      <div className="mx-auto w-full max-w-md px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
        <div className="grid grid-cols-6 gap-2 rounded-3xl border border-gray-200 bg-white/95 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.15)] backdrop-blur">
          {dashboardTabs.map(({ key, label, icon: Icon }) => {
            const isActive = currentPage === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onNavigate(key)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center justify-center rounded-2xl px-2 py-2 transition ${
                  isActive ? 'bg-red-50 text-red-600' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="sr-only">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default DashboardTabBar;
