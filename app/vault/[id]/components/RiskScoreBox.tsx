interface RiskScoreBoxProps {
  score: string;
  feedback: string;
}

export function RiskScoreBox({ score, feedback }: RiskScoreBoxProps) {
  return (
    <div className="flex flex-col items-end">
      <div
        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 font-bold text-sm mb-1"
        aria-label={`Risk Score: ${score}`}
      >
        Risk Score: <span className="text-lg" aria-hidden="true">{score}</span>
      </div>
      <div className="text-xs text-muted-foreground max-w-xs text-right">{feedback}</div>
    </div>
  );
}
