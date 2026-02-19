# E2E Test Scenarios — Elitra SpiceFlow Integration

## 1. Page Load & Health

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 1.1 | App loads without crash | Navigate to `/` | Page renders, no white screen |
| 1.2 | No unhandled console errors on load | Navigate to `/`, capture `console.error` | Zero errors (warnings OK) |
| 1.3 | Title is correct | Navigate to `/` | Document title contains "Elitra" |
| 1.4 | Logo renders | Navigate to `/` | `img[alt="Elitra"]` is visible |
| 1.5 | Vault detail page loads | Navigate to a valid `/vault/[id]` | Page renders vault info |

## 2. Navigation

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 2.1 | Logo links to home | Click logo in nav | URL is `/` |
| 2.2 | Opportunities page is default | Navigate to `/` | Opportunities content visible |

## 3. Wallet Connect / Disconnect

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 3.1 | Connect button visible | Load page | "Connect" button is visible |
| 3.2 | Connect button opens modal | Click "Connect" | RainbowKit modal appears |
| 3.3 | Disconnect (mocked) | Mock connected state → disconnect | Button reverts to "Connect" |

## 4. Deposit Modal

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 4.1 | Deposit opens from opportunities | Click "Deposit" on opportunities page | Deposit modal/overlay appears |
| 4.2 | Deposit opens from vault detail | Click "Deposit" on vault page | Deposit modal/overlay appears |
| 4.3 | Deposit modal closes | Open deposit → close it | Modal gone, page visible |

## 5. Supply / Gasless Deposit Modal

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 5.1 | Supply modal opens | Trigger openSupply | Supply modal appears |
| 5.2 | Supply modal closes | Open → close supply modal | Modal gone |

## 6. Withdraw Modal

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 6.1 | Withdraw modal opens | Click "Withdraw" | Chain select step appears |
| 6.2 | Withdraw modal closes | Open → close withdraw modal | Modal gone |

## 7. Account Badge & Popup

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 7.1 | Badge shows balance when funded | Set crossChainBalance > 0 | Badge displays formatted amount |
| 7.2 | Badge click opens popup | Click account badge | Popup card appears |
| 7.3 | ESC closes popup | Open popup → press Escape | Popup closes |
| 7.4 | Click outside closes popup | Open popup → click outside | Popup closes |
| 7.5 | Popup shows deposit history | Add deposits → open popup | Recent deposits listed |

## 8. Form Validation

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 8.1 | Zero amount rejected | Enter "0" in deposit/supply amount | Submit button disabled or error shown |
| 8.2 | Empty amount rejected | Leave amount blank | Submit button disabled |
| 8.3 | Huge number handled | Enter "999999999999" | No crash, graceful handling |
| 8.4 | Negative number rejected | Enter "-1" | Input rejected or error |

## 9. Balance Updates

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 9.1 | Balance updates after deposit | Call addDeposit with usdValue | crossChainBalance increases |
| 9.2 | Balance updates after withdraw | Call deductBalance | crossChainBalance decreases, never < 0 |

## 10. Mobile Viewport (375px)

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 10.1 | Layout doesn't overflow | Set viewport 375x812 | No horizontal scroll |
| 10.2 | Nav is usable | 375px viewport | Logo and connect button visible |
| 10.3 | Content readable | 375px viewport | Text not clipped, buttons tappable |

## 11. Error Resilience

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 11.1 | SDK error boundary catches crash | SDK component throws | Error boundary renders fallback, auto-resets |
| 11.2 | NaN balance guard | addDeposit with NaN usdValue | Balance unchanged (NaN treated as 0) |
