import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface OnChainScoreGaugeProps {
  score: number;
  maxScore?: number;
}

export function OnChainScoreGauge({
  score,
  maxScore = 1000,
}: OnChainScoreGaugeProps) {
  const percentage = (score / maxScore) * 100;
  
  // SVG dimensions
  const width = 280;
  const height = 160;
  const strokeWidth = 20;
  const radius = (width - strokeWidth) / 2 - 10;
  const centerX = width / 2;
  const centerY = height - 20;
  
  // Arc calculations for semi-circle
  const circumference = Math.PI * radius;
  const progressOffset = circumference - (percentage / 100) * circumference;

  const getScoreLabel = () => {
    if (percentage >= 75) return 'Excellent';
    if (percentage >= 50) return 'Good';
    if (percentage >= 25) return 'Fair';
    return 'Poor';
  };

  const getTierText = () => {
    if (percentage >= 75) return 'Tier 1';
    if (percentage >= 50) return 'Tier 2';
    if (percentage >= 25) return 'Tier 3';
    return 'Tier 4';
  };

  return (
    <div className="flex flex-col items-center">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        {/* Background arc - dark */}
        <path
          d={`M ${strokeWidth / 2 + 10} ${centerY} A ${radius} ${radius} 0 0 1 ${width - strokeWidth / 2 - 10} ${centerY}`}
          fill="none"
          stroke="hsl(222, 30%, 18%)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        
        {/* Progress arc - purple gradient */}
        <motion.path
          d={`M ${strokeWidth / 2 + 10} ${centerY} A ${radius} ${radius} 0 0 1 ${width - strokeWidth / 2 - 10} ${centerY}`}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: progressOffset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          style={{
            filter: 'drop-shadow(0 0 12px hsl(var(--primary) / 0.5))',
          }}
        />

        {/* End cap indicator - small dark rectangle */}
        <motion.circle
          cx={width - strokeWidth / 2 - 10}
          cy={centerY}
          r={strokeWidth / 2}
          fill="hsl(222, 30%, 15%)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        />
      </svg>

      {/* Score Display */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-center -mt-16"
      >
        <p className="text-6xl font-bold text-foreground">{score}</p>
        <p className="text-lg font-semibold text-success mt-1">{getScoreLabel()}</p>
      </motion.div>

      {/* Description */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="text-muted-foreground text-center mt-6 text-sm max-w-xs"
      >
        Your behavior indicates low risk. You qualify for{' '}
        <span className="text-foreground font-semibold">{getTierText()}</span> interest rates.
      </motion.p>
    </div>
  );
}
