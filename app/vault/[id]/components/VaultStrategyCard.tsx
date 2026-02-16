import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BookOpen, ChevronDown, ChevronUp, TrendingUp, Info } from "lucide-react";
import { useState } from "react";

interface VaultStrategyCardProps {
  strategyInfo: {
    title: string;
    description: string;
    details: string[];
    risks: string[];
  };
}

export function VaultStrategyCard({ strategyInfo }: VaultStrategyCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <Card className="bg-card border-border hover:border-primary/20 transition-all duration-300">
      <div className="p-6 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-primary" />
            <h3 className="text-xl font-bold text-foreground uppercase tracking-wide">
              Strategy Explanation
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {strategyInfo.title}
            </Badge>
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>
        {!isExpanded && (
          <p className="text-muted-foreground mt-3">{strategyInfo.description}</p>
        )}
      </div>
      {isExpanded && (
        <div className="px-6 pb-6 space-y-6">
          <Separator />
          <div>
            <p className="text-foreground mb-4">{strategyInfo.description}</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                Strategy Details
              </h4>
              <ul className="space-y-2">
                {strategyInfo.details.map((detail, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 flex-shrink-0" />
                    {detail}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <Info className="h-5 w-5 text-yellow-500" />
                Risk Considerations
              </h4>
              <ul className="space-y-2">
                {strategyInfo.risks.map((risk, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-2 flex-shrink-0" />
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
