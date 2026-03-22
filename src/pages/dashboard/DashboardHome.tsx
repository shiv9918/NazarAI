import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock3,
  Eye,
  Filter,
  ImageIcon,
  MapPin,
  Save,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTranslation } from 'react-i18next';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const AUTH_TOKEN_KEY = 'nazarai_auth_token';

type ReportStatus = 'reported' | 'in_progress' | 'resolved';
type DepartmentName = 'roads' | 'sanitation' | 'electrical' | 'water' | 'administration';

type Report = {
  id: string;
  type: string;
  severity: number;
  lat: number;
  lng: number;
  location: string;
  ward?: string | null;
  department: DepartmentName | string;
  description?: string | null;
  imageUrl?: string | null;
  isDuplicate?: boolean;
  isEmergency?: boolean;
  status: ReportStatus;
  resolutionNotes?: string | null;
  proofImageUrl?: string | null;
  resolvedAt?: string | null;
  reportedAt: string;
  updatedAt: string;
  citizenName?: string;
  citizenEmail?: string;
  aiDescription?: string | null;
};

type ModalForm = {
  status: ReportStatus;
  department: string;
  resolutionNotes: string;
  proofImageUrl: string | null;
  isEmergency: boolean;
};

const DEPARTMENT_ORDER: DepartmentName[] = ['roads', 'sanitation', 'electrical', 'water'];

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

function isSameDay(date: Date, reference: Date) {
  return date >= startOfDay(reference) && date <= endOfDay(reference);
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDays(value: number) {
  return `${value.toFixed(1)} days`;
}

function performanceColor(percent: number) {
  if (percent > 70) {
    return {
      text: 'text-emerald-600 dark:text-emerald-400',
      bar: 'bg-emerald-500',
      bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    };
  }

  if (percent >= 40) {
    return {
      text: 'text-amber-600 dark:text-amber-400',
      bar: 'bg-amber-500',
      bg: 'bg-amber-100 dark:bg-amber-900/30',
    };
  }

  return {
    text: 'text-rose-600 dark:text-rose-400',
    bar: 'bg-rose-500',
    bg: 'bg-rose-100 dark:bg-rose-900/30',
  };
}

function statusLabel(status: ReportStatus, t: (key: string) => string) {
  if (status === 'in_progress') return t('in_progress');
  if (status === 'reported') return t('pending');
  return t('resolved');
}

async function compressToDataUrl(file: File): Promise<string> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to process image.'));
    img.src = rawDataUrl;
  });

  const maxSize = 1280;
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to create image canvas.');
  ctx.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL('image/jpeg', 0.74);
}

