"use client"

import { useChainId, useAccount, useSwitchChain } from "wagmi"
import { supportedChains } from "@/lib/wagmi"
import { getChainMetadata } from "@/lib/contracts/vault-registry"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AlertTriangle, ChevronDown, Check } from "lucide-react"

export function ChainStatus() {
  const chainId = useChainId()
  const { isConnected } = useAccount()
  const { switchChain } = useSwitchChain()

  if (!isConnected) return null

  const currentChain = supportedChains.find((chain) => chain.id === chainId)
  const chainMetadata = getChainMetadata(chainId)
  const isSupported = !!currentChain

  if (!isSupported) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Badge variant="destructive" className="gap-1 cursor-pointer">
            <AlertTriangle className="h-3 w-3" />
            Unsupported Chain
            <ChevronDown className="h-3 w-3" />
          </Badge>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <div className="px-2 py-1.5 text-xs text-muted-foreground">Switch to supported chain:</div>
          {supportedChains.map((chain) => {
            const metadata = getChainMetadata(chain.id)
            return (
              <DropdownMenuItem key={chain.id} onClick={() => switchChain({ chainId: chain.id })} className="gap-2">
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
          <span>{chainMetadata?.icon || "○"}</span>
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
              onClick={() => !isActive && switchChain({ chainId: chain.id })}
              className="gap-2"
              disabled={isActive}
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
