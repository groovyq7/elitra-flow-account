interface EthereumError {
  cause?: {
    code: number | string | null
    details: string
    shortMessage: string
    name: string
  }
  name?: string
  details?: string
  code?: number | string
  message?: string
  shortMessage?: string
  data?: { message?: string }
}

export class ErrorHandler {
  private static ETHEREUM_RPC_ERRORS: { [key: number]: string } = {
    4001: "Transaction rejected by user",
    4100: "Unauthorized: Please connect to your wallet",
    4200: "Unsupported method",
    4900: "Wallet disconnected",
    4901: "Chain not connected",
  }

  private static CONTRACT_ERRORS: { [key: string]: string } = {
    TRANSFER_FAILED: "Token transfer failed",
    EXPIRED: "Transaction expired",
    "SAFEMATH: SUBTRACTION UNDERFLOW": "Calculation error: Amount too low",
  }

  private static NETWORK_ERRORS: { [key: string]: string } = {
    NETWORK_ERROR: "Network error - please check your connection",
    SERVER_ERROR: "Server error - please try again later",
  }

  /**
   * Elitra/vault-specific error patterns checked before generic contract errors.
   * Each entry maps a set of substrings to a user-friendly message.
   */
  private static VAULT_ERROR_PATTERNS: Array<{
    patterns: string[]
    message: string
  }> = [
    {
      patterns: ["insufficient balance", "transfer amount exceeds balance"],
      message: "Insufficient token balance",
    },
    {
      patterns: ["allowance", "ERC20: insufficient allowance"],
      message: "Token approval required — please approve first",
    },
    {
      patterns: ["SafeTransferFrom", "safeTransferFrom"],
      message: "Token transfer failed — check your balance and approval",
    },
    {
      patterns: ["minimumMint", "minimum shares"],
      message: "Price moved — try again",
    },
    {
      patterns: ["minimumAssets"],
      message: "Slippage too high — try again",
    },
  ]

  /**
   * Main error handler that checks for various error types.
   */
  static handleError(error: unknown): string {
    const err = error as EthereumError

    // Check for viem ACTION_REJECTED code (user rejected in wallet).
    const code = err?.cause?.code || err?.code
    if (code === "ACTION_REJECTED" || code === 4001) {
      return "Transaction rejected by user"
    }

    // Attempt to extract a contract-related error.
    const contractError = this.parseContractError(err)
    if (contractError) return contractError

    // Check for Ethereum provider errors.
    const rpcError = this.parseRpcError(err)
    if (rpcError) return rpcError

    // Check for network-related errors.
    const networkError = this.parseNetworkError(err)
    if (networkError) return networkError

    // Fallback to a generic error message.
    return this.parseGenericError(err)
  }

  private static parseRpcError(error: EthereumError): string | null {
    const code = error?.cause?.code || error?.code
    if (code && typeof code === "number") {
      return this.ETHEREUM_RPC_ERRORS[code] || null
    }
    return null
  }

  private static parseContractError(error: EthereumError): string | null {
    const errorMessage =
      error?.data?.message ||
      error?.shortMessage ||
      error?.cause?.shortMessage ||
      error?.details ||
      error?.cause?.details ||
      error?.message

    if (!errorMessage) return null

    // Check Elitra/vault-specific patterns first (most relevant).
    for (const { patterns, message } of this.VAULT_ERROR_PATTERNS) {
      if (patterns.some((pattern) => errorMessage.includes(pattern))) {
        return message
      }
    }

    // Check through generic contract errors.
    for (const [key, value] of Object.entries(this.CONTRACT_ERRORS)) {
      if (errorMessage.includes(key)) return value
    }

    // Try to extract a revert reason with a regex.
    const revertReason = this.parseRevertReason(errorMessage)
    if (revertReason) return revertReason

    // Gas estimation issues.
    if (errorMessage.includes("gas")) {
      return "Not enough gas, increase gas limit"
    }

    // STF is Solidity shorthand for SafeTransferFrom failure.
    if (errorMessage.includes("STF")) {
      return "Token transfer failed"
    }

    return null
  }

  private static parseRevertReason(message: string): string | null {
    const revertRegex =
      /reverted(?: with reason)?(?: string)? ['"]([^'"]+)['"]/i
    const matches = message.match(revertRegex)
    return matches ? matches[1] : null
  }

  private static parseNetworkError(error: EthereumError): string | null {
    const errorMessage =
      error?.data?.message ||
      error?.shortMessage ||
      error?.cause?.shortMessage ||
      error?.details ||
      error?.cause?.details ||
      error?.message
    const code = error?.cause?.code || error?.code
    if (errorMessage?.includes("Network Error")) {
      return this.NETWORK_ERRORS.NETWORK_ERROR
    }
    if (code === "SERVER_ERROR") {
      return this.NETWORK_ERRORS.SERVER_ERROR
    }
    return null
  }

  private static parseGenericError(error: EthereumError): string {
    console.error("Unhandled error:", error)
    const errorMessage =
      error?.data?.message ||
      error?.shortMessage ||
      error?.cause?.shortMessage ||
      error?.details ||
      error?.cause?.details ||
      error?.message
    return errorMessage || "Please try again later"
  }

  /**
   * Utility function to format a message for user display.
   */
  static getReadableErrorMessage(message: string): string {
    if (!message) return ""
    return message.charAt(0).toUpperCase() + message.slice(1)
  }
}
