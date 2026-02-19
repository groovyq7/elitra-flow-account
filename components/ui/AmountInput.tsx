import React, { useEffect, useState } from "react";
import Image from "next/image";
import { Wallet, ChevronDown } from "lucide-react";
import { getTokenImage } from "@/lib/utils";
import {
  getTokenBalance,
  getTokenPrice,
  getVaultRate,
} from "@/lib/utils/get-token-balance";
import { formatPrice, formatTokenAmount } from "@/lib/utils/format";
import { useAccount, useChains, useChainId } from "wagmi";
import { TokenType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { zeroAddress, parseUnits, formatUnits } from "viem";
import Link from "next/link";

interface AmountInputProps {
  amount: string;
  setAmount: (val: string) => void;
  selectedToken: TokenType;
  setIsTokenSelectorOpen: (open: boolean) => void;
  isDisabled?: boolean;
  setIsDisabled?: (val: boolean) => void;
  className?: string;
  reload?: boolean;
}

export const AmountInput: React.FC<AmountInputProps> = ({
  amount,
  setAmount,
  selectedToken,
  setIsTokenSelectorOpen,
  isDisabled = false,
  setIsDisabled,
  className = "",
  reload = false,
}) => {
  const { address } = useAccount();
  const chains = useChains();
  const chainId = useChainId();
  const chain = chains.find((c) => c.id === chainId)!;
  // Human formatted balance string (for display)
  const [tokenBalance, setTokenBalance] = useState("0");
  // Raw on-chain balance as bigint for precision math
  const [tokenBalanceRaw, setTokenBalanceRaw] = useState<bigint>(0n);
  const [tokenPrice, setTokenPrice] = useState(0);
  const [usdAmount, setUsdAmount] = useState(0);
  const balNum = parseFloat(tokenBalance || "0");
  const enteredNum = parseFloat(amount || "0");
  const hasInsufficient =
    amount !== "" &&
    !isNaN(enteredNum) &&
    !isNaN(balNum) &&
    enteredNum > balNum;

  const handleMaxClick = (percentage: number = 100) => {
    // Use bigint math to avoid precision loss. Percentage assumed integer (25,50,75,100)
    if (!selectedToken) return;
    const decimals = selectedToken.decimals ?? 18;
    if (tokenBalanceRaw === undefined) return;

    // Convert integer percentage to bigint math
    const pct = Math.round(percentage); // ensure integer
    const amountRaw = (tokenBalanceRaw * BigInt(pct)) / 100n;

    // Gas buffer only for native token (ETH / chain native) to leave dust for gas
    const GAS_BUFFER = "0.00001"; // string for parseUnits
    let adjustedRaw = amountRaw;
    if (selectedToken.address === zeroAddress) {
      const gasBufferRaw = parseUnits(GAS_BUFFER, decimals);
      if (adjustedRaw > gasBufferRaw) {
        adjustedRaw = adjustedRaw - gasBufferRaw;
      }
    }

    const formatted = formatUnits(adjustedRaw, decimals);
    // Avoid scientific notation & trim trailing zeros but keep enough precision
    setAmount(adjustedRaw > 0n ? formatted : "0");
  };

  useEffect(() => {
    let cancelled = false;
    const fetchBalance = async () => {
      if (!address) {
        setTokenBalance("0");
        return;
      }
      const res = await getTokenBalance(selectedToken.address, address, chain);
      if (cancelled) return;
      setTokenBalance(res.formatted);
      if (res.balance !== undefined) setTokenBalanceRaw(res.balance);
      if (selectedToken.symbol.toLowerCase().startsWith("e")) {
        const price = await getTokenPrice(
          selectedToken.symbol.toUpperCase().replace("E", "")
        );
        const ratio = await getVaultRate(selectedToken.symbol, chain);
        if (cancelled) return;
        const adjustedPrice = price.price * Number(ratio.rate);
        setTokenPrice(adjustedPrice);
      } else {
        const price = await getTokenPrice(selectedToken.symbol);
        if (cancelled) return;
        setTokenPrice(price.price);
      }
    };
    fetchBalance();
    return () => { cancelled = true; };
  }, [address, selectedToken, chain, reload]);

  useEffect(() => {
    // Use precise multiplication without losing too many decimals: parse user amount as float is acceptable for USD view
    setUsdAmount(Number(amount || 0) * tokenPrice);
  }, [amount, tokenPrice]);

  // propagate disabled state when insufficient balance
  useEffect(() => {
    if (setIsDisabled) {
      setIsDisabled(hasInsufficient);
    }
  }, [hasInsufficient, setIsDisabled]);

  return (
    <div
      className={`mb-6 bg-gray-100 p-4 rounded-md border border-gray-200 ${className}`}
    >
      <h4 className="text-base sm:text-lg font-medium mb-4">Enter Amount</h4>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <input
            aria-label={`Amount in ${selectedToken?.symbol ?? "token"}`}
            inputMode="decimal"
            pattern="^[0-9]*[.,]?[0-9]*$"
            placeholder="0.00"
            value={amount}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9.]/g, "");
              setAmount(val);
            }}
            className={`text-3xl sm:text-3xl h-14 sm:h-16 pr-38 pl-4 w-full rounded-lg focus:outline-none transition text-left font-semibold bg-white appearance-none border ${
              hasInsufficient
                ? "border-red-400 focus:ring-2 focus:ring-red-300 text-red-500"
                : "border-gray-200 focus:ring-2 focus:ring-blue-200"
            }`}
            style={{ MozAppearance: "textfield" }}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
            <button
              type="button"
              aria-label={`Select token — currently ${selectedToken?.symbol}`}
              onClick={() => setIsTokenSelectorOpen(true)}
              className="flex items-center gap-2 px-2 py-2 rounded-md bg-gray-100 border border-gray-300 hover:bg-gray-200"
            >
              {getTokenImage(selectedToken?.symbol) ? (
                <Image
                  src={
                    getTokenImage(selectedToken?.symbol)! || "/placeholder.svg"
                  }
                  alt={selectedToken?.symbol}
                  width={20}
                  height={20}
                  className="w-5 h-5 rounded-full"
                />
              ) : (
                <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">
                    {selectedToken?.symbol?.charAt(0)}
                  </span>
                </div>
              )}
              <span className="font-medium">{selectedToken?.symbol}</span>
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
          <style jsx>{`
            input::-webkit-outer-spin-button,
            input::-webkit-inner-spin-button {
              -webkit-appearance: none;
              margin: 0;
            }
            input[type="number"] {
              -moz-appearance: textfield;
            }
          `}</style>
        </div>
      </div>
      {hasInsufficient && (
        <div className="pt-2 text-xs font-medium text-red-500">
          Insufficient balance
        </div>
      )}
      <div className="flex gap-2 mt-4 justify-between items-center">
        <div className="flex gap-2 mt-2 text-sm text-gray-500 flex-col">
          <div className="flex gap-2 items-center">
            <Wallet className="h-4 w-4" />
            <div
              onClick={() => {
                handleMaxClick(100);
              }}
            >
              <span className="hover:underline cursor-pointer">
                {formatTokenAmount(tokenBalance)} {selectedToken?.symbol}
              </span>
            </div>
          </div>
          <div className="text-md text-gray-400">${formatPrice(usdAmount)}</div>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            className="rounded-md bg-blue-500 text-xs font-semibold py-1 h-7"
            onClick={() => {
              handleMaxClick(100);
            }}
          >
            MAX
          </Button>
          <Button
            type="button"
            className="hidden md:block rounded-md bg-blue-500 text-xs font-semibold py-1 h-7"
            onClick={() => {
              handleMaxClick(75);
            }}
          >
            75%
          </Button>
          <Button
            type="button"
            className="rounded-md bg-blue-500 text-xs font-semibold py-1 h-7"
            onClick={() => {
              handleMaxClick(50);
            }}
          >
            50%
          </Button>
          <Button
            type="button"
            className="hidden md:block rounded-md bg-blue-500 text-xs font-semibold py-1 h-7"
            onClick={() => {
              handleMaxClick(25);
            }}
          >
            25%
          </Button>
        </div>
      </div>
      {Number(tokenBalance) <= 0 && selectedToken.noBalanceText && selectedToken.dexLink && (
        <Link href={selectedToken.dexLink} target="_blank" className="text-xs text-gray-400 mt-2 hover:underline w-full block">
          {selectedToken.noBalanceText}
        </Link>
      )}
    </div>
  );
};
