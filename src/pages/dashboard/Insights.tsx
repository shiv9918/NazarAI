import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, Clock3, Download, ListChecks, ShieldAlert } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from 'react-i18next';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const AUTH_TOKEN_KEY = 'nazarai_auth_token';

type ReportStatus = 'reported' | 'in_progress' | 'resolved';
type DepartmentKey = 'roads' | 'sanitation' | 'electrical' | 'water';

type Report = {
  id: string;
  type: string;
  severity: number;
  location: string;
  ward?: string | null;
  department: string;
  status: ReportStatus;
  reportedAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
};

type DeptPerfRow = {
  key: DepartmentKey;
  name: string;
  assigned: number;
  resolved: number;
  slaPercent: number;
  avgDays: number;
  trend: 'up' | 'down';
  rank: number;
};

const DEPARTMENTS: DepartmentKey[] = ['roads', 'sanitation', 'electrical', 'water'];
const PIE_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#06b6d4', '#ef4444', '#8b5cf6'];

function tWithFallback(t: (key: string) => string, key: string, fallback: string) {
  const value = t(key);
  return value === key ? fallback : value;
}

function normalizeDepartment(value: string): DepartmentKey | null {
  const normalized = String(value || '').toLowerCase().trim();
  if (normalized === 'roads' || normalized === 'road') return 'roads';
  if (normalized === 'sanitation') return 'sanitation';
  if (normalized === 'electrical' || normalized === 'electric') return 'electrical';
  if (normalized === 'water') return 'water';
  return null;
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function formatIssueLabel(raw: string) {
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDays(value: number) {
  return `${value.toFixed(1)} d`;
}

function performanceColor(percent: number) {
  if (percent > 70) {
    return {
      text: 'text-emerald-600 dark:text-emerald-400',
      bar: 'bg-emerald-500',
      badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    };
  }

  if (percent >= 40) {
    return {
      text: 'text-amber-600 dark:text-amber-400',
      bar: 'bg-amber-500',
      badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    };
  }

  return {
    text: 'text-rose-600 dark:text-rose-400',
    bar: 'bg-rose-500',
    badge: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
  };
}

function buildCsv(rows: Report[]) {
  const header = ['id', 'type', 'severity', 'location', 'department', 'status', 'reportedAt', 'resolvedAt'];
  const body = rows.map((row) => [
    row.id,
    row.type,
    String(row.severity),
    row.location,
    row.department,
    row.status,
    row.reportedAt,
    row.resolvedAt || '',
  ]);

  const lines = [header, ...body].map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','));
  return lines.join('\n');
}

export default function Insights() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { t } = useTranslation();

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchReports = async () => {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      if (!token) {
        if (isMounted) {
          setReports([]);
          setLoading(false);
        }
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/reports`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || 'Failed to fetch report insights data.');
        }

        if (!isMounted) return;
        setReports(Array.isArray(payload?.reports) ? payload.reports : []);
      } catch (error) {
        console.error('Insights fetch error:', error);
        if (isMounted) {
          setReports([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchReports();
    const intervalId = setInterval(fetchReports, 30000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const resolvedToday = reports.filter((report) => {
      if (report.status !== 'resolved') return false;
      const resolvedDate = new Date(report.resolvedAt || report.updatedAt || report.reportedAt);
      return resolvedDate >= todayStart && resolvedDate <= todayEnd;
    }).length;

    const pendingCritical = reports.filter((report) => report.severity >= 8 && report.status !== 'resolved').length;

    const resolutionDurations = reports
      .filter((report) => report.status === 'resolved')
      .map((report) => {
        const createdAt = new Date(report.reportedAt).getTime();
        const resolvedAt = new Date(report.resolvedAt || report.updatedAt || report.reportedAt).getTime();
        return Math.max(0, resolvedAt - createdAt) / (1000 * 60 * 60 * 24);
      });

    const avgResolutionDays = resolutionDurations.length
      ? resolutionDurations.reduce((sum, days) => sum + days, 0) / resolutionDurations.length
      : 0;

    return {
      totalReports: reports.length,
      resolvedToday,
      pendingCritical,
      avgResolutionDays,
    };
  }, [reports]);

  const trendData = useMemo(() => {
    const now = new Date();
    const days: Array<{ day: string; count: number; resolved: number }> = [];

    for (let i = 6; i >= 0; i--) {
      const dayDate = new Date(now);
      dayDate.setDate(now.getDate() - i);
      const dayStart = startOfDay(dayDate);
      const dayEnd = endOfDay(dayDate);

      const count = reports.filter((report) => {
        const reported = new Date(report.reportedAt);
        return reported >= dayStart && reported <= dayEnd;
      }).length;

      const resolved = reports.filter((report) => {
        if (report.status !== 'resolved') return false;
        const resolvedDate = new Date(report.resolvedAt || report.updatedAt || report.reportedAt);
        return resolvedDate >= dayStart && resolvedDate <= dayEnd;
      }).length;

      days.push({
        day: dayDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        count,
        resolved,
      });
    }

    return days;
  }, [reports]);

  const issueData = useMemo(() => {
    const map = new Map<string, number>();

    reports.forEach((report) => {
      const key = report.type || 'others';
      map.set(key, (map.get(key) || 0) + 1);
    });

    return [...map.entries()]
      .map(([name, value]) => ({ name: formatIssueLabel(name), value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [reports]);

  const departments = useMemo(() => {
    const now = new Date();
    const currentWindowStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
    const previousWindowStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13));
    const previousWindowEnd = endOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7));

    return DEPARTMENTS.map((department) => {
      const assignedReports = reports.filter((report) => normalizeDepartment(report.department) === department);
      const resolvedReports = assignedReports.filter((report) => report.status === 'resolved');
      const assigned = assignedReports.length;
      const resolved = resolvedReports.length;
      const slaPercent = assigned ? Math.round((resolved / assigned) * 100) : 0;

      const avgDaysRaw = resolvedReports.map((report) => {
        const createdAt = new Date(report.reportedAt).getTime();
        const resolvedAt = new Date(report.resolvedAt || report.updatedAt || report.reportedAt).getTime();
        return Math.max(0, resolvedAt - createdAt) / (1000 * 60 * 60 * 24);
      });

      const avgDays = avgDaysRaw.length ? avgDaysRaw.reduce((sum, days) => sum + days, 0) / avgDaysRaw.length : 0;

      const resolvedCurrentWindow = resolvedReports.filter((report) => {
        const date = new Date(report.resolvedAt || report.updatedAt || report.reportedAt);
        return date >= currentWindowStart;
      }).length;

      const resolvedPreviousWindow = resolvedReports.filter((report) => {
        const date = new Date(report.resolvedAt || report.updatedAt || report.reportedAt);
        return date >= previousWindowStart && date <= previousWindowEnd;
      }).length;

      const trend: 'up' | 'down' = resolvedCurrentWindow >= resolvedPreviousWindow ? 'up' : 'down';

      return {
        key: department,
        name: department,
        assigned,
        resolved,
        slaPercent,
        avgDays,
        trend,
        rank: 0,
      };
    })
      .sort((a, b) => b.slaPercent - a.slaPercent || b.resolved - a.resolved || a.avgDays - b.avgDays)
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }, [reports]);

  const failingSlaCount = departments.filter((dept) => dept.slaPercent < 40).length;

  const handleExport = () => {
    const csv = buildCsv(reports);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `municipal-insights-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-12 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{t('performance_analytics')}</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{t('real_time_insights')}</p>
        </div>
        <button
          onClick={handleExport}
          disabled={reports.length === 0}
          className="flex items-center gap-2 rounded-2xl bg-slate-900 dark:bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-xl hover:bg-slate-800 dark:hover:bg-blue-700 transition-all hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          <Download size={18} />
          {t('export_report')}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <motion.div whileHover={{ y: -5 }} className="rounded-[2rem] bg-blue-600 p-7 text-white shadow-xl shadow-blue-200 dark:shadow-none">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 mb-5">
            <ListChecks size={24} />
          </div>
          <div className="text-sm font-bold uppercase tracking-wider opacity-80">Total Reports</div>
          <div className="mt-2 text-4xl font-black">{stats.totalReports}</div>
          <div className="mt-3 text-xs font-medium opacity-80">All reports stored in database</div>
        </motion.div>

        <motion.div whileHover={{ y: -5 }} className="rounded-[2rem] bg-emerald-600 p-7 text-white shadow-xl shadow-emerald-200 dark:shadow-none">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 mb-5">
            <CheckCircle2 size={24} />
          </div>
          <div className="text-sm font-bold uppercase tracking-wider opacity-80">Resolved Today</div>
          <div className="mt-2 text-4xl font-black">{stats.resolvedToday}</div>
          <div className="mt-3 text-xs font-medium opacity-80">Resolved in current day window</div>
        </motion.div>

        <motion.div whileHover={{ y: -5 }} className="rounded-[2rem] bg-rose-600 p-7 text-white shadow-xl shadow-rose-200 dark:shadow-none">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 mb-5">
            <AlertTriangle size={24} />
          </div>
          <div className="text-sm font-bold uppercase tracking-wider opacity-80">Pending Critical</div>
          <div className="mt-2 text-4xl font-black">{stats.pendingCritical}</div>
          <div className="mt-3 text-xs font-medium opacity-80">Severity 8+ not resolved</div>
        </motion.div>

        <motion.div whileHover={{ y: -5 }} className="rounded-[2rem] bg-slate-900 p-7 text-white shadow-xl border border-slate-800">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 mb-5">
            <Clock3 size={24} />
          </div>
          <div className="text-sm font-bold uppercase tracking-wider opacity-80">Average Resolution</div>
          <div className="mt-2 text-4xl font-black">{formatDays(stats.avgResolutionDays)}</div>
          <div className="mt-3 text-xs font-medium opacity-80">Calculated from resolved reports</div>
        </motion.div>
      </div>

      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Department Performance</h3>
          <div className="flex items-center gap-2 rounded-2xl bg-rose-50 dark:bg-rose-900/30 px-5 py-2.5 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-800">
            <ShieldAlert size={18} />
            <span className="text-sm font-bold">{failingSlaCount} under 40% SLA</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {departments.map((dept, index) => {
            const color = performanceColor(dept.slaPercent);
            const deptName =
              dept.key === 'roads'
                ? tWithFallback(t, 'roads_dept', 'Roads')
                : dept.key === 'sanitation'
                  ? tWithFallback(t, 'sanitation_dept', 'Sanitation')
                  : dept.key === 'electrical'
                    ? tWithFallback(t, 'electrical_dept', 'Electrical')
                    : tWithFallback(t, 'water_dept', 'Water');

            return (
              <motion.div
                key={dept.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="rounded-[2rem] bg-white dark:bg-slate-900 p-8 shadow-sm border border-slate-100 dark:border-slate-800 transition-all hover:shadow-lg"
              >
                <div className="flex flex-wrap items-center justify-between gap-8">
                  <div className="flex items-center gap-8 min-w-[280px]">
                    <div
                      className={`flex h-14 w-14 items-center justify-center rounded-2xl font-black text-2xl ${
                        dept.rank === 1
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                          : dept.rank === 2
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            : dept.rank === 3
                              ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                              : 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {dept.rank}
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 dark:text-white">{deptName}</h3>
                      <div className="flex items-center gap-3 mt-2">
                        <span className={`text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider ${color.badge}`}>
                          {dept.slaPercent}% SLA
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500 font-bold">
                          {dept.resolved}/{dept.assigned} resolved
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-w-[300px]">
                    <div className="flex justify-between text-[10px] font-black text-slate-400 dark:text-slate-500 mb-3 uppercase tracking-[0.2em]">
                      <span>SLA Compliance</span>
                      <span>{dept.slaPercent}%</span>
                    </div>
                    <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${dept.slaPercent}%` }}
                        transition={{ duration: 0.9, delay: 0.2 }}
                        className={`h-full rounded-full ${color.bar}`}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-10 min-w-[180px] justify-end">
                    <div className="text-right">
                      <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Avg Time</div>
                      <div className="text-2xl font-black text-slate-900 dark:text-white">{formatDays(dept.avgDays)}</div>
                    </div>
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                        dept.trend === 'up'
                          ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {dept.trend === 'up' ? <ArrowUpRight size={24} /> : <ArrowDownRight size={24} />}
                    </div>
                  </div>
                </div>

                {dept.slaPercent < 40 && (
                  <div className="mt-8 p-5 rounded-2xl bg-rose-50 dark:bg-rose-900/30 border border-rose-100 dark:border-rose-800 flex items-center justify-between">
                    <div className="flex items-center gap-4 text-rose-600 dark:text-rose-400">
                      <AlertTriangle size={24} />
                      <span className="text-sm font-black uppercase tracking-wide">Auto Escalated</span>
                    </div>
                    <span className="text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest">Needs immediate action</span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 rounded-[2.5rem] bg-white dark:bg-slate-900 p-10 shadow-sm border border-slate-100 dark:border-slate-800">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-8">Issue Categories</h3>
          {issueData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm font-bold text-slate-500 dark:text-slate-400">
              {loading ? t('loading') : 'No issue data in database.'}
            </div>
          ) : (
            <>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={issueData} cx="50%" cy="50%" innerRadius={68} outerRadius={92} paddingAngle={6} dataKey="value">
                      {issueData.map((entry, index) => (
                        <Cell key={`cell-${entry.name}`} fill={PIE_COLORS[index % PIE_COLORS.length]} cornerRadius={4} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: '16px',
                        border: 'none',
                        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                        backgroundColor: isDark ? '#0f172a' : '#ffffff',
                        color: isDark ? '#ffffff' : '#000000',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-8 space-y-3">
                {issueData.map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-slate-600 dark:text-slate-400 font-bold">{item.name}</span>
                    </div>
                    <span className="font-black text-slate-900 dark:text-white">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="rounded-[2.5rem] bg-white dark:bg-slate-900 p-10 shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Issue Volume Trends (Last 7 Days)</h3>
            <div className="flex gap-3">
              <span className="flex items-center gap-1 text-xs font-bold text-blue-600"><div className="h-2 w-2 rounded-full bg-blue-600" /> Reported</span>
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-600"><div className="h-2 w-2 rounded-full bg-emerald-600" /> Resolved</span>
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '16px',
                    border: 'none',
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    color: isDark ? '#ffffff' : '#000000',
                    padding: '10px 14px',
                  }}
                  itemStyle={{ fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="count" name="Reported" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#10b981" strokeWidth={3} fillOpacity={0} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
