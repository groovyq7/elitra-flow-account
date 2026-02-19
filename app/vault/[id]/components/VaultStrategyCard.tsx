import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BookOpen, ChevronDown, ChevronUp, TrendingUp, Info } from "lucide-react";
import { useState } from "react";

interface VaultStrategyCardProps {
  strategyInfo: {
    title: string;
    description: string;
    details?: string[];
    risks?: string[];
  };
}

export function VaultStrategyCard({ strategyInfo }: VaultStrategyCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const details = strategyInfo.details ?? [];
  const risks = strategyInfo.risks ?? [];

  return (
    <Card className="bg-card border-border hover:border-primary/20 transition-all duration-300">
      <button
        type="button"
        className="w-full p-6 cursor-pointer text-left"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls="vault-strategy-details"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-primary" aria-hidden="true" />
            <h3 className="text-xl font-bold text-foreground uppercase tracking-wide">
              Strategy Explanation
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {strategyInfo.title}
            </Badge>
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            )}
          </div>
        </div>
        {!isExpanded && (
          <p className="text-muted-foreground mt-3">{strategyInfo.description}</p>
        )}
      </button>
      {isExpanded && (
        <div id="vault-strategy-details" className="px-6 pb-6 space-y-6">
          <Separator />
          <div>
            <p className="text-foreground mb-4">{strategyInfo.description}</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" aria-hidden="true" />
                Strategy Details
              </h4>
              {details.length > 0 ? (
                <ul className="space-y-2">
                  {details.map((detail, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 flex-shrink-0" aria-hidden="true" />
                      {detail}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No strategy details available.</p>
              )}
            </div>
            <div>
              <h4 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <Info className="h-5 w-5 text-yellow-500" aria-hidden="true" />
                Risk Considerations
              </h4>
              {risks.length > 0 ? (
                <ul className="space-y-2">
                  {risks.map((risk, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-2 flex-shrink-0" aria-hidden="true" />
                      {risk}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No risk considerations listed.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
