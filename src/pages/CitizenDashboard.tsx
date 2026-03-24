import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { List, CheckCircle, Clock, AlertTriangle, Eye, ArrowRight, MapPin, Award, LogOut, ThumbsUp, RotateCcw, X, ImageIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const { user } = useAuth();
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [feedbackModal, setFeedbackModal] = useState<{ isOpen: boolean; reportId: string | null; isSatisfied: boolean }>({
    isOpen: false,
    reportId: null,
    isSatisfied: false,
  });
  const [feedbackText, setFeedbackText] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const handleSatisfactionClick = (reportId: string, isSatisfied: boolean) => {
    if (isSatisfied) {
      // Mark as satisfied without feedback
      submitSatisfactionFeedback(reportId, true, '');
    } else {
      // Open modal for recomplain feedback
      setFeedbackModal({ isOpen: true, reportId, isSatisfied: false });
      setFeedbackText('');
    }
  };

  const submitSatisfactionFeedback = async (reportId: string, isSatisfied: boolean, feedback: string) => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) return;

    setSubmittingFeedback(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/reports/${reportId}/satisfaction`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          satisfied: isSatisfied,
          feedback: feedback || '',
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        alert(data?.message || 'Failed to submit feedback.');
        return;
      }

      // Update local reports list
      setReports(reports.map(r => 
        r.id === reportId 
          ? { ...r, is_reopened: !isSatisfied, status: isSatisfied ? 'resolved' : 'reported' }
          : r
      ));

      setFeedbackModal({ isOpen: false, reportId: null, isSatisfied: false });
      setFeedbackText('');
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Error submitting feedback.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

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
    const intervalId = setInterval(fetchReports, 30000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{t('citizen_dashboard.welcome', { name: user?.firstName || 'Citizen' })}</h1>
          <p className="text-slate-600 mt-1 dark:text-slate-400">{t('citizen_dashboard.subtitle')}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 dark:bg-slate-900 dark:border-slate-800">
            <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center dark:bg-amber-900/20 dark:text-amber-400">
              <Award size={20} />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider dark:text-slate-500">{t('citizen_dashboard.points')}</div>
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
          <span>{t('citizen_dashboard.report_issue_now')}</span>
          <ArrowRight size={24} className="transition-transform group-hover:translate-x-2" />
        </Link>
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 dark:text-white">
            <List size={20} className="text-blue-600 dark:text-blue-400" />
            {t('citizen_dashboard.my_recent_reports')}
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
                    <button onClick={() => setSelectedReport(report)} className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all dark:bg-slate-800 dark:text-slate-500 dark:hover:text-blue-400 dark:hover:bg-blue-900/20">
                      <span className="text-xs font-bold uppercase tracking-wider">Details</span>
                      <ArrowRight size={16} />
                    </button>
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
        {/* <div className="space-y-8">
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
        </div> */}
      </div>

      {/* Issue Details Modal */}
      <AnimatePresence>
        {selectedReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.96 }}
              className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            >
              <button
                className="absolute right-4 top-4 rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                onClick={() => setSelectedReport(null)}
              >
                <X size={18} />
              </button>

              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <h3 className="text-2xl font-black capitalize text-slate-900 dark:text-white">
                      {selectedReport.type.replace(/_/g, ' ')}
                    </h3>
                    <span className={`text-xs font-bold uppercase px-3 py-1 rounded-full ${
                      selectedReport.status === 'resolved' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' :
                      selectedReport.status === 'in_progress' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' :
                      'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                      {selectedReport.status === 'resolved' ? 'Resolved' : selectedReport.status === 'in_progress' ? 'In Progress' : 'Reported'}
                    </span>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                    {selectedReport.imageUrl ? (
                      <img src={selectedReport.imageUrl} alt="Complaint" className="h-56 w-full rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-slate-300 text-slate-400 dark:border-slate-700">
                        <ImageIcon size={24} />
                      </div>
                    )}
                    <div className="mt-3 text-sm text-slate-700 dark:text-slate-300">
                      <div className="font-bold">Description</div>
                      <div>{selectedReport.description || 'No description provided'}</div>
                    </div>
                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      ID: {selectedReport.complaintCode || selectedReport.id}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-200">Complaint Details</div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <MapPin size={14} /> {selectedReport.location}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400">Department: {selectedReport.department ? selectedReport.department.charAt(0).toUpperCase() + selectedReport.department.slice(1) : 'Not assigned'}</div>
                      <div className="text-slate-500 dark:text-slate-400">Severity: {selectedReport.severity || 'Not specified'}</div>
                      <div className="text-slate-500 dark:text-slate-400">Reported: {selectedReport.reportedAt ? new Date(selectedReport.reportedAt).toLocaleString('en-IN') : 'N/A'}</div>
                    </div>
                  </div>

                  {selectedReport.status === 'resolved' && selectedReport.proofImageUrl && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/30 dark:bg-emerald-950/20">
                      <div className="mb-3 text-sm font-bold text-emerald-900 dark:text-emerald-200">Resolution Proof</div>
                      <img src={selectedReport.proofImageUrl} alt="Resolution proof" className="h-40 w-full rounded-xl object-cover" />
                      <div className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
                        Resolved on {selectedReport.resolvedAt ? new Date(selectedReport.resolvedAt).toLocaleDateString('en-IN') : 'N/A'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Recomplain Feedback Modal */}
      {feedbackModal.isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setFeedbackModal({ isOpen: false, reportId: null, isSatisfied: false })}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-md w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('citizen_dashboard.feedback_modal_title')}</h3>
              <button
                onClick={() => setFeedbackModal({ isOpen: false, reportId: null, isSatisfied: false })}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              {t('citizen_dashboard.feedback_modal_description')}
            </p>

            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder={t('citizen_dashboard.feedback_placeholder')}
              className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 mb-4 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
            />

            <div className="flex gap-3">
              <button
                onClick={() => setFeedbackModal({ isOpen: false, reportId: null, isSatisfied: false })}
                className="flex-1 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (feedbackText.trim()) {
                    submitSatisfactionFeedback(feedbackModal.reportId!, false, feedbackText);
                  }
                }}
                disabled={submittingFeedback || !feedbackText.trim()}
                className="flex-1 px-4 py-2 rounded-lg bg-amber-600 text-white font-bold hover:bg-amber-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingFeedback ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
