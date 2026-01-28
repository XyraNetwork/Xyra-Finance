### Xyra Finance – Lending Pool Program (`lending_pool_v8.aleo`)

---

## Overview

**Xyra Finance** is a privacy-first lending and borrowing protocol on **Aleo**. We are building the **first fully private money market** on Aleo—inspired by Aave’s design but reimplemented from the ground up to use zero-knowledge privacy.

**What we’re doing**

- **Problem**: Existing DeFi lending (Aave, Compound) exposes user balances and strategies, attracts MEV and liquidation sniping, and is unsuitable for institutions and DAOs. Privacy chains today lack full money-market mechanics (supply, borrow, repay, interest, liquidations).
- **Solution**: A complete lending protocol where **deposits, borrows, repayments, withdrawals, and interest** are tracked on-chain, but **user positions stay private** (encrypted Aleo records). Pool-level metrics (TVL, utilization, interest index) remain provable without revealing individual data.
- **Current status (Wave 1)**: We have implemented and deployed a **single-asset lending pool** (`lending_pool_v8.aleo`) with all core features—deposit, borrow, repay, withdraw, accrue interest, utilization tracking—and a **web dApp** that connects Aleo wallets, executes transactions, and fetches/decrypts user records to show positions. This is **state tracking only** (no real asset/token integration yet); it is the foundation for the full private money market we are building.

**Vision**: Establish Aleo as the **private credit layer of Web3**—MEV-free, compliant-friendly, and capable of undercollateralized and institutional lending in future phases.

---

### About this directory

This directory contains the **core Leo program** for Xyra Finance. The current on‑chain component (`lending_pool_v8.aleo`) implements a **single‑asset lending pool** with:

- **Deposits** (supply)  
- **Borrows**  
- **Repayments**  
- **Withdrawals**  
- **Interest accrual & utilization tracking**  
- **Private per‑user activity via Aleo records**

This is the foundation of our Wave Hacks submission: a **private money market on Aleo**. The frontend and integration logic live in the root `Aave-Aleo` project; this `program/` folder is focused on the Leo contracts and tests.

---

### 1. Features (Current Wave)

The `lending_pool_v8.aleo` program (see `src/main.leo`) includes:

- **Upgradable constructor**
  - Uses Leo’s `@admin` mechanism so the program can be upgraded by a designated admin address.

- **Public pool state (aggregates)**
  - `total_supplied`
  - `total_borrowed`
  - `interest_index`
  - `utilization_index`
  - All tracked as public mappings keyed by a global pool key.

- **Private user activity**
  - `UserActivity` record with:
    - `owner`
    - `total_deposits`
    - `total_withdrawals`
    - `total_borrows`
    - `total_repayments`
  - Per‑user aggregates stored in private mappings keyed by a **hashed address** (`field`) for privacy.

- **Core transitions**
  - `deposit(amount: u64)`  
  - `borrow(amount: u64)`  
  - `repay(amount: u64)`  
  - `withdraw(amount: u64)`  
  - `accrue_interest(delta_index: u64)`  
  - `get_address_hash()`  
  - `get_user_activity()`

All state‑changing operations are implemented as `async transition` + `async finalize_*` pairs, aligning with Aleo’s execution model.

---

### 2. Roadmap (Contract Side)

**Phase 1 – Completed (this repo)**  
- Single‑asset lending pool (`lending_pool_v8.aleo`).  
- Over‑collateralized borrowing logic.  
- Pool‑level interest index & utilization index.  
- Basic liquidation/risk constraints inside the pool (no real token transfers yet).  

**Phase 2 – Planned**  
- Multi‑asset pools and pool configuration.  
- Position manager program for aggregated user state.  
- Liquidation controller and richer risk engine (separate Leo modules).  

**Phase 3 – Planned**  
- ZK credit primitives and under‑collateralized lending.  
- Oracle adapter for external price feeds.  
- Specialized institutional / DAO pools with custom risk parameters.

---

### 3. Tech Stack

- **Language**: Leo (ProvableHQ Aleo smart contract language)  
- **Target chain**: Aleo Testnet (for current deployment)  
- **Core program**: `lending_pool_v8.aleo` (`src/main.leo`)  
- **Tests**: `program/tests/test_lending_pool.leo` (basic harness against `lending_pool_v8.aleo`)  

The frontend, wallet integration, and off‑chain logic are in the root project (Next.js + React + `@provablehq/aleo-wallet-adaptor-*`), and interact with this program via standard Aleo transaction flows.

---

### 4. Setup & Build Instructions

#### 4.1 Prerequisites

- **Leo** CLI installed (see official docs for installation).  
- A recent Rust toolchain (if building Leo from source).  
- (Optional) Aleo account / keys configured in `.env` for deployment and real executions.

From the `program/` directory:

```bash
cd program
```

#### 4.2 Install / Initialize

If this project was created with `leo new`, the scaffolding is already in place. To verify:

```bash
leo info
```

You should see `lending_pool_v8.aleo` as the main program in `src/main.leo`.

#### 4.3 Build

Compile the program:

```bash
leo build
```

This will:

- Type‑check the Leo code.  
- Generate the Aleo program artifacts in `build/`.  

#### 4.4 Run Transitions Locally

You can execute transitions with sample inputs using:

```bash
# Example: simulate a deposit of 100 units
leo run deposit 100u64

# Example: simulate accrue_interest with a delta index of 10_000 (scaled)
leo run accrue_interest 10000u64
```

Note: these `leo run` commands execute locally and **do not** interact with the real Aleo network; they’re for development and testing of constraints.

#### 4.5 Tests

The `tests/test_lending_pool.leo` file provides a minimal harness that imports `lending_pool_v8.aleo`:

```bash
leo test
```

This validates that the program builds and that the test harness itself compiles and runs. Because `lending_pool_v8.aleo` uses `async` transitions and `Future`s, full end‑to‑end behavioral tests are primarily handled via the frontend and manual flows (see the root project docs).

---

### 5. Frontend Integration (High‑Level)

The main dApp lives in the root of the repository (`Aave-Aleo`), and:

- Connects to Aleo wallets via `@provablehq/aleo-wallet-adaptor-react`.  
- Executes transitions (deposit, borrow, repay, withdraw, accrue_interest) via `executeTransaction`.  
- Fetches and decrypts user records from `lending_pool_v8.aleo` to display:
  - Total Deposits  
  - Total Withdrawals  
  - Total Borrows  
  - Total Repayments  
  - Net supplied / net borrowed positions  

For details on wallet integration and UI, see the main project README at the repo root.

---

### 6. Contributing

- Contract changes should keep **backwards compatibility** in mind where possible (especially for future upgrades).  
- Please run `leo build` and `leo test` before opening a PR that touches `src/main.leo` or `tests/`.  
- For larger architectural changes (new modules like `risk_engine` or `position_manager`), keep contracts small, composable, and well‑documented.