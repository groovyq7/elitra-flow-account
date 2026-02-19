"use client"

import { useWalletAddress } from "@/components/providers/WalletAddressContext";

import { useState, useEffect } from "react"
import { useChainId, useSwitchChain } from "wagmi"

import { supportedChains } from "@/lib/wagmi"
import { getChainMetadata } from "@/lib/contracts/vault-registry"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AlertTriangle, ChevronDown, Check, Loader2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"

export function ChainStatus() {
  const chainId = useChainId()
  const connectedAddress = useWalletAddress()
  const isConnected = connectedAddress !== undefined
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain()

  const handleSwitch = async (targetChainId: number) => {
    if (isSwitching) return;
    try {
      // wagmi infers a strict union type for chainId from the config; cast to
      // satisfy the type while staying runtime-correct.
      await switchChainAsync({ chainId: targetChainId as Parameters<typeof switchChainAsync>[0]["chainId"] });
    } catch {
      toast({
        title: "Network switch failed",
        description: "Please switch the network manually in your wallet.",
        variant: "destructive",
      });
    }
  }

  // Defer wallet-dependent UI until after hydration to prevent SSR mismatch
  const [hasMounted, setHasMounted] = useState(false)
  useEffect(() => { setHasMounted(true) }, [])

  if (!hasMounted || !isConnected) return null

  const currentChain = supportedChains.find((chain) => chain.id === chainId)
  const chainMetadata = getChainMetadata(chainId)
  const isSupported = !!currentChain

  if (!isSupported) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Badge variant="destructive" className="gap-1 cursor-pointer animate-pulse" title="Wrong network — deposits on this chain may fail or lose funds">
            {isSwitching
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <AlertTriangle className="h-3 w-3" />
            }
            Wrong Network
            <ChevronDown className="h-3 w-3" />
          </Badge>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <div className="px-2 py-1.5 text-xs font-semibold text-destructive">
            ⚠️ Wrong network — switch to continue safely
          </div>
          <div className="px-2 py-1 text-xs text-muted-foreground">Switch to:</div>
          {supportedChains.map((chain) => {
            const metadata = getChainMetadata(chain.id)
            return (
              <DropdownMenuItem
                key={chain.id}
                onClick={() => handleSwitch(chain.id)}
                className="gap-2"
                disabled={isSwitching}
              >
                <span>{metadata?.icon || "○"}</span>
                {chain.name}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-secondary/80">
          {isSwitching
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <span>{chainMetadata?.icon || "○"}</span>
          }
          {chainMetadata?.shortName || currentChain.name}
          <ChevronDown className="h-3 w-3" />
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="px-2 py-1.5 text-xs text-muted-foreground">Switch network:</div>
        {supportedChains.map((chain) => {
          const metadata = getChainMetadata(chain.id)
          const isActive = chain.id === chainId
          return (
            <DropdownMenuItem
              key={chain.id}
              onClick={() => !isActive && handleSwitch(chain.id)}
              className="gap-2"
              disabled={isActive || isSwitching}
            >
              <span>{metadata?.icon || "○"}</span>
              {chain.name}
              {isActive && <Check className="h-3 w-3 ml-auto" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
