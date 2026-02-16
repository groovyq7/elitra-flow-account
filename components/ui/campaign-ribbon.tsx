"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface CampaignRibbonProps {
  className?: string;
}

export function CampaignRibbon({ className = "" }: CampaignRibbonProps) {
  return (
    <Link
      href="/campaign"
      className={`
        w-full block bg-primary/7 text-primary-foreground py-2 px-4 ${className}
        transition-all duration-200
        hover:bg-primary/1
        hover:text-primary
      `}
      style={{ textDecoration: "none" }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-center">
          <span className="flex items-center space-x-2">
            <span className="text-sm font-medium text-primary">
              Elitra ₿app OG Pass - Claim Now
            </span>
          <ChevronRight className="h-4 w-4 text-primary" />
        </span>
      </div>
    </Link>
  );
}
