import { motion } from 'framer-motion';
import { Shield, Target, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function About() {
  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-slate-950">
      {/* Hero */}
      <section className="bg-slate-900 py-24 text-white dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-extrabold tracking-tight sm:text-6xl"
          >
            {t('about_hero_title')}
          </motion.h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
            {t('about_hero_desc')}
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{t('our_mission')}</h2>
              <p className="mt-6 text-lg text-slate-600 dark:text-slate-400">
                {t('mission_desc')}
              </p>
              <div className="mt-10 space-y-6">
                {[
                  { icon: <Target className="text-blue-600 dark:text-blue-400" />, title: t('faster_detection_title'), desc: t('faster_detection_desc') },
                  { icon: <Shield className="text-emerald-600 dark:text-emerald-400" />, title: t('transparent_governance_title'), desc: t('transparent_governance_desc') },
                  { icon: <Users className="text-amber-600 dark:text-amber-400" />, title: t('citizen_empowerment_title'), desc: t('citizen_empowerment_desc') }
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex-shrink-0">{item.icon}</div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">{item.title}</h3>
                      <p className="text-slate-600 dark:text-slate-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="aspect-square rounded-3xl bg-slate-100 overflow-hidden shadow-2xl dark:bg-slate-900">
                <img 
                  src="https://picsum.photos/seed/delhi/800/800" 
                  alt="Delhi City" 
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="absolute -bottom-6 -left-6 rounded-3xl bg-blue-600 p-8 text-white shadow-xl dark:bg-blue-700">
                <div className="text-4xl font-black">272</div>
                <div className="text-sm font-bold uppercase tracking-wider opacity-80">{t('wards_covered')}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* System Architecture */}
      <section className="py-24 bg-white dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl font-bold text-slate-900 mb-16 dark:text-white">{t('system_architecture')}</h2>
          <div className="relative">
            <div className="absolute top-1/2 left-0 w-full h-1 bg-blue-100 -translate-y-1/2 hidden lg:block dark:bg-blue-900/20"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
              {[
                { step: "01", title: t('citizen_input_title'), desc: t('citizen_input_desc') },
                { step: "02", title: t('ai_detection_title'), desc: t('ai_detection_desc') },
                { step: "03", title: t('smart_routing_title'), desc: t('smart_routing_desc') },
                { step: "04", title: t('resolution_title'), desc: t('resolution_desc') }
              ].map((item, i) => (
                <div key={i} className="bg-slate-50 p-8 rounded-3xl border border-slate-100 text-center dark:bg-slate-900 dark:border-slate-800">
                  <div className="text-4xl font-black text-blue-100 mb-4 dark:text-blue-900/40">{item.step}</div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2 dark:text-white">{item.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Impact Statistics */}
      <section className="py-24 bg-slate-900 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-16">{t('impact_numbers')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
            {[
              { label: t('faster_detection_label'), value: "95%" },
              { label: t('faster_resolution_label'), value: "10x" },
              { label: t('cost_reduction_label'), value: "80%" },
              { label: t('wards_covered'), value: "272" }
            ].map((stat, i) => (
              <div key={i}>
                <div className="text-5xl font-black text-blue-400 mb-2">{stat.value}</div>
                <div className="text-xs font-bold uppercase tracking-widest text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

