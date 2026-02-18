#!/usr/bin/env node
/**
 * Patches @spicenet-io/spiceflow-ui SDK to fix issues when used with
 * an external wallet (RainbowKit) instead of Privy's embedded wallet.
 *
 * ROOT CAUSE: The SDK's SpiceFlowProvider wraps children in Privy's
 * PrivyProvider, which installs its own internal WagmiProvider. When
 * the SDK's SpiceDeposit component calls useAccount(), it reads from
 * Privy's wagmi context (no wallet) instead of the app's wagmi context
 * (RainbowKit wallet connected). This makes the deposit form think
 * no wallet is connected.
 *
 * FIX STRATEGY: Make SpiceDeposit accept an optional externalWalletAddress
 * prop. When provided, use it instead of useAccount() results internally.
 * The hook is still called (React rules), but its result is overridden.
 *
 * Patches applied:
 *
 * 1. closeOnSelect: SelectChainModal closes entire deposit flow on chain
 *    select. Fix: inject closeOnSelect:false.
 *
 * 2. skip-privy: In 7702 mode, SDK navigates to "provider-login" (Privy
 *    auth) after chain selection. Fix: skip to "connect-wallet" directly.
 *
 * 3. external-wallet-override: Make Mr (SpiceDeposit inner) accept
 *    externalWalletAddress prop. When provided, override useAccount()
 *    results so isConnected=true and address=externalWalletAddress.
 *
 * Run automatically via: npm run postinstall
 */
const fs = require("fs");
const path = require("path");

const SDK_DIR = path.join(
  __dirname,
  "..",
  "node_modules",
  "@spicenet-io",
  "spiceflow-ui",
  "dist"
);

function patch(file, oldPattern, newPattern, label) {
  const filePath = path.join(SDK_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.log(`[patch-spiceflow] Skipping ${file} (not found)`);
    return;
  }
  let content = fs.readFileSync(filePath, "utf-8");
  if (!content.includes(oldPattern)) {
    // Old pattern gone — either already patched or SDK version changed
    if (content.includes(newPattern)) {
      console.log(`[patch-spiceflow] ${file} already patched (${label})`);
    } else {
      console.warn(`[patch-spiceflow] Pattern not found in ${file} (${label}), skipping`);
    }
    return;
  }
  // Use split/join instead of replace to avoid $& special replacement patterns
  content = content.split(oldPattern).join(newPattern);
  fs.writeFileSync(filePath, content);
  console.log(`[patch-spiceflow] Patched ${file} (${label})`);
}

// --- Fix 1: closeOnSelect:false on SelectChainModal inside SpiceDeposit ---

patch(
  "index.js",
  "e(tn,{isOpen:t,onClose:D,onChainSelect:ne,supportedChains:E.supportedChainIds})",
  "e(tn,{isOpen:t,onClose:D,onChainSelect:ne,supportedChains:E.supportedChainIds,closeOnSelect:false})",
  "closeOnSelect"
);

patch(
  "index.cjs.js",
  "e.jsx(js,{isOpen:t,onClose:W,onChainSelect:te,supportedChains:E.supportedChainIds})",
  "e.jsx(js,{isOpen:t,onClose:W,onChainSelect:te,supportedChains:E.supportedChainIds,closeOnSelect:false})",
  "closeOnSelect"
);

// --- Fix 2: Skip provider-login (Privy) step, go straight to connect-wallet ---

patch(
  "index.js",
  'W(w?"connect-wallet":"provider-login")',
  'W("connect-wallet")',
  "skip-privy"
);

patch(
  "index.cjs.js",
  'j(A?"connect-wallet":"provider-login")',
  'j("connect-wallet")',
  "skip-privy"
);

// --- Fix 3: External wallet override for SpiceDeposit ---
//
// Problem: Mr (SpiceDeposit inner) calls useAccount() which reads from
// Privy's internal wagmi context, not the app's RainbowKit wagmi.
// So isConnected=false and address=undefined even when wallet is connected.
//
// Solution (3a): Add externalWalletAddress to Mr's destructured props.
// Solution (3b): Replace the useAccount() destructuring with an IIFE that
// still calls the hook (satisfying React rules) but overrides the result
// when externalWalletAddress is provided.

