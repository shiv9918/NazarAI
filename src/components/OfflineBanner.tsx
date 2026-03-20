import { useState, useEffect } from 'react';
import { WifiOff, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline || !isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[150] w-[90%] max-w-md"
      >
        <div className="bg-amber-600 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4 border border-amber-500 dark:bg-amber-700 dark:border-amber-600">
          <div className="flex items-center gap-3">
            <WifiOff size={20} />
            <div>
              <div className="font-bold text-sm">You are offline</div>
              <div className="text-xs opacity-80">Reports will be saved and synced later.</div>
            </div>
          </div>
          <button onClick={() => setIsVisible(false)} className="p-1 hover:bg-white/20 rounded-full">
            <X size={16} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
