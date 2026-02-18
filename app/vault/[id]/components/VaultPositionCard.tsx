import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Zap, Info, ArrowDownToLine } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useSpiceStore } from "@/store/useSpiceStore";

interface VaultPositionCardProps {
  userAssetValue: number;
  vault: any;
  depositAmount: string;
  setDepositAmount: (v: string) => void;
  handleDeposit: () => void;
  isApproving: boolean;
  isDepositing: boolean;
  needsApproval: (amount: string, decimals: number) => boolean;
  withdrawAmount: string;
  setWithdrawAmount: (v: string) => void;
  handleWithdraw: () => void;
  isWithdrawing: boolean;
}

export function VaultPositionCard({
  userAssetValue,
  vault,
  depositAmount,
  setDepositAmount,
  handleDeposit,
  isApproving,
  isDepositing,
  needsApproval,
  withdrawAmount,
  setWithdrawAmount,
  handleWithdraw,
  isWithdrawing,
}: VaultPositionCardProps) {
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const { openSupply, crossChainBalance } = useSpiceStore();

  const handleGaslessSupply = () => {
    // Use the vault's underlying deposit token (wrappedAddress for native, or address for ERC20)
    const depositAddress = vault.token0.wrappedAddress || vault.token0.address;
    openSupply({
      address: depositAddress,
      symbol: vault.token0.symbol,
      decimals: vault.token0.decimals,
    });
  };

  return (
    <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-2xl p-6 border border-primary/20 hover:border-primary/30 transition-all duration-300">
      <div className="flex items-center justify-between md:flex-row flex-col gap-3">
        <div className="flex gap-3">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold text-foreground uppercase tracking-wide">
              Your Position
            </h3>
          </div>
          <div className="text-2xl font-bold text-foreground">
            ${userAssetValue.toFixed(2)}
          </div>
        </div>
        <div className="flex gap-3">
          <Dialog open={isDepositModalOpen} onOpenChange={setIsDepositModalOpen}>
            <DialogTrigger asChild>
              <Button className="neon-button px-8 py-3 font-bold uppercase tracking-wider hover:scale-105 transition-transform duration-200">
                <Zap className="h-4 w-4 mr-2" />
                Deposit
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold uppercase tracking-wide">
                  Deposit to Vault
                </DialogTitle>
                <DialogDescription>
                  Deposit {vault.token0.symbol} to start earning yield
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Input
                    id="deposit-amount"
                    type="number"
                    style={{ height: "3rem", fontSize: "1.25rem", fontWeight: "600" }}
                    placeholder="0.0"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="text-lg p-4"
                  />
                  <div className="text-xs text-muted-foreground">
                    Asset: {vault.token0.symbol}
                  </div>
                </div>
                {depositAmount && needsApproval(depositAmount, vault.token0.decimals) && (
                  <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <Info className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm text-yellow-500">
                      Token approval required before deposit
                    </span>
                  </div>
                )}
                <Button
                  onClick={handleDeposit}
                  disabled={!depositAmount || isApproving || isDepositing}
                  className="w-full neon-button h-12 text-lg font-bold"
                >
                  {isApproving
                    ? "Approving..."
                    : isDepositing
                    ? "Depositing..."
                    : needsApproval(depositAmount, vault.token0.decimals)
                    ? "Approve & Deposit"
                    : "Deposit"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          {crossChainBalance > 0 && (
            <Button
              className="px-8 py-3 font-bold uppercase tracking-wider hover:scale-105 transition-transform duration-200 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white"
              onClick={handleGaslessSupply}
            >
              <ArrowDownToLine className="h-4 w-4 mr-2" />
              Supply (Gasless)
            </Button>
          )}
          <Button
            variant="outline"
            className="px-8 py-3 font-bold uppercase tracking-wider border-2 hover:bg-foreground hover:text-background bg-transparent hover:scale-105 transition-all duration-200"
            onClick={handleWithdraw}
            disabled={isWithdrawing}
          >
            {isWithdrawing ? "Withdrawing..." : "Withdraw"}
          </Button>
        </div>
      </div>
    </div>
  );
}
