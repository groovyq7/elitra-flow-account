import { useState } from "react";

interface InvestmentSectionProps {
  apy: number;
  tokenSymbol: string;
}

export function InvestmentSection({ apy, tokenSymbol }: InvestmentSectionProps) {
  const [amount, setAmount] = useState(1000);
  // Simple projection: compound interest, APY is annual
  const projected = (amount * Math.pow(1 + apy / 100, 1)).toFixed(2);
  return (
    <div className="bg-card rounded-xl p-6 flex flex-col items-center gap-4 border border-primary/10">
      <div className="text-lg font-bold mb-2">Start Investing</div>
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Amount to invest</span>
          <input
            type="number"
            aria-label="Investment amount"
            min={0}
            value={amount}
            onChange={e => setAmount(Number(e.target.value))}
            className="border rounded px-2 py-1 w-24 text-right font-mono"
          />
          <span className="font-semibold">{tokenSymbol}</span>
        </div>
        <div className="text-xs text-muted-foreground">Projected Returns (1 year):</div>
        <div className="text-lg font-semibold">
          ${amount} today → ${projected} in 1 year
        </div>
      </div>
    </div>
  );
}
