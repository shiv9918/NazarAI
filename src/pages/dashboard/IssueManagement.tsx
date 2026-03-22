import { useState, useEffect } from 'react';
import { Search, Filter, Download, MoreVertical, Eye, CheckCircle, Clock, AlertTriangle, MapPin, Users, X, Calendar, Info, Maximize2, Upload, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const AUTH_TOKEN_KEY = 'nazarai_auth_token';

type ReportStatus = 'reported' | 'in_progress' | 'resolved';

export default function IssueManagement() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState<any>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [showProofUpload, setShowProofUpload] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

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
        throw new Error(data?.message || 'Failed to fetch reports.');
      }

      const reportsData = Array.isArray(data?.reports) ? data.reports : [];
      setIssues(reportsData);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, []);

  const filteredIssues = issues.filter((issue) => {
    const matchesSearch = searchText === '' ||
      issue.location?.toLowerCase().includes(searchText.toLowerCase()) ||
      issue.id?.toString().includes(searchText) ||
      issue.type?.toLowerCase().includes(searchText.toLowerCase());

    const matchesDepartment = departmentFilter === 'all' || issue.department === departmentFilter;
    const matchesStatus = statusFilter === 'all' || issue.status === statusFilter;

    return matchesSearch && matchesDepartment && matchesStatus;
  });

  const statusLabel = (status: string, t: any) => {
    switch (status) {
      case 'reported':
        return 'Pending';
      case 'in_progress':
        return 'In Progress';
      case 'resolved':
        return 'Resolved';
      default:
        return status;
    }
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const updateIssueStatus = async (issueId: string, newStatus: ReportStatus, resolutionNotes?: string, proofImageUrl?: string) => {
    setUpdatingStatus(true);
    const token = localStorage.getItem(AUTH_TOKEN_KEY);

    try {
      const response = await fetch(`${API_BASE_URL}/api/reports/${issueId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: newStatus,
          resolutionNotes,
          proofImageUrl,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update issue status');
      }

      await fetchIssues();
      setSelectedIssue(null);
      setProofImage(null);
      setShowProofUpload(false);
      setPendingStatusChange(null);
    } catch (error) {
      console.error('Error updating issue:', error);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const onProofImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setProofImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const openIssueModal = (issue: any) => {
    setSelectedIssue(issue);
    setProofImage(issue.proofImageUrl || null);
  };

  const closeIssueModal = () => {
    setSelectedIssue(null);
    setProofImage(null);
    setShowProofUpload(false);
    setPendingStatusChange(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white">Issue Management</h1>
        <button className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-black uppercase tracking-wide text-white hover:bg-blue-700">
          <Download size={16} />
          Export
        </button>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
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
              {filteredIssues.map((issue) => (
                <tr
                  key={issue.id}
                  className="cursor-pointer border-b border-slate-100 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/30"
                  onClick={() => openIssueModal(issue)}
                >
                  <td className="px-3 py-3 font-bold text-slate-800 dark:text-slate-200">#{issue.id.slice(-8)}</td>
                  <td className="px-3 py-3 capitalize text-slate-700 dark:text-slate-300">{issue.type.replace(/_/g, ' ')}</td>
                  <td className="px-3 py-3 text-slate-600 dark:text-slate-400">{issue.location}</td>
                  <td className="px-3 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {issue.department}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${
                      issue.severity >= 8
                        ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'
                        : issue.severity >= 5
                          ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>
                      {issue.severity}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-semibold text-slate-700 dark:text-slate-300">{statusLabel(issue.status, t)}</td>
                  <td className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">{formatDateTime(issue.reportedAt)}</td>
                  <td className="px-3 py-3 text-right">
                    <button
                      className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30"
                      onClick={(e) => {
                        e.stopPropagation();
                        openIssueModal(issue);
                      }}
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredIssues.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                    No issues matched your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {selectedIssue && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.96 }}
              className="relative max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            >
              <button
                className="absolute right-4 top-4 rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                onClick={closeIssueModal}
              >
                <X size={18} />
              </button>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="space-y-4">
                  <h3 className="text-2xl font-black capitalize text-slate-900 dark:text-white">
                    {selectedIssue.type.replace(/_/g, ' ')}
                  </h3>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                    {selectedIssue.imageUrl ? (
                      <img src={selectedIssue.imageUrl} alt="Issue" className="h-56 w-full rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-slate-300 text-slate-400 dark:border-slate-700">
                        <Info size={24} />
                      </div>
                    )}
                    <div className="mt-3 text-sm text-slate-700 dark:text-slate-300">
                      <div className="font-bold">Description</div>
                      <div>{selectedIssue.description || 'No description provided'}</div>
                    </div>
                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      ID: {selectedIssue.id} | Reporter: {selectedIssue.citizenName || '-'}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-200">Resolution Notes</div>
                    <textarea
                      value={selectedIssue.resolutionNotes || ''}
                      onChange={(e) => setSelectedIssue({ ...selectedIssue, resolutionNotes: e.target.value })}
                      className="h-28 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      placeholder="Add resolution details"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-200">Issue Details</div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300"><MapPin size={14} /> {selectedIssue.location}</div>
                      <div className="text-slate-500 dark:text-slate-400">{selectedIssue.ward || 'No ward specified'}</div>
                      <div className="text-slate-500 dark:text-slate-400">Severity: {selectedIssue.severity}</div>
                      <div className="text-slate-500 dark:text-slate-400">Created: {formatDateTime(selectedIssue.reportedAt)}</div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-200">Status</div>
                    <select
                      value={selectedIssue.status}
                      onChange={(e) => setSelectedIssue({ ...selectedIssue, status: e.target.value as ReportStatus })}
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
                      value={selectedIssue.department}
                      onChange={(e) => setSelectedIssue({ ...selectedIssue, department: e.target.value })}
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
                        checked={selectedIssue.isEmergency || false}
                        onChange={(e) => setSelectedIssue({ ...selectedIssue, isEmergency: e.target.checked })}
                      />
                      Mark as emergency
                    </label>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-200">Resolution Proof Image</div>
                    {proofImage ? (
                      <div className="space-y-3">
                        <img src={proofImage} alt="Proof" className="h-40 w-full rounded-xl object-cover" />
                        <button
                          className="rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-black uppercase text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
                          onClick={() => setProofImage(null)}
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
                    {selectedIssue.status === 'resolved' && !proofImage && (
                      <div className="mt-2 text-xs font-bold text-rose-600 dark:text-rose-400">
                        Proof image is required to set status as resolved.
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => updateIssueStatus(selectedIssue.id, selectedIssue.status, selectedIssue.resolutionNotes, proofImage)}
                    disabled={updatingStatus}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black uppercase tracking-wide text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    <Save size={16} /> {updatingStatus ? 'Updating...' : 'Update Issue'}
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