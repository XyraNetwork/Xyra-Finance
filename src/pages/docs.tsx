import React, { useState, useEffect } from 'react';
import type { NextPageWithLayout } from '@/types';
import Layout from '@/layouts/_layout';
import {
  LENDING_POOL_PROGRAM_ID,
  USDC_LENDING_POOL_PROGRAM_ID,
  USAD_LENDING_POOL_PROGRAM_ID,
} from '@/components/aleo/rpc';

const customStyles: Record<string, React.CSSProperties> = {
  glassPanel: {
    background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.4) 0%, rgba(3, 7, 18, 0.6) 100%)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  sidebarLinkActive: {
    color: '#22d3ee',
    background: 'rgba(34, 211, 238, 0.05)',
    borderRight: '2px solid #22d3ee',
  },
  textGradientCyan: {
    background: 'linear-gradient(to right, #22d3ee, #818cf8)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
};

const BookOpenIcon = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>
);

const LayersIcon = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polygon points="12 2 2 7 12 12 22 7 12 2"/>
    <polyline points="2 17 12 22 22 17"/>
    <polyline points="2 12 12 17 22 12"/>
  </svg>
);

const UserIcon = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const CpuIcon = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/>
    <rect x="9" y="9" width="6" height="6"/>
    <line x1="9" y1="1" x2="9" y2="4"/>
    <line x1="15" y1="1" x2="15" y2="4"/>
    <line x1="9" y1="20" x2="9" y2="23"/>
    <line x1="15" y1="20" x2="15" y2="23"/>
    <line x1="20" y1="9" x2="23" y2="9"/>
    <line x1="20" y1="14" x2="23" y2="14"/>
    <line x1="1" y1="9" x2="4" y2="9"/>
    <line x1="1" y1="14" x2="4" y2="14"/>
  </svg>
);

const ShieldIcon = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const CodeIcon = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="16 18 22 12 16 6"/>
    <polyline points="8 6 2 12 8 18"/>
  </svg>
);

const LayoutIcon = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <line x1="3" y1="9" x2="21" y2="9"/>
    <line x1="9" y1="21" x2="9" y2="9"/>
  </svg>
);

const TrendingUpIcon = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
);

const RefreshCwIcon = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="23 4 23 10 17 10"/>
    <polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
);

const Sidebar = ({ activeSection }: { activeSection: string }) => {
  const linkStyle = (id: string) => ({
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    borderRadius: '0.375rem',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    textDecoration: 'none',
    ...(activeSection === id ? customStyles.sidebarLinkActive : { color: '#94a3b8' }),
  });

  return (
    <aside className="w-64 hidden lg:block sticky top-32 pr-4" style={{ height: 'calc(100vh - 160px)', overflowY: 'auto' }}>
      <div className="space-y-8">
        <div>
          <h5 className="text-xs font-bold text-slate-500 uppercase mb-4 tracking-widest font-sans">Guide</h5>
          <nav className="flex flex-col gap-1">
            <a href="#overview" style={linkStyle('overview')}>
              <BookOpenIcon className="w-4 h-4" /> Overview
            </a>
            <a href="#guide-features" style={linkStyle('guide-features')}>
              <LayersIcon className="w-4 h-4" /> What you can do
            </a>
            <a href="#wave-5" style={linkStyle('wave-5')}>
              <TrendingUpIcon className="w-4 h-4" /> Wave 5
            </a>
            <a href="#guide-screens" style={linkStyle('guide-screens')}>
              <LayoutIcon className="w-4 h-4" /> Where things live
            </a>
            <a href="#guide-privacy" style={linkStyle('guide-privacy')}>
              <ShieldIcon className="w-4 h-4" /> Privacy (simple)
            </a>
            <a href="#roadmap" style={linkStyle('roadmap')}>
              <TrendingUpIcon className="w-4 h-4" /> Roadmap
            </a>
          </nav>
        </div>
        <div>
          <h5 className="text-xs font-bold text-slate-500 uppercase mb-4 tracking-widest font-sans">Technical reference</h5>
          <nav className="flex flex-col gap-1">
            <a href="#ref-program" style={linkStyle('ref-program')}>
              <CodeIcon className="w-4 h-4" /> On-chain program
            </a>
            <a href="#ref-wave-5" style={linkStyle('ref-wave-5')}>
              <CpuIcon className="w-4 h-4" /> Wave 5 (build)
            </a>
            <a href="#ref-wallet" style={linkStyle('ref-wallet')}>
              <UserIcon className="w-4 h-4" /> Wallet adapter
            </a>
            <a href="#ref-transactions" style={linkStyle('ref-transactions')}>
              <RefreshCwIcon className="w-4 h-4" /> Transactions
            </a>
            <a href="#supabase" style={linkStyle('supabase')}>
              <LayersIcon className="w-4 h-4" /> Supabase
            </a>
            <a href="#vault" style={linkStyle('vault')}>
              <CpuIcon className="w-4 h-4" /> Vault backend
            </a>
            <a href="#development" style={linkStyle('development')}>
              <TrendingUpIcon className="w-4 h-4" /> Environment
            </a>
          </nav>
        </div>
      </div>
    </aside>
  );
};