// ESM 3a: Add externalWalletAddress to Mr's props
patch(
  "index.js",
  ",Mr=({isOpen:t,onClose:n,styles:s,className:r=\"\",postDepositBatches:o,allowedTokens:a,onDepositAmountChange:c,allowSecondAsset:i,destinationChainId:g,destinationTokenAddress:h,postDepositInstruction:u,postDepositInstructionLabel:d,airdrop:k=!1,sponsorGas:v=!1})=>{",
  ",Mr=({isOpen:t,onClose:n,styles:s,className:r=\"\",postDepositBatches:o,allowedTokens:a,onDepositAmountChange:c,allowSecondAsset:i,destinationChainId:g,destinationTokenAddress:h,postDepositInstruction:u,postDepositInstructionLabel:d,airdrop:k=!1,sponsorGas:v=!1,externalWalletAddress:__extAddr})=>{",
  "mr-add-prop-esm"
);

// ESM 3b: Override useAccount() with IIFE — hooks still called, result overridden
patch(
  "index.js",
  "{isConnected:H,address:Z}=ct()",
  "{isConnected:H,address:Z}=(()=>{const __w=ct();return __extAddr?{isConnected:!0,address:__extAddr}:__w})()",
  "mr-override-wallet-esm"
);

// CJS 3a: Add externalWalletAddress to Mr's props
patch(
  "index.cjs.js",
  "=({isOpen:t,onClose:o,styles:a,className:n=\"\",postDepositBatches:s,allowedTokens:i,onDepositAmountChange:c,allowSecondAsset:l,destinationChainId:x,destinationTokenAddress:h,postDepositInstruction:u,postDepositInstructionLabel:d,airdrop:S=!1,sponsorGas:F=!1})=>{",
  "=({isOpen:t,onClose:o,styles:a,className:n=\"\",postDepositBatches:s,allowedTokens:i,onDepositAmountChange:c,allowSecondAsset:l,destinationChainId:x,destinationTokenAddress:h,postDepositInstruction:u,postDepositInstructionLabel:d,airdrop:S=!1,sponsorGas:F=!1,externalWalletAddress:__extAddr})=>{",
  "mr-add-prop-cjs"
);

// CJS 3b: Override useAccount() with IIFE
patch(
  "index.cjs.js",
  "{isConnected:M,address:J}=Ce.useAccount()",
  "{isConnected:M,address:J}=(()=>{const __w=Ce.useAccount();return __extAddr?{isConnected:!0,address:__extAddr}:__w})()",
  "mr-override-wallet-cjs"
);

// --- Fix 4: Skip connect-wallet step when wallet already connected ---
//
// After Fix 3, H/M (isConnected) is correctly true when an external wallet
// is connected. Now we patch the chain-select handler to skip directly to
// "deposit" instead of always routing through "connect-wallet".

patch(
  "index.js",
  'ne=ae(q=>{const R=parseInt(q);S(R),x(!1),W("connect-wallet")},[w])',
  'ne=ae(q=>{const R=parseInt(q);S(R),x(!1),W(H?"deposit":"connect-wallet")},[w,H])',
  "skip-connect-wallet-esm"
);

patch(
  "index.cjs.js",
  'te=r.useCallback(N=>{const B=parseInt(N);k(B),y(!1),j("connect-wallet")},[A])',
  'te=r.useCallback(N=>{const B=parseInt(N);k(B),y(!1),j(M?"deposit":"connect-wallet")},[A,M])',
  "skip-connect-wallet-cjs"
);

// --- Fix 5: Wallet-connected check in sn (deposit form) ---
//
// Problem: sn's wallet-connected variable (re/se) uses:
//   re = _ ? !!g : m && y && !!Z
// where _ = non-7702 mode, g = externalWalletAddress, m = Privy ready,
// y = Privy authenticated, Z = embedded wallet address.
// In 7702 mode, _ is false, so re = m && y && !!Z — ignores g entirely.
// Since we use RainbowKit not Privy, m/y are false → "Wallet Not Connected".
//
// Fix: In 7702 mode, also consider externalWalletAddress (g/x):
//   re = _ ? !!g : !!g || (m && y && !!Z)

patch(
  "index.js",
  "re=_?!!g:m&&y&&!!Z",
  "re=_?!!g:!!g||m&&y&&!!Z",
  "sn-wallet-check-esm"
);

patch(
  "index.cjs.js",
  "se=$?!!x:f&&m&&!!J",
  "se=$?!!x:!!x||f&&m&&!!J",
  "sn-wallet-check-cjs"
);