export default function DashboardHome() {
  const { t } = useTranslation();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [modalForm, setModalForm] = useState<ModalForm | null>(null);
  const [saving, setSaving] = useState(false);

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
          throw new Error(payload?.message || 'Failed to fetch reports.');
        }

        if (!isMounted) return;
        setReports(Array.isArray(payload?.reports) ? payload.reports : []);
      } catch (error) {
        console.error('Dashboard reports fetch error:', error);
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
    const intervalId = setInterval(fetchReports, 8000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  const stats = useMemo(() => {
    const totalReports = reports.length;
    const now = new Date();

    const resolvedToday = reports.filter((report) => {
      if (report.status !== 'resolved') return false;
      const resolvedDate = new Date(report.resolvedAt || report.updatedAt || report.reportedAt);
      return isSameDay(resolvedDate, now);
    }).length;

    const pendingCritical = reports.filter((report) => report.severity >= 8 && report.status !== 'resolved').length;

    const resolutionDurations = reports
      .filter((report) => report.status === 'resolved')
      .map((report) => {
        const created = new Date(report.reportedAt).getTime();
        const resolved = new Date(report.resolvedAt || report.updatedAt || report.reportedAt).getTime();
        return Math.max(0, resolved - created) / (1000 * 60 * 60 * 24);
      });

    const avgResolutionDays = resolutionDurations.length
      ? resolutionDurations.reduce((acc, days) => acc + days, 0) / resolutionDurations.length
      : 0;

    return {
      totalReports,
      resolvedToday,
      pendingCritical,
      avgResolutionDays,
    };
  }, [reports]);

  const departmentPerformance = useMemo(() => {
    return DEPARTMENT_ORDER.map((department) => {
      const assigned = reports.filter((report) => report.department === department).length;
      const resolved = reports.filter((report) => report.department === department && report.status === 'resolved').length;
      const percent = assigned > 0 ? Math.round((resolved / assigned) * 100) : 0;
      const color = performanceColor(percent);

      return {
        department,
        assigned,
        resolved,
        percent,
        escalated: assigned > 0 && percent < 40,
        color,
      };
    });
  }, [reports]);

  const reportsPerDay = useMemo(() => {
    const out: { day: string; reports: number }[] = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const current = new Date(today);
      current.setDate(today.getDate() - i);
      const dayStart = startOfDay(current).getTime();
      const dayEnd = endOfDay(current).getTime();
      const dayLabel = current.toLocaleDateString('en-IN', { weekday: 'short' });

      const reportsCount = reports.filter((report) => {
        const time = new Date(report.reportedAt).getTime();
        return time >= dayStart && time <= dayEnd;
      }).length;

      out.push({ day: dayLabel, reports: reportsCount });
    }

    return out;
  }, [reports]);

  const issueTypeData = useMemo(() => {
    const counts = new Map<string, number>();
    reports.forEach((report) => {
      counts.set(report.type, (counts.get(report.type) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([issueType, count]) => ({ issueType: issueType.replace(/_/g, ' '), count }))
      .sort((a, b) => b.count - a.count);
  }, [reports]);

  const emergencyReports = useMemo(() => {
    return reports.filter((report) => (report.isEmergency || report.severity >= 9) && report.status !== 'resolved');
  }, [reports]);

  const filteredReports = useMemo(() => {
    const search = searchText.toLowerCase().trim();

    return reports.filter((report) => {
      if (departmentFilter !== 'all' && report.department !== departmentFilter) return false;
      if (statusFilter !== 'all' && report.status !== statusFilter) return false;
      if (!search) return true;

      return (
        report.location.toLowerCase().includes(search) ||
        report.id.toLowerCase().includes(search)
      );
    });
  }, [reports, departmentFilter, statusFilter, searchText]);

  const liveFeed = useMemo(() => {
    return [...reports]
      .sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime())
      .slice(0, 10);
  }, [reports]);

  const openReportModal = (report: Report) => {
    setSelectedReport(report);
    setModalForm({
      status: report.status,
      department: report.department,
      resolutionNotes: report.resolutionNotes || '',
      proofImageUrl: report.proofImageUrl || null,
      isEmergency: Boolean(report.isEmergency),
    });
  };

  const closeReportModal = () => {
    setSelectedReport(null);
    setModalForm(null);
  };

  const onProofImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !modalForm) return;

    try {
      const dataUrl = await compressToDataUrl(file);
      setModalForm({
        ...modalForm,
        proofImageUrl: dataUrl,
      });
    } catch (error) {
      console.error('Proof image conversion failed:', error);
      alert('Failed to process proof image. Please choose a smaller image.');
    }
  };

  const saveReportChanges = async () => {
    if (!selectedReport || !modalForm) return;

    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      alert('Session expired. Please login again.');
      return;
    }

    if (modalForm.status === 'resolved' && !modalForm.proofImageUrl) {
      alert('Please upload proof image before marking this complaint as resolved.');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/reports/${selectedReport.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: modalForm.status,
          department: modalForm.department,
          resolutionNotes: modalForm.resolutionNotes,
          proofImageUrl: modalForm.proofImageUrl,
          isEmergency: modalForm.isEmergency,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to update complaint.');
      }

      const updated = payload?.report as Report;
      if (updated) {
        setReports((prev) => prev.map((report) => (report.id === updated.id ? updated : report)));
        closeReportModal();
      }
    } catch (error) {
      console.error('Save complaint update error:', error);
      alert(error instanceof Error ? error.message : 'Failed to update complaint.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center font-bold text-slate-500 dark:text-slate-400">{t('loading')}</div>;
  }

  return (
    <div className="space-y-8">
      {emergencyReports.length > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/50 dark:bg-rose-950/30">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 text-rose-600 dark:text-rose-400" size={20} />
            <div>
              <div className="text-sm font-black uppercase tracking-wide text-rose-700 dark:text-rose-300">Emergency Alert</div>
              <div className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                {emergencyReports[0].type.replace(/_/g, ' ')} at {emergencyReports[0].location}
              </div>
              <div className="text-xs text-rose-600 dark:text-rose-400">
                ID: {emergencyReports[0].id} | Severity: {emergencyReports[0].severity} | Status: {statusLabel(emergencyReports[0].status, t)}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Total Reports</div>
          <div className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{stats.totalReports}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Resolved Today</div>
          <div className="mt-2 text-3xl font-black text-emerald-600 dark:text-emerald-400">{stats.resolvedToday}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Pending Critical</div>
          <div className="mt-2 text-3xl font-black text-rose-600 dark:text-rose-400">{stats.pendingCritical}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Avg Resolution</div>
          <div className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{formatDays(stats.avgResolutionDays)}</div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-4 text-lg font-black text-slate-900 dark:text-white">Issue Status</h3>
        <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search by location or ID"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-slate-400" />
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                <option value="all">All Departments</option>
                <option value="roads">Roads</option>
                <option value="sanitation">Sanitation</option>
                <option value="electrical">Electrical</option>
                <option value="water">Water</option>
                <option value="administration">Administration</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                <option value="all">All Status</option>
                <option value="reported">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-black uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-3 py-3">Complaint ID</th>
                  <th className="px-3 py-3">Issue Type</th>
                  <th className="px-3 py-3">Location</th>
                  <th className="px-3 py-3">Department</th>
                  <th className="px-3 py-3">Severity</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Created At</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((report) => (
                  <tr
                    key={report.id}
                    className="cursor-pointer border-b border-slate-100 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/30"
                    onClick={() => openReportModal(report)}
                  >
                    <td className="px-3 py-3 font-bold text-slate-800 dark:text-slate-200">#{report.id.slice(-8)}</td>
                    <td className="px-3 py-3 capitalize text-slate-700 dark:text-slate-300">{report.type.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-400">{report.location}</td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {report.department}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${
                        report.severity >= 8
                          ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'
                          : report.severity >= 5
                            ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                            : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        {report.severity}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-semibold text-slate-700 dark:text-slate-300">{statusLabel(report.status, t)}</td>
                    <td className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">{formatDateTime(report.reportedAt)}</td>
                    <td className="px-3 py-3 text-right">
                      <button
                        className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30"
                        onClick={(e) => {
                          e.stopPropagation();
                          openReportModal(report);
                        }}
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredReports.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                      No complaints matched your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      {/* <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 text-lg font-black text-slate-900 dark:text-white">Reports (Last 7 Days)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={reportsPerDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} />
                <XAxis dataKey="day" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="reports" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 text-lg font-black text-slate-900 dark:text-white">Issue Type Distribution</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={issueTypeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} />
                <XAxis dataKey="issueType" interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#0f766e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div> */}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 text-lg font-black text-slate-900 dark:text-white">Reports (Last 7 Days)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={reportsPerDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} />
                <XAxis dataKey="day" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="reports" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 text-lg font-black text-slate-900 dark:text-white">Issue Type Distribution</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={issueTypeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} />
                <XAxis dataKey="issueType" interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#0f766e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-5 flex items-center gap-2 text-lg font-black text-slate-900 dark:text-white">
          <Building2 size={20} /> Department Performance
        </div>
        <div className="space-y-4">
          {departmentPerformance.map((item) => (
            <div key={item.department} className="rounded-2xl border border-slate-100 p-4 dark:border-slate-800">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-slate-200">
                  {item.department}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-black ${item.color.text}`}>{item.percent}%</span>
                  {item.escalated && (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black uppercase text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
                      escalated
                    </span>
                  )}
                </div>
              </div>
              <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div className={`h-full ${item.color.bar}`} style={{ width: `${Math.max(3, item.percent)}%` }} />
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Resolved {item.resolved} / Assigned {item.assigned}
              </div>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selectedReport && modalForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.96 }}
              className="relative max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            >
              <button
                className="absolute right-4 top-4 rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                onClick={closeReportModal}
              >
                <X size={18} />
              </button>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="space-y-4">
                  <h3 className="text-2xl font-black capitalize text-slate-900 dark:text-white">
                    {selectedReport.type.replace(/_/g, ' ')}
                  </h3>

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
                      ID: {selectedReport.id} | Reporter: {selectedReport.citizenName || '-'}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-200">Resolution Notes</div>
                    <textarea
                      value={modalForm.resolutionNotes}
                      onChange={(e) => setModalForm({ ...modalForm, resolutionNotes: e.target.value })}
                      className="h-28 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      placeholder="Add resolution details"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-200">Complaint Details</div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300"><MapPin size={14} /> {selectedReport.location}</div>
                      <div className="text-slate-500 dark:text-slate-400">{selectedReport.ward || 'No ward specified'}</div>
                      <div className="text-slate-500 dark:text-slate-400">Severity: {selectedReport.severity}</div>
                      <div className="text-slate-500 dark:text-slate-400">Created: {formatDateTime(selectedReport.reportedAt)}</div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-200">Status</div>
                    <select
                      value={modalForm.status}
                      onChange={(e) => setModalForm({ ...modalForm, status: e.target.value as ReportStatus })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    >
                      <option value="reported">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-200">Assigned Department</div>
                    <select
                      value={modalForm.department}
                      onChange={(e) => setModalForm({ ...modalForm, department: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    >
                      <option value="roads">Roads</option>
                      <option value="sanitation">Sanitation</option>
                      <option value="electrical">Electrical</option>
                      <option value="water">Water</option>
                      <option value="administration">Administration</option>
                    </select>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={modalForm.isEmergency}
                        onChange={(e) => setModalForm({ ...modalForm, isEmergency: e.target.checked })}
                      />
                      Mark as emergency
                    </label>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-200">Resolution Proof Image</div>
                    {modalForm.proofImageUrl ? (
                      <div className="space-y-3">
                        <img src={modalForm.proofImageUrl} alt="Proof" className="h-40 w-full rounded-xl object-cover" />
                        <button
                          className="rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-black uppercase text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
                          onClick={() => setModalForm({ ...modalForm, proofImageUrl: null })}
                        >
                          Remove Proof
                        </button>
                      </div>
                    ) : (
                      <label className="block">
                        <input type="file" accept="image/*" onChange={onProofImageChange} className="hidden" />
                        <div className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-center text-sm font-semibold text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/40">
                          Upload proof image
                        </div>
                      </label>
                    )}
                    {modalForm.status === 'resolved' && !modalForm.proofImageUrl && (
                      <div className="mt-2 text-xs font-bold text-rose-600 dark:text-rose-400">
                        Proof image is required to set status as resolved.
                      </div>
                    )}
                  </div>

                  <button
                    onClick={saveReportChanges}
                    disabled={saving}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black uppercase tracking-wide text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