const OnThisPage = () => (
  <aside className="w-48 hidden xl:block sticky top-32 h-fit">
    <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4 font-sans">On this page</h5>
    <nav className="flex flex-col gap-2.5 text-xs border-l border-white/5 pl-4 font-sans">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Guide</span>
      <a href="#overview" className="text-slate-400 hover:text-cyan-400 transition-colors pl-2">Overview</a>
      <a href="#guide-features" className="text-slate-400 hover:text-cyan-400 transition-colors pl-2">What you can do</a>
      <a href="#wave-5" className="text-slate-400 hover:text-cyan-400 transition-colors pl-2">Wave 5</a>
      <a href="#guide-screens" className="text-slate-400 hover:text-cyan-400 transition-colors pl-2">Where things live</a>
      <a href="#guide-privacy" className="text-slate-400 hover:text-cyan-400 transition-colors pl-2">Privacy</a>
      <a href="#roadmap" className="text-slate-400 hover:text-cyan-400 transition-colors pl-2">Roadmap</a>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 pt-2">Reference</span>
      <a href="#ref-program" className="text-slate-400 hover:text-cyan-400 transition-colors pl-2">On-chain program</a>
      <a href="#ref-wave-5" className="text-slate-400 hover:text-cyan-400 transition-colors pl-2">Wave 5 (build)</a>
      <a href="#ref-wallet" className="text-slate-400 hover:text-cyan-400 transition-colors pl-2">Wallet</a>
      <a href="#ref-transactions" className="text-slate-400 hover:text-cyan-400 transition-colors pl-2">Transactions</a>
      <a href="#supabase" className="text-slate-400 hover:text-cyan-400 transition-colors pl-2">Supabase</a>
      <a href="#vault" className="text-slate-400 hover:text-cyan-400 transition-colors pl-2">Vault</a>
      <a href="#development" className="text-slate-400 hover:text-cyan-400 transition-colors pl-2">Environment</a>
    </nav>
  </aside>
);

