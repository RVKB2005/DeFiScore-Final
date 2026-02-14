import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ScoreGaugeProps {
  score: number;
  maxScore?: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const sizeConfig = {
  sm: { width: 120, height: 60, strokeWidth: 8, fontSize: 'text-xl' },
  md: { width: 200, height: 100, strokeWidth: 12, fontSize: 'text-3xl' },
  lg: { width: 280, height: 140, strokeWidth: 16, fontSize: 'text-4xl' },
};

export function ScoreGauge({
  score,
  maxScore = 850,
  size = 'md',
  showLabel = true,
}: ScoreGaugeProps) {
  const config = sizeConfig[size];
  const percentage = (score / maxScore) * 100;
  const radius = (config.width - config.strokeWidth) / 2;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getScoreColor = () => {
    if (percentage >= 80) return 'text-success';
    if (percentage >= 60) return 'text-primary';
    if (percentage >= 40) return 'text-warning';
    return 'text-destructive';
  };

  const getStrokeColor = () => {
    if (percentage >= 80) return 'hsl(142, 76%, 36%)';
    if (percentage >= 60) return 'hsl(258, 90%, 66%)';
    if (percentage >= 40) return 'hsl(38, 92%, 50%)';
    return 'hsl(0, 84%, 60%)';
  };

  const getScoreLabel = () => {
    if (percentage >= 80) return 'Excellent';
    if (percentage >= 60) return 'Good';
    if (percentage >= 40) return 'Fair';
    return 'Poor';
  };

  return (
    <div className="flex flex-col items-center">
      <svg
        width={config.width}
        height={config.height + 10}
        viewBox={`0 0 ${config.width} ${config.height + 10}`}
      >
        {/* Background arc */}
        <path
          d={`M ${config.strokeWidth / 2} ${config.height} A ${radius} ${radius} 0 0 1 ${config.width - config.strokeWidth / 2} ${config.height}`}
          fill="none"
          stroke="hsl(222, 30%, 20%)"
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
        />
        
        {/* Progress arc */}
        <motion.path
          d={`M ${config.strokeWidth / 2} ${config.height} A ${radius} ${radius} 0 0 1 ${config.width - config.strokeWidth / 2} ${config.height}`}
          fill="none"
          stroke={getStrokeColor()}
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          style={{
            filter: `drop-shadow(0 0 8px ${getStrokeColor()})`,
          }}
        />

        {/* Score text */}
        <motion.text
          x={config.width / 2}
          y={config.height - 10}
          textAnchor="middle"
          className={cn('font-bold fill-current', getScoreColor(), config.fontSize)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {score}
        </motion.text>
      </svg>

      {showLabel && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-2 text-center"
        >
          <p className={cn('font-semibold', getScoreColor())}>{getScoreLabel()}</p>
          <p className="text-sm text-muted-foreground">out of {maxScore}</p>
        </motion.div>
      )}
    </div>
  );
}
