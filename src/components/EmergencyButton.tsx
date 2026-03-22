import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, MapPin, X, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function EmergencyButton() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
    }, 1500);
  };

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 z-[90] flex h-14 w-14 items-center justify-center rounded-full bg-rose-600 text-white shadow-xl shadow-rose-200"
      >
        <AlertTriangle size={28} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm dark:bg-slate-950/80">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900 dark:border dark:border-slate-800"
            >
              <div className="bg-rose-600 p-6 text-white dark:bg-rose-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <AlertTriangle size={24} />
                    {t('emergency.title')}
                  </h2>
                  <button onClick={() => setIsOpen(false)} className="rounded-full p-1 hover:bg-white/20">
                    <X size={20} />
                  </button>
                </div>
                <p className="mt-2 text-sm opacity-90">
                  {t('emergency.subtitle')}
                </p>
              </div>

              <div className="p-6">
                {!submitted ? (
                  <div className="space-y-6">
                    <div className="rounded-2xl bg-slate-50 p-6 flex flex-col items-center text-center gap-4 dark:bg-slate-800">
                      <div className="h-16 w-16 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
                        <MapPin size={32} />
                      </div>
                      <div>
                        <div className="text-lg font-bold text-slate-900 dark:text-white">{t('emergency.autoTagging')}</div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('emergency.locationDesc')}</p>
                      </div>
                    </div>
                    
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="w-full rounded-2xl bg-rose-600 py-4 font-bold text-white shadow-lg hover:bg-rose-700 disabled:opacity-50 dark:bg-rose-700 dark:hover:bg-rose-800"
                    >
                      {isSubmitting ? <Loader2 className="animate-spin mx-auto" /> : t('emergency.submit')}
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                      <CheckCircle2 size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('emergency.successTitle')}</h3>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                      {t('emergency.successDesc')}
                    </p>
                    <button
                      onClick={() => {setIsOpen(false); setSubmitted(false);}}
                      className="mt-6 w-full rounded-2xl border border-slate-200 py-3 font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                    >
                      {t('emergency.close')}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

function CheckCircle2({ size, className }: { size: number, className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
