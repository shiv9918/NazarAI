import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, ArrowUpRight, X, Calendar, Info, Maximize2, Upload, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const AUTH_TOKEN_KEY = 'nazarai_auth_token';

export default function DepartmentDashboardHome() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState<any>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [proofImageFile, setProofImageFile] = useState<File | null>(null);
  const [showProofUpload, setShowProofUpload] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [activeSection, setActiveSection] = useState<'all' | 'today'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'reported' | 'in_progress' | 'resolved'>('all');

  const fetchIssues = async () => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      setIssues([]);
      setLoading(false);
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
        throw new Error(data?.message || 'Failed to fetch department reports.');
      }

      const reportsData = Array.isArray(data?.reports) ? data.reports : [];
      setIssues(reportsData);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const convertImageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const maxSide = 1600;
          const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          const width = Math.max(1, Math.round(img.width * scale));
          const height = Math.max(1, Math.round(img.height * scale));

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Unable to process image.'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.75));
        };

        img.onerror = () => reject(new Error('Invalid image file.'));
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleProofImageChange = async (e: any) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('Please upload an image smaller than 10MB.');
        return;
      }

      setProofImageFile(file);
      try {
        const base64 = await convertImageToBase64(file);
        setProofImage(base64);
      } catch (error) {
        console.error('Error processing proof image:', error);
        alert('Could not process the selected image. Please try another file.');
      }
    }
  };

  const handleStatusChangeClick = (newStatus: string) => {
    if (newStatus !== 'resolved') {
      handleUpdateStatus(newStatus, null);
      return;
    }

    setPendingStatusChange(newStatus);
    setProofImage(null);
    setProofImageFile(null);
    setResolutionNotes('');
    setShowProofUpload(true);
  };

  const handleUpdateStatus = async (newStatus: string, proofImageData: string | null, notes?: string) => {
    if (!selectedIssue) return;
    setUpdatingStatus(true);
    try {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      if (!token) {
        throw new Error('Session expired. Please login again.');
      }

      const response = await fetch(`${API_BASE_URL}/api/reports/${selectedIssue.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          status: newStatus,
          proofImageUrl: proofImageData || null,
          resolutionNotes: notes || undefined,
          resolvedByOfficer: user?.name || undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || 'Failed to update status.');
      }

      const updatedReport = data?.report;
      if (updatedReport) {
        setSelectedIssue(updatedReport);
        setIssues((prev) => prev.map((issue) => issue.id === updatedReport.id ? updatedReport : issue));
        setProofImage(null);
        setProofImageFile(null);
        setShowProofUpload(false);
        setPendingStatusChange(null);
        setResolutionNotes('');
      }
    } catch (error) {
      console.error("Error updating status:", error);
      alert(error instanceof Error ? error.message : 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchIssues();
    const intervalId = setInterval(fetchIssues, 30000);
    return () => clearInterval(intervalId);
  }, [user]);

  const isRecomplaintIssue = (issue: any) =>
    issue.isReopened ||
    Number(issue.reopenVotes || 0) > 0 ||
    String(issue.citizenRating || '').toLowerCase() === 'unsatisfied';

  const isTodayIssue = (issue: any) => {
    const sourceDate = issue.reportedAt || issue.createdAt;
    if (!sourceDate) return false;
    const reportDate = new Date(sourceDate);
    const now = new Date();

    return (
      reportDate.getFullYear() === now.getFullYear() &&
      reportDate.getMonth() === now.getMonth() &&
      reportDate.getDate() === now.getDate()
    );
  };

  const resolvedComplaints = issues.filter((issue) => issue.status === 'resolved').length;
  const recomplainedComplaints = issues.filter((issue) => isRecomplaintIssue(issue)).length;
  const todaysComplaints = issues.filter((issue) => isTodayIssue(issue)).length;

  const filteredIssues = issues.filter((issue) => {
    const matchesSection = activeSection === 'all' ? true : isTodayIssue(issue);
    const matchesStatus = statusFilter === 'all' ? true : issue.status === statusFilter;

    const searchTarget = [
      issue.complaintCode,
      issue.type,
      issue.location,
      issue.ward,
      issue.status,
      issue.department,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const matchesSearch = searchTarget.includes(searchQuery.toLowerCase());

    return matchesSection && matchesStatus && matchesSearch;
  });

  if (loading) return <div className="p-8 text-center font-bold text-slate-500">{t('loading')}</div>;

  return (
    <div className="space-y-8">
      {/* Issues Section */}
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              {user?.department ? `${user.department} ${t('department_issues')}` : t('all_issues')}
            </h3>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              Horizontal issue view aligned with municipal dashboard
            </p>
          </div>
          <div className="text-sm font-bold text-slate-500 dark:text-slate-400">
            Showing {filteredIssues.length} of {issues.length}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">All Complaints</p>
            <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{filteredIssues.length}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Today's Complaints</p>
            <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{todaysComplaints}</p>
          </div>
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-900/10">
            <p className="text-xs font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Resolved Complaints</p>
            <p className="mt-2 text-3xl font-black text-emerald-700 dark:text-emerald-300">{resolvedComplaints}</p>
          </div>
          <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-5 shadow-sm dark:border-amber-900/60 dark:bg-amber-900/10">
            <p className="text-xs font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">Re-Complained</p>
            <p className="mt-2 text-3xl font-black text-amber-700 dark:text-amber-300">{recomplainedComplaints}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex flex-wrap gap-2">
            {[
              { key: 'all', label: 'All Complaints' },
              { key: 'today', label: "Today's Complaints" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveSection(tab.key as 'all' | 'today')}
                className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
                  activeSection === tab.key
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-blue-900/30'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by complaint ID, location, issue type..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'reported' | 'in_progress' | 'resolved')}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="all">All Status</option>
              <option value="reported">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-widest text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-3 py-3">Complaint ID</th>
                  <th className="px-3 py-3">Issue</th>
                  <th className="px-3 py-3">Location</th>
                  <th className="px-3 py-3">Severity</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Reported</th>
                  <th className="px-3 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredIssues.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                      No complaints found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredIssues.map((issue) => {
                    const isRecomplaint = isRecomplaintIssue(issue);
                    return (
                      <tr
                        key={issue.id}
                        className="border-b border-slate-100 transition hover:bg-slate-50 dark:border-slate-800/70 dark:hover:bg-slate-800/50"
                      >
                        <td className="px-3 py-4">
                          <div className="font-black text-slate-900 dark:text-white">{issue.complaintCode || issue.complaintNumber || issue.id}</div>
                          {isRecomplaint && (
                            <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                              Re-Complained
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-4 font-semibold capitalize text-slate-700 dark:text-slate-200">{String(issue.type || '').replace('_', ' ')}</td>
                        <td className="px-3 py-4 text-slate-600 dark:text-slate-300">
                          <div className="flex items-start gap-2">
                            <MapPin size={14} className="mt-0.5 text-blue-500" />
                            <span>{issue.ward ? `${issue.ward}, ` : ''}{issue.location || 'N/A'}</span>
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                            issue.severity >= 8
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                              : issue.severity >= 5
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          }`}>
                            {issue.severity >= 8 ? 'Critical' : issue.severity >= 5 ? 'High' : 'Normal'}
                          </span>
                        </td>
                        <td className="px-3 py-4">
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                            issue.status === 'resolved'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                              : issue.status === 'in_progress'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                          }`}>
                            {issue.status === 'resolved' ? 'Resolved' : issue.status === 'in_progress' ? 'In Progress' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-slate-600 dark:text-slate-300">
                          {new Date(issue.reportedAt || issue.createdAt || new Date()).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-3 py-4 text-right">
                          <button
                            onClick={() => setSelectedIssue(issue)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-black text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20"
                          >
                            {t('details')}
                            <ArrowUpRight size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Issue Details Modal */}
      <AnimatePresence>
        {selectedIssue && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm p-4">
            <div className="flex min-h-full items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800"
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedIssue(null)}
                className="absolute top-6 right-6 z-10 p-2 rounded-full bg-white/80 dark:bg-slate-800/80 text-slate-900 dark:text-white hover:bg-white dark:hover:bg-slate-700 transition-colors shadow-lg"
              >
                <X size={20} />
              </button>

              <div className="max-h-[calc(90vh-2rem)] overflow-y-auto p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Image Section */}
                  <div className="space-y-4">
                    <div 
                      className="relative h-64 w-full rounded-3xl overflow-hidden shadow-inner bg-slate-100 dark:bg-slate-800 cursor-zoom-in group/img"
                      onClick={() => setShowFullImage(true)}
                    >
                      <img
                        src={selectedIssue.imageUrl || `https://picsum.photos/seed/${selectedIssue.type}-${selectedIssue.id}/600/400`}
                        alt={selectedIssue.type}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover/img:scale-105"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover/img:opacity-100">
                        <Maximize2 className="text-white" size={32} />
                      </div>
                      <div className={`absolute top-4 left-4 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-lg ${
                        selectedIssue.severity >= 8 ? 'bg-rose-500 text-white' :
                        selectedIssue.severity >= 5 ? 'bg-amber-500 text-white' :
                        'bg-blue-500 text-white'
                      }`}>
                        {selectedIssue.severity >= 8 ? t('critical') : selectedIssue.severity >= 5 ? t('high') : t('normal')}
                      </div>
                    </div>

                    <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                      <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">{t('description')}</h5>
                      <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed font-medium">
                        {selectedIssue.description || t('no_description_provided')}
                      </p>
                    </div>

                    {/* Model Analysis Section */}
                    <div className="p-6 rounded-3xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-800/20">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                        <h5 className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">OpenCV Model Summary</h5>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed font-medium italic">
                        {selectedIssue.aiDescription || "OpenCV model review indicates this is a significant infrastructure concern requiring priority attention."}
                      </p>
                    </div>
                  </div>

                  {/* Details Section */}
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-3xl font-black text-slate-900 dark:text-white capitalize mb-2">
                        {selectedIssue.type.replace('_', ' ')}
                      </h2>
                      <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold ${
                        selectedIssue.status === 'resolved' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' :
                        selectedIssue.status === 'in_progress' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' :
                        'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        <div className={`h-2 w-2 rounded-full ${
                          selectedIssue.status === 'resolved' ? 'bg-emerald-500' :
                          selectedIssue.status === 'in_progress' ? 'bg-blue-500' :
                          'bg-slate-400'
                        }`} />
                        {selectedIssue.status === 'resolved' ? t('resolved') : selectedIssue.status === 'in_progress' ? t('in_progress') : t('pending')}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-start gap-4 p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-800/20">
                        <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                          <MapPin size={20} />
                        </div>
                        <div>
                          <h6 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">{t('location')}</h6>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">
                            {selectedIssue.ward ? `${selectedIssue.ward}, ` : ''}{selectedIssue.location}
                          </p>
                          <p className="text-[10px] font-medium text-slate-500 mt-1">
                            {selectedIssue.lat.toFixed(6)}, {selectedIssue.lng.toFixed(6)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-4 p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100/50 dark:border-indigo-800/20">
                        <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                          <Calendar size={20} />
                        </div>
                        <div>
                          <h6 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">{t('reported_on')}</h6>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">
                            {new Date(selectedIssue.reportedAt || selectedIssue.createdAt || new Date()).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                        <div className="p-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                          <Info size={20} />
                        </div>
                        <div>
                          <h6 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('department')}</h6>
                          <p className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                            {selectedIssue.department}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                        <div className="p-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                          <Info size={20} />
                        </div>
                        <div>
                          <h6 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Citizen Contact</h6>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">
                            {selectedIssue.citizenName || 'Unknown Citizen'}
                          </p>
                          <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1">
                            Mobile: {selectedIssue.citizenPhone || '-'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 space-y-3">
                      <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Update Status</h5>
                      <div className="grid grid-cols-3 gap-2">
                        {['reported', 'in_progress', 'resolved'].map((status) => (
                          <button
                            key={status}
                            disabled={updatingStatus || selectedIssue.status === status}
                            onClick={() => handleStatusChangeClick(status)}
                            className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                              selectedIssue.status === status
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                            } disabled:opacity-50`}
                          >
                            {status === 'reported' ? 'pending' : status.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                      <button 
                        onClick={() => setSelectedIssue(null)}
                        className="w-full py-4 mt-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-sm uppercase tracking-widest hover:opacity-90 transition-opacity"
                      >
                        {t('close')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Full Image Viewer */}
      <AnimatePresence>
        {showFullImage && selectedIssue && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowFullImage(false)}
            className="fixed inset-0 z-60 flex items-center justify-center bg-black/95 p-4 cursor-zoom-out"
          >
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={selectedIssue.imageUrl}
              alt="Full view"
              className="max-w-full max-h-full rounded-lg shadow-2xl"
            />
            <button 
              className="absolute top-8 right-8 text-white hover:text-slate-300 transition-colors"
              onClick={() => setShowFullImage(false)}
            >
              <X size={32} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Proof Image Upload Modal */}
      <AnimatePresence>
        {showProofUpload && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 p-8"
            >
              <button
                onClick={() => {
                  setShowProofUpload(false);
                  setProofImage(null);
                  setProofImageFile(null);
                  setPendingStatusChange(null);
                  setResolutionNotes('');
                }}
                className="absolute top-6 right-6 p-2 rounded-full bg-white/80 dark:bg-slate-800/80 text-slate-900 dark:text-white hover:bg-white dark:hover:bg-slate-700 transition-colors"
              >
                <X size={20} />
              </button>

              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
                Upload Proof Image
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                Please upload proof image before marking this issue as resolved. This will be visible to the citizen.
              </p>

              {/* Image Preview */}
              {proofImage ? (
                <div className="mb-6 relative h-64 w-full rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800">
                  <img src={proofImage} alt="Proof preview" className="h-full w-full object-cover" />
                  <button
                    onClick={() => {
                      setProofImage(null);
                      setProofImageFile(null);
                    }}
                    className="absolute top-2 right-2 p-2 rounded-lg bg-red-500 text-white hover:bg-red-600"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <label className="mb-6 block">
                  <div className="relative h-48 w-full rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <div className="text-center">
                      <Upload className="mx-auto mb-3 text-slate-400" size={32} />
                      <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
                        Click or drag image
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-500">
                        PNG, JPEG up to 5MB
                      </p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProofImageChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                </label>
              )}

              <div className="mb-6">
                <label className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Resolution notes (mandatory)
                </label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={4}
                  placeholder="Describe what was done... (minimum 20 characters)"
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Minimum 20 characters required</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowProofUpload(false);
                    setProofImage(null);
                    setProofImageFile(null);
                    setPendingStatusChange(null);
                    setResolutionNotes('');
                  }}
                  className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={!proofImage || updatingStatus || resolutionNotes.trim().length < 20}
                  onClick={() => {
                    if (pendingStatusChange && proofImage && resolutionNotes.trim().length >= 20) {
                      handleUpdateStatus(pendingStatusChange, proofImage, resolutionNotes.trim());
                    }
                  }}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {updatingStatus ? 'Uploading...' : 'Resolve & Upload'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
