# ABI Files — lib/abis/

This directory contains ABI (Application Binary Interface) JSON files for smart contracts
used by the Elitra platform. Some ABIs are actively used in the UI; others are included
for completeness, future features, or use by external integrators.

**Do not delete any file from this directory without checking with the Spicenet team.**

## Actively Used in the UI

| File | Contract | Purpose |
|------|----------|---------|
| `EliteraTeller.json` | EliteraTeller | Encodes `bulkWithdrawNow` calls in SpiceWithdrawModal and WithdrawModal |
| `EliteraAccountant.json` | EliteraAccountant | Reads vault rate (assets per share) for slippage calculation |
| `TakaraMarketState.json` | TakaraMarketState | Fetches market state for the Takara lending integration |
| `YeiMarket.json` | YeiMarket | Fetches market state for the Yei lending integration |

## Included for Future Use / Integrators

| File | Contract | Purpose |
|------|----------|---------|
| `EliteraVault.json` | EliteraVault (ERC-4626) | Core vault share token. Included for future vault management UI and external integrators querying share balances, totalAssets, etc. |
| `BoringVault.json` | BoringVault | Underlying boring-vault contract. Included for future direct vault interaction features and integrator reference. |
| `EliteraAuthority.json` | EliteraAuthority | Role-based access control for the Elitra protocol. Included for future admin tooling and integrator reference. |
| `EliteraManager.json` | EliteraManager | Manages strategy execution and rebalancing. Included for future yield strategy UI and integrator reference. |
| `ManagerWithMerkleVerification.json` | ManagerWithMerkleVerification | Extension of EliteraManager with Merkle-tree proof-based call verification. Included for future strategy management features. |
