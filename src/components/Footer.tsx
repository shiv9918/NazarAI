import { useTranslation } from 'react-i18next';

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-slate-200 bg-white py-8 dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-0">
              <img
                src="/logo-removebg-preview.png"
                alt="Nazar AI Logo"
                className="h-auto w-16 align-middle"
              />
              <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white align-middle">{t('app_name')}</span>
            </div>
            <p className="mt-3 max-w-xs text-xs text-slate-500 dark:text-slate-400">
              {t('footer_desc')}
            </p>
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider dark:text-white">{t('platform')}</h4>
            <ul className="mt-3 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
              <li><a href="/report" className="hover:text-blue-600 dark:hover:text-blue-400">{t('report_issue')}</a></li>
              <li><a href="/track" className="hover:text-blue-600 dark:hover:text-blue-400">{t('track_issue')}</a></li>
              <li><a href="/map" className="hover:text-blue-600 dark:hover:text-blue-400">{t('city_map')}</a></li>
              <li><a href="/dashboard" className="hover:text-blue-600 dark:hover:text-blue-400">{t('admin_dashboard')}</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider dark:text-white">{t('contact')}</h4>
            <ul className="mt-3 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
              <li>{t('delhi_municipal_corp')}</li>
              <li>{t('civic_centre')}</li>
              <li>{t('new_delhi_address')}</li>
              <li>support@civiceye.delhi.gov.in</li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-slate-100 pt-6 flex flex-col md:flex-row justify-between items-center gap-4 dark:border-slate-800">
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            {t('copyright')}
          </p>
          <div className="flex gap-4">
            <a href="#" className="text-[10px] text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">{t('privacy_policy')}</a>
            <a href="#" className="text-[10px] text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">{t('terms_of_service')}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
