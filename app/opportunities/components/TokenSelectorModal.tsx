import { Dialog, DialogContent } from "@/components/ui/dialog";
import Image from "next/image";
import { getTokenImage } from "@/lib/utils";
import React from "react";
import { DialogTitle } from "@radix-ui/react-dialog";
import { trackModalOpen, trackTokenSelected } from '@/lib/analytics'
import { TokenType } from "@/lib/types";

interface TokenSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedToken: TokenType;
  setSelectedToken: (val: TokenType) => void;
  tokens: TokenType[];
}

export const TokenSelectorModal: React.FC<TokenSelectorModalProps> = ({
  open,
  onOpenChange,
  selectedToken,
  setSelectedToken,
  tokens,
}) => {
  return (
  <Dialog open={open} onOpenChange={(v) => { if (v) trackModalOpen('token-selector'); onOpenChange(v) }}>
      <DialogTitle></DialogTitle>
      <DialogContent className="sm:max-w-[400px] max-w-[95vw] p-0">
        <div className="p-4 sm:p-6">
          <h3 className="text-lg font-semibold mb-4">Select Token</h3>
          <div className="space-y-2">
            {tokens.map((token) => (
              <button
                key={token.address}
                onClick={() => {
                  setSelectedToken(token);
                  trackTokenSelected(token.symbol, token.address)
                  onOpenChange(false);
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all hover:bg-gray-50 ${
                  selectedToken?.address === token.address ? "border-primary bg-primary/5" : "border-gray-200"
                }`}
              >
                {getTokenImage(token.symbol) ? (
                  <Image
                    src={getTokenImage(token.symbol)! || "/placeholder.svg"}
                    alt={token.symbol}
                    width={32}
                    height={32}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center border-2 border-primary/20">
                    <span className="text-sm font-bold text-primary">{token.symbol.charAt(0)}</span>
                  </div>
                )}
                <div className="text-left">
                  <div className="font-medium">{token.symbol}</div>
                  {token.name && <div className="text-xs text-muted-foreground">{token.name}</div>}
                </div>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
