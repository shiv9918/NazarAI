import { motion } from 'framer-motion';
import { AlertCircle, CloudRain, Wind, Thermometer } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function WeatherAlert() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      className="bg-amber-50 border-b border-amber-100 dark:bg-amber-950/30 dark:border-amber-900/50"
    >
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
              <CloudRain size={18} />
            </div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              <span className="font-bold">⛈ Heavy Rain Alert:</span> 15-16 March. 23 wards at risk of flooding. Pre-deploying sanitation teams.
            </p>
          </div>
          <button 
            onClick={() => setIsVisible(false)}
            className="text-xs font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
          >
            Dismiss
          </button>
        </div>
      </div>
    </motion.div>
  );
}
