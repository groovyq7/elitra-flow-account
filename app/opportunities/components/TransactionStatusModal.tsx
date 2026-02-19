import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ArrowDown,
  CheckCircle,
  Copy,
  ExternalLink,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import { getTokenImage } from "@/lib/utils";
import React from "react";
import { useConfig } from "wagmi";
import { DialogTitle } from "@radix-ui/react-dialog";

interface TransactionStatusModalProps {
  open: boolean;
  status: "loading" | "success" | "error" | "idle";
  txHash?: string | null;
  onClose: () => void;
  copied: boolean;
  onCopy: () => void;
  modalType: "deposit" | "withdraw";
  amount: string;
  amountUSD: string;
  outputAmount: string | number;
  outputAmountUSD: string | number;
  tokenSymbol: string;
  tokenOutputSymbol?: string | null;
  tokenImage: string;
  tokenOutputImage?: string | null;
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
}

export const TransactionStatusModal: React.FC<TransactionStatusModalProps> = ({
  open,
  status,
  txHash,
  onClose,
  copied,
  onCopy,
  modalType,
  amount,
  amountUSD,
  outputAmount,
  outputAmountUSD,
  tokenSymbol,
  tokenImage,
  tokenOutputSymbol,
  tokenOutputImage,
  title,
  description,
  icon,
}) => {
  const explorerUrl = useConfig().getClient().chain.blockExplorers?.default?.url;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogTitle></DialogTitle>
      <DialogContent
        className="sm:max-w-[400px] max-w-[95vw] p-4 flex flex-col items-between justify-center"
        showCloseButton={false}
      >
        <div className="w-full flex flex-col items-center justify-between gap-4 min-h-[400px]">
          {icon ? (
            icon
          ) : status === "loading" ? (
            <svg
              className="animate-spin h-10 w-10 text-blue-600 mb-2"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              ></path>
            </svg>
          ) : status === "error" ? (
            <XCircle className="w-10 h-10 text-red-600 mb-2" />
          ) : status === "success" ? (
            <CheckCircle className="w-10 h-10 text-green-600 mb-2" />
          ) : null}
          <div
            className={
              status === "error"
                ? "text-red-700 font-semibold text-lg"
                : status === "success"
                ? "text-green-700 font-semibold text-lg"
                : status === "loading"
                ? "text-blue-700 font-semibold text-lg"
                : "text-lg font-semibold"
            }
          >
            {title ||
              (status === "loading"
                ? `Processing ${
                    modalType === "deposit" ? "Deposit" : "Withdraw"
                  }...`
                : status === "error"
                ? `${modalType === "deposit" ? "Deposit" : "Withdraw"} Failed`
                : `${
                    modalType === "deposit" ? "Deposit" : "Withdraw"
                  } Successful!`)}
          </div>
          <div className="text-sm text-center">{description || null}</div>
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 mt-2">
              {tokenImage ? (
                <Image
                  src={tokenImage}
                  alt={tokenSymbol}
                  width={28}
                  height={28}
                  className="w-7 h-7 rounded-full"
                />
              ) : (
                <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">
                    {tokenSymbol?.charAt(0)}
                  </span>
                </div>
              )}
              <div className="flex flex-col items-start">
                <span className="text-base font-semibold">
                  {amount || "0.00"} {tokenSymbol}
                </span>
                <span className="text-xs text-gray-400">
                  ≈ ${amountUSD || "0.00"}
                </span>
              </div>
            </div>
            <ArrowDown className="w-5 h-5 text-gray-400 " />
            <div className="flex items-center gap-2 mt-2">
              <Image
                src={tokenOutputImage || tokenImage}
                alt={tokenOutputSymbol || tokenSymbol}
                width={28}
                height={28}
                className="w-7 h-7 rounded-full"
              />
              <div className="flex flex-col items-start">
                <span className="text-base font-semibold">
                  {outputAmount || ""} {tokenOutputSymbol || ""}
                </span>
                <span className="text-xs text-gray-400">
                  ≈ ${outputAmountUSD || "0.00"}
                </span>
              </div>
            </div>
          </div>
          {txHash && explorerUrl && (
            <div className="flex flex-col items-center gap-2 mt-2 w-full">
              {/* <div className="flex items-center gap-3 mt-1">
                {copied ? (
                  <span className="text-green-600 text-xs ml-1">Copied</span>
                ) : (
                  <span className="text-sm font-mono">TX Hash</span>
                )}
                <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded select-all">
                  {txHash.slice(0, 10)}...{txHash.slice(-8)}
                </span>
                <button
                  onClick={onCopy}
                  className="p-1 hover:bg-gray-200 rounded"
                  title="Copy Tx Hash"
                >
                  <Copy className="w-4 h-4 text-gray-500" />
                </button>
              </div> */}
              <a
                href={`${explorerUrl}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-w-xs items-center justify-center rounded-md gap-2 p-3 mt-2 text-xs font-semibold rounded bg-gray-100 text-gray-900 hover:bg-gray-200 transition-colors shadow"
                style={{ textDecoration: "none" }}
              >
                View on Explorer
                <ExternalLink className="w-4 h-4 ml-1" />
              </a>
            </div>
          )}
          <Button
            className="min-w-xs"
            variant="secondary"
            onClick={onClose}
            disabled={status === "loading"}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
