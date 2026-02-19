"use client"

import { getChainMetadata } from "@/lib/contracts/vault-registry"
import { Badge } from "@/components/ui/badge"

interface ChainIndicatorProps {
  chainId: number | undefined
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
  const metadata = chainId != null ? getChainMetadata(chainId) : null

  if (!metadata) {
    return (
      <Badge variant={variant} className={className} aria-label="Unknown chain">
        Unknown Chain
      </Badge>
    )
  }

  return (
    <Badge
      variant={variant}
      className={className}
      aria-label={`Chain: ${metadata.shortName}`}
    >
      {showIcon && <span className="mr-1" aria-hidden="true">{metadata.icon}</span>}
      {showName && metadata.shortName}
    </Badge>
  )
}
