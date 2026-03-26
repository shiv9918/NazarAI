import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, MapPin, Clock, CheckCircle2, ChevronRight, Phone, AlertCircle, ImageIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const AUTH_TOKEN_KEY = 'nazarai_auth_token';

export default function TrackIssue() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchId, setSearchId] = useState(searchParams.get('id') || '');
  const [complaint, setComplaint] = useState<any>(null);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sliderLoading, setSliderLoading] = useState(true);

  useEffect(() => {
    if (searchId) {
      handleSearch();
    }
    fetchComplaints();
  }, []);

  const fetchComplaints = async () => {
    setSliderLoading(true);
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      setSliderLoading(false);
      setComplaints([]);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/reports`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to fetch your complaints.');
      }
      const reportData: any[] = Array.isArray(payload?.reports) ? payload.reports : [];
      setComplaints(
        reportData
          .map((r) => ({
            ...r,
            reportedAtLabel: r.reportedAt ? new Date(r.reportedAt).toLocaleDateString('en-IN') : '-',
          }))
          .sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime())
      );
    } catch (error) {
      console.error('Error fetching complaints:', error);
      setComplaints([]);
    } finally {
      setSliderLoading(false);
    }
  };

  const handleSearch = async (targetId?: string) => {
    const idToSearch = targetId || searchId;
    if (!idToSearch) return;
    setLoading(true);

    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      alert('Session expired. Please login again.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/reports/${idToSearch}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 404) {
          alert('Complaint not found. Please check the ID.');
        } else {
          alert(payload?.message || 'Error searching complaint. Please try again.');
        }
        setComplaint(null);
        return;
      }

      const data = payload.report;
      const reportedAt = data?.reportedAt ? new Date(data.reportedAt) : new Date();
      const status = data?.status || 'reported';

      setComplaint({
        ...data,
        reportedAt: reportedAt.toLocaleString('en-IN'),
        resolvedAt: data?.resolvedAt,
        timeline: [
          { status: t('status_reported'), time: reportedAt.toLocaleString('en-IN'), done: true },
          { status: `${t('status_ai_verified')} (${Math.round((data?.confidence || 0.94) * 100)}% conf.)`, time: 'Analysis complete', done: true },
          { status: t('status_assigned'), time: 'Department notified', done: status !== 'reported' },
          { status: t('status_in_progress_timeline'), time: 'Field work', done: status === 'in_progress' || status === 'resolved' },
          { status: t('status_resolved'), time: 'Final check', done: status === 'resolved' }
        ]
      });
    } catch (error) {
      console.error("Error searching complaint:", error);
      alert("Error searching complaint. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{t('track_complaint_title')}</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">{t('track_complaint_subtitle')}</p>
      </div>

      <div className="mt-10 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            placeholder={t('complaint_id_placeholder')}
            className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-4 focus:border-blue-500 focus:outline-none shadow-sm dark:bg-slate-900 dark:border-slate-800 dark:text-white dark:placeholder-slate-500"
          />
        </div>
        <button
          onClick={handleSearch}
          className="rounded-2xl bg-blue-600 px-8 py-4 font-bold text-white shadow-lg hover:bg-blue-700"
        >
          {t('track_button')}
        </button>
      </div>

      {/* Only show complaints slider if no complaint is selected */}
      {!complaint && (
        <div className="mt-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="inline-block w-1.5 h-5 bg-blue-600 rounded-sm mr-2"></span>
            My Recent Reports
          </h2>

          {sliderLoading ? (
            <div className="mt-4">{t('loading')}...</div>
          ) : complaints.length === 0 ? (
            <div className="mt-4 text-slate-500 dark:text-slate-400">{t('no_complaints_found')}</div>
          ) : (
            <div className="mt-4 flex flex-col gap-6 pb-2">
              {complaints.map((item) => (
                <div
                  key={item.id || item.complaintCode}
                  className="flex w-full bg-white rounded-3xl border border-slate-100 p-6 shadow-md items-center gap-6 dark:bg-slate-900 dark:border-slate-800"
                >
                  {/* Image */}
                  <div className="flex-shrink-0 h-24 w-24 rounded-2xl overflow-hidden bg-slate-100 flex items-center justify-center">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.type} className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="text-slate-300" size={40} />
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-blue-400 tracking-widest mb-1">#{(item.complaintCode || item.id)?.slice(-6).toUpperCase()}</div>
                    <div className="text-lg font-bold text-slate-900 dark:text-white mb-1 capitalize">{item.type || '—'}</div>
                    <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                      <MapPin size={16} className="inline-block mr-1" />
                      {item.location || '-'}
                    </div>
                  </div>
                  {/* Status + Button */}
                  <div className="flex flex-col items-end gap-3">
                    <span className="rounded-full bg-slate-100 px-4 py-1 text-xs font-bold text-slate-500 tracking-wide mb-2" style={{ letterSpacing: '0.05em' }}>
                      {item.status?.toUpperCase()}
                    </span>
                    <button
                      onClick={() => {
                        const targetId = item.id || item.complaintCode;
                        setSearchId(targetId);
                        handleSearch(targetId);
                      }}
                      className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 transition"
                    >
                      TRACK <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="mt-20 flex justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        </div>
      )}

      {complaint && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-12 space-y-8"
        >
          {/* Back Button */}
          <div className="mb-4">
            <button
              onClick={() => {
                setSearchId("");
                setComplaint(null);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-blue-50 dark:bg-slate-800 dark:text-white dark:hover:bg-blue-900/20"
            >
              <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} />
              Back
            </button>
          </div>
          {/* Status Card */}
          <div className="rounded-3xl bg-white p-8 shadow-xl border border-slate-100 dark:bg-slate-900 dark:border-slate-800">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest dark:text-slate-500">{t('complaint_id')}</div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">{complaint.complaintCode || complaint.id}</div>
              </div>
              <div className="rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                {complaint.status === 'resolved'
                  ? t('status_resolved')
                  : complaint.status === 'in_progress'
                    ? t('status_work_in_progress')
                    : t('status_reported')}
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  <MapPin size={20} />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase dark:text-slate-500">{t('location_label')}</div>
                  <div className="font-bold text-slate-900 dark:text-white">{complaint.location}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  <AlertCircle size={20} />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase dark:text-slate-500">{t('department_label')}</div>
                  <div className="font-bold text-slate-900 dark:text-white">{complaint.department}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Proof Images Section */}
          {complaint.status === 'resolved' && complaint.proofImageUrl && (
            <div className="rounded-3xl bg-white p-8 shadow-xl border border-slate-100 dark:bg-slate-900 dark:border-slate-800">
              <h3 className="mb-6 text-lg font-bold text-slate-900 flex items-center gap-2 dark:text-white">
                <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" size={20} />
                {t('resolution_proof')}
              </h3>
              <div className="space-y-4">
                <div className="rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800">
                  <img 
                    src={complaint.proofImageUrl} 
                    alt="Resolution proof" 
                    className="w-full h-96 object-cover"
                  />
                </div>
                <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-bold">
                  <CheckCircle2 size={18} />
                  Issue resolved on {complaint.resolvedAt ? new Date(complaint.resolvedAt).toLocaleDateString('en-IN') : 'N/A'}
                </div>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="rounded-3xl bg-white p-8 shadow-xl border border-slate-100 dark:bg-slate-900 dark:border-slate-800">
            <h3 className="mb-8 text-lg font-bold text-slate-900 dark:text-white">{t('complaint_journey')}</h3>
            <div className="space-y-8">
              {complaint.timeline.map((item: any, i: number) => (
                <div key={i} className="relative flex gap-6">
                  {i !== complaint.timeline.length - 1 && (
                    <div className={`absolute left-4 top-8 h-full w-0.5 ${item.done ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'}`} />
                  )}
                  <div className={`z-10 flex h-8 w-8 items-center justify-center rounded-full ${
                    item.done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                  }`}>
                    {item.done ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                  </div>
                  <div className="flex-1">
                    <div className={`font-bold ${item.done ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-600'}`}>{item.status}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">{item.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          {/* <div className="flex flex-col gap-4 sm:flex-row">
            <button className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 py-4 font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-900">
              <Phone size={20} />
              {t('contact_department')}
            </button>
            <button className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-50 py-4 font-bold text-rose-600 hover:bg-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:hover:bg-rose-900/40">
              {t('escalate_issue')}
            </button>
          </div> */}
        </motion.div>
      )}
    </div>
  );
}