const DocsPage: NextPageWithLayout = () => {
  const [activeSection, setActiveSection] = useState('overview');

  const unifiedPools =
    LENDING_POOL_PROGRAM_ID === USDC_LENDING_POOL_PROGRAM_ID &&
    LENDING_POOL_PROGRAM_ID === USAD_LENDING_POOL_PROGRAM_ID;

  useEffect(() => {
    const handleScroll = () => {
      const sections = [
        'overview',
        'guide-features',
        'wave-5',
        'guide-screens',
        'guide-privacy',
        'roadmap',
        'ref-program',
        'ref-wave-5',
        'ref-wallet',
        'ref-transactions',
        'supabase',
        'vault',
        'development',
      ];
      let current = 'overview';
      sections.forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
          const top = el.getBoundingClientRect().top;
          if (top <= 150) {
            current = id;
          }
        }
      });
      setActiveSection(current);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-20 flex gap-6 lg:gap-12 font-sans text-slate-300 overflow-x-hidden">
      <Sidebar activeSection={activeSection} />
      <main className="flex-1 max-w-4xl min-w-0 px-1 sm:px-0 overflow-x-hidden break-words [overflow-wrap:anywhere] animate-fade-in-up">
        
        <section id="overview" className="scroll-mt-32 mb-20">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-2 py-0.5 rounded font-mono border" style={{ background: 'rgba(6, 182, 212, 0.1)', color: '#22d3ee', fontSize: '0.625rem', borderColor: 'rgba(6, 182, 212, 0.2)' }}>
              WAVE-5 · TESTNET
            </span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold mb-8 text-white">
            Documentation <span style={customStyles.textGradientCyan}>overview</span>
          </h1>
          <div className="p-8 rounded-2xl space-y-8" style={customStyles.glassPanel}>
            <p className="text-lg text-slate-300 leading-relaxed">
              Xyra is a lending-style application on <strong>Aleo testnet</strong>. You connect a wallet, put assets into shared pools to earn yield, borrow against what
              you have supplied, and always see whether your overall position is safe or at risk. Everything runs in one integrated pool that treats{' '}
              <strong>ALEO</strong>, <strong>USDCx</strong>, and <strong>USAD</strong> as separate markets that share one account health picture.
            </p>

            <div>
              <h2 className="text-base font-semibold text-white mb-3">Supported assets</h2>
              <ul className="space-y-3 text-slate-400 leading-relaxed">
                <li>
                  <span className="font-semibold text-slate-300">ALEO</span> — The native token of the Aleo network. You can supply it as collateral, borrow it, or
                  repay with it, like the other markets.
                </li>
                <li>
                  <span className="font-semibold text-slate-300">USDCx</span> — A dollar-style test stablecoin used in this build. Same idea as ALEO: supply, borrow,
                  repay, and withdraw within pool rules.
                </li>
                <li>
                  <span className="font-semibold text-slate-300">USAD</span> — Another test stablecoin market alongside USDCx. Again, you can mix it with your other
                  collateral and debts according to what the dashboard allows.
                </li>
              </ul>
              <p className="text-slate-500 text-sm mt-3 leading-relaxed">
                All three are testnet-only; names sound like production assets but are for experimentation.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold text-white mb-3">Features at a glance</h2>
              <p className="text-slate-400 leading-relaxed mb-4">
                Here is how the main pieces fit together, in everyday terms. The next section, <strong>What you can do</strong>, goes deeper on each one.
              </p>
              <ul className="space-y-3 text-slate-400 leading-relaxed list-disc list-inside marker:text-cyan-500/80">
                <li>
                  <span className="font-semibold text-slate-300">Supply and withdraw</span> — Deposit any supported asset to back your borrowing power, and take
                  collateral back when the pool agrees it is still safe.
                </li>
                <li>
                  <span className="font-semibold text-slate-300">Borrow and repay</span> — Take out a loan in one asset while the app looks at your full mix of
                  collateral and debt; pay down what you owe using tokens you actually hold.
                </li>
                <li>
                  <span className="font-semibold text-slate-300">Markets / pool stats</span> — See how much is deposited, how much is borrowed, and rough yield
                  indicators so you can compare conditions before you act.
                </li>
                <li>
                  <span className="font-semibold text-slate-300">Self-liquidation</span> — If you fall below safe limits, a dedicated flow helps you repay and free
                  collateral yourself instead of waiting for someone else to step in.
                </li>
                <li>
                  <span className="font-semibold text-slate-300">Flash loans</span> — Very short-term borrowing from pool cash: you open a session, receive funds, run
                  your steps, and pay back with a fee in the same asset before moving on.
                </li>
                <li>
                  <span className="font-semibold text-slate-300">Admin</span> — For the operator wallet only: keep prices and risk settings up to date, tune flash
                  rules, and move protocol fees when allowed.
                </li>
              </ul>
            </div>

            <p className="text-slate-400 leading-relaxed border-t border-white/10 pt-6">
              Nothing here is mainnet money—tokens and prices are for testing. The second half of this page is a <strong>technical reference</strong> for developers
              and operators (program layout, RPC, database, env).
            </p>
          </div>
        </section>

        <section id="guide-features" className="scroll-mt-32 mb-20">
          <h2 className="text-3xl font-bold mb-8 flex items-center gap-3 text-white">
            <LayersIcon className="w-8 h-8 text-cyan-400" />
            What you can do
          </h2>
          <div className="p-8 rounded-2xl space-y-10" style={customStyles.glassPanel}>
            <p className="text-slate-400 leading-relaxed">
              Below, each feature is explained the way you would describe it to a friend—no jargon required. All of them apply across{' '}
              <strong className="text-slate-300">ALEO</strong>, <strong className="text-slate-300">USDCx</strong>, and <strong className="text-slate-300">USAD</strong>{' '}
              wherever the app offers that action for the asset.
            </p>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white">Supply and withdraw</h3>
              <p className="text-slate-400 leading-relaxed">
                Supplying means you send tokens into the pool so they can be lent to others. In return you earn a share of the interest borrowers pay, and those
                tokens count as collateral: they increase how much you are allowed to borrow. Withdrawing is the opposite: you take collateral out of the pool. The
                app only allows it if you would still stay within safe limits afterward—if withdrawing would leave you owing too much compared to what you have left,
                you will need to repay debt first or withdraw a smaller amount. You can do this separately for ALEO, USDCx, and USAD from the dashboard.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white">Borrow and repay</h3>
              <p className="text-slate-400 leading-relaxed">
                Borrowing lets you pull tokens out of the pool now and pay them back later with interest. The important idea is that the protocol does not only look at
                one line item: it looks at <em>everything</em> you have supplied and everything you owe across ALEO, USDCx, and USAD, converts that to a common risk
                picture, and decides whether a new loan is safe. Repaying means you send tokens back to reduce what you owe. You might repay using a different asset
                than you borrowed; the app applies your payment to outstanding debt in a set order until your payment is used up or your debt is cleared. That makes
                it easier to fix your position without juggling many manual steps.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white">See pool stats (Markets)</h3>
              <p className="text-slate-400 leading-relaxed">
                The Markets view is your bird&apos;s-eye view of the pool. You can see how large each reserve is, how much of it is already borrowed, and rough
                earning and borrowing cost indicators (often summarized as APY-style numbers). None of this replaces your own judgment, but it helps you understand
                whether a market is quiet or busy before you supply or borrow a large amount.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white">Self-liquidate (Liquidation page)</h3>
              <p className="text-slate-400 leading-relaxed">
                Sometimes the value of your collateral falls or your debt grows so that you are no longer within the protocol&apos;s safety rules. When that happens,
                you are &quot;underwater&quot; or liquidatable. The Liquidation section is there so <em>you</em> can fix the situation: pay back part or all of your debt
                and reclaim collateral according to the rules, instead of waiting for a third party. In this testnet build you act as your own liquidator; there is no
                separate liquidator marketplace in the UI yet. The page also shows a preview so you understand the outcome before you confirm in your wallet.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white">Flash loan (advanced)</h3>
              <p className="text-slate-400 leading-relaxed">
                A flash loan is a loan that must be opened and closed in a tight sequence: you request a session for a chosen asset (ALEO, USDCx, or USAD), the pool
                reserves liquidity for you, and a backend vault sends that asset to your wallet so you can use it immediately. You then complete a separate
                &quot;settle&quot; step where you pay back at least the borrowed amount plus the fee the pool requires, and optionally satisfy any minimum-profit rule
                you set when you opened. Until you settle, you typically cannot start another flash session. This pattern is aimed at developers and power users who
                want liquidity for a single coordinated strategy, not for long-term borrowing—that is what the normal borrow flow is for.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white">Admin (operators only)</h3>
              <p className="text-slate-400 leading-relaxed">
                Most users never need this. The Admin page is only for a wallet that has been configured as the protocol operator. From there that wallet can perform
                housekeeping: set or refresh asset prices so risk math stays realistic, trigger interest accrual, adjust safety parameters such as how much people can
                borrow against collateral, turn flash loans on or off per asset and set caps and fees, allow or block specific strategy identifiers for flash loans,
                and withdraw accumulated protocol fees when permitted. If your address is not the designated admin, the page will simply tell you access is restricted.
              </p>
            </div>
          </div>
        </section>

        <section id="wave-5" className="scroll-mt-32 mb-20">
          <h2 className="text-3xl font-bold mb-8 flex items-center gap-3 text-white">
            <TrendingUpIcon className="w-8 h-8 text-cyan-400" />
            What shipped in Wave 5
          </h2>
          <div className="p-8 rounded-2xl space-y-4" style={customStyles.glassPanel}>
            <p className="text-slate-400 leading-relaxed mb-4">
              Wave 5 is the release that made the product easier to trust and operate: numbers on screen follow the same rules as the chain, risky positions get a
              dedicated flow, flash liquidity works across assets, and admins have one place to tune the pool.
            </p>
            <ul className="space-y-4 text-slate-300 leading-relaxed">
              <li>
                <span className="font-semibold text-white">Portfolio you can rely on</span>
                <span className="text-slate-400"> — Collateral, debt, health, and limits are derived from your on-chain position together with live pool parameters (indices and prices), not from a simplified copy that could drift.</span>
              </li>
              <li>
                <span className="font-semibold text-white">Liquidation page</span>
                <span className="text-slate-400"> — Clear read on whether you are liquidatable, a preview before you sign, and history styled like the rest of the app.</span>
              </li>
              <li>
                <span className="font-semibold text-white">Flash loans for all three assets</span>
                <span className="text-slate-400"> — Open and settle for ALEO, USDCx, or USAD; the vault sends the funded asset; history shows open, fund, and settle steps.</span>
              </li>
              <li>
                <span className="font-semibold text-white">Admin console</span>
                <span className="text-slate-400"> — One screen for initialization, oracle prices, interest accrual, risk and rate parameters, flash policy, and protocol fee withdrawal.</span>
              </li>
            </ul>
          </div>
        </section>

        <section id="guide-screens" className="scroll-mt-32 mb-20">
          <h2 className="text-3xl font-bold mb-8 flex items-center gap-3 text-white">
            <LayoutIcon className="w-8 h-8 text-cyan-400" />
            Where things live
          </h2>
          <div className="p-8 rounded-2xl space-y-6" style={customStyles.glassPanel}>
            <dl className="space-y-5 text-sm">
              <div>
                <dt className="font-semibold text-white mb-1">Dashboard</dt>
                <dd className="text-slate-400 leading-relaxed">Your portfolio summary, health factor, and per-asset actions (supply, withdraw, borrow, repay).</dd>
              </div>
              <div>
                <dt className="font-semibold text-white mb-1">Markets</dt>
                <dd className="text-slate-400 leading-relaxed">Pool-level statistics and utilization—useful before you size a trade.</dd>
              </div>
              <div>
                <dt className="font-semibold text-white mb-1">Liquidation</dt>
                <dd className="text-slate-400 leading-relaxed">When debt outweighs allowed collateral, use this flow to self-liquidate and see past activity.</dd>
              </div>
              <div>
                <dt className="font-semibold text-white mb-1">Flash Loan</dt>
                <dd className="text-slate-400 leading-relaxed">Open a flash session, settle it, and review session history (open → vault fund → settle).</dd>
              </div>
              <div>
                <dt className="font-semibold text-white mb-1">Docs</dt>
                <dd className="text-slate-400 leading-relaxed">This page—user-oriented guide first, technical reference below.</dd>
              </div>
              <div>
                <dt className="font-semibold text-white mb-1">Admin</dt>
                <dd className="text-slate-400 leading-relaxed">Separate route for the operator wallet only; not part of the main borrower experience.</dd>
              </div>
            </dl>
          </div>
        </section>

        <section id="guide-privacy" className="scroll-mt-32 mb-20">
          <h2 className="text-3xl font-bold mb-8 flex items-center gap-3 text-white">
            <ShieldIcon className="w-8 h-8 text-cyan-400" />
            Privacy (plain language)
          </h2>
          <div className="p-8 rounded-2xl space-y-4" style={customStyles.glassPanel}>
            <p className="text-slate-300 leading-relaxed">
              Aleo emphasizes <strong>private state</strong>: your balances and position details are carried in encrypted records that only you (and the programs you
              authorize) can use. The interface marks sensitive columns and actions so you know you are signing a private transaction.
            </p>
            <p className="text-slate-400 leading-relaxed">
              The app avoids writing secret values to the browser console in normal use. For local debugging only, set{' '}
              <span className="font-mono text-cyan-400 text-sm">NEXT_PUBLIC_DEBUG_PRIVACY=true</span> (see Environment in the technical reference below).
            </p>
            <p className="text-slate-400 leading-relaxed text-sm border-t border-white/10 pt-4">
              What appears on-chain publicly still depends on each transition&apos;s design (the deployed ABI). The guide above stays non-technical; precise public vs
              private fields are listed in the program build output.
            </p>
          </div>
        </section>

        <section id="roadmap" className="scroll-mt-32 mb-20">
          <h2 className="text-3xl font-bold mb-8 flex items-center gap-3 text-white">
            <TrendingUpIcon className="w-8 h-8 text-indigo-400" />
            Roadmap
          </h2>
          <div className="p-8 rounded-2xl space-y-4" style={customStyles.glassPanel}>
            <ul className="space-y-3 text-slate-300 leading-relaxed">
              <li><span className="font-semibold text-white">Done (Wave 5):</span> mapping-aligned portfolio, liquidation UX, multi-asset flash loans with vault funding, admin console, Supabase flash session rows.</li>
              <li><span className="font-semibold text-white">Optional UI:</span> private-record migration skeleton (gated env flag)—does not replace core lending flows.</li>
              <li><span className="font-semibold text-white">Next directions:</span> third-party liquidators, stronger oracles, governance, more assets, mainnet hardening.</li>
            </ul>
          </div>
        </section>

        <div className="mb-16 pt-4 border-t border-white/10">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Technical reference</p>
          <p className="text-sm text-slate-500">For engineers and operators. File paths, transition names, and env vars.</p>
        </div>

        <section id="ref-program" className="scroll-mt-32 mb-20">
          <h2 className="text-3xl font-bold mb-8 flex items-center gap-3 text-white">
            <CodeIcon className="w-8 h-8 text-purple-400" />
            On-chain program
          </h2>
          <div className="p-8 rounded-2xl space-y-4" style={customStyles.glassPanel}>
            <ul className="list-disc list-inside space-y-2 text-sm text-slate-400">
              <li><span className="font-semibold text-white">Source:</span> <span className="font-mono text-purple-300">program/src/main.leo</span></li>
              <li><span className="font-semibold text-white">Build name:</span> <span className="font-mono text-purple-300">program/build/program.json</span> (e.g. <span className="font-mono text-purple-300">xyra_lending_v32.aleo</span> at time of writing)</li>
              <li><span className="font-semibold text-white">Wallet target:</span> <span className="font-mono text-purple-300 break-all">{LENDING_POOL_PROGRAM_ID}</span> from <span className="font-mono text-purple-300">NEXT_PUBLIC_LENDING_POOL_PROGRAM_ID</span></li>
              <li>One program, three reserves (asset ids <span className="font-mono text-purple-300">0field</span> / <span className="font-mono text-purple-300">1field</span> / <span className="font-mono text-purple-300">2field</span>): per-asset indices, utilization, fees, LTV, liquidation params, <span className="font-mono text-purple-300">asset_price</span> for USD-normalized risk.</li>
              <li>User state: private <span className="font-mono text-purple-300">LendingPosition</span> record; pool totals and indices in mappings.</li>
              <li>Flash: mappings such as <span className="font-mono text-purple-300">flash_active</span>, <span className="font-mono text-purple-300">flash_asset</span>, premium / max params.</li>
            </ul>
            <div className="mt-4 p-4 rounded-xl bg-black/20 text-sm font-mono text-slate-300">
              <span className="text-white">Env program slots</span>
              <ul className="list-disc list-inside mt-2 space-y-1 ml-4 text-xs break-all">
                <li>Primary: {LENDING_POOL_PROGRAM_ID}</li>
                <li>USDCx: {USDC_LENDING_POOL_PROGRAM_ID}</li>
                <li>USAD: {USAD_LENDING_POOL_PROGRAM_ID}</li>
              </ul>
            </div>
            {unifiedPools ? (
              <p className="text-xs text-slate-500 italic">Unified deployment: all three env vars match.</p>
            ) : (
              <p className="text-xs text-slate-500 italic">Split deployment: slot env vars may differ from primary.</p>
            )}
          </div>
        </section>

        <section id="ref-wave-5" className="scroll-mt-32 mb-20">
          <h2 className="text-3xl font-bold mb-8 flex items-center gap-3 text-white">
            <CpuIcon className="w-8 h-8 text-violet-400" />
            Wave 5 — implementation
          </h2>
          <div className="p-8 rounded-2xl space-y-8" style={customStyles.glassPanel}>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Portfolio reads (positions + mappings)</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                <span className="font-mono text-cyan-300">src/components/aleo/rpc.ts</span> decrypts or resolves the user&apos;s <span className="font-mono text-cyan-300">LendingPosition</span> and
                combines it with mapping reads (<span className="font-mono text-cyan-300">supply_index</span>, <span className="font-mono text-cyan-300">borrow_index</span>,{' '}
                <span className="font-mono text-cyan-300">asset_price</span>, LTV, etc.) so UI collateral, debt, health, caps, and liquidation preview match{' '}
                <span className="font-mono text-cyan-300">finalize_borrow</span>, <span className="font-mono text-cyan-300">finalize_withdraw</span>,{' '}
                <span className="font-mono text-cyan-300">finalize_repay_any</span>. New users: <span className="font-mono text-cyan-300">open_lending_account</span>.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Liquidation</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Transition <span className="font-mono text-cyan-300">self_liquidate_and_payout</span>. Dashboard liquidation view:{' '}
                <span className="font-mono text-cyan-300">src/pages/dashboard.tsx</span> (liquidation tab). Preview via{' '}
                <span className="font-mono text-cyan-300">getLiquidationPreviewAleo</span>—health / liquidatable computed even when repay input is empty.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Flash loans</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-2">
                <span className="font-mono text-cyan-300">flash_open</span> → vault funds session →{' '}
                <span className="font-mono text-cyan-300">flash_settle_with_credits</span> | <span className="font-mono text-cyan-300">flash_settle_with_usdcx</span> |{' '}
                <span className="font-mono text-cyan-300">flash_settle_with_usad</span>. Admin: <span className="font-mono text-cyan-300">set_flash_params</span>,{' '}
                <span className="font-mono text-cyan-300">set_flash_strategy_allowed</span>.
              </p>
              <p className="text-sm text-slate-400 leading-relaxed">
                Backend: <span className="font-mono text-cyan-300">POST /flash/fund-session</span> + watcher calls the same withdrawal paths as borrow payout, selected by{' '}
                <span className="font-mono text-cyan-300">asset_id</span> (<span className="font-mono text-cyan-300">backend/src/server.js</span>).
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Admin</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                <span className="font-mono text-cyan-300">/admin</span> → <span className="font-mono text-cyan-300">src/components/AdminView.tsx</span>. Gate:{' '}
                <span className="font-mono text-cyan-300">NEXT_PUBLIC_LENDING_ADMIN_ADDRESS</span>. Actions: initialize, <span className="font-mono text-cyan-300">set_asset_price</span>,{' '}
                <span className="font-mono text-cyan-300">accrue_interest</span>, <span className="font-mono text-cyan-300">set_asset_params</span>, flash admin transitions,{' '}
                <span className="font-mono text-cyan-300">withdraw_fees</span>.
              </p>
            </div>
          </div>
        </section>

        <section id="ref-wallet" className="scroll-mt-32 mb-20">
          <h2 className="text-3xl font-bold mb-8 flex items-center gap-3 text-white">
            <UserIcon className="w-8 h-8 text-indigo-400" />
            Wallet adapter
          </h2>
          <div className="p-8 rounded-2xl" style={customStyles.glassPanel}>
            <ul className="list-disc list-inside space-y-2 text-sm text-slate-400">
              <li>Packages: <span className="font-mono text-indigo-300">@provablehq/aleo-wallet-adaptor-react</span>, UI button component from the same stack.</li>
              <li>Program allowlist: <span className="font-mono text-indigo-300">getWalletConnectProgramIds()</span> in <span className="font-mono text-indigo-300">src/types/index.ts</span> (deduped).</li>
              <li><span className="font-mono text-indigo-300">decryptPermission</span> where supported; <span className="font-mono text-indigo-300">address</span> drives RPC + history.</li>
              <li><span className="font-mono text-indigo-300">WalletPersistence</span> (sessionStorage) keeps connection across Dashboard / Markets / Docs.</li>
            </ul>
          </div>
        </section>

        <section id="ref-transactions" className="scroll-mt-32 mb-20">
          <h2 className="text-3xl font-bold mb-8 flex items-center gap-3 text-white">
            <RefreshCwIcon className="w-8 h-8 text-indigo-400" />
            Transactions
          </h2>
          <div className="p-8 rounded-2xl" style={customStyles.glassPanel}>
            <ol className="list-decimal list-inside space-y-2 text-sm text-slate-400">
              <li>User action → <span className="font-mono text-indigo-300">rpc.ts</span> builds inputs from the deployed ABI.</li>
              <li><span className="font-mono text-indigo-300">executeTransaction</span> — use plain Leo literals; visibility comes from the ABI (do not suffix <span className="font-mono text-indigo-300">.private</span> in JS).</li>
              <li>Poll <span className="font-mono text-indigo-300">transactionStatus</span>; then explorer links + Supabase rows.</li>
              <li>Borrow / withdraw: watcher completes vault payout; second link in history when vault tx exists.</li>
              <li>Flash: after open finalizes, backend funds; user settles; <span className="font-mono text-indigo-300">flash_sessions</span> updated.</li>
            </ol>
          </div>
        </section>

        <section id="supabase" className="scroll-mt-32 mb-20">
          <h2 className="text-3xl font-bold mb-8 flex items-center gap-3 text-white">
            <LayersIcon className="w-8 h-8 text-purple-400" />
            Supabase
          </h2>
          <div className="p-8 rounded-2xl" style={customStyles.glassPanel}>
             <h3 className="font-semibold text-white mb-2">Schema (Summary)</h3>
             <p className="text-sm text-slate-400 mb-2">Table <span className="font-mono text-purple-400">transaction_history</span> key columns:</p>
             <ul className="list-disc list-inside space-y-1 mb-4 text-sm text-slate-400">
                <li><span className="font-mono">wallet_address</span> — Aleo address.</li>
                <li><span className="font-mono">tx_id</span> — main pool transaction hash.</li>
                <li><span className="font-mono">type</span> — deposit | withdraw | borrow | repay | flash_loan | self_liquidate_payout | … (as recorded by the app).</li>
                <li><span className="font-mono">asset</span> — aleo, usdcx, or usad.</li>
                <li><span className="font-mono">vault_tx_id</span> — when vault payout completes.</li>
          </ul>
             <h3 className="font-semibold text-white mb-2 mt-6">Flash sessions</h3>
             <p className="text-sm text-slate-400 mb-2">Table <span className="font-mono text-purple-400">flash_sessions</span> (see <span className="font-mono text-purple-400">supabase/FLASH_SESSIONS_SCHEMA.sql</span>) stores:</p>
             <ul className="list-disc list-inside space-y-1 text-sm text-slate-400">
                <li><span className="font-mono">user_address</span>, <span className="font-mono">strategy_wallet</span>, <span className="font-mono">asset_id</span> (<span className="font-mono">0field|1field|2field</span>).</li>
                <li><span className="font-mono">principal_micro</span>, <span className="font-mono">min_profit_micro</span>, <span className="font-mono">strategy_id_field</span>.</li>
                <li><span className="font-mono">flash_open_tx_id</span>, <span className="font-mono">vault_fund_tx_id</span>, <span className="font-mono">flash_settle_tx_id</span>, <span className="font-mono">status</span>, timestamps.</li>
             </ul>
             <h3 className="font-semibold text-white mb-2">Environment</h3>
             <ul className="list-disc list-inside space-y-1 text-sm text-slate-400">
                <li><span className="font-mono">NEXT_PUBLIC_SUPABASE_URL</span></li>
                <li><span className="font-mono">NEXT_PUBLIC_SUPABASE_PUB_KEY</span></li>
          </ul>
        </div>
      </section>

        <section id="vault" className="scroll-mt-32 mb-20">
          <h2 className="text-3xl font-bold mb-8 flex items-center gap-3 text-white">
            <CpuIcon className="w-8 h-8 text-cyan-400" />
            Vault backend
          </h2>
          <div className="p-8 rounded-2xl space-y-4" style={customStyles.glassPanel}>
            <p className="text-sm text-slate-400">The Node server in <span className="font-mono text-cyan-400">backend/</span> holds the vault wallet and sends user payouts from on-chain programs after the pool records the borrow/withdraw intent.</p>
            <ul className="list-disc list-inside space-y-2 text-sm text-slate-400">
               <li><span className="font-semibold text-white">Vault transfers</span> for supported asset types (ALEO credits, USDCx, USAD) after finalized borrow / withdraw / flash-fund requests.</li>
               <li><span className="font-semibold text-white">Flash funding</span> — <span className="font-mono text-cyan-400">POST /flash/fund-session</span> and the flash funding watcher route to the same withdrawal helpers as borrow payout, keyed by session <span className="font-mono text-cyan-400">asset_id</span>.</li>
               <li><span className="font-semibold text-white">GET /vault-balances</span> — public vault balances per token program.</li>
               <li><span className="font-semibold text-white">Vault watcher</span> — polls Supabase for rows needing a vault tx.</li>
               <li><span className="font-semibold text-white">Optional oracle</span> — backend can poll spot prices and broadcast <span className="font-mono text-cyan-400">set_asset_price</span>.</li>
          </ul>
             <p className="text-xs text-slate-500 mt-2">Configure NEXT_PUBLIC_BACKEND_URL on the frontend and CORS_ORIGIN / vault env vars in backend/.env.</p>
        </div>
      </section>

        <section id="development" className="scroll-mt-32 mb-20">
          <h2 className="text-3xl font-bold mb-8 flex items-center gap-3 text-white">
            <TrendingUpIcon className="w-8 h-8 text-indigo-400" />
            Environment
          </h2>
          <div className="p-8 rounded-2xl" style={customStyles.glassPanel}>
             <ul className="list-disc list-inside space-y-2 text-sm text-slate-400">
               <li><span className="font-semibold text-white">Pool program:</span> <span className="font-mono text-cyan-400">NEXT_PUBLIC_LENDING_POOL_PROGRAM_ID</span> (optional split slots: <span className="font-mono text-cyan-400">NEXT_PUBLIC_USDC_LENDING_POOL_PROGRAM_ID</span>, <span className="font-mono text-cyan-400">NEXT_PUBLIC_USAD_LENDING_POOL_PROGRAM_ID</span> — see <span className="font-mono text-cyan-400">src/types/index.ts</span> and <span className="font-mono text-cyan-400">rpc.ts</span>).</li>
               <li><span className="font-semibold text-white">Admin access:</span> <span className="font-mono text-cyan-400">NEXT_PUBLIC_LENDING_ADMIN_ADDRESS</span> must match the connected wallet on <span className="font-mono text-cyan-400">/admin</span>.</li>
               <li><span className="font-mono text-cyan-400">NEXT_PUBLIC_APP_ENV</span> toggles minor UX (e.g. status message timing).</li>
               <li><span className="font-mono text-cyan-400">NEXT_PUBLIC_DEBUG_PRIVACY</span> — set to <span className="font-mono text-cyan-400">true</span> only for local debugging of RPC / record flows.</li>
               <li>Next.js Pages router, Tailwind, layout in <span className="font-mono text-cyan-400">layouts/_layout.tsx</span>.</li>
               <li>All integrations target Aleo testnet unless changed.</li>
          </ul>
             <p className="text-xs text-slate-500 mt-4 pt-4 border-t border-white/10">Implementation entry points: <span className="font-mono text-cyan-400">src/pages/dashboard.tsx</span>, <span className="font-mono text-cyan-400">src/pages/admin.tsx</span>, <span className="font-mono text-cyan-400">src/components/AdminView.tsx</span>, <span className="font-mono text-cyan-400">src/components/aleo/rpc.ts</span>, <span className="font-mono text-cyan-400">backend/src/server.js</span>, <span className="font-mono text-cyan-400">supabase/schema.sql</span>, <span className="font-mono text-cyan-400">supabase/FLASH_SESSIONS_SCHEMA.sql</span>.</p>
        </div>
      </section>

      </main>
      <OnThisPage />
    </div>
  );
};

DocsPage.getLayout = function getLayout(page: React.ReactElement) {
  return <Layout>{page}</Layout>;
};

export default DocsPage;