// --- Fix 6: Skip Privy auth in deposit execution when external wallet connected ---
//
// Problem: sn's deposit execution (wt/ft) has a 7702-mode block:
//   if(!_) { if(!D||!Z) { error("Missing embedded wallet") }
//            if(!m||!y) { error("Please authenticate with Privy") } }
// Even with external wallet address available, this blocks execution
// because Privy is not authenticated (we use RainbowKit).
//
// Fix: Only run the Privy/embedded-wallet checks when there's NO external
// wallet. When G/O (= externalWalletAddress copy) exists, skip these checks.
//   if(!_ && !G) { ... }  (ESM)
//   if(!$ && !O) { ... }  (CJS)

patch(
  "index.js",
  'if(console.log("IS NON 7702",_),!_){if(!D||!Z)',
  'if(console.log("IS NON 7702",_),!_&&!G){if(!D||!Z)',
  "sn-skip-privy-exec-esm"
);

patch(
  "index.cjs.js",
  'if(console.log("IS NON 7702",$),!$){if(!W||!J)',
  'if(console.log("IS NON 7702",$),!$&&!O){if(!W||!J)',
  "sn-skip-privy-exec-cjs"
);

// --- Fix 7: Bypass Privy auth check in button text when external wallet connected ---
//
// Problem: sn's button text function (_t/zt) checks in 7702 mode:
//   if(F==="7702") { if(!m)return"Loading..."; if(!y)return"Authentication Required" }
// Even when externalWalletAddress is provided and wallet-connected check passes,
// the SDK still requires Privy authentication (y/m) to show "DEPOSIT".
// Since we use RainbowKit (not Privy), y is always false → "Authentication Required".
//
// Fix: Only run the 7702 Privy auth checks when there's NO external wallet:
//   if(F==="7702"&&!g) { ... }  (ESM, g = externalWalletAddress)
//   if(I==="7702"&&!x) { ... }  (CJS, x = externalWalletAddress)

patch(
  "index.js",
  'if(F==="7702"){if(!m)return"Loading...";if(!y)return"Authentication Required"}',
  'if(F==="7702"&&!g){if(!m)return"Loading...";if(!y)return"Authentication Required"}',
  "sn-bypass-privy-auth-btn-esm"
);

patch(
  "index.cjs.js",
  'if(I==="7702"){if(!f)return"Loading...";if(!m)return"Authentication Required"}',
  'if(I==="7702"&&!x){if(!f)return"Loading...";if(!m)return"Authentication Required"}',
  "sn-bypass-privy-auth-btn-cjs"
);

// --- Fix 8: Use externalWalletAddress as fallback in 7702 deposit execution ---
//
// Problem: In the 7702 else-branch of sn's deposit execution (wt/ft),
// transactions are sent to D/W (the Privy embedded wallet address from
// useEmbeddedWalletAddress). Since we use RainbowKit (not Privy), D/W
// is undefined → viem throws "Invalid to address".
//
// The externalWalletAddress is already available as G (ESM) / O (CJS).
// Fix: Use G||D / O||W so the external wallet address is used when the
// embedded wallet address is unavailable.
//
// ESM: D = embedded wallet (undefined), G = external wallet (from prop)
// CJS: W = embedded wallet (undefined), O = external wallet (from prop)

// 8a: Native ETH sendTransaction — to:D → to:G||D
patch(
  "index.js",
  "{to:D,value:Ne}",
  "{to:G||D,value:Ne}",
  "sn-7702-native-to-esm"
);

patch(
  "index.cjs.js",
  "{to:W,value:He}",
  "{to:O||W,value:He}",
  "sn-7702-native-to-cjs"
);

// 8b: ERC-20 transfer args — recipient D → G||D
patch(
  "index.js",
  "args:[D,Ne]",
  "args:[G||D,Ne]",
  "sn-7702-erc20-args-esm"
);

patch(
  "index.cjs.js",
  "args:[W,He]",
  "args:[O||W,He]",
  "sn-7702-erc20-args-cjs"
);

// 8c: submitSpiceDeposit user field — user:D → user:G||D
patch(
  "index.js",
  "user:D,isDeposit:!0",
  "user:G||D,isDeposit:!0",
  "sn-7702-submit-user-esm"
);

patch(
  "index.cjs.js",
  "user:W,isDeposit:!0",
  "user:O||W,isDeposit:!0",
  "sn-7702-submit-user-cjs"
);

// 8d: Token tracking sender — sender:D → sender:G||D
patch(
  "index.js",
  "sender:D,receiver:",
  "sender:G||D,receiver:",
  "sn-7702-sender-esm"
);

patch(
  "index.cjs.js",
  "sender:W,receiver:",
  "sender:O||W,receiver:",
  "sn-7702-sender-cjs"
);
