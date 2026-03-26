import { useTranslation } from 'react-i18next';
import { MapPinned, Construction } from 'lucide-react';

export default function CityMap() {
  const { t } = useTranslation();

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <MapPinned className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {t('city_map')}
          </h1>
        </div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Explore city-wide issue markers and track civic activity by area.
        </p>
      </header>

      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center dark:border-slate-700 dark:bg-slate-900/50">
        <Construction className="mx-auto h-8 w-8 text-amber-500" />
        <p className="mt-3 text-base font-medium text-slate-800 dark:text-slate-200">
          Map view is being prepared.
        </p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          This placeholder keeps routing stable for production builds while the interactive map module is integrated.
        </p>
      </div>
    </section>
  );
}
