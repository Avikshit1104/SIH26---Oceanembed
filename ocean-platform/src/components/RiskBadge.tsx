interface RiskBadgeProps {
  risk: 'Low' | 'Moderate' | 'High' | 'Severe';
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
}

export default function RiskBadge({ risk, size = 'md', showDot = true }: RiskBadgeProps) {
  const config = {
    Low:      { bg: 'bg-green-500/20',  border: 'border-green-500/40',  text: 'text-green-400',  dot: 'bg-green-400' },
    Moderate: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/40', text: 'text-yellow-400', dot: 'bg-yellow-400' },
    High:     { bg: 'bg-orange-500/20', border: 'border-orange-500/40', text: 'text-orange-400', dot: 'bg-orange-400' },
    Severe:   { bg: 'bg-red-500/20',    border: 'border-red-500/40',    text: 'text-red-400',    dot: 'bg-red-400' },
  }[risk];

  const sizeClass = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  }[size];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${config.bg} ${config.border} ${config.text} ${sizeClass}`}>
      {showDot && (
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot} ${risk === 'High' || risk === 'Severe' ? 'animate-pulse' : ''}`} />
      )}
      {risk}
    </span>
  );
}
