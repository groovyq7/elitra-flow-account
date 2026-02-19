import { getVaultsByChain, getVaultById } from "@/lib/contracts/vault-registry"
import type { Vault, UserPosition, VaultTransaction } from "@/lib/types"

export class VaultSDK {
  private chainId: number

  constructor(chainId: number) {
    this.chainId = chainId
  }

  // Vault Data Methods
  async getVaultList(): Promise<Vault[]> {
    return getVaultsByChain(this.chainId)
  }

  async getVaultDetails(vaultId: string): Promise<Vault | null> {
    const vault = getVaultById(vaultId, this.chainId)
    return vault || null
  }

  async getUserPositions(_walletAddress: string): Promise<UserPosition[]> {
    // In production, this would make on-chain calls to get user positions
    const vaults = await this.getVaultList()

    // Mock implementation - return positions for first 2 vaults
    // Use BigInt arithmetic to avoid Number precision loss for large values (> 2^53)
    return vaults.slice(0, 2).map((vault) => {
      const decimalsMul = 10n ** BigInt(vault.token0.decimals);
      return {
        vaultId: vault.id,
        vault,
        shares: BigInt(Math.floor(Math.random() * 1000000)) * (10n ** 18n),
        assets: BigInt(Math.floor(Math.random() * 5000)) * decimalsMul,
        pendingRewards: BigInt(Math.floor(Math.random() * 100)) * decimalsMul,
      };
    })
  }

  async getUserRewards(_walletAddress: string, _vaultId?: string): Promise<bigint> {
    // Mock implementation - in production this would be contract calls
    return BigInt(Math.floor(Math.random() * 50)) * (10n ** 18n)
  }

  async getVaultTransactions(_walletAddress: string, _vaultId?: string): Promise<VaultTransaction[]> {
    // Mock implementation - in production this would query events
    return [
      {
        hash: "0x1234567890abcdef",
        type: "deposit",
        amount: BigInt("1000000000000000000"),
        timestamp: Date.now() - 86400000, // 1 day ago
        blockNumber: 18500000,
      },
      {
        hash: "0xabcdef1234567890",
        type: "withdraw",
        amount: BigInt("500000000000000000"),
        timestamp: Date.now() - 172800000, // 2 days ago
        blockNumber: 18495000,
      },
    ]
  }

  async getAllChainsVaults(): Promise<{ chainId: number; vaults: Vault[] }[]> {
    // In production, this would query multiple chains
    const supportedChains = [1, 42161, 137, 10, 8453]
    return supportedChains.map((chainId) => ({
      chainId,
      vaults: getVaultsByChain(chainId),
    }))
  }

  async getUserPositionsAllChains(_walletAddress: string): Promise<{ chainId: number; positions: UserPosition[] }[]> {
    // In production, this would query user positions across all chains
    const supportedChains = [1, 42161, 137, 10, 8453]
    return supportedChains.map((chainId) => {
      return {
        chainId,
        positions: [], // Would be populated with actual positions (new VaultSDK(chainId) as needed)
      }
    })
  }

  // Utility Methods
  calculateSharePrice(vault: Vault & { totalSupply?: bigint; totalAssets?: bigint }): number {
    if (!vault.totalSupply || vault.totalSupply === BigInt(0)) return 1
    return Number(vault.totalAssets ?? 0n) / Number(vault.totalSupply)
  }

  calculateUserValue(position: UserPosition): number {
    const sharePrice = this.calculateSharePrice(position.vault)
    return (Number(position.shares) * sharePrice) / Math.pow(10, position.vault.token0.decimals)
  }

  // Chain Management
  setChainId(chainId: number) {
    this.chainId = chainId
  }

  getChainId(): number {
    return this.chainId
  }
}

// Export singleton instance
export const vaultSDK = new VaultSDK(1) // Default to Ethereum mainnet

export class MultiChainVaultSDK {
  private sdks: Map<number, VaultSDK> = new Map()

  getSDK(chainId: number): VaultSDK {
    if (!this.sdks.has(chainId)) {
      this.sdks.set(chainId, new VaultSDK(chainId))
    }
    return this.sdks.get(chainId)!
  }

  async getAllVaults(): Promise<{ chainId: number; vaults: Vault[] }[]> {
    const supportedChains = [1, 42161, 137, 10, 8453]
    return Promise.all(
      supportedChains.map(async (chainId) => ({
        chainId,
        vaults: await this.getSDK(chainId).getVaultList(),
      })),
    )
  }

  async getUserPositionsAllChains(_walletAddress: string): Promise<{ chainId: number; positions: UserPosition[] }[]> {
    const supportedChains = [1, 42161, 137, 10, 8453]
    return Promise.all(
      supportedChains.map(async (chainId) => ({
        chainId,
        positions: await this.getSDK(chainId).getUserPositions(_walletAddress),
      })),
    )
  }
}

export const multiChainVaultSDK = new MultiChainVaultSDK()
