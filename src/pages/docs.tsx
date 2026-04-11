import React, { useState, useEffect, useRef } from 'react';
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
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);

const LayersIcon = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

const UserIcon = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const CpuIcon = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
    <rect x="9" y="9" width="6" height="6" />
    <line x1="9" y1="1" x2="9" y2="4" />
    <line x1="15" y1="1" x2="15" y2="4" />
    <line x1="9" y1="20" x2="9" y2="23" />
    <line x1="15" y1="20" x2="15" y2="23" />
    <line x1="20" y1="9" x2="23" y2="9" />
    <line x1="20" y1="14" x2="23" y2="14" />
    <line x1="1" y1="9" x2="4" y2="9" />
    <line x1="1" y1="14" x2="4" y2="14" />
  </svg>
);

const ShieldIcon = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const CodeIcon = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

const LayoutIcon = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="9" y1="21" x2="9" y2="9" />
  </svg>
);

const TrendingUpIcon = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const RefreshCwIcon = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const ZapIcon = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

type NavLinkProps = { id: string; label: string; icon?: React.ReactNode; activeSection: string };

const NavLink = ({ id, label, icon, activeSection }: NavLinkProps) => {
  const isActive = activeSection === id;
  const style: React.CSSProperties = {
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    borderRadius: '0.375rem',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    textDecoration: 'none',
    ...(isActive ? customStyles.sidebarLinkActive : { color: '#94a3b8' }),
  };
  return (
    <a href={`#${id}`} data-nav-id={id} style={style}>
      {icon}
      {label}
    </a>
  );
};

const Sidebar = ({
  activeSection,
  scrollRootRef,
}: {
  activeSection: string;
  scrollRootRef: React.RefObject<HTMLDivElement | null>;
}) => (
  <aside
    ref={scrollRootRef}
    className="w-64 shrink-0 self-start hidden lg:block lg:sticky lg:top-32 lg:z-10 pr-2 pb-2 max-h-[calc(100dvh-9rem)] overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable]"
  >
    <div className="space-y-6 pr-2 pb-6">
      <div>
        <h5 className="text-xs font-bold text-slate-500 uppercase mb-3 tracking-widest font-sans">Introduction</h5>
        <nav className="flex flex-col gap-1">
          <NavLink id="intro-overview" label="Overview" icon={<BookOpenIcon className="w-4 h-4 shrink-0" />} activeSection={activeSection} />
          <NavLink id="xyra-101" label="Xyra 101" icon={<BookOpenIcon className="w-4 h-4 shrink-0" />} activeSection={activeSection} />
        </nav>
      </div>
      <div>
        <h5 className="text-xs font-bold text-slate-500 uppercase mb-3 tracking-widest font-sans">Liquidity model</h5>
        <nav className="flex flex-col gap-1">
          <NavLink id="liquidity-model" label="Pool & reserves" icon={<LayersIcon className="w-4 h-4 shrink-0" />} activeSection={activeSection} />
        </nav>
      </div>
      <div>
        <h5 className="text-xs font-bold text-slate-500 uppercase mb-3 tracking-widest font-sans">User positions</h5>
        <nav className="flex flex-col gap-1">
          <NavLink id="user-supply" label="Supply assets" icon={<TrendingUpIcon className="w-4 h-4 shrink-0" />} activeSection={activeSection} />
          <NavLink id="user-borrow" label="Borrow assets" icon={<TrendingUpIcon className="w-4 h-4 shrink-0" />} activeSection={activeSection} />
          <NavLink id="user-withdraw" label="Withdraw" icon={<RefreshCwIcon className="w-4 h-4 shrink-0" />} activeSection={activeSection} />
          <NavLink id="user-repay" label="Repay" icon={<RefreshCwIcon className="w-4 h-4 shrink-0" />} activeSection={activeSection} />
          <NavLink id="user-markets" label="Markets & rates" icon={<LayersIcon className="w-4 h-4 shrink-0" />} activeSection={activeSection} />
          <NavLink id="user-liquidation" label="Liquidations" icon={<ShieldIcon className="w-4 h-4 shrink-0" />} activeSection={activeSection} />
          <NavLink id="user-flash" label="Flash loans" icon={<ZapIcon className="w-4 h-4 shrink-0" />} activeSection={activeSection} />
          <NavLink id="user-admin" label="Protocol admin" icon={<CpuIcon className="w-4 h-4 shrink-0" />} activeSection={activeSection} />
        </nav>
      </div>
      <div>
        <h5 className="text-xs font-bold text-slate-500 uppercase mb-3 tracking-widest font-sans">Tools</h5>
        <nav className="flex flex-col gap-1">
          <NavLink id="app-navigation" label="Using the app" icon={<LayoutIcon className="w-4 h-4 shrink-0" />} activeSection={activeSection} />
        </nav>
      </div>
      <div>
        <h5 className="text-xs font-bold text-slate-500 uppercase mb-3 tracking-widest font-sans">Safety</h5>
        <nav className="flex flex-col gap-1">
          <NavLink id="safety-privacy" label="Risks & privacy" icon={<ShieldIcon className="w-4 h-4 shrink-0" />} activeSection={activeSection} />
        </nav>
      </div>
      <div>
        <h5 className="text-xs font-bold text-slate-500 uppercase mb-3 tracking-widest font-sans">Changelog</h5>
        <nav className="flex flex-col gap-1">
          <NavLink id="release-wave5" label="Wave 5" icon={<TrendingUpIcon className="w-4 h-4 shrink-0" />} activeSection={activeSection} />
          <NavLink id="roadmap" label="Roadmap" icon={<TrendingUpIcon className="w-4 h-4 shrink-0" />} activeSection={activeSection} />
        </nav>
      </div>
      <div>
        <h5 className="text-xs font-bold text-slate-500 uppercase mb-3 tracking-widest font-sans">Integrate</h5>
        <nav className="flex flex-col gap-1">
          <NavLink id="integrate" label="Quickstart" icon={<CodeIcon className="w-4 h-4 shrink-0" />} activeSection={activeSection} />
        </nav>
      </div>
      <div>
        <h5 className="text-xs font-bold text-slate-500 uppercase mb-3 tracking-widest font-sans">Reference</h5>
        <nav className="flex flex-col gap-1">
          <NavLink id="ref-program" label="On-chain program" icon={<CodeIcon className="w-4 h-4 shrink-0" />} activeSection={activeSection} />
          <NavLink id="ref-wave-5" label="Implementation" icon={<CpuIcon className="w-4 h-4 shrink-0" />} activeSection={activeSection} />
          <NavLink id="ref-wallet" label="Wallet" icon={<UserIcon className="w-4 h-4 shrink-0" />} activeSection={activeSection} />
          <NavLink id="ref-transactions" label="Transactions" icon={<RefreshCwIcon className="w-4 h-4 shrink-0" />} activeSection={activeSection} />
          <NavLink id="supabase" label="Supabase" icon={<LayersIcon className="w-4 h-4 shrink-0" />} activeSection={activeSection} />
          <NavLink id="vault" label="Vault backend" icon={<CpuIcon className="w-4 h-4 shrink-0" />} activeSection={activeSection} />
          <NavLink id="development" label="Environment" icon={<TrendingUpIcon className="w-4 h-4 shrink-0" />} activeSection={activeSection} />
        </nav>
      </div>
    </div>
  </aside>
);

