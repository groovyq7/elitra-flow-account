// Lightweight PostHog helpers with safety guards
// Client-only usage; safe no-ops if PostHog isn't ready

import posthog from 'posthog-js'

type Dict = Record<string, any>

function safeCapture(event: string, properties?: Dict) {
  if (typeof window === 'undefined') return
  try {
    // attach common props
    const common: Dict = {
      path: typeof window !== 'undefined' ? window.location.pathname : undefined,
      search: typeof window !== 'undefined' ? window.location.search : undefined,
      ts: Date.now(),
    }
    posthog?.capture?.(event, { ...common, ...(properties || {}) })
  } catch (_) {
    // swallow errors
  }
}

export function track(event: string, properties?: Dict) {
  safeCapture(event, properties)
}

// Pageviews (App Router doesn't auto track on route change by default)
export function trackPageView(pathname: string, search: string) {
  safeCapture('$pageview', { pathname, search })
}

// Modals & UI
export function trackModalOpen(modal: 'deposit' | 'withdraw' | 'spicedeposit' | 'spicewithdraw' | 'token-selector', properties?: Dict) {
  safeCapture('modal_open', { modal, ...(properties || {}) })
}

export function trackTokenSelected(tokenSymbol: string, tokenAddress: string, properties?: Dict) {
  safeCapture('token_selected', { tokenSymbol, tokenAddress, ...(properties || {}) })
}

export function trackChartTimeframeSelected(timeframe: '30d' | '6m' | '1y' | '3y', properties?: Dict) {
  safeCapture('chart_timeframe_selected', { timeframe, ...(properties || {}) })
}

// User identification
export function identifyUser(address: string, props?: Dict) {
  if (typeof window === 'undefined') return
  try {
    const distinctId = address?.toLowerCase()
    if (!distinctId) return
    posthog?.identify?.(distinctId, {
      wallet: distinctId,
      ...props,
    })
  } catch (_) {}
}

export function resetUser() {
  if (typeof window === 'undefined') return
  try {
    posthog?.reset?.()
  } catch (_) {}
}

// Wallet/chain lifecycle
export function trackWalletConnected(address: string, properties?: Dict) {
  safeCapture('wallet_connected', { address: address?.toLowerCase(), ...(properties || {}) })
}

export function trackWalletDisconnected(properties?: Dict) {
  safeCapture('wallet_disconnected', { ...(properties || {}) })
}

export function trackChainChanged(chainId: number | string, properties?: Dict) {
  safeCapture('chain_changed', { chainId, ...(properties || {}) })
}

// Approvals
export function trackApprovalAttempt(tokenSymbol: string, tokenAddress: string, amount: string | number | bigint, properties?: Dict) {
  safeCapture('approval_attempt', { tokenSymbol, tokenAddress, amount: String(amount), ...(properties || {}) })
}

export function trackApprovalResult(status: 'success' | 'error', properties?: Dict) {
  safeCapture(`approval_${status}`, properties)
}

// Deposits
export function trackDepositAttempt(properties: Dict) {
  safeCapture('deposit_attempt', properties)
}

export function trackDepositSuccess(properties: Dict) {
  safeCapture('deposit_success', properties)
}

export function trackDepositFailed(properties: Dict) {
  safeCapture('deposit_failed', properties)
}

// Withdraws
export function trackWithdrawAttempt(properties: Dict) {
  safeCapture('withdraw_attempt', properties)
}

export function trackWithdrawSuccess(properties: Dict) {
  safeCapture('withdraw_success', properties)
}

export function trackWithdrawFailed(properties: Dict) {
  safeCapture('withdraw_failed', properties)
}
