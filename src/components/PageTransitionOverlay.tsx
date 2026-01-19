import React from 'react';

type PageTransitionOverlayProps = {
  isVisible: boolean;
  icon?: React.ReactNode;
  message?: string;
};

const PageTransitionOverlay: React.FC<PageTransitionOverlayProps> = ({ isVisible, icon, message }) => {
  const renderedIcon = icon ?? (
    <img
      src="/logoELA.png"
      alt="Page transition dumbbell"
      className="w-full h-full object-contain"
    />
  );

  return (
    <>
      {/* OPAQUE, NON-ANIMATING RED BACKDROP */}
      <div
        className={`fixed inset-0 z-[60] ${isVisible ? 'block' : 'hidden'}`}
      >
        <div className="absolute inset-0 bg-red-900" />
      </div>

      {/* CONTENT LAYER (can animate) */}
      <div
        className={`fixed inset-0 z-[61] flex items-center justify-center pointer-events-none ${
          isVisible ? 'opacity-100' : 'opacity-0'
        } duration-500 `}
      >
        <div className="relative flex flex-col items-center justify-center space-y-6">
          <div
            className="relative w-32 h-32 sm:w-40 sm:h-56 animate-spin"
            style={{ animationDuration: '3s' }}
          >
            {renderedIcon}
          </div>
          {message && (
            <div className="text-center text-white text-lg sm:text-xl font-semibold tracking-wide uppercase animate-pulse drop-shadow-lg">
              {message}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default PageTransitionOverlay;
