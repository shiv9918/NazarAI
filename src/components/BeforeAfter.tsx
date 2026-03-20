import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface BeforeAfterProps {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
}

export default function BeforeAfter({ 
  beforeUrl, 
  afterUrl, 
  beforeLabel = "Before (Reported)", 
  afterLabel = "After (Resolved)" 
}: BeforeAfterProps) {
  const [sliderPos, setSliderPos] = useState(50);

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const position = ((x - rect.left) / rect.width) * 100;
    setSliderPos(Math.max(0, Math.min(100, position)));
  };

  return (
    <div 
      className="relative aspect-video w-full overflow-hidden rounded-3xl cursor-col-resize select-none border-4 border-white dark:border-slate-800 shadow-xl"
      onMouseMove={handleMove}
      onTouchMove={handleMove}
    >
      {/* After Image (Background) */}
      <img src={afterUrl} alt="After" className="absolute inset-0 h-full w-full object-cover" referrerPolicy="no-referrer" />
      
      {/* Before Image (Foreground with Clip) */}
      <div 
        className="absolute inset-0 h-full w-full overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
      >
        <img src={beforeUrl} alt="Before" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      </div>

      {/* Slider Line */}
      <div 
        className="absolute inset-y-0 z-10 w-1 bg-white dark:bg-slate-400 shadow-lg"
        style={{ left: `${sliderPos}%` }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xl border-2 border-slate-100 dark:border-slate-800">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="m18 8 4 4-4 4M6 8l-4 4 4 4" />
          </svg>
        </div>
      </div>

      {/* Labels */}
      <div className="absolute bottom-4 left-4 z-20 rounded-lg bg-black/40 backdrop-blur-md px-3 py-1 text-[10px] font-bold text-white uppercase tracking-wider">
        {beforeLabel}
      </div>
      <div className="absolute bottom-4 right-4 z-20 rounded-lg bg-black/40 backdrop-blur-md px-3 py-1 text-[10px] font-bold text-white uppercase tracking-wider">
        {afterLabel}
      </div>
    </div>
  );
}
