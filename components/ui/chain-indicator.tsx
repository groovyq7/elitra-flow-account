"use client"

import { getChainMetadata } from "@/lib/contracts/vault-registry"
import { Badge } from "@/components/ui/badge"

interface ChainIndicatorProps {
  chainId: number
  variant?: "default" | "outline" | "secondary"
  showIcon?: boolean
  showName?: boolean
  className?: string
}

export function ChainIndicator({
  chainId,
  variant = "outline",
  showIcon = true,
  showName = true,
  className,
}: ChainIndicatorProps) {
  const metadata = getChainMetadata(chainId)

  if (!metadata) {
    return (
      <Badge variant={variant} className={className}>
        Unknown Chain
      </Badge>
    )
  }

  return (
    <Badge variant={variant} className={className}>
      {showIcon && <span className="mr-1">{metadata.icon}</span>}
      {showName && metadata.shortName}
    </Badge>
  )
}
