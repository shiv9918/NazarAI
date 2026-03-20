import { useEffect, useMemo, useState } from 'react';
import { Trophy, Star, Shield, Award, Crown, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const AUTH_TOKEN_KEY = 'nazarai_auth_token';

type LeaderboardItem = {
  id: string;
  name: string;
  reportsCount: number;
  resolvedCount: number;
  points: number;
  rank: number;
};

function getBadgeKey(points: number, reportsCount: number) {
  if (points >= 1000) return 'civic_hero';
  if (points >= 600) return 'ward_guardian';
  if (points >= 200) return 'contributor';
  if (reportsCount >= 1) return 'first_report';
  return 'first_report';
}

export default function LeaderBoard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [leaders, setLeaders] = useState<LeaderboardItem[]>([]);
  const [currentUserStats, setCurrentUserStats] = useState<LeaderboardItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchLeaderboard = async () => {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      if (!token) {
        if (isMounted) {
          setLeaders([]);
          setCurrentUserStats(null);
          setLoading(false);
        }
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/reports/leaderboard`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || 'Failed to fetch leaderboard.');
        }

        if (!isMounted) return;

        setLeaders(Array.isArray(payload?.leaders) ? payload.leaders : []);
        setCurrentUserStats(payload?.currentUser || null);
      } catch (error) {
        console.error('Leaderboard fetch error:', error);
        if (isMounted) {
          setLeaders([]);
          setCurrentUserStats(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchLeaderboard();
    return () => {
      isMounted = false;
    };
  }, []);

  const badgeProgress = useMemo(() => {
    const points = currentUserStats?.points ?? 0;
    const reportsCount = currentUserStats?.reportsCount ?? 0;

    const badgeTargets = [
      { key: 'contributor', minPoints: 200 },
      { key: 'ward_guardian', minPoints: 600 },
      { key: 'civic_hero', minPoints: 1000 },
    ];

    const nextTarget = badgeTargets.find((item) => points < item.minPoints) || null;
    const maxPoints = nextTarget ? nextTarget.minPoints : Math.max(points, 1000);
    const percent = maxPoints > 0 ? Math.min(100, Math.round((points / maxPoints) * 100)) : 0;

    return {
      points,
      reportsCount,
      nextTarget,
      maxPoints,
      percent,
      badgeKey: getBadgeKey(points, reportsCount),
    };
  }, [currentUserStats]);

  const badges = [
    { key: 'first_report', icon: <Star size={16} />, color: 'bg-emerald-100 text-emerald-600' },
    { key: 'contributor', icon: <Award size={16} />, color: 'bg-blue-100 text-blue-600' },
    { key: 'ward_guardian', icon: <Shield size={16} />, color: 'bg-amber-100 text-amber-600' },
    { key: 'civic_hero', icon: <Crown size={16} />, color: 'bg-rose-100 text-rose-600' },
  ];

  const currentName = currentUserStats?.name || user?.name || 'Citizen';
  const currentInitial = currentName.charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{t('leaderboard_title')}</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">{t('leaderboard_desc')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        <div className="col-span-1 md:col-span-2 space-y-4">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 dark:text-white">
            <Trophy className="text-amber-500" size={20} />
            {t('top_contributors')}
          </h3>

          <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm dark:bg-slate-900 dark:border-slate-800">
            {loading ? (
              <div className="p-8 text-center text-sm font-bold text-slate-500 dark:text-slate-400">{t('loading')}</div>
            ) : leaders.length === 0 ? (
              <div className="p-8 text-center text-sm font-bold text-slate-500 dark:text-slate-400">
                No contributor data found in database yet.
              </div>
            ) : (
              leaders.map((entry, i) => {
                const badgeKey = getBadgeKey(entry.points, entry.reportsCount);

                return (
                  <div key={entry.id} className={`flex items-center justify-between p-6 ${i !== leaders.length - 1 ? 'border-b border-slate-100 dark:border-slate-800' : ''}`}>
                    <div className="flex items-center gap-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full font-bold ${
                        entry.rank === 1 ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' :
                        entry.rank === 2 ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' :
                        entry.rank === 3 ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400' :
                        'bg-slate-50 text-slate-400 dark:bg-slate-800/50 dark:text-slate-500'
                      }`}>
                        {entry.rank}
                      </div>
                      <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                        <User size={24} />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{entry.name}</div>
                        <div className="text-xs font-bold text-blue-600 uppercase tracking-wider dark:text-blue-400">{t(badgeKey)}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-slate-900 dark:text-white">{entry.points}</div>
                      <div className="text-xs text-slate-500 font-medium dark:text-slate-400">{t('reports_count', { count: entry.reportsCount })}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('your_progress')}</h3>
          <div className="rounded-3xl bg-slate-900 p-6 text-white shadow-xl dark:bg-slate-900 dark:border dark:border-slate-800">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-14 w-14 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                {currentInitial}
              </div>
              <div>
                <div className="font-bold">{currentName}</div>
                <div className="text-xs text-slate-400">
                  {currentUserStats?.rank ? t('rank_in_delhi', { rank: currentUserStats.rank }) : 'Rank will appear after your first report'}
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-400 uppercase">{t('points')}</span>
                  <span>{badgeProgress.points} / {badgeProgress.maxPoints}</span>
                </div>
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: `${badgeProgress.percent}%` }} />
                </div>
              </div>
              <div className="text-xs text-slate-400">
                {badgeProgress.nextTarget
                  ? t('points_away', {
                    points: Math.max(0, badgeProgress.nextTarget.minPoints - badgeProgress.points),
                    badge: t(badgeProgress.nextTarget.key),
                  })
                  : 'You have reached the highest badge tier.'}
              </div>
            </div>
          </div>

          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('badges')}</h3>
          <div className="grid grid-cols-2 gap-3">
            {badges.map((badge) => {
              const unlocked =
                (badge.key === 'first_report' && badgeProgress.reportsCount >= 1) ||
                (badge.key === 'contributor' && badgeProgress.points >= 200) ||
                (badge.key === 'ward_guardian' && badgeProgress.points >= 600) ||
                (badge.key === 'civic_hero' && badgeProgress.points >= 1000);

              return (
                <div key={badge.key} className={`flex flex-col items-center justify-center p-4 rounded-2xl border border-slate-100 dark:border-slate-800 ${unlocked ? badge.color : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'} dark:bg-slate-900/50`}>
                  {badge.icon}
                  <span className="mt-2 text-[10px] font-bold uppercase text-center">{t(badge.key)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