const ON_PAGE_LINKS: { group: string; items: { id: string; label: string }[] }[] = [
  {
    group: 'Introduction',
    items: [
      { id: 'intro-overview', label: 'Overview' },
      { id: 'xyra-101', label: 'Xyra 101' },
    ],
  },
  {
    group: 'Liquidity',
    items: [{ id: 'liquidity-model', label: 'Pool & reserves' }],
  },
  {
    group: 'User positions',
    items: [
      { id: 'user-supply', label: 'Supply' },
      { id: 'user-borrow', label: 'Borrow' },
      { id: 'user-withdraw', label: 'Withdraw' },
      { id: 'user-repay', label: 'Repay' },
      { id: 'user-markets', label: 'Markets' },
      { id: 'user-liquidation', label: 'Liquidations' },
      { id: 'user-flash', label: 'Flash loans' },
      { id: 'user-admin', label: 'Admin' },
    ],
  },
  {
    group: 'Tools & safety',
    items: [
      { id: 'app-navigation', label: 'Using the app' },
      { id: 'safety-privacy', label: 'Risks & privacy' },
    ],
  },
  {
    group: 'Changelog',
    items: [
      { id: 'release-wave5', label: 'Wave 5' },
      { id: 'roadmap', label: 'Roadmap' },
    ],
  },
  {
    group: 'Integrate',
    items: [{ id: 'integrate', label: 'Quickstart' }],
  },
  {
    group: 'Reference',
    items: [
      { id: 'ref-program', label: 'Program' },
      { id: 'ref-wave-5', label: 'Implementation' },
      { id: 'ref-wallet', label: 'Wallet' },
      { id: 'ref-transactions', label: 'Transactions' },
      { id: 'supabase', label: 'Supabase' },
      { id: 'vault', label: 'Vault' },
      { id: 'development', label: 'Environment' },
    ],
  },
];

const OnThisPage = () => (
  <aside className="w-48 shrink-0 self-start hidden xl:block xl:sticky xl:top-32 xl:z-10">
    <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4 font-sans">On this page</h5>
    <nav className="flex flex-col gap-4 text-xs border-l border-white/5 pl-4 font-sans">
      {ON_PAGE_LINKS.map(({ group, items }) => (
        <div key={group}>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 block mb-2">{group}</span>
          {items.map(({ id, label }) => (
            <a key={id} href={`#${id}`} className="block text-slate-400 hover:text-cyan-400 transition-colors pl-2 py-0.5">
              {label}
            </a>
          ))}
        </div>
      ))}
    </nav>
  </aside>
);

const SCROLL_SECTION_IDS = [
  'intro-overview',
  'xyra-101',
  'liquidity-model',
  'user-supply',
  'user-borrow',
  'user-withdraw',
  'user-repay',
  'user-markets',
  'user-liquidation',
  'user-flash',
  'user-admin',
  'app-navigation',
  'safety-privacy',
  'release-wave5',
  'roadmap',
  'integrate',
  'ref-program',
  'ref-wave-5',
  'ref-wallet',
  'ref-transactions',
  'supabase',
  'vault',
  'development',
];

