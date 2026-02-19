#!/usr/bin/env node
/**
 * ============================================================
 * patch-spiceflow.js — SDK patch script for @spicenet-io/spiceflow-ui
 * ============================================================
 *
 * TARGET SDK VERSION: 1.11.13
 * Patches are applied to the minified bundle at:
 *   node_modules/@spicenet-io/spiceflow-ui/dist/index.js
 *   node_modules/@spicenet-io/spiceflow-ui/dist/index.cjs.js
 *
 * WHY WE PATCH INSTEAD OF FORKING:
 *   The SDK is closed-source. Patching the minified bundle is the only
 *   option to fix integration issues without maintaining a full fork.
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
 * HOW TO UPDATE WHEN THE SDK VERSION CHANGES:
 *   1. Bump EXPECTED_VERSION below to match the new SDK version.
 *   2. Run `npm install` — the postinstall will fail with pattern errors.
 *   3. Diff the new minified bundle vs old to find changed patterns.
 *   4. Update each patch() call's oldPattern / newPattern as needed.
 *   5. Update the verify() calls to match the new expected patterns.
 *   6. Run `npm run postinstall` manually and confirm all VERIFIED lines pass.
 *   7. Update the SDK version pin in package.json to match.
 *
 * Patches applied:
 *   1. closeOnSelect:false — prevent SelectChainModal from closing the
 *      entire deposit flow on chain select.
 *   2. skip-privy — skip "provider-login" (Privy auth) step, go straight
 *      to "connect-wallet" after chain selection.
 *   3. external-wallet-override — add externalWalletAddress prop to
 *      SpiceDeposit inner (Mr), override useAccount() with IIFE.
 *   4. skip-connect-wallet — skip "connect-wallet" step when wallet is
 *      already connected (isConnected=true from override).
 *   5. sn-wallet-check — fix wallet-connected check in deposit form (sn)
 *      to consider externalWalletAddress in 7702 mode.
 *   6. sn-skip-privy-exec — skip Privy auth checks during deposit
 *      execution when an external wallet is provided.
 *   7. sn-bypass-privy-auth-btn — bypass "Authentication Required" button
 *      text when external wallet is connected.
 *   8. sn-7702-address-fallback — use externalWalletAddress as fallback
 *      for the embedded wallet address in 7702 deposit execution.
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

// ── SDK version guard ────────────────────────────────────────────────────────
// These patches are tightly coupled to the minified output of a specific SDK
// version. If the SDK is upgraded, patterns may silently fail to apply,
// breaking the deposit flow. Fail fast here instead of at runtime.
const EXPECTED_VERSION = "1.11.13";
const sdkPkgPath = path.join(SDK_DIR, "..", "package.json");
if (!fs.existsSync(sdkPkgPath)) {
  console.error(
    `[patch-spiceflow] ERROR: SDK package.json not found at ${sdkPkgPath}. ` +
      "Run npm install first."
  );
  process.exit(1);
}
const installedVersion = JSON.parse(
  fs.readFileSync(sdkPkgPath, "utf-8")
).version;
if (installedVersion !== EXPECTED_VERSION) {
  console.error(
    `[patch-spiceflow] ERROR: Expected SDK version ${EXPECTED_VERSION}, ` +
      `got ${installedVersion}. Patches may not apply correctly. ` +
      "Update scripts/patch-spiceflow.js if you intentionally upgraded the SDK " +
      "(see HOW TO UPDATE section at the top of this file)."
  );
  process.exit(1);
}
console.log(`[patch-spiceflow] SDK version ${installedVersion} confirmed.`);

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

/**
 * Verify that a patched pattern is present in the output file.
 * Called after all patches run. Exits with code 1 on failure so the
 * build fails loudly rather than shipping a silently broken SDK.
 */
