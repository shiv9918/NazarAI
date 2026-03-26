import { motion } from 'framer-motion';
import { ArrowRight, Camera, Search, CheckCircle, TrendingUp, Shield, Zap, AlertTriangle, MapPin, Smartphone, User, Send } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

export default function Home() {
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();
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
    <div className="bg-slate-50 text-slate-900">
      {/* Top service strip */}
      <div className="bg-blue-600 text-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-2 text-xs sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <span className="font-semibold">{t('landing.emergency')}: <span className="font-normal">911</span></span>
            <span>|</span>
            <span>{t('landing.citizens_helpline')}: <span className="font-semibold">1800-123-456</span></span>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <span>{t('landing.support_24x7')}</span>
            <span>|</span>
            <span>{t('landing.fast_secure')}</span>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 py-16 sm:py-24">
        <div className="absolute inset-0 opacity-10">
          <img src="https://images.unsplash.com/photo-1497076086858-3f934a09acd7?auto=format&fit=crop&w=1400&q=80" alt="city background" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-800/70 to-indigo-700/60"></div>
        </div>

        <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-8 px-4 sm:px-6 lg:px-8 xl:flex-row xl:items-center">
          <div className="w-full xl:w-2/3">
            <p className="mb-3 inline-flex rounded-full bg-white/20 px-4 py-1 text-sm font-medium text-white">{t('landing.empowering_city')}</p>
            <h1 className="text-4xl font-extrabold leading-tight text-white sm:text-5xl md:text-6xl">
              {t('hero_title')}
            </h1>
            <p className="mt-6 max-w-2xl text-base text-white/90 sm:text-lg">
              {t('hero_subtitle')}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                onClick={() => navigate(isAuthenticated ? '/report' : '/login')}
                className="rounded-full bg-white px-6 py-3 text-base font-semibold text-blue-700 transition duration-200 hover:scale-105 hover:bg-blue-50"
              >
                {t('report_issue')}
              </button>
              <button
                onClick={() => navigate(isAuthenticated ? '/track' : '/login')}
                className="rounded-full border border-white/80 px-6 py-3 text-base font-semibold text-white transition duration-200 hover:bg-white/20"
              >
                {t('citizen_layout.track_application')}
              </button>
            </div>
          </div>

          <div className="w-full xl:w-1/3">
            <div className="rounded-3xl border border-white/30 bg-white/90 p-6 shadow-xl backdrop-blur-2xl">
              <h3 className="text-lg font-bold text-slate-800">{t('landing.issue_success')}</h3>
              <p className="mt-2 text-sm text-slate-500">{t('landing.issues_solved_text')}</p>

              <div className="mt-5 grid grid-cols-2 gap-3 text-center">
                <div className="rounded-xl bg-blue-100 p-3 text-slate-900">
                  <p className="text-2xl font-bold">15k+</p>
                  <p className="text-xs font-medium">{t('landing.issue_solved')}</p>
                </div>
                <div className="rounded-xl bg-emerald-100 p-3 text-slate-900">
                  <p className="text-2xl font-bold">98%</p>
                  <p className="text-xs font-medium">{t('landing.success_rate')}</p>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-blue-500 p-3 text-sm text-white">
                <p className="font-semibold">{t('landing.status_live')}</p>
                <p className="text-xs">{t('landing.make_city_smart')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Services Section */}
      <section className="bg-white py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">{t('landing.government_officials')}</h2>
              <p className="mt-2 text-sm text-slate-500">{t('landing.meet_city_leaders')}</p>
              <div className="mt-4 space-y-3">
                {[
                  { name: 'Hon. Bansi Joshi', title: 'City Municipal Commissioner', phone: '98******10' },
                  { name: 'Dr. Meera Sharma', title: 'Chief Officer, Public Works', phone: '98******50' },
                  { name: 'Eliza Rodriguez', title: 'Citizen Relation Head', phone: '98******70' }
                ].map((person, i) => (
                  <div key={i} className="rounded-xl border border-slate-100 p-3">
                    <div className="text-sm font-semibold text-slate-900">{person.name}</div>
                    <div className="text-xs text-slate-500">{person.title}</div>
                    <div className="mt-1 text-xs text-slate-400">{person.phone}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">{t('landing.public_services')}</h2>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-600">{t('landing.explore_more')}</span>
              </div>
              <div className="relative mt-4">
                <input
                  type="text"
                  placeholder={t('landing.search_services')}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-10 text-sm text-slate-700 outline-none focus:border-blue-500"
                />
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[t('landing.water_leakage'), t('landing.road_repair'), t('landing.street_light'), t('landing.sanitation'), t('landing.pothole_fix')].map((item, i) => (
                  <button key={i} className="rounded-xl border border-slate-200 bg-white p-3 text-left text-sm font-medium text-slate-700 transition hover:bg-blue-50">
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">{t('landing.updates')}</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="font-semibold">{t('landing.update_1_title')}</div>
                  <div className="text-xs text-slate-500">3 min ago</div>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="font-semibold">{t('landing.update_2_title')}</div>
                  <div className="text-xs text-slate-500">10 min ago</div>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="font-semibold">{t('landing.update_3_title')}</div>
                  <div className="text-xs text-slate-500">30 min ago</div>
                </div>
              </div>
              <div className="mt-6 rounded-xl bg-blue-500 p-4 text-white">
                <h3 className="font-bold">{t('landing.citizen_assistance')}</h3>
                <p className="mt-1 text-sm">{t('landing.need_help_call')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Additional features section (kept from existing structure as optional) */}
      <section className="bg-slate-100 py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3 text-blue-600">
                <CheckCircle size={20} />
                <div>
                  <h4 className="font-bold text-slate-900">{t('landing.transparency')}</h4>
                  <p className="text-sm text-slate-500">{t('landing.track_entire_lifecycle')}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3 text-emerald-600">
                <Shield size={20} />
                <div>
                  <h4 className="font-bold text-slate-900">{t('landing.secure')}</h4>
                  <p className="text-sm text-slate-500">{t('landing.data_protected_end_to_end')}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3 text-amber-500">
                <Zap size={20} />
                <div>
                  <h4 className="font-bold text-slate-900">{t('landing.fast_processing')}</h4>
                  <p className="text-sm text-slate-500">{t('landing.issues_resolved_quickly')}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3 text-indigo-600">
                <TrendingUp size={20} />
                <div>
                  <h4 className="font-bold text-slate-900">{t('landing.continuous_improvement')}</h4>
                  <p className="text-sm text-slate-500">{t('landing.data_driven_decisions')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works workflow section */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-extrabold text-slate-900">{t('landing.how_it_works_title')}</h2>
          <p className="mt-3 text-lg text-slate-500">{t('landing.seamless_integration')}</p>
        </div>

        <div className="mx-auto mt-10 grid max-w-7xl grid-cols-1 gap-6 px-4 sm:px-6 lg:grid-cols-5 lg:gap-4 lg:px-8">
          {[
            { icon: Zap, title: t('landing.citizen_report'), description: t('landing.upload_photo_location') },
            { icon: Shield, title: t('landing.ai_detection'), description: t('landing.auto_categorize_score') },
            { icon: TrendingUp, title: t('landing.severity_scoring'), description: t('landing.prioritize_critical') },
            { icon: User, title: t('landing.dept_routing'), description: t('landing.assign_relevant_team') },
            { icon: CheckCircle, title: t('landing.resolution'), description: t('landing.track_verify_fix') }
          ].map((step, idx) => (
            <div key={idx} className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-blue-500 bg-white text-blue-600">
                <step.icon size={24} />
              </div>
              <h3 className="mt-4 text-xl font-bold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm text-slate-500">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Citizen Reviews section */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-4xl font-extrabold text-slate-900">{t('landing.citizen_reviews')}</h2>
            <p className="mt-2 text-lg text-slate-500">{t('landing.real_feedback_community')}</p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                name: 'Aditi Sharma',
                role: t('landing.resident_north_delhi'),
                pic: 'https://randomuser.me/api/portraits/women/45.jpg',
                review: t('landing.review_1_text')
              },
              {
                name: 'Rahul Verma',
                role: t('landing.local_shopkeeper'),
                pic: 'https://randomuser.me/api/portraits/men/32.jpg',
                review: t('landing.review_2_text')
              },
              {
                name: 'Nisha Jain',
                role: t('landing.college_student'),
                pic: 'https://randomuser.me/api/portraits/women/68.jpg',
                review: t('landing.review_3_text')
              }
            ].map((item, idx) => (
              <article key={idx} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-lg transition hover:-translate-y-1 hover:shadow-2xl">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-0 transition group-hover:opacity-100"></div>
                <div className="flex items-center gap-4">
                  <img src={item.pic} alt={`${item.name} avatar`} className="h-14 w-14 rounded-full object-cover ring-2 ring-blue-500" />
                  <div>
                    <div className="text-sm font-bold text-slate-900">{item.name}</div>
                    <div className="text-xs text-slate-500">{item.role}</div>
                  </div>
                </div>
                <p className="mt-4 text-slate-700">“{item.review}”</p>
                <div className="mt-5 flex items-center gap-1 text-amber-500">
                  {[1,2,3,4,5].map(star => (
                    <span key={star} className="text-lg">★</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
