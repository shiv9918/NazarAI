import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect, useState } from 'react';
import { IndianRupee } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CostCounterProps {
  initialValue?: number;
  className?: string;
  label?: string;
}

export default function CostCounter({ initialValue = 1245210, className = "", label }: CostCounterProps) {
  const { t } = useTranslation();
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest).toLocaleString());
  const [displayValue, setDisplayValue] = useState("0");

  useEffect(() => {
    const controls = animate(count, initialValue, { duration: 2 });
    return controls.stop;
  }, [initialValue]);

  useEffect(() => {
    return rounded.onChange((v) => setDisplayValue(v));
  }, [rounded]);

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="flex items-center gap-1 text-4xl font-black text-emerald-500">
        <IndianRupee size={32} />
        <motion.span>{displayValue}</motion.span>
      </div>
      <div className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">{label || t('costCounter.label')}</div>
    </div>
  );
}
