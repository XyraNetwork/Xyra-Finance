'use client';

import { useState } from 'react';
import cn from 'classnames';
import { useWindowScroll } from '@/hooks/use-window-scroll';

import { useIsMounted } from '@/hooks/use-is-mounted';


import React, { FC, useMemo } from 'react';
import { WalletMultiButton } from '@provablehq/aleo-wallet-adaptor-react-ui';

function HeaderRightArea() {
  return (
    <div className="relative order-last flex shrink-0 items-center gap-3 sm:gap-6 lg:gap-8">
      <div 
        style={{ 
          position: 'relative', 
          zIndex: 9999, 
          pointerEvents: 'auto',
          cursor: 'pointer'
        }}
        className="wallet-button-wrapper"
      >
        <WalletMultiButton className="bg-[#1253fa]" />
      </div>
    </div>
  );
}

export function Header() {
  
  const isMounted = useIsMounted();
  let windowScroll = useWindowScroll();
  let [isOpen, setIsOpen] = useState(false);

  return (
    <nav
      className={`fixed top-0 z-30 w-full transition-all duration-300 ltr:right-0 rtl:left-0 ${
        isMounted && windowScroll.y > 10
          ? 'h-16 bg-gradient-to-b from-white to-white/80 shadow-card backdrop-blur dark:from-dark dark:to-dark/80 sm:h-20'
          : 'h-16 sm:h-24'
      }`}
      style={{ zIndex: 30 }}
    >
      <div className="flex h-full items-center justify-between px-4 sm:px-6 lg:px-8 xl:px-10 3xl:px-12">
        <div className="flex items-center">
          <div className="block ltr:mr-1 rtl:ml-1 ltr:sm:mr-3 rtl:sm:ml-3 xl:hidden">

          </div>
        </div>

        <HeaderRightArea />
      </div>
    </nav>
  );
}

interface DashboardLayoutProps {
  contentClassName?: string;
}

export default function Layout({
  children,
  contentClassName,
}: React.PropsWithChildren<DashboardLayoutProps>) {
  return (
    <div className="w-full">
      <Header />
      
      <main
        className={cn(
          'min-h-[100vh] px-4 pt-24 pb-16 sm:px-6 sm:pb-20 lg:px-8 xl:px-10 xl:pb-24 3xl:px-12',
          contentClassName
        )}
      >
        {children}
      </main>
    </div>
  );
}
