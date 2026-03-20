import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Clock, MapPin, ArrowUpRight, X, Calendar, Info, Edit3, Save, Maximize2, Upload } from 'lucide-react';
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
    setShowProofUpload(true);
  };

  const handleUpdateStatus = async (newStatus: string, proofImageData: string | null) => {
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
          proofImageUrl: proofImageData || null
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
    const intervalId = setInterval(fetchIssues, 10000);
    return () => clearInterval(intervalId);
  }, [user]);

  if (loading) return <div className="p-8 text-center font-bold text-slate-500">{t('loading')}</div>;

  return (
    <div className="space-y-8">
      {/* Issues Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-slate-900 dark:text-white">
            {user?.department ? `${user.department} ${t('department_issues')}` : t('all_issues')}
          </h3>
          <div className="text-sm font-bold text-slate-500 dark:text-slate-400">
            {issues.length} {t('total_issues')}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {issues.map((issue, i) => (
            <motion.div
              key={issue.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelectedIssue(issue)}
              className="group overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-all hover:shadow-lg cursor-pointer"
            >
              <div className="relative h-48 w-full overflow-hidden">
                <img
                  src={issue.imageUrl || `https://picsum.photos/seed/${issue.type}-${issue.id}/600/400`}
                  alt={issue.type}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
                <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm ${
                  issue.severity >= 8 ? 'bg-rose-500 text-white' :
                  issue.severity >= 5 ? 'bg-amber-500 text-white' :
                  'bg-blue-500 text-white'
                }`}>
                  {issue.severity >= 8 ? t('critical') : issue.severity >= 5 ? t('high') : t('normal')}
                </div>
              </div>
              <div className="p-5">
                <h4 className="text-lg font-black text-slate-900 dark:text-white mb-2 truncate capitalize">
                  {issue.type.replace('_', ' ')}
                </h4>
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-4">
                  <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                    <MapPin size={14} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-xs font-bold truncate">{issue.ward ? `${issue.ward}, ` : ''}{issue.location}</span>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-800">
                  <div className={`text-[10px] font-bold px-3 py-1 rounded-full ${
                    issue.status === 'resolved' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' :
                    issue.status === 'in_progress' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' :
                    'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {issue.status === 'resolved' ? t('resolved') : issue.status === 'in_progress' ? t('in_progress') : t('pending')}
                  </div>
                  <button className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors">
                    {t('details')}
                    <ArrowUpRight size={14} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
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

                    {/* AI Analysis Section */}
                    <div className="p-6 rounded-3xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-800/20">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                        <h5 className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">AI Analysis</h5>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed font-medium italic">
                        {selectedIssue.aiDescription || "AI is analyzing this issue... Based on initial visual data, this appears to be a significant infrastructure concern requiring immediate attention. Recommended priority: High."}
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
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 p-4 cursor-zoom-out"
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

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowProofUpload(false);
                    setProofImage(null);
                    setProofImageFile(null);
                    setPendingStatusChange(null);
                  }}
                  className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={!proofImage || updatingStatus}
                  onClick={() => {
                    if (pendingStatusChange && proofImage) {
                      handleUpdateStatus(pendingStatusChange, proofImage);
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
