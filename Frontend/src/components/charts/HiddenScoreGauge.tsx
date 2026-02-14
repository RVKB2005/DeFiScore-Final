import { motion } from 'framer-motion';
import { Lock, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface HiddenScoreGaugeProps {
  onViewScore: () => void;
}

export function HiddenScoreGauge({ onViewScore }: HiddenScoreGaugeProps) {
  // SVG dimensions
  const width = 280;
  const height = 160;
  const strokeWidth = 20;
  const radius = (width - strokeWidth) / 2 - 10;
  const centerY = height - 20;

  return (
    <div className="flex flex-col items-center">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible opacity-50"
      >
        {/* Background arc - dark (full arc shown as locked) */}
        <path
          d={`M ${strokeWidth / 2 + 10} ${centerY} A ${radius} ${radius} 0 0 1 ${width - strokeWidth / 2 - 10} ${centerY}`}
          fill="none"
          stroke="hsl(222, 30%, 18%)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        
        {/* Partial hint arc - muted purple */}
        <path
          d={`M ${strokeWidth / 2 + 10} ${centerY} A ${radius} ${radius} 0 0 1 ${width - strokeWidth / 2 - 10} ${centerY}`}
          fill="none"
          stroke="hsl(var(--primary) / 0.3)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray="20 15"
        />
      </svg>

      {/* Hidden Score Display */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-center -mt-16"
      >
        <div className="flex items-center justify-center gap-2">
          <Lock className="w-8 h-8 text-muted-foreground" />
          <p className="text-5xl font-bold text-muted-foreground tracking-wider">• • •</p>
        </div>
        <p className="text-muted-foreground mt-2">Score Hidden</p>
      </motion.div>

      {/* View Score Button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-6"
      >
        <Button
          variant="glow"
          onClick={onViewScore}
          className="gap-2"
        >
          <Eye className="w-4 h-4" />
          View Score
        </Button>
      </motion.div>

      {/* Description */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-muted-foreground text-center mt-4 text-sm max-w-xs"
      >
        Enter your password to decrypt and view your on-chain credit score.
      </motion.p>
    </div>
  );
}