function verify(file, expectedPattern, label) {
  const filePath = path.join(SDK_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.error(`[patch-spiceflow] VERIFY FAIL: ${file} not found`);
    process.exit(1);
  }
  const content = fs.readFileSync(filePath, "utf-8");
  if (!content.includes(expectedPattern)) {
    console.error(
      `[patch-spiceflow] VERIFY FAIL: ${label} — expected pattern not found in ${file}`
    );
    process.exit(1);
  }
  console.log(`[patch-spiceflow] VERIFIED: ${label}`);
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
//
// NOTE: The `console.log("IS NON 7702", ...)` calls below originate from the
// SDK's own source code — they are not added by this patch script. We preserve
// them in the patched output because modifying around them is unavoidable.
// These logs appear in production builds of the SDK; they are not our concern
// to remove (that would require a separate SDK release). If they become noisy,
// open a ticket with @spicenet-io.

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

// --- Fix 9: Bypass "Address not available" guard + fix nonce call ---
//
// Problem: The deposit execution function has a guard:
//   if(!D) throw new Error("Address not available")   (ESM, D = Privy embedded wallet)
//   if(!W) throw new Error("Address not available")   (CJS, W = Privy embedded wallet)
// This throws BEFORE reaching the patched user/to/sender calls, because D/W
// (Privy embedded wallet) is always undefined when using RainbowKit.
//
// The nonce call immediately after also uses D/W directly:
//   ze = await qt(D, Re)             (ESM)
//   Ze.getAccountNonce(W, je)        (CJS)
//
// Fix: bypass the guard when externalWalletAddress (G/O) is provided,
// and use G||D / O||W for the nonce call.

patch(
  "index.js",
  'if(!D)throw new Error("Address not available")',
  'if(!G&&!D)throw new Error("Address not available")',
  "sn-address-guard-esm"
);

patch(
  "index.cjs.js",
  'if(!W)throw new Error("Address not available")',
  'if(!O&&!W)throw new Error("Address not available")',
  "sn-address-guard-cjs"
);

patch(
  "index.js",
  "await qt(D,Re)",
  "await qt(G||D,Re)",
  "sn-nonce-addr-esm"
);

patch(
  "index.cjs.js",
  "getAccountNonce(W,je)",
  "getAccountNonce(O||W,je)",
  "sn-nonce-addr-cjs"
);

// ── Verification step ────────────────────────────────────────────────────────
// After all patches run, verify the key new patterns are present in both
// bundle files. If any check fails, exit(1) to fail the build immediately.

// Fix 1: closeOnSelect:false
verify("index.js",    "closeOnSelect:false",            "closeOnSelect — ESM");
verify("index.cjs.js","closeOnSelect:false",            "closeOnSelect — CJS");

// Fix 2: skip provider-login (no ternary, straight to connect-wallet)
verify("index.js",    'W("connect-wallet")',            "skip-privy (connect-wallet direct) — ESM");
verify("index.cjs.js",'j("connect-wallet")',            "skip-privy (connect-wallet direct) — CJS");

// Fix 3: externalWalletAddress prop + IIFE override
verify("index.js",    "__extAddr",                      "externalWalletAddress prop — ESM");
verify("index.cjs.js","__extAddr",                      "externalWalletAddress prop — CJS");
verify("index.js",    "__extAddr?{isConnected:!0",      "useAccount() IIFE override — ESM");
verify("index.cjs.js","__extAddr?{isConnected:!0",      "useAccount() IIFE override — CJS");

// Fix 5: wallet-connected check includes external address in 7702 mode
verify("index.js",    "re=_?!!g:!!g||m&&y&&!!Z",       "sn-wallet-check — ESM");
verify("index.cjs.js","se=$?!!x:!!x||f&&m&&!!J",       "sn-wallet-check — CJS");

// Fix 6: skip Privy auth guard when external wallet present
verify("index.js",    "!_&&!G){if(!D||!Z)",            "sn-skip-privy-exec — ESM");
verify("index.cjs.js","!$&&!O){if(!W||!J)",            "sn-skip-privy-exec — CJS");

// Fix 8: external wallet fallback for 7702 deposit addresses
verify("index.js",    "user:G||D,isDeposit:!0",        "sn-7702-submit-user — ESM");
verify("index.cjs.js","user:O||W,isDeposit:!0",        "sn-7702-submit-user — CJS");

// Fix 9: address guard + nonce call
verify("index.js",    '!G&&!D)throw new Error("Address not available")', "sn-address-guard — ESM");
verify("index.cjs.js",'!O&&!W)throw new Error("Address not available")', "sn-address-guard — CJS");
verify("index.js",    "await qt(G||D,Re)",                                "sn-nonce-addr — ESM");
verify("index.cjs.js","getAccountNonce(O||W,je)",                         "sn-nonce-addr — CJS");

console.log("[patch-spiceflow] All patches applied and verified.");
