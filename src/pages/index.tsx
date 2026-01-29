import type { NextPageWithLayout } from '@/types';
import { NextSeo } from 'next-seo';
import Layout from '@/layouts/_layout';
import Button from '@/components/ui/button';
import { useRouter } from 'next/router';

const MainPage: NextPageWithLayout = () => {
  const router = useRouter();

  const handleEnterApp = () => {
    router.push('/dashboard');
  };

  return (
    <>
      <NextSeo
        title="Xyra Finance – Private Lending & Borrowing on Aleo"
        description="Xyra Finance is a privacy-first money market on Aleo: private lending, borrowing, and institutional-grade credit rails powered by zero-knowledge proofs."
        openGraph={{
          title: 'Xyra Finance – Private Lending & Borrowing on Aleo',
          description:
            'Private, compliant, MEV-free money markets on Aleo. Supply, borrow, and manage capital with full confidentiality.',
        }}
      />

      {/* Add top padding only on mobile so the hero clears the fixed navbar */}
      <main className="min-h-screen bg-gradient-to-br from-base-300 via-base-100 to-base-200 text-base-content pt-20 md:pt-0">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-40">
            <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-primary/40 to-secondary/30 blur-3xl" />
            <div className="absolute -right-24 bottom-0 h-64 w-64 rounded-full bg-gradient-to-tr from-accent/30 to-primary/30 blur-3xl" />
          </div>

          <div className="relative mx-auto flex max-w-6xl flex-col gap-12 px-6 pb-20 pt-28 md:flex-row md:items-center md:pb-28 md:pt-32">
            {/* Left: copy */}
            <div className="flex-1 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-base-200/80 px-3 py-1 text-[11px] uppercase tracking-widest text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Private Money Markets on Aleo
              </div>

              <h1 className="text-4xl font-semibold leading-tight sm:text-5xl md:text-6xl">
                Xyra Finance
                <span className="block text-base-content/70">
                  Private Lending & Borrowing Protocol on Aleo
                </span>
              </h1>

              <p className="max-w-xl text-sm md:text-base text-base-content/80">
                Xyra Finance is a privacy-first money market inspired by Aave and rebuilt for Aleo.
                Supply, borrow, and manage capital with fully confidential positions, zk-enforced
                risk, and MEV-free liquidations — without compromising solvency or transparency.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Button
                  onClick={handleEnterApp}
                  className="btn btn-primary px-8 py-3 text-sm font-semibold tracking-wide"
                >
                  Enter App
                </Button>
                <div className="flex flex-col text-xs text-base-content/70">
                  <span>Built for privacy-conscious DeFi users, DAOs, and institutions.</span>
                  <span>Powered by Aleo&apos;s zero-knowledge execution layer.</span>
                </div>
              </div>
            </div>

            {/* Right: project summary card */}
            <div className="flex-1">
              <div className="rounded-2xl border border-base-300/60 bg-base-100/80 p-6 shadow-card backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">
                  Protocol Snapshot
                </p>
                <ul className="space-y-3 text-xs text-base-content/80">
                  <li>
                    <span className="font-semibold text-base-content">Private lending pools</span>{' '}
                    with confidential user positions and zk-provable pool solvency.
                  </li>
                  <li>
                    <span className="font-semibold text-base-content">
                      ZK-based risk &amp; health engine
                    </span>{' '}
                    enforcing collateral checks, interest, and liquidation thresholds privately.
                  </li>
                  <li>
                    <span className="font-semibold text-base-content">
                      MEV-free, protocol-controlled liquidations
                    </span>{' '}
                    with private keepers and no liquidation sniping.
                  </li>
                  <li>
                    Future phases unlock{' '}
                    <span className="font-semibold text-base-content">
                      undercollateralized credit markets
                    </span>{' '}
                    via ZK credit scores and private attestations.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Problem / Solution / Architecture */}
        <section className="border-t border-base-300/60 bg-base-100/80">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 md:grid-cols-3 md:py-14">
            <div className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                Problem
              </h2>
              <p className="text-xs text-base-content/80">
                Existing money markets expose every balance and liquidation on-chain, creating MEV
                risk, copy trading, and making DeFi unusable for institutions and regulated
                entities.
              </p>
              <ul className="mt-2 space-y-1 text-xs text-base-content/70 list-disc list-inside">
                <li>Public balances &amp; strategies</li>
                <li>Liquidation sniping &amp; MEV</li>
                <li>No safe undercollateralized credit</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                Solution
              </h2>
              <p className="text-xs text-base-content/80">
                A fully private, Aleo-native lending &amp; borrowing protocol where all sensitive
                state lives in records and transitions are proven with zero-knowledge proofs.
              </p>
              <ul className="mt-2 space-y-1 text-xs text-base-content/70 list-disc list-inside">
                <li>Private deposits &amp; borrows</li>
                <li>ZK-enforced health factor &amp; solvency</li>
                <li>MEV-free, protocol-controlled liquidations</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                Architecture
              </h2>
              <p className="text-xs text-base-content/80">
                Xyra is composed of a Lending Pool program, Private Position Manager, ZK Risk
                Engine, Oracle Adapter, and Liquidation Controller, all designed for Aleo.
              </p>
              <ul className="mt-2 space-y-1 text-xs text-base-content/70 list-disc list-inside">
                <li>User balances stored as Aleo records</li>
                <li>Pool state proven without leaking positions</li>
                <li>Composable with Aleo-native DeFi</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Features & Use Cases */}
        <section className="bg-base-200/80 border-t border-base-300/60">
          <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
            <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Why Xyra Finance</h2>
                <p className="text-xs text-base-content/70">
                  The first true private money market on Aleo, designed for both power users and
                  institutions.
                </p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-xl bg-base-100 p-5 shadow-card">
                <h3 className="text-sm font-semibold mb-2">Confidential Positions</h3>
                <p className="text-xs text-base-content/75">
                  Users maintain private records for supplied and borrowed assets, collateral
                  ratios, and health factor. No public address-level exposures.
                </p>
              </div>

              <div className="rounded-xl bg-base-100 p-5 shadow-card">
                <h3 className="text-sm font-semibold mb-2">ZK Risk Engine</h3>
                <p className="text-xs text-base-content/75">
                  Collateral checks, borrow limits, and liquidation thresholds are enforced
                  privately via zero-knowledge proofs, while keeping pool solvency provable.
                </p>
              </div>

              <div className="rounded-xl bg-base-100 p-5 shadow-card">
                <h3 className="text-sm font-semibold mb-2">MEV-Free Liquidations</h3>
                <p className="text-xs text-base-content/75">
                  Protocol-controlled liquidations and private keepers remove public liquidation
                  auctions, MEV races, and sniping.
                </p>
              </div>

              <div className="rounded-xl bg-base-100 p-5 shadow-card">
                <h3 className="text-sm font-semibold mb-2">Institutional-Grade Privacy</h3>
                <p className="text-xs text-base-content/75">
                  Ideal for DAOs, funds, and corporates: private treasury strategies, custom risk
                  parameters, and selective disclosure for auditors.
                </p>
              </div>

              <div className="rounded-xl bg-base-100 p-5 shadow-card">
                <h3 className="text-sm font-semibold mb-2">Future: ZK Credit &amp; Under-Collateralized Lending</h3>
                <p className="text-xs text-base-content/75">
                  Roadmap includes ZK credit scores, reputation-based borrowing, and private
                  attestations to unlock compliant, credit-based lending.
                </p>
              </div>

              <div className="rounded-xl bg-base-100 p-5 shadow-card">
                <h3 className="text-sm font-semibold mb-2">Compliance-Friendly Rails</h3>
                <p className="text-xs text-base-content/75">
                  ZK-based KYC and jurisdiction checks without exposing raw identity data, making
                  Xyra a natural fit for regulated entities.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Roadmap */}
        <section className="bg-base-100 border-t border-base-300/60">
          <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
            <div className="mb-6">
              <h2 className="text-lg font-semibold">Roadmap</h2>
              <p className="text-xs text-base-content/70">
                Gradual expansion from a single-asset private pool to a full private credit layer
                on Aleo.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3 text-xs">
              <div className="rounded-xl bg-base-200 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary mb-2">
                  Phase 1
                </p>
                <ul className="space-y-1 text-base-content/80">
                  <li>Single-asset private lending pool</li>
                  <li>Overcollateralized borrowing</li>
                  <li>Protocol-controlled liquidations</li>
                </ul>
              </div>

              <div className="rounded-xl bg-base-200 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary mb-2">
                  Phase 2
                </p>
                <ul className="space-y-1 text-base-content/80">
                  <li>Multi-asset private pools</li>
                  <li>Institutional &amp; DAO treasury pools</li>
                  <li>Advanced risk tooling for managers</li>
                </ul>
              </div>

              <div className="rounded-xl bg-base-200 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary mb-2">
                  Phase 3
                </p>
                <ul className="space-y-1 text-base-content/80">
                  <li>ZK credit scores &amp; undercollateralized lending</li>
                  <li>Cross-chain private yield strategies</li>
                  <li>Aleo as the private credit layer of Web3</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Call to action */}
        <section className="border-t border-base-300/60 bg-base-200/90">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-center md:flex-row md:text-left">
            <div>
              <h3 className="text-base font-semibold">Ready to explore private money markets?</h3>
              <p className="text-xs text-base-content/70">
                Enter the dApp to interact with the lending pool on Aleo testnet.
              </p>
            </div>
            <Button
              onClick={handleEnterApp}
              className="btn btn-primary px-8 py-2 text-sm font-semibold tracking-wide"
            >
              Enter App
            </Button>
          </div>
        </section>
      </main>
    </>
  );
};

MainPage.getLayout = (page) => <Layout>{page}</Layout>;
export default MainPage;
