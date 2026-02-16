
export class NoTradeFoundError extends Error {
  public name = 'NoTradeFoundError';
}

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
    INSUFFICIENT_OUTPUT_AMOUNT: "Insufficient output amount",
    INSUFFICIENT_LIQUIDITY: "Insufficient liquidity",
    INSUFFICIENT_INPUT_AMOUNT: "Insufficient input amount",
    EXPIRED: "Transaction expired",
    EXCESSIVE_INPUT_AMOUNT: "Excessive input amount",
    TRANSFER_FAILED: "Token transfer failed",
    "SAFEMATH: SUBTRACTION UNDERFLOW": "Calculation error: Amount too low",
    "StoryHuntV3Router: INVALID_PATH": "Invalid token swap path",
  }

  private static NETWORK_ERRORS: { [key: string]: string } = {
    NETWORK_ERROR: "Network error - please check your connection",
    SERVER_ERROR: "Server error - please try again later",
  }

  // Add a new block for quotation errors:
  private static QUOTATION_ERRORS = {
    ProviderGasError: "Gas provider error - please try again later",
    ProviderTimeoutError: "Provider timeout - please try again later",
    ProviderBlockHeaderError: "Provider block header error - please try again later",
    BlockConflictError: "Block conflict error - please check the network",
    SuccessRateError: "Success rate error - please try again later",
    NoTradeFoundError: "No trade found - please try again later",
  }

  /**
   * Main error handler that checks for various error types.
   */
  static handleError(error: any): string {
    const err = error as EthereumError

    // Explicit check for user rejection.
    const code = err?.cause?.code || err?.code
    if (code === 4001) return "Transaction rejected by user"

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
      error?.message;

      console.log("contract error : ",error);
    if (!errorMessage) return null

    // Check through defined contract errors.
    for (const [key, value] of Object.entries(this.CONTRACT_ERRORS)) {
      if (errorMessage.includes(key)) return value
    }

    // Try to extract a revert reason with a regex.
    const revertReason = this.parseRevertReason(errorMessage)
    if (revertReason) return revertReason

    // Specific case for gas estimation issues.
    if (errorMessage.includes("gas")) {
      return "Not enough gas, increase gas limit"
    }

    if (errorMessage.includes("slippage") || errorMessage.toLowerCase().includes("too little received")) {
      return "Price movement too high, increase slippage tolerance"
    }

    if (errorMessage.includes("approve")) {
      return "Token approval failed"
    }

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

  // Specific error handlers for DEX operations.
  static handleSwapError(error: any): string {
    const handled = this.handleError(error)
    if (handled !== "An unexpected error occurred - please try again")
      return handled
    const errorMessage =
      error?.data?.message ||
      error?.shortMessage ||
      error?.cause?.shortMessage ||
      error?.details ||
      error?.cause?.details ||
      error?.message
    if (errorMessage?.includes("slippage") || errorMessage.toLowerCase().includes("too little received")) {
      return "Price movement too high, increase slippage tolerance"
    }

    return handled
  }

  static handleApprovalError(error: any): string {
    const handled = this.handleError(error)
    if (handled !== "An unexpected error occurred - please try again")
      return handled
    const errorMessage =
      error?.data?.message ||
      error?.shortMessage ||
      error?.cause?.shortMessage ||
      error?.details ||
      error?.cause?.details ||
      error?.message
    if (errorMessage?.includes("approve")) {
      return "Token approval failed - check token permissions"
    }

    return handled
  }

  static handleBalanceError(error: any): string {
    const handled = this.handleError(error)
    if (handled !== "An unexpected error occurred - please try again")
      return handled
    const errorMessage =
      error?.data?.message ||
      error?.shortMessage ||
      error?.cause?.shortMessage ||
      error?.details ||
      error?.cause?.details ||
      error?.message
    if (errorMessage?.includes("balance")) {
      return "Insufficient balance for transaction"
    }

    return handled
  }

  /**
   * Utility function to format a message for user display.
   * You might want to adjust the logic to better handle acronyms.
   */
  static getReadableErrorMessage(message: string): string {
    if (!message) return ""
    return message.charAt(0).toUpperCase() + message.slice(1)
  }
}