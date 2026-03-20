import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { List, CheckCircle, Clock, AlertTriangle, Eye, ArrowRight, MapPin, Award, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const AUTH_TOKEN_KEY = 'nazarai_auth_token';

// Calculate average resolution time in days
const calculateAvgResolutionTime = (reports: any[]): string => {
  const resolvedReports = reports.filter((r) => r.status === 'resolved');
  if (resolvedReports.length === 0) return '0 days';

  const totalTime = resolvedReports.reduce((sum, report) => {
    const createdMs = new Date(report.reportedAt).getTime();
    const resolvedMs = new Date(report.updatedAt).getTime();
    const days = (resolvedMs - createdMs) / (1000 * 60 * 60 * 24);
    return sum + days;
  }, 0);

  const avgDays = (totalTime / resolvedReports.length).toFixed(1);
  return `${avgDays} days`;
};

// Calculate citizen's ranking among all citizens
const calculateRanking = (citizenReports: number, allReports: any[]): { rank: string; percentage: number } => {
  const citizenReportCounts = new Map<string, number>();
  allReports.forEach((report) => {
    if (report.citizen_id) {
      citizenReportCounts.set(report.citizen_id, (citizenReportCounts.get(report.citizen_id) || 0) + 1);
    }
  });

  const sortedCounts = Array.from(citizenReportCounts.values()).sort((a, b) => b - a);
  const rank = sortedCounts.findIndex((count) => count === citizenReports) + 1;
  const percentage = Math.round(((sortedCounts.length - rank) / sortedCounts.length) * 100) || 0;
  
  return { rank: `#${rank}`, percentage };
};

export default function CitizenDashboard() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const { user } = useAuth();

  useEffect(() => {
    let isMounted = true;

    const fetchReports = async () => {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      if (!token) {
        if (isMounted) {
          setReports([]);
          setStats({ resolved: 0, avgTime: '0 days', points: 0, rank: '—', percentage: 0 });
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

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.message || 'Failed to fetch reports.');
        }

        const reportsData: any[] = Array.isArray(data?.reports) ? data.reports : [];
        
        if (!isMounted) return;

        // Calculate stats
        const resolvedCount = reportsData.filter((r) => r.status === 'resolved').length;
        const avgTime = calculateAvgResolutionTime(reportsData);
        const points = reportsData.length * 50; // 50 points per report
        
        // For now, use simple ranking (can be improved with actual leaderboard API)
        const allReportsResponse = await fetch(`${API_BASE_URL}/api/reports`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const allData = await allReportsResponse.json().catch(() => ({}));
        const allReports = Array.isArray(allData?.reports) ? allData.reports : [];
        
        const { rank, percentage } = calculateRanking(reportsData.length, allReports);

        setStats({
          resolved: resolvedCount,
          avgTime,
          points,
          rank,
          percentage,
        });

        setReports(reportsData.sort((a: any, b: any) => {
          const aTime = new Date(a.reportedAt).getTime();
          const bTime = new Date(b.reportedAt).getTime();
          return bTime - aTime;
        }));

        setLoading(false);
      } catch (error) {
        console.error('Error fetching reports:', error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchReports();
    const intervalId = setInterval(fetchReports, 10000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Welcome, {user?.firstName || 'Citizen'}</h1>
          <p className="text-slate-600 mt-1 dark:text-slate-400">Track your contributions and impact in the city.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 dark:bg-slate-900 dark:border-slate-800">
            <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center dark:bg-amber-900/20 dark:text-amber-400">
              <Award size={20} />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider dark:text-slate-500">Points</div>
              <div className="text-lg font-black text-slate-900 dark:text-white">{stats?.points || 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Center Action Button */}
      <div className="flex justify-center py-8">
        <Link
          to="/report"
          className="group relative flex items-center gap-4 rounded-3xl bg-blue-600 px-12 py-6 text-xl font-black text-white shadow-2xl shadow-blue-200 transition-all hover:bg-blue-700 hover:scale-105 active:scale-95 dark:shadow-blue-900/20"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-white transition-transform group-hover:rotate-12">
            <AlertTriangle size={28} />
          </div>
          <span>Report an Issue Now</span>
          <ArrowRight size={24} className="transition-transform group-hover:translate-x-2" />
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Reports List */}
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 dark:text-white">
            <List size={20} className="text-blue-600 dark:text-blue-400" />
            My Recent Reports
          </h3>
          
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full dark:border-blue-400 dark:border-t-transparent"></div>
            </div>
          ) : reports.length > 0 ? (
            <div className="space-y-4">
              {reports.map((report) => (
                <motion.div 
                  key={report.id}
                  whileHover={{ scale: 1.01 }}
                  className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col sm:flex-row gap-6 items-start sm:items-center dark:bg-slate-900 dark:border-slate-800"
                >
                  <div className="h-20 w-20 rounded-2xl overflow-hidden flex-shrink-0">
                    <img src={report.imageUrl || `https://picsum.photos/seed/${report.type}-${report.id}/80/80`} alt="Issue" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest dark:text-slate-500">#{report.id.slice(-6)}</span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        report.status === 'resolved' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' :
                        report.status === 'in_progress' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' :
                        'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {report.status === 'resolved' ? 'Resolved' : report.status === 'in_progress' ? 'In Progress' : 'Reported'}
                      </span>
                    </div>
                    <h4 className="text-lg font-bold text-slate-900 capitalize dark:text-white">{report.type.replace(/_/g, ' ')}</h4>
                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-1 dark:text-slate-400">
                      <MapPin size={12} />
                      {report.location}
                    </div>
                    {report.status === 'resolved' && report.proofImageUrl && (
                      <div className="mt-2 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        Resolution proof available in Details
                      </div>
                    )}
                  </div>
                    <Link to={`/track?id=${report.id}`} className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all dark:bg-slate-800 dark:text-slate-500 dark:hover:text-blue-400 dark:hover:bg-blue-900/20">
                      <span className="text-xs font-bold uppercase tracking-wider">Details</span>
                      <ArrowRight size={16} />
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-3xl border border-slate-100 dark:bg-slate-900 dark:border-slate-800">
              <p className="text-slate-500 dark:text-slate-400">You haven't reported any issues yet.</p>
            </div>
          )}
        </div>

        {/* Sidebar (Impact Stats) */}
        <div className="space-y-8">
          {!loading && stats ? (
            <div className="bg-slate-900 p-8 rounded-[2rem] text-white shadow-xl dark:bg-slate-900 dark:border dark:border-slate-800">
              <h3 className="text-xl font-bold mb-6">Your Impact</h3>
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center text-emerald-400">
                    <CheckCircle size={24} />
                  </div>
                  <div>
                    <div className="text-2xl font-black">{stats.resolved}</div>
                    <div className="text-xs font-bold text-slate-400 uppercase">Issues Resolved</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center text-amber-400">
                    <Clock size={24} />
                  </div>
                  <div>
                    <div className="text-2xl font-black">{stats.avgTime}</div>
                    <div className="text-xs font-bold text-slate-400 uppercase">Avg. Resolution</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center text-blue-400">
                    <Award size={24} />
                  </div>
                  <div>
                    <div className="text-2xl font-black">{stats.points}</div>
                    <div className="text-xs font-bold text-slate-400 uppercase">Total Points</div>
                  </div>
                </div>
              </div>
              <div className="mt-8 pt-8 border-t border-white/10">
                {stats.percentage > 0 ? (
                  <div className="text-sm font-bold text-blue-400">
                    You are in the top {stats.percentage}% of reporters! 🦁
                  </div>
                ) : (
                  <div className="text-sm font-bold text-slate-400">
                    Start reporting issues to earn your spot on the leaderboard
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 p-8 rounded-[2rem] text-white shadow-xl">
              <h3 className="text-xl font-bold mb-6">Your Impact</h3>
              <div className="flex justify-center py-8">
                <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
