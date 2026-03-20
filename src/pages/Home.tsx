import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Camera, Search, CheckCircle, TrendingUp, Shield, Zap, AlertTriangle, MapPin, Smartphone, User, Send } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalToday: 247,
    resolvedToday: 124,
    avgTime: "2.3 days",
    emergencyIssues: 12
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        moneySaved: prev.moneySaved + Math.floor(Math.random() * 100)
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col dark:bg-slate-950">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white py-20 lg:py-32 dark:bg-slate-950">
        <div className="absolute inset-0 z-0 opacity-10">
          <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-blue-600 blur-3xl"></div>
          <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-emerald-600 blur-3xl"></div>
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-5xl font-extrabold tracking-tight text-slate-900 sm:text-7xl dark:text-white"
            >
              {t('hero_title')}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-400"
            >
              {t('hero_subtitle')}
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
            >
              <button
                onClick={() => navigate(isAuthenticated ? '/report' : '/login')}
                className="group flex items-center gap-2 rounded-full bg-blue-600 px-8 py-4 text-lg font-semibold text-white shadow-xl shadow-blue-200 transition-all hover:bg-blue-700 hover:scale-105 dark:shadow-blue-900/20"
              >
                <Camera size={20} />
                {t('report_issue')}
                <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
              </button>
              <button
                onClick={() => navigate(isAuthenticated ? '/track' : '/login')}
                className="rounded-full border-2 border-slate-200 px-8 py-4 text-lg font-semibold text-slate-700 transition-all hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
              >
                {t('track_issue')}
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-slate-900 py-8 text-white dark:bg-slate-950 dark:border-y dark:border-slate-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-400">{stats.totalToday}</div>
              <div className="mt-1 text-xs uppercase tracking-wider text-slate-400">{t('stats_today')}</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-emerald-400">{stats.resolvedToday}</div>
              <div className="mt-1 text-xs uppercase tracking-wider text-slate-400">{t('stats_resolved')}</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-400">{stats.avgTime}</div>
              <div className="mt-1 text-xs uppercase tracking-wider text-slate-400">{t('stats_time')}</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-rose-400">{stats.emergencyIssues}</div>
              <div className="mt-1 text-xs uppercase tracking-wider text-slate-400">{t('emergency_issues')}</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-slate-50 py-24 relative overflow-hidden dark:bg-slate-900/50">
        <div className="absolute top-1/2 left-0 w-full h-1 bg-blue-100 -translate-y-1/2 hidden lg:block z-0 dark:bg-blue-900/20"></div>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <h2 className="mb-16 text-center text-3xl font-bold text-slate-900 dark:text-white">{t('how_it_works')}</h2>
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4">
            {[
              { 
                icon: <User className="text-slate-600 dark:text-slate-400" />, 
                title: t('step0'), 
                desc: t('step0_desc'),
                color: "bg-slate-100 dark:bg-slate-800"
              },
              { 
                icon: <Camera className="text-blue-600 dark:text-blue-400" />, 
                title: t('step1'), 
                desc: t('step1_desc'),
                color: "bg-blue-50 dark:bg-blue-900/20"
              },
              { 
                icon: <MapPin className="text-emerald-600 dark:text-emerald-400" />, 
                title: t('step2'), 
                desc: t('step2_desc'),
                color: "bg-emerald-50 dark:bg-emerald-900/20"
              },
              { 
                icon: <Send className="text-indigo-600 dark:text-indigo-400" />, 
                title: t('step3'), 
                desc: t('step3_desc'),
                color: "bg-indigo-50 dark:bg-indigo-900/20"
              }
            ].map((step, i) => (
              <motion.div 
                key={i} 
                whileHover={{ y: -10 }}
                className="flex flex-col items-center text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-100 dark:bg-slate-900 dark:border-slate-800"
              >
                <div className={`mb-6 flex h-20 w-20 items-center justify-center rounded-2xl ${step.color} shadow-inner`}>
                  {step.icon}
                </div>
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-600 text-white text-sm font-bold mb-4">
                  {i + 1}
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{step.title}</h3>
                <p className="mt-4 text-slate-600 leading-relaxed dark:text-slate-400">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-24 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{t('categories')}</h2>
              <p className="mt-2 text-slate-600 dark:text-slate-400">{t('categories_desc')}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { name: t('garbage'), count: 142, color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' },
              { name: t('pothole'), count: 89, color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' },
              { name: t('streetlight'), count: 56, color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' },
              { name: t('water'), count: 34, color: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-400' },
              { name: t('dump'), count: 21, color: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400' }
            ].map((cat, i) => (
              <div key={i} className="rounded-2xl border border-slate-100 bg-white p-6 transition-all hover:shadow-lg dark:bg-slate-900 dark:border-slate-800 dark:hover:shadow-blue-900/10">
                <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${cat.color}`}>
                  <TrendingUp size={24} />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white">{cat.name}</h3>
                <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{cat.count} {t('reports_this_month')}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
