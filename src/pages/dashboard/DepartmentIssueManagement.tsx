import { useState, useEffect, useMemo } from 'react';
import { Search, Filter, Download, MoreVertical, Eye, CheckCircle, Clock, AlertTriangle, MapPin, Users, X, Calendar, Info, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import ResolutionModal from '../../components/ResolutionModal';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const AUTH_TOKEN_KEY = 'nazarai_auth_token';

export default function DepartmentIssueManagement() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState<any>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [showResolutionModal, setShowResolutionModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'recomplaints'>('all');
  const [searchText, setSearchText] = useState('');

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

  const handleStatusChangeClick = (newStatus: string) => {
    if (!selectedIssue) {
      return;
    }

    if (newStatus !== 'resolved') {
      void handleUpdateStatus({
        issueId: selectedIssue.id,
        newStatus,
      });
      return;
    }

    setShowResolutionModal(true);
  };

  const handleUpdateStatus = async (params: {
    issueId: string;
    newStatus: string;
    proofImageUrl?: string | null;
    resolutionNotes?: string;
    resolvedByOfficer?: string;
  }) => {
    setUpdatingStatus(true);
    try {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      if (!token) {
        throw new Error('Session expired. Please login again.');
      }

      const response = await fetch(`${API_BASE_URL}/api/reports/${params.issueId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: params.newStatus,
          proofImageUrl: params.proofImageUrl || null,
          resolutionNotes: params.resolutionNotes,
          resolvedByOfficer: params.resolvedByOfficer,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || 'Failed to update status.');
      }

      const updatedReport = data?.report;
      if (updatedReport) {
        setSelectedIssue((prev: any) => (prev?.id === updatedReport.id ? updatedReport : prev));
        setIssues((prev) => prev.map((issue) => issue.id === updatedReport.id ? updatedReport : issue));
      }
    } catch (error) {
      console.error("Error updating status:", error);
      alert(error instanceof Error ? error.message : 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleResolvedSubmit = async (data: {
    proofFile: File;
    resolutionNotes: string;
    officerName: string;
    resolutionTimeTakenHours: number;
  }) => {
    if (!selectedIssue) return;

    try {
      setUpdatingStatus(true);

      const proofImageData = await convertImageToBase64(data.proofFile);

      await handleUpdateStatus({
        issueId: selectedIssue.id,
        newStatus: 'resolved',
        proofImageUrl: proofImageData,
        resolutionNotes: data.resolutionNotes,
        resolvedByOfficer: data.officerName,
      });

      alert('Marked as resolved! Citizen has been notified on WhatsApp.');
      setShowResolutionModal(false);
      setSelectedIssue(null);
      await fetchIssues();
    } catch (error) {
      console.error('Error while resolving issue:', error);
      alert(error instanceof Error ? error.message : 'Failed to resolve issue.');
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

  const filteredIssues = useMemo(() => {
    const search = searchText.toLowerCase().trim();

    return issues.filter((issue) => {
      const isRecomplaint = Boolean(issue.isReopened) || issue.citizenRating === 'unsatisfied';
      if (activeTab === 'recomplaints' && !isRecomplaint) return false;

      if (!search) return true;

      return (
        (issue.location || '').toLowerCase().includes(search) ||
        (issue.id || '').toLowerCase().includes(search) ||
        (issue.complaintCode || '').toLowerCase().includes(search)
      );
    });
  }, [issues, activeTab, searchText]);

  const reComplaintCount = useMemo(() => {
    return issues.filter((issue) => Boolean(issue.isReopened) || issue.citizenRating === 'unsatisfied').length;
  }, [issues]);

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-4 text-lg font-black text-slate-900 dark:text-white">Reports</h3>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`rounded-xl px-3 py-2 text-xs font-black uppercase tracking-wide transition ${
              activeTab === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            All Reports ({issues.length})
          </button>
          <button
            onClick={() => setActiveTab('recomplaints')}
            className={`rounded-xl px-3 py-2 text-xs font-black uppercase tracking-wide transition ${
              activeTab === 'recomplaints'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50'
            }`}
          >
            Re-Complaints ({reComplaintCount})
          </button>
          {activeTab === 'recomplaints' && (
            <div className="text-xs font-semibold text-amber-700 dark:text-amber-300">
              These reports were rated "NAHI" by citizens. Re-assess and reassign as needed.
            </div>
          )}
        </div>

      {/* Header Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search by ID, location, or department..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-3 pl-12 pr-4 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800">
            <Filter size={18} />
            Filter
          </button>
          <button className="flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 dark:hover:bg-blue-700">
            <Download size={18} />
            Export
          </button>
        </div>
      </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
              <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Loading...</span>
            </div>
            <p className="mt-4 text-slate-500 dark:text-slate-400 font-medium">Loading issues...</p>
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
            <p className="text-slate-500 dark:text-slate-400 font-medium">No issues found matching your criteria.</p>
          </div>
        ) : filteredIssues.map((issue) => (
          <motion.div
            key={issue.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ y: -4 }}
            onClick={() => setSelectedIssue(issue)}
            className="group relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-all hover:shadow-xl dark:hover:shadow-blue-900/10 cursor-pointer"
          >
            {/* Image Section */}
            <div className="relative h-48 w-full overflow-hidden">
              <img
                src={issue.imageUrl || `https://picsum.photos/seed/${issue.type}-${issue.id}/600/400`}
                alt={issue.type}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />
              <div className="absolute top-4 right-4">
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-lg ${
                  issue.severity >= 8 ? 'bg-rose-500 text-white' :
                  issue.severity >= 5 ? 'bg-amber-500 text-white' :
                  'bg-blue-500 text-white'
                }`}>
                  {issue.severity >= 8 ? t('critical') : issue.severity >= 5 ? t('high') : t('normal')}
                </div>
              </div>
              <div className="absolute bottom-4 left-4">
                <div className="flex items-center gap-2 text-white">
                  <div className="h-8 w-8 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center">
                    <AlertTriangle size={16} />
                  </div>
                  <span className="text-sm font-bold capitalize">{issue.type.replace('_', ' ')}</span>
                </div>
              </div>
            </div>

            {/* Content Section */}
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1 line-clamp-1">
                    {issue.type.replace('_', ' ').toUpperCase()} #{issue.id.slice(-6)}
                  </h3>
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <MapPin size={14} className="text-blue-500" />
                    <span className="text-xs font-bold">{issue.ward ? `${issue.ward}, ` : ''}{issue.location}</span>
                  </div>
                </div>
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center border-2 ${
                  issue.status === 'resolved' ? 'border-emerald-500/20 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' :
                  issue.status === 'in_progress' ? 'border-blue-500/20 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' :
                  'border-slate-200 bg-slate-50 text-slate-400 dark:bg-slate-800 dark:border-slate-700'
                }`}>
                  {issue.status === 'resolved' ? <CheckCircle size={20} /> : <Clock size={20} />}
                </div>
              </div>

              {issue.isReopened && (
                <div className="mb-3 rounded-lg bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-900/50 px-3 py-2 text-xs font-black uppercase text-amber-700 dark:text-amber-300">
                  ⚠️ Reopen by Citizen - Re-assess needed
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <Users size={12} className="text-slate-500" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tighter">
                    {issue.department}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
                    <Eye size={18} />
                  </button>
                  <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                    <MoreVertical size={18} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
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

                    {selectedIssue.isReopened && (
                      <div className="mt-6 p-4 rounded-3xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="text-2xl">⚠️</div>
                          <div>
                            <h5 className="text-sm font-black text-amber-900 dark:text-amber-200 uppercase tracking-widest mb-2">Complaint Reopened by Citizen</h5>
                            <div className="space-y-2 text-sm text-amber-800 dark:text-amber-300">
                              <p><span className="font-bold">Original Department:</span> {selectedIssue.originalDepartment || 'Unknown'}</p>
                              <p><span className="font-bold">Reopened Status:</span> {selectedIssue.isReopened ? '✗ Not Satisfied' : '✓ Satisfied'}</p>
                              {selectedIssue.citizenFeedback && (
                                <p><span className="font-bold">Citizen Feedback:</span> {selectedIssue.citizenFeedback}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

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

      <ResolutionModal
        isOpen={showResolutionModal}
        complaint={selectedIssue ? {
          id: selectedIssue.id,
          type: selectedIssue.type,
          imageUrl: selectedIssue.imageUrl,
          location: selectedIssue.location,
          createdAt: selectedIssue.createdAt,
          reportedAt: selectedIssue.reportedAt,
        } : null}
        onClose={() => setShowResolutionModal(false)}
        onResolved={handleResolvedSubmit}
        isSubmitting={updatingStatus}
      />
    </div>
  );
}
