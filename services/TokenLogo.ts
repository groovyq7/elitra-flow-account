import { isAddress } from "viem"

export class TokenLogoService {
  private static instance: TokenLogoService
  public tokenLogoCache: { [key: string]: { logoURI: string } } = {}

  private constructor() {
    this.cacheTokenLogo()
  }

  public static getInstance(): TokenLogoService {
    if (!TokenLogoService.instance) {
      TokenLogoService.instance = new TokenLogoService()
    }
    return TokenLogoService.instance
  }

  private async cacheTokenLogo() {
    try {
      const cacheTokenLogoRes = await fetch("/api/token-logo")
      const cacheTokenLogo = await cacheTokenLogoRes.json()

      // Ensure the structure of tokenLogoCache is correct
      this.tokenLogoCache = Object.keys(cacheTokenLogo).reduce((acc, key) => {
        acc[key] = { logoURI: cacheTokenLogo[key] }
        return acc;
      }, {} as { [key: string]: { logoURI: string } })
    } catch (error) {
      console.error("Failed to fetch token logos:", error)
    }
  }

  public getTokenLogo(symbolOrAddress: string | undefined): string {
    if(!symbolOrAddress) return "/icons/newtoken.png"
    const cacheKey = isAddress(symbolOrAddress || '', { strict: false }) ? symbolOrAddress.toLowerCase() : symbolOrAddress;
    if (this.tokenLogoCache[cacheKey]) {
      return this.tokenLogoCache[cacheKey].logoURI
    }
    
    if (String(symbolOrAddress).includes('USDC.e')){
      return this.tokenLogoCache['USDC']?.logoURI || "https://raw.githubusercontent.com/0xstoryhunt/default-list/refs/heads/main/tokens_logos/USDC.png"
    }
    //add ATH reward token logo
    if (symbolOrAddress.toLowerCase().includes('0xc26e824a8D0F369f296BCa49974639f5A80dcB10'.toLowerCase())) {
      return "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xbe0Ed4138121EcFC5c0E56B40517da27E6c5226B/logo.png"
    }
    return "/icons/newtoken.png"
  }

  public isVerified(address: string): boolean {
    return !!this.tokenLogoCache[address.toLowerCase()];
  }
}

export default TokenLogoService.getInstance()