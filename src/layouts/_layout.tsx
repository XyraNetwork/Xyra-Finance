'use client';

import { useWindowScroll } from '@/hooks/use-window-scroll';
import { useIsMounted } from '@/hooks/use-is-mounted';
import React, { useState, useEffect } from 'react';
import { WalletMultiButton } from '@provablehq/aleo-wallet-adaptor-react-ui';
import { useRouter } from 'next/router';
import { HomeIcon } from '@/components/icons/home';
import { Twitter } from '@/components/icons/twitter';
import { Discord } from '@/components/icons/discord';
import { useTheme } from 'next-themes';
import Footer from '@/components/ui/Footer';

// ThemeSelector: simple light/dark toggle buttons using next-themes
function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  // Use a mount flag to avoid SSR mismatch
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const current = theme === 'light' ? 'light' : 'dark';

  return (
    <div className="inline-flex items-center rounded-full bg-base-200 p-1 text-[11px]">
      <button
        type="button"
        onClick={() => setTheme('light')}
        className={`px-3 py-1 rounded-full transition ${
          current === 'light' ? 'bg-base-100 text-primary font-semibold' : 'text-base-content/70'
        }`}
      >
        Light
      </button>
      <button
        type="button"
        onClick={() => setTheme('dark')}
        className={`px-3 py-1 rounded-full transition ${
          current === 'dark' ? 'bg-base-100 text-primary font-semibold' : 'text-base-content/70'
        }`}
      >
        Dark
      </button>
    </div>
  );
}

function HeaderRightArea() {
  const router = useRouter();
  const isLanding = router.pathname === '/';

  return (
    <div className="relative order-last flex shrink-0 items-center gap-3 sm:gap-6 lg:gap-8 btn-primary-content text-primary">
      {/* Use the updated ThemeSelector */}
      <ThemeSelector />
      {!isLanding && (
        <div
          style={{
            position: 'relative',
            zIndex: 9999,
            pointerEvents: 'auto',
            cursor: 'pointer',
          }}
          className="wallet-button-wrapper"
        >
          <WalletMultiButton />
        </div>
      )}
    </div>
  );
}

export function Header() {
  const windowScroll = useWindowScroll();
  const isMounted = useIsMounted();

  return (
    <nav
      className={`fixed top-0 z-30 w-full bg-base-200 transition-all duration-300 ${
        isMounted && windowScroll.y > 10 ? 'shadow-card backdrop-blur' : ''
      }`}
      style={{ zIndex: 30 }}
    >
      <div className="flex flex-wrap items-center justify-between px-8 py-8 sm:px-6 lg:px-8 xl:px-10 3xl:px-12">
        <div className="flex items-center space-x-3">
          <img
            src="https://www.xyra.network/_next/image?url=%2Fassets%2Flogo.png&w=128&q=75"
            alt="Xyra Finance"
            className="h-8 w-auto"
          />
          <div className="flex flex-col">
            <span className="text-xs font-semibold tracking-[0.18em] uppercase text-base-content/70">
              Xyra Finance
            </span>
            <span className="text-[10px] text-base-content/70">
              Private Lending &amp; Borrowing Protocol on Aleo
            </span>
            <span className="hidden sm:block text-[10px] text-base-content/60">
              Over-collateralized multi-asset money market on Aleo Testnet.
            </span>
          </div>
        </div>
        {/* Added a wrapper div with margin-left to create more space */}
        <div className="ml-2 mt-2">
          <HeaderRightArea />
        </div>
      </div>
      
    </nav>
  );
  
  
  
}

interface LayoutProps {}

export default function Layout({
  children,
}: React.PropsWithChildren<LayoutProps>) {
  return (
    // Use DaisyUI tokens for the background and text color
    <div className="bg-base-100 text-base-content flex min-h-screen flex-col">
      <Header />
      <main className="mb-12 flex flex-grow flex-col pt-4 sm:pt-12 bg-primary">
        {children}
      </main>
      <Footer />
    </div>
  );
}