const DocsPage: NextPageWithLayout = () => {
  const [activeSection, setActiveSection] = useState('intro-overview');
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const skipSidebarScrollIntoView = useRef(true);

  const unifiedPools =
    LENDING_POOL_PROGRAM_ID === USDC_LENDING_POOL_PROGRAM_ID &&
    LENDING_POOL_PROGRAM_ID === USAD_LENDING_POOL_PROGRAM_ID;

  useEffect(() => {
    const handleScroll = () => {
      let current = 'intro-overview';
      SCROLL_SECTION_IDS.forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
          const top = el.getBoundingClientRect().top;
          if (top <= 150) current = id;
        }
      });
      setActiveSection(current);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Keep the active item visible inside the scrollable left nav without jumping when it's already in view.
  useEffect(() => {
    if (skipSidebarScrollIntoView.current) {
      skipSidebarScrollIntoView.current = false;
      return;
    }
    const root = sidebarScrollRef.current;
    if (!root) return;
    const link = root.querySelector(`a[data-nav-id="${activeSection}"]`);
    if (link instanceof HTMLElement) {
      link.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
  }, [activeSection]);

  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-20 flex items-start gap-6 lg:gap-12 font-sans text-slate-300 min-w-0">
      <Sidebar activeSection={activeSection} scrollRootRef={sidebarScrollRef} />
      <main className="flex-1 max-w-4xl min-w-0 px-1 sm:px-0 overflow-x-hidden break-words [overflow-wrap:anywhere] animate-fade-in-up">
        <section id="intro-overview" className="scroll-mt-32 mb-16">
          <div className="flex items-center gap-3 mb-4">
            <span
              className="px-2 py-0.5 rounded font-mono border"
              style={{
                background: 'rgba(6, 182, 212, 0.1)',
                color: '#22d3ee',
                fontSize: '0.625rem',
                borderColor: 'rgba(6, 182, 212, 0.2)',
              }}
            >
              TESTNET
            </span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold mb-3 text-white">
            Documentation <span style={customStyles.textGradientCyan}>overview</span>
          </h1>
          <p className="text-slate-400 text-lg mb-8 max-w-3xl leading-relaxed">
            Xyra is a non-custodial liquidity protocol on <strong className="text-slate-300">Aleo testnet</strong>: suppliers add assets to shared pools and earn yield;
            borrowers draw liquidity against collateral that keeps the position within protocol risk rules. This guide is organized with concepts first, then each user
            action, then integration and reference—mapped to our Leo program and frontend.
          </p>
          <div className="p-8 rounded-2xl space-y-8" style={customStyles.glassPanel}>
            <p className="text-lg text-slate-300 leading-relaxed">
              The app uses <strong>one integrated pool</strong> that treats <strong>ALEO</strong>, <strong>USDCx</strong>, and <strong>USAD</strong> as separate reserves
              (markets) while sharing a single account health view: collateral and debt across assets are normalized for risk checks. Everything runs on Aleo private
              records and testnet deployments.
            </p>
            <div>
              <h2 className="text-base font-semibold text-white mb-3">Supported assets</h2>
              <ul className="space-y-3 text-slate-400 leading-relaxed">
                <li>
                  <span className="font-semibold text-slate-300">ALEO</span> — Native Aleo token: supply as collateral, borrow, repay, withdraw per pool rules.
                </li>
                <li>
                  <span className="font-semibold text-slate-300">USDCx</span> — Test stablecoin (USDC-style): same operations as ALEO within this build.
                </li>
                <li>
                  <span className="font-semibold text-slate-300">USAD</span> — Second test stablecoin market; composable with the same cross-collateral account.
                </li>
              </ul>
              <p className="text-slate-500 text-sm mt-3 leading-relaxed">All assets are testnet-only; names may resemble mainnet tickers but are for experimentation.</p>
            </div>
            <p className="text-slate-400 leading-relaxed border-t border-white/10 pt-6 text-sm">
              For protocol mechanics per action, see <strong className="text-slate-300">User positions</strong> below. Developers should jump to <strong>Integrate</strong>{' '}
              and <strong>Reference</strong>.
            </p>
          </div>
        </section>

        <section id="xyra-101" className="scroll-mt-32 mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6 flex items-center gap-3 text-white">
            <BookOpenIcon className="w-7 h-7 text-cyan-400 shrink-0" />
            Xyra 101
          </h2>
          <div className="p-8 rounded-2xl space-y-4" style={customStyles.glassPanel}>
            <ul className="space-y-4 text-slate-300 leading-relaxed list-disc list-inside marker:text-cyan-500/80">
              <li>
                <strong className="text-white">Connect a wallet</strong> that supports Aleo testnet and approve record access when prompted—your position lives in private{' '}
                <span className="font-mono text-cyan-300/90 text-sm">LendingPosition</span> records.
              </li>
              <li>
                <strong className="text-white">Open a lending account once</strong> (<span className="font-mono text-sm text-cyan-300/90">open_lending_account</span>) before
                depositing or borrowing; then use supply, borrow, repay, and withdraw as needed.
              </li>
              <li>
                <strong className="text-white">Watch health, not just balances</strong> — the UI aggregates collateral and debt in USD terms using on-chain prices and
                parameters so you know if you are safe, close to limits, or need to repay / self-liquidate.
              </li>
            </ul>
          </div>
        </section>

        <section id="liquidity-model" className="scroll-mt-32 mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6 flex items-center gap-3 text-white">
            <LayersIcon className="w-7 h-7 text-cyan-400 shrink-0" />
            Liquidity pool & reserves
          </h2>
          <div className="p-8 rounded-2xl space-y-6" style={customStyles.glassPanel}>
            <p className="text-slate-400 leading-relaxed">
              In standard lending terms, a <em>liquidity pool</em> holds shared liquidity across <em>reserves</em> (per-asset markets). Xyra does this in a single on-chain
              program with <strong className="text-slate-300">three reserves</strong> keyed by asset id: <span className="font-mono text-purple-300">0field</span> (ALEO),{' '}
              <span className="font-mono text-purple-300">1field</span> (USDCx), <span className="font-mono text-purple-300">2field</span> (USAD). Pool-level mappings
              track totals, utilization, supply and borrow indices, fees, LTV, liquidation parameters, and oracle prices for USD-normalized risk.
            </p>
            <p className="text-slate-400 leading-relaxed">
              <strong className="text-white">Cross-collateral</strong> means your position is evaluated as a portfolio: supplying one asset can support borrowing another,
              subject to LTV and health constraints enforced in finalize transitions—not isolated per-asset silos in the UI sense.
            </p>
            <p className="text-slate-400 leading-relaxed">
              <strong className="text-white">Interest</strong> accrues via on-chain indices; the app reads mappings and your private position to show effective supply and
              borrow balances. Anyone can call accrual; it also updates on user flows.
            </p>
            <p className="text-slate-500 text-sm border-t border-white/10 pt-4">
              Borrow and withdraw payouts that leave the shielded pool are completed by a <strong className="text-slate-400">vault backend</strong> after the pool
              transaction finalizes (see Reference → Vault).
            </p>
          </div>
        </section>

        <div className="mb-10">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">User positions</p>
          <p className="text-sm text-slate-500">How each operation works in the app (ALEO, USDCx, and USAD where supported).</p>
        </div>

        <section id="user-supply" className="scroll-mt-32 mb-14">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 text-white">Supply assets</h2>
          <div className="p-6 rounded-2xl space-y-3" style={customStyles.glassPanel}>
            <p className="text-slate-400 leading-relaxed">
              Supplying deposits tokens into the pool so others can borrow them. You earn a share of borrow interest, and supplied amounts count as{' '}
              <strong className="text-slate-300">collateral</strong>, increasing how much you may borrow. Use the Dashboard per-asset tabs to supply native ALEO (credits
              record), USDCx, or USAD (private token records with Merkle proofs as required by the deployed programs).
            </p>
          </div>
        </section>

        <section id="user-borrow" className="scroll-mt-32 mb-14">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 text-white">Borrow assets</h2>
          <div className="p-6 rounded-2xl space-y-3" style={customStyles.glassPanel}>
            <p className="text-slate-400 leading-relaxed">
              Borrowing pulls liquidity from the pool against your total collateral. The protocol evaluates <strong className="text-slate-300">all</strong> supplied and
              owed positions across ALEO, USDCx, and USAD using USD risk math—not a single isolated line. After the pool transaction finalizes, the{' '}
              <strong className="text-slate-300">vault</strong> sends the borrowed asset to your wallet where applicable.
            </p>
          </div>
        </section>

        <section id="user-withdraw" className="scroll-mt-32 mb-14">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 text-white">Withdraw</h2>
          <div className="p-6 rounded-2xl space-y-3" style={customStyles.glassPanel}>
            <p className="text-slate-400 leading-relaxed">
              Withdraw removes collateral from the pool only if health and liquidity rules still pass afterward. If you owe too much relative to what would remain, repay
              debt or withdraw less. Limits combine <strong className="text-slate-300">portfolio caps</strong>, per-asset rules, and vault liquidity where the payout is
              delivered off the shielded pool.
            </p>
          </div>
        </section>

        <section id="user-repay" className="scroll-mt-32 mb-14">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 text-white">Repay</h2>
          <div className="p-6 rounded-2xl space-y-3" style={customStyles.glassPanel}>
            <p className="text-slate-400 leading-relaxed">
              Repay sends tokens back to reduce debt. You can repay using an asset different from the one you borrowed: the program applies payment to outstanding debt
              in a defined order (e.g. cross-asset repay flows) until the payment is exhausted or debt is cleared—useful for rebalancing without many manual steps.
            </p>
          </div>
        </section>

        <section id="user-markets" className="scroll-mt-32 mb-14">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 text-white">Markets & exchange rates</h2>
          <div className="p-6 rounded-2xl space-y-3" style={customStyles.glassPanel}>
            <p className="text-slate-400 leading-relaxed">
              The <strong className="text-slate-300">Markets</strong> screen is the place to compare reserves: total supplied, borrowed, utilization, and APY-style
              indicators derived from on-chain data. Use it to size supply or borrow before you commit; it does not replace checking your own position on the Dashboard.
            </p>
          </div>
        </section>

        <section id="user-liquidation" className="scroll-mt-32 mb-14">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 text-white">Liquidations</h2>
          <div className="p-6 rounded-2xl space-y-3" style={customStyles.glassPanel}>
            <p className="text-slate-400 leading-relaxed">
              If collateral value or debt leaves you outside protocol rules, you may become liquidatable. The <strong className="text-slate-300">Liquidation</strong> page
              supports <strong className="text-slate-300">self-liquidation</strong>: you repay and reclaim collateral under program rules, with an on-screen preview
              before you sign. This testnet build does not expose a separate liquidator marketplace in the UI.
            </p>
          </div>
        </section>

        <section id="user-flash" className="scroll-mt-32 mb-14">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 text-white">Flash loans</h2>
          <div className="p-6 rounded-2xl space-y-3" style={customStyles.glassPanel}>
            <p className="text-slate-400 leading-relaxed">
              Flash liquidity is borrowed and returned in one coordinated flow: open a session for ALEO, USDCx, or USAD, receive funds from the vault, execute your
              strategy, then settle with principal plus fee (and any configured minimum profit). It is aimed at advanced users and integrations—not a substitute for
              long-term borrow.
            </p>
          </div>
        </section>

        <section id="user-admin" className="scroll-mt-32 mb-14">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 text-white">Protocol admin</h2>
          <div className="p-6 rounded-2xl space-y-3" style={customStyles.glassPanel}>
            <p className="text-slate-400 leading-relaxed">
              The <strong className="text-slate-300">Admin</strong> route is restricted to the configured operator wallet. It is used to refresh oracle prices, accrue
              interest, adjust risk and rate parameters, configure flash-loan policy, and withdraw protocol fees when allowed. Other addresses see an access message
              only.
            </p>
          </div>
        </section>

        <section id="app-navigation" className="scroll-mt-32 mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6 flex items-center gap-3 text-white">
            <LayoutIcon className="w-7 h-7 text-cyan-400 shrink-0" />
            Using the app
          </h2>
          <div className="p-8 rounded-2xl space-y-6" style={customStyles.glassPanel}>
            <dl className="space-y-5 text-sm">
              <div>
                <dt className="font-semibold text-white mb-1">Dashboard</dt>
                <dd className="text-slate-400 leading-relaxed">Portfolio summary, health, and per-asset supply / withdraw / borrow / repay.</dd>
              </div>
              <div>
                <dt className="font-semibold text-white mb-1">Markets</dt>
                <dd className="text-slate-400 leading-relaxed">Pool-level stats and yields before you size a position.</dd>
              </div>
              <div>
                <dt className="font-semibold text-white mb-1">Liquidation</dt>
                <dd className="text-slate-400 leading-relaxed">Self-liquidation flow and related history.</dd>
              </div>
              <div>
                <dt className="font-semibold text-white mb-1">Flash loan</dt>
                <dd className="text-slate-400 leading-relaxed">Open session, settle, and session history (open → fund → settle).</dd>
              </div>
              <div>
                <dt className="font-semibold text-white mb-1">Docs</dt>
                <dd className="text-slate-400 leading-relaxed">This documentation.</dd>
              </div>
              <div>
                <dt className="font-semibold text-white mb-1">Admin</dt>
                <dd className="text-slate-400 leading-relaxed">Operator-only; separate from the borrower journey.</dd>
              </div>
            </dl>
          </div>
        </section>

        <section id="safety-privacy" className="scroll-mt-32 mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6 flex items-center gap-3 text-white">
            <ShieldIcon className="w-7 h-7 text-cyan-400 shrink-0" />
            Risks & privacy
          </h2>
          <div className="p-8 rounded-2xl space-y-4" style={customStyles.glassPanel}>
            <p className="text-slate-300 leading-relaxed">
              <strong className="text-white">Testnet risk.</strong> Tokens have no real value; oracles and parameters are for testing. Do not treat this deployment as
              production financial infrastructure.
            </p>
            <p className="text-slate-400 leading-relaxed">
              <strong className="text-slate-300">Privacy.</strong> Aleo uses private state: balances and position details are carried in encrypted records visible to you
              (and programs you authorize). The UI labels sensitive actions accordingly.
            </p>
            <p className="text-slate-400 leading-relaxed">
              The app avoids logging decrypted records or position internals in the browser by default. For local debugging only, set{' '}
              <span className="font-mono text-cyan-400 text-sm">NEXT_PUBLIC_DEBUG_PRIVACY=true</span> (see Environment in Reference).
            </p>
            <p className="text-slate-400 leading-relaxed text-sm border-t border-white/10 pt-4">
              Exact public vs private fields per transition follow the deployed Leo ABI and build artifacts.
            </p>
          </div>
        </section>

        <section id="release-wave5" className="scroll-mt-32 mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6 flex items-center gap-3 text-white">
            <TrendingUpIcon className="w-7 h-7 text-cyan-400 shrink-0" />
            Wave 5 release
          </h2>
          <div className="p-8 rounded-2xl space-y-4" style={customStyles.glassPanel}>
            <p className="text-slate-400 leading-relaxed mb-4">
              Wave 5 aligned the product with on-chain truth: portfolio and caps match finalize logic, liquidation and flash flows are first-class, and admins have a
              single console.
            </p>
            <ul className="space-y-4 text-slate-300 leading-relaxed">
              <li>
                <span className="font-semibold text-white">Portfolio</span>
                <span className="text-slate-400">
                  {' '}
                  — Collateral, debt, health, and limits from <span className="font-mono text-cyan-300/90 text-sm">LendingPosition</span> plus live mappings (indices,
                  prices).
                </span>
              </li>
              <li>
                <span className="font-semibold text-white">Liquidation UX</span>
                <span className="text-slate-400"> — Liquidatable state, preview before sign, history consistent with the rest of the app.</span>
              </li>
              <li>
                <span className="font-semibold text-white">Flash loans</span>
                <span className="text-slate-400"> — ALEO, USDCx, USAD; vault funding; Supabase session rows.</span>
              </li>
              <li>
                <span className="font-semibold text-white">Admin console</span>
                <span className="text-slate-400"> — Initialization, oracles, accrual, risk/rates, flash policy, fee withdrawal.</span>
              </li>
            </ul>
          </div>
        </section>

        <section id="roadmap" className="scroll-mt-32 mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6 flex items-center gap-3 text-white">
            <TrendingUpIcon className="w-7 h-7 text-indigo-400 shrink-0" />
            Roadmap
          </h2>
          <div className="p-8 rounded-2xl space-y-4" style={customStyles.glassPanel}>
            <ul className="space-y-3 text-slate-300 leading-relaxed">
              <li>
                <span className="font-semibold text-white">Done (Wave 5):</span> mapping-aligned portfolio, liquidation UX, multi-asset flash with vault funding, admin
                console, Supabase flash sessions.
              </li>
              <li>
                <span className="font-semibold text-white">Optional UI:</span> private-record migration helpers behind env flags.
              </li>
              <li>
                <span className="font-semibold text-white">Next directions:</span> third-party liquidators, stronger oracles, governance, more assets, mainnet hardening.
              </li>
            </ul>
          </div>
        </section>

        <section id="integrate" className="scroll-mt-32 mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6 flex items-center gap-3 text-white">
            <CodeIcon className="w-7 h-7 text-cyan-400 shrink-0" />
            Quickstart (integrate)
          </h2>
          <div className="p-8 rounded-2xl space-y-4" style={customStyles.glassPanel}>
            <p className="text-slate-400 leading-relaxed">
              To build on top of Xyra or operate a deployment, use the <strong className="text-slate-300">Reference</strong> sections in order:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-sm text-slate-400 leading-relaxed">
              <li>
                <strong className="text-slate-300">On-chain program</strong> — Leo source, program id env vars, reserves and mappings.
              </li>
              <li>
                <strong className="text-slate-300">Implementation</strong> — How <span className="font-mono text-cyan-300/90">rpc.ts</span> and the UI align with
                finalize transitions.
              </li>
              <li>
                <strong className="text-slate-300">Wallet</strong> — Adapter packages and program allowlist.
              </li>
              <li>
                <strong className="text-slate-300">Transactions</strong> — Build inputs, execute, poll, Supabase and vault follow-up.
              </li>
              <li>
                <strong className="text-slate-300">Supabase &amp; Vault</strong> — History schema, flash sessions, backend payout watchers.
              </li>
              <li>
                <strong className="text-slate-300">Environment</strong> — All <span className="font-mono text-cyan-300/90">NEXT_PUBLIC_*</span> and operator gates.
              </li>
            </ol>
          </div>
        </section>

        <div className="mb-16 pt-4 border-t border-white/10">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Reference</p>
          <p className="text-sm text-slate-500">Technical detail for engineers and operators: paths, transitions, env vars.</p>
        </div>

        <section id="ref-program" className="scroll-mt-32 mb-20">
          <h2 className="text-3xl font-bold mb-8 flex items-center gap-3 text-white">
            <CodeIcon className="w-8 h-8 text-purple-400" />
            On-chain program
          </h2>
          <div className="p-8 rounded-2xl space-y-4" style={customStyles.glassPanel}>
            <ul className="list-disc list-inside space-y-2 text-sm text-slate-400">
              <li>
                <span className="font-semibold text-white">Source:</span> <span className="font-mono text-purple-300">program/src/main.leo</span>
              </li>
              <li>
                <span className="font-semibold text-white">Build:</span> <span className="font-mono text-purple-300">program/build/program.json</span> (deployed name varies,
                e.g. <span className="font-mono text-purple-300">xyra_lending_v32.aleo</span>)
              </li>
              <li>
                <span className="font-semibold text-white">Wallet target:</span>{' '}
                <span className="font-mono text-purple-300 break-all">{LENDING_POOL_PROGRAM_ID}</span> from{' '}
                <span className="font-mono text-purple-300">NEXT_PUBLIC_LENDING_POOL_PROGRAM_ID</span>
              </li>
              <li>
                One program, three reserves (<span className="font-mono text-purple-300">0field</span> / <span className="font-mono text-purple-300">1field</span> /{' '}
                <span className="font-mono text-purple-300">2field</span>): per-asset indices, utilization, fees, LTV, liquidation params,{' '}
                <span className="font-mono text-purple-300">asset_price</span> for USD risk.
              </li>
              <li>
                User state: private <span className="font-mono text-purple-300">LendingPosition</span>; pool totals in mappings.
              </li>
              <li>
                Flash: <span className="font-mono text-purple-300">flash_active</span>, <span className="font-mono text-purple-300">flash_asset</span>, premium and cap
                params.
              </li>
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
            Implementation
          </h2>
          <div className="p-8 rounded-2xl space-y-8" style={customStyles.glassPanel}>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Portfolio reads</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                <span className="font-mono text-cyan-300">src/components/aleo/rpc.ts</span> resolves <span className="font-mono text-cyan-300">LendingPosition</span> and
                mappings (<span className="font-mono text-cyan-300">supply_index</span>, <span className="font-mono text-cyan-300">borrow_index</span>,{' '}
                <span className="font-mono text-cyan-300">asset_price</span>, LTV, …) so UI matches{' '}
                <span className="font-mono text-cyan-300">finalize_borrow</span>, <span className="font-mono text-cyan-300">finalize_withdraw</span>,{' '}
                <span className="font-mono text-cyan-300">finalize_repay_any</span>. New users:{' '}
                <span className="font-mono text-cyan-300">open_lending_account</span>.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Liquidation</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                <span className="font-mono text-cyan-300">self_liquidate_and_payout</span>. UI: <span className="font-mono text-cyan-300">src/pages/dashboard.tsx</span>{' '}
                (liquidation tab). Preview: <span className="font-mono text-cyan-300">getLiquidationPreviewAleo</span>.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Flash loans</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-2">
                <span className="font-mono text-cyan-300">flash_open</span> → vault funds →{' '}
                <span className="font-mono text-cyan-300">flash_settle_with_credits</span> |{' '}
                <span className="font-mono text-cyan-300">flash_settle_with_usdcx</span> |{' '}
                <span className="font-mono text-cyan-300">flash_settle_with_usad</span>. Admin: <span className="font-mono text-cyan-300">set_flash_params</span>,{' '}
                <span className="font-mono text-cyan-300">set_flash_strategy_allowed</span>.
              </p>
              <p className="text-sm text-slate-400 leading-relaxed">
                Backend: <span className="font-mono text-cyan-300">POST /flash/fund-session</span> and watcher use borrow-style withdrawal helpers by{' '}
                <span className="font-mono text-cyan-300">asset_id</span> (<span className="font-mono text-cyan-300">backend/src/server.js</span>).
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Admin</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                <span className="font-mono text-cyan-300">/admin</span> → <span className="font-mono text-cyan-300">src/components/AdminView.tsx</span>. Gate:{' '}
                <span className="font-mono text-cyan-300">NEXT_PUBLIC_LENDING_ADMIN_ADDRESS</span>. Actions: initialize,{' '}
                <span className="font-mono text-cyan-300">set_asset_price</span>, <span className="font-mono text-cyan-300">accrue_interest</span>,{' '}
                <span className="font-mono text-cyan-300">set_asset_params</span>, flash admin transitions, <span className="font-mono text-cyan-300">withdraw_fees</span>.
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
              <li>
                Packages: <span className="font-mono text-indigo-300">@provablehq/aleo-wallet-adaptor-react</span> (+ UI button).
              </li>
              <li>
                Program allowlist: <span className="font-mono text-indigo-300">getWalletConnectProgramIds()</span> in{' '}
                <span className="font-mono text-indigo-300">src/types/index.ts</span>.
              </li>
              <li>
                <span className="font-mono text-indigo-300">decryptPermission</span> where supported; <span className="font-mono text-indigo-300">address</span> for RPC
                and history.
              </li>
              <li>
                <span className="font-mono text-indigo-300">WalletPersistence</span> (sessionStorage) across routes.
              </li>
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
              <li>
                User action → <span className="font-mono text-indigo-300">rpc.ts</span> builds inputs from the deployed ABI.
              </li>
              <li>
                <span className="font-mono text-indigo-300">executeTransaction</span> — Leo literals; visibility from ABI (avoid extra{' '}
                <span className="font-mono text-indigo-300">.private</span> in JS).
              </li>
              <li>
                Poll <span className="font-mono text-indigo-300">transactionStatus</span>; explorer links + Supabase rows.
              </li>
              <li>Borrow / withdraw: watcher completes vault payout; second history link when vault tx exists.</li>
              <li>
                Flash: after open, backend funds; user settles; <span className="font-mono text-indigo-300">flash_sessions</span> updated.
              </li>
            </ol>
          </div>
        </section>

        <section id="supabase" className="scroll-mt-32 mb-20">
          <h2 className="text-3xl font-bold mb-8 flex items-center gap-3 text-white">
            <LayersIcon className="w-8 h-8 text-purple-400" />
            Supabase
          </h2>
          <div className="p-8 rounded-2xl" style={customStyles.glassPanel}>
            <h3 className="font-semibold text-white mb-2">Schema (summary)</h3>
            <p className="text-sm text-slate-400 mb-2">
              Table <span className="font-mono text-purple-400">transaction_history</span>:
            </p>
            <ul className="list-disc list-inside space-y-1 mb-4 text-sm text-slate-400">
              <li>
                <span className="font-mono">wallet_address</span> — Aleo address.
              </li>
              <li>
                <span className="font-mono">tx_id</span> — pool transaction hash.
              </li>
              <li>
                <span className="font-mono">type</span> — deposit | withdraw | borrow | repay | flash_loan | self_liquidate_payout | …
              </li>
              <li>
                <span className="font-mono">asset</span> — aleo, usdcx, usad.
              </li>
              <li>
                <span className="font-mono">vault_tx_id</span> — when vault payout completes.
              </li>
            </ul>
            <h3 className="font-semibold text-white mb-2 mt-6">Flash sessions</h3>
            <p className="text-sm text-slate-400 mb-2">
              Table <span className="font-mono text-purple-400">flash_sessions</span> (<span className="font-mono text-purple-400">supabase/FLASH_SESSIONS_SCHEMA.sql</span>
              ):
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-slate-400">
              <li>
                <span className="font-mono">user_address</span>, <span className="font-mono">strategy_wallet</span>, <span className="font-mono">asset_id</span> (
                <span className="font-mono">0field|1field|2field</span>).
              </li>
              <li>
                <span className="font-mono">principal_micro</span>, <span className="font-mono">min_profit_micro</span>,{' '}
                <span className="font-mono">strategy_id_field</span>.
              </li>
              <li>
                <span className="font-mono">flash_open_tx_id</span>, <span className="font-mono">vault_fund_tx_id</span>,{' '}
                <span className="font-mono">flash_settle_tx_id</span>, <span className="font-mono">status</span>, timestamps.
              </li>
            </ul>
            <h3 className="font-semibold text-white mb-2 mt-6">Environment</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-slate-400">
              <li>
                <span className="font-mono">NEXT_PUBLIC_SUPABASE_URL</span>
              </li>
              <li>
                <span className="font-mono">NEXT_PUBLIC_SUPABASE_PUB_KEY</span>
              </li>
            </ul>
          </div>
        </section>

        <section id="vault" className="scroll-mt-32 mb-20">
          <h2 className="text-3xl font-bold mb-8 flex items-center gap-3 text-white">
            <CpuIcon className="w-8 h-8 text-cyan-400" />
            Vault backend
          </h2>
          <div className="p-8 rounded-2xl space-y-4" style={customStyles.glassPanel}>
            <p className="text-sm text-slate-400">
              Node server in <span className="font-mono text-cyan-400">backend/</span>: vault wallet sends payouts after the pool records borrow / withdraw / flash-fund
              intent.
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-slate-400">
              <li>Vault transfers for ALEO credits, USDCx, USAD after finalized borrow / withdraw / flash fund.</li>
              <li>
                <span className="font-mono text-cyan-400">POST /flash/fund-session</span> and flash watcher share borrow payout helpers by session{' '}
                <span className="font-mono text-cyan-400">asset_id</span>.
              </li>
              <li>
                <span className="font-semibold text-white">GET /vault-balances</span> — vault balances per token program.
              </li>
              <li>Vault watcher polls Supabase for rows needing a vault transaction.</li>
              <li>Optional oracle can poll prices and broadcast set_asset_price.</li>
            </ul>
            <p className="text-xs text-slate-500 mt-2">
              Frontend: <span className="font-mono text-cyan-400">NEXT_PUBLIC_BACKEND_URL</span>. Backend: <span className="font-mono text-cyan-400">CORS_ORIGIN</span> and
              vault env in <span className="font-mono text-cyan-400">backend/.env</span>.
            </p>
          </div>
        </section>

        <section id="development" className="scroll-mt-32 mb-20">
          <h2 className="text-3xl font-bold mb-8 flex items-center gap-3 text-white">
            <TrendingUpIcon className="w-8 h-8 text-indigo-400" />
            Environment
          </h2>
          <div className="p-8 rounded-2xl" style={customStyles.glassPanel}>
            <ul className="list-disc list-inside space-y-2 text-sm text-slate-400">
              <li>
                <span className="font-semibold text-white">Pool program:</span>{' '}
                <span className="font-mono text-cyan-400">NEXT_PUBLIC_LENDING_POOL_PROGRAM_ID</span> (optional:{' '}
                <span className="font-mono text-cyan-400">NEXT_PUBLIC_USDC_LENDING_POOL_PROGRAM_ID</span>,{' '}
                <span className="font-mono text-cyan-400">NEXT_PUBLIC_USAD_LENDING_POOL_PROGRAM_ID</span> — see{' '}
                <span className="font-mono text-cyan-400">src/types/index.ts</span>).
              </li>
              <li>
                <span className="font-semibold text-white">Admin:</span>{' '}
                <span className="font-mono text-cyan-400">NEXT_PUBLIC_LENDING_ADMIN_ADDRESS</span> must match the wallet on{' '}
                <span className="font-mono text-cyan-400">/admin</span>.
              </li>
              <li>
                <span className="font-mono text-cyan-400">NEXT_PUBLIC_APP_ENV</span> — minor UX (e.g. status timing).
              </li>
              <li>
                <span className="font-mono text-cyan-400">NEXT_PUBLIC_DEBUG_PRIVACY</span> — <span className="font-mono text-cyan-400">true</span> only for local RPC /
                record debugging.
              </li>
              <li>
                Next.js Pages router, Tailwind, <span className="font-mono text-cyan-400">layouts/_layout.tsx</span>.
              </li>
              <li>Defaults target Aleo testnet unless you change them.</li>
            </ul>
            <p className="text-xs text-slate-500 mt-4 pt-4 border-t border-white/10">
              Entry points: <span className="font-mono text-cyan-400">src/pages/dashboard.tsx</span>,{' '}
              <span className="font-mono text-cyan-400">src/pages/admin.tsx</span>, <span className="font-mono text-cyan-400">src/components/AdminView.tsx</span>,{' '}
              <span className="font-mono text-cyan-400">src/components/aleo/rpc.ts</span>, <span className="font-mono text-cyan-400">backend/src/server.js</span>,{' '}
              <span className="font-mono text-cyan-400">supabase/schema.sql</span>, <span className="font-mono text-cyan-400">supabase/FLASH_SESSIONS_SCHEMA.sql</span>.
            </p>
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
