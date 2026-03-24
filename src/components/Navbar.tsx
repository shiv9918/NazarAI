import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import { Menu, X, Globe, User, Shield, LogIn, LogOut, ChevronDown, Award, Settings } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { t } = useTranslation();
  const { language, toggleLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { user, logout, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const profileRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navLinks = [
    { name: t('report_issue'), path: '/report' },
    { name: t('track_issue'), path: '/track' },
    { name: t('leaderboard'), path: '/leaderboard' },
    { name: t('city_map'), path: '/map' },
  ];

  const dashboardPath = user?.role === 'citizen'
    ? '/citizen-dashboard'
    : user?.role === 'department'
      ? '/dept-dashboard'
      : '/dashboard';

  const brandRedirectPath = isAuthenticated ? dashboardPath : '/';

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link to={brandRedirectPath} className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="Nazar AI Logo"
              className="h-14 w-auto object-contain"
            />
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{t('app_name')}</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex md:items-center md:gap-8">
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-900"
            >
              <Globe size={14} />
              {language === 'en' ? 'हिं' : 'EN'}
            </button>

            {/* Auth Section */}
            {isAuthenticated ? (
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center gap-2 rounded-full border border-slate-200 p-1 pr-3 transition-all hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                >
                  <img
                    src={user?.avatar}
                    alt={user?.name}
                    className="h-8 w-8 rounded-full object-cover shadow-sm"
                  />
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isProfileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950 dark:shadow-blue-900/20"
                    >
                      {/* User Info Header */}
                      <div className="bg-slate-50 p-4 dark:bg-slate-900/50">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{user?.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            user?.role === 'citizen' ? 'bg-blue-100 text-blue-600' : 'bg-rose-100 text-rose-600'
                          }`}>
                            {user?.role}
                          </span>
                          {user?.points !== undefined && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                              <Award size={10} />
                              {user.points} {t('points')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Menu Items */}
                      <div className="p-2">
                        <Link
                          to={dashboardPath}
                          onClick={() => setIsProfileOpen(false)}
                          className="flex items-center gap-3 rounded-xl p-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-blue-400"
                        >
                          <User size={18} />
                          {t('my_dashboard')}
                        </Link>
                        <Link
                          to="/settings"
                          onClick={() => setIsProfileOpen(false)}
                          className="flex w-full items-center gap-3 rounded-xl p-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-blue-400"
                        >
                          <Settings size={18} />
                          {t('settings')}
                        </Link>
                        <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                        <button
                          onClick={() => {
                            logout();
                            setIsProfileOpen(false);
                            navigate('/');
                          }}
                          className="flex w-full items-center gap-3 rounded-xl p-3 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-50 dark:hover:bg-rose-900/20"
                        >
                          <LogOut size={18} />
                          {t('logout')}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:bg-slate-800 hover:scale-105 active:scale-95"
              >
                <LogIn size={18} />
                {t('login')}
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden">
            <button onClick={() => setIsOpen(!isOpen)} className="text-slate-600 dark:text-slate-400">
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b border-slate-200 bg-white md:hidden dark:border-slate-800 dark:bg-slate-950"
          >
            <div className="space-y-1 px-4 py-4">
              <div className="flex items-center gap-4 px-3 py-2">
                <button
                  onClick={toggleLanguage}
                  className="flex items-center gap-2 text-base font-medium text-slate-600 dark:text-slate-400"
                >
                  <Globe size={18} />
                  {language === 'en' ? t('language.hindi') : t('language.english')}
                </button>
              </div>

              <div className="mt-4 border-t border-slate-100 pt-4">
                {isAuthenticated ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/50">
                      <img
                        src={user?.avatar}
                        alt={user?.name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{user?.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
                      </div>
                    </div>
                    <Link
                      to={dashboardPath}
                      onClick={() => setIsOpen(false)}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 p-4 text-sm font-bold text-white shadow-lg"
                    >
                      <User size={20} />
                      {t('my_dashboard')}
                    </Link>
                    <button
                      onClick={() => {
                        logout();
                        setIsOpen(false);
                        navigate('/');
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-600 dark:bg-rose-900/20"
                    >
                      <LogOut size={20} />
                      {t('logout')}
                    </button>
                  </div>
                ) : (
                  <Link
                    to="/login"
                    onClick={() => setIsOpen(false)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 p-4 text-sm font-bold text-white shadow-lg"
                  >
                    <LogIn size={20} />
                    {t('login_to_portal')}
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
