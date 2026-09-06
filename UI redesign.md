# Implementation Plan - Fungible Token DApp UI/UX Redesign & Infrastructure Settings

Redesign the Midnight Fungible Token frontend application into an institutional-grade, progressive, and mobile-friendly web application with a responsive side panel (drawer on mobile, collapsible on desktop), a Midnight infrastructure configuration & settings modal with live diagnostic probes, and a reorganized dashboard layout.

## User Review Required

> [!IMPORTANT]
> **Dynamic Infrastructure Configuration**: We are introducing a dynamic `ConfigContext` that enables switching networks between **Preprod Testnet**, **Local Devnet** (`localhost:8088 / 9944 / 6300`), and **Custom Network** on the fly without changing code or restarting servers. Custom endpoints are persisted to `localStorage`.
>
> **Layout & Architecture**: The interface transitions from a single vertically-stacked column into a responsive App Shell with a **collapsible sidebar (desktop) / slide-out drawer (mobile)**, top sticky header, quick KPI metrics bar, and a reorganized workspace with tabbed sections (Circuits & Actions, Ledger Inspector, Activity Log, and System Diagnostics).

---

## Key Features & Proposed Changes

### 1. Dynamic Infrastructure Configuration System
- Create [`src/presentation/context/ConfigContext.tsx`](file:///home/paul/compact/fungible-token/src/presentation/context/ConfigContext.tsx):
  - Manages active network preset (`preprod`, `devnet`, `custom`).
  - Presets for Preprod, Local Devnet, and Custom endpoints.
  - Form validation for URLs and 32-byte contract address.
  - Persists custom overrides to `localStorage`.
  - Exposes dynamic URL getters (`getExplorerTxUrl`, `getExplorerContractUrl`).
  - Provides active configuration to all providers.

### 2. Midnight Infrastructure Configuration & Settings Modal
- Create [`src/presentation/components/InfrastructureSettingsModal.tsx`](file:///home/paul/compact/fungible-token/src/presentation/components/InfrastructureSettingsModal.tsx):
  - **Preset Selection**: Preprod Testnet vs Local Devnet vs Custom.
  - **Configurable Endpoints**:
    - Contract Address (with copy, format validator, and default reset).
    - GraphQL Indexer HTTP URL.
    - GraphQL Indexer WebSocket URL.
    - Node RPC URL.
    - Proof Server URL.
    - Faucet URL.
    - Block Explorer URL.
  - **Live Diagnostics Tool**:
    - "Test Connectivity" button that executes live HTTP/GraphQL probes against Proof Server (`/health`), Indexer (`POST { __typename }`), Node RPC, and Explorer.
    - Displays roundtrip ping latency (ms), HTTP response codes, and green/amber/red status pills.
  - **Reset & Save**: One-click restore to `deployment.config.json` defaults.

### 3. Responsive Side Panel (Sidebar & Drawer)
- Create [`src/presentation/components/Sidebar.tsx`](file:///home/paul/compact/fungible-token/src/presentation/components/Sidebar.tsx):
  - **Desktop**: Collapsible left sidebar (expanded 260px, collapsed 72px) with toggle button.
  - **Mobile / Tablet**: Smooth slide-over drawer with backdrop blur and touch swipe/close.
  - **Items**:
    - Midnight DApp Brand & Version indicator.
    - Quick section navigation (Dashboard, Contract Actions, Ledger Inspector, Activity Log, Diagnostics).
    - Connected Wallet Card (account address with copy, network badge, tNight / DUST mini gauges).
    - Infrastructure Status summary pill with direct trigger for Settings Modal.
    - Quick external links (Explorer, Faucet, Docs).

### 4. Header & Mobile Navigation Enhancements
- Modify [`src/presentation/components/Header.tsx`](file:///home/paul/compact/fungible-token/src/presentation/components/Header.tsx):
  - Add hamburger button on mobile to toggle the sidebar drawer.
  - Add quick settings gear button with tooltips.
  - Keep Lace / Test Mode switcher and Wallet connection buttons compact and responsive.
- Create [`src/presentation/components/MobileBottomNav.tsx`](file:///home/paul/compact/fungible-token/src/presentation/components/MobileBottomNav.tsx):
  - 1-tap mobile bottom navigation bar (Overview, Actions, Ledger, Activity, Settings).

### 5. Card & Dashboard Reorganization
- Modify [`app/page.tsx`](file:///home/paul/compact/fungible-token/app/page.tsx):
  - **Top KPI Summary Bar**:
    - Token Collection name, symbol, decimals, and total supply.
    - User Token Balance with formatted units.
    - Contract status (Initialized vs Uninitialized).
    - Active Network & Mode badge.
  - **Reorganized Workspace Layout**:
    - Segmented Tab Navigation for instant focus:
      - **Tab 1: Contract Actions** (`TokenActions.tsx`): Streamlined circuit execution forms (Transfer, Mint, Approve, Transfer From, Burn, Initialize) with inline validation.
      - **Tab 2: Ledger Inspector** (`QueryViewer.tsx` + Contract Metadata): Query balances and allowances with search filter and contract state details.
      - **Tab 3: Activity & Audit Log** (`ActivityLog.tsx`): Searchable and filterable transaction history with explorer links and block heights.
      - **Tab 4: Infrastructure & Network** (Live health cards, indexer status, endpoint details).
  - Wrap app in `ConfigProvider`.

### 6. PWA & Mobile Progressive Enhancements
- Create [`public/manifest.json`](file:///home/paul/compact/fungible-token/public/manifest.json) for installable Web App metadata.
- Modify [`app/layout.tsx`](file:///home/paul/compact/fungible-token/app/layout.tsx) with theme color and mobile meta tags.

---

## Verification Plan

### Automated Tests
- Run `npx vitest run` to ensure all existing contract and provider tests pass without regressions.
- Add unit tests in `tests/modules.test.ts` for:
  - `ConfigContext` preset switching and URL resolution.
  - Network configuration persistence in `localStorage`.
- Run `npx tsc --noEmit` to verify type completeness.

### Manual Verification
- Test responsive viewports in browser:
  - Mobile (375px - 430px): Verify drawer open/close, bottom nav, card responsiveness, touch targets.
  - Tablet (768px - 1024px): Verify fluid grid layout and header elements.
  - Desktop (1280px+): Verify collapsible sidebar, KPI metrics bar, and tabbed workspace.
- Test Settings Modal:
  - Open modal, switch to "Local Devnet" preset, verify endpoints populate.
  - Run "Test Connectivity" and verify latency badges.
  - Save changes, verify persistence in localStorage.
  - Click "Reset to Defaults" and verify original values restore.
