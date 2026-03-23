import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, X } from 'lucide-react';

export type ResolutionReport = {
  id: string;
  type: string;
  imageUrl?: string | null;
  location?: string | null;
  createdAt?: string | null;
  reportedAt?: string | null;
};

type ResolvePayload = {
  proofFile: File;
  resolutionNotes: string;
  officerName: string;
  resolutionTimeTakenHours: number;
};

type ResolutionModalProps = {
  isOpen: boolean;
  complaint: ResolutionReport | null;
  onClose: () => void;
  onResolved: (data: ResolvePayload) => Promise<void> | void;
  isSubmitting?: boolean;
};

function formatComplaintId(id: string) {
  const short = id.replace(/-/g, '').slice(-8).toUpperCase();
  return `NAZ-${new Date().getFullYear()}-${short}`;
}

function prettifyIssueType(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function durationLabel(start: Date, end: Date) {
  const totalHours = Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60)));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (days > 0) {
    return `${days} days ${hours} hours`;
  }

  return `${hours} hours`;
}

export default function ResolutionModal({
  isOpen,
  complaint,
  onClose,
  onResolved,
  isSubmitting = false,
}: ResolutionModalProps) {
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [officerName, setOfficerName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setProofFile(null);
      setProofPreview(null);
      setResolutionNotes('');
      setOfficerName('');
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (proofPreview) {
        URL.revokeObjectURL(proofPreview);
      }
    };
  }, [proofPreview]);

  const reportedAt = useMemo(() => {
    const raw = complaint?.reportedAt || complaint?.createdAt;
    if (!raw) return new Date();
    const dt = new Date(raw);
    return Number.isNaN(dt.getTime()) ? new Date() : dt;
  }, [complaint]);

  const timeTakenHours = useMemo(() => {
    return Math.max(0, Math.round((Date.now() - reportedAt.getTime()) / (1000 * 60 * 60)));
  }, [reportedAt]);

  const canSubmit = Boolean(proofFile) && resolutionNotes.trim().length >= 20 && officerName.trim().length > 0;

  const onFileChange = (file: File | undefined) => {
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png'];
    if (!allowed.includes(file.type)) {
      setError('Only JPEG and PNG files are allowed.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Max file size is 5MB.');
      return;
    }

    if (proofPreview) {
      URL.revokeObjectURL(proofPreview);
    }

    setProofFile(file);
    setProofPreview(URL.createObjectURL(file));
    setError(null);
  };

  const submit = async () => {
    if (!proofFile) {
      setError('Proof photo is mandatory before marking as resolved.');
      return;
    }

    if (resolutionNotes.trim().length < 20) {
      setError('Resolution notes must be at least 20 characters.');
      return;
    }

    if (!officerName.trim()) {
      setError('Field Officer name is required.');
      return;
    }

    setError(null);
    await onResolved({
      proofFile,
      resolutionNotes: resolutionNotes.trim(),
      officerName: officerName.trim(),
      resolutionTimeTakenHours: timeTakenHours,
    });
  };

  return (
    <AnimatePresence>
      {isOpen && complaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 14 }}
            className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 md:p-8"
          >
            <button
              onClick={onClose}
              className="absolute right-5 top-5 rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <X size={18} />
            </button>

            <h2 className="text-2xl font-black text-slate-900 dark:text-white">
              Mark as Resolved - #{formatComplaintId(complaint.id)}
            </h2>

            <div className="mt-6 space-y-6">
              <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Before (reported by citizen)
                </p>
                <div className="mt-3 flex items-start gap-4">
                  <img
                    src={complaint.imageUrl || `https://picsum.photos/seed/${complaint.id}/600/400`}
                    alt="Before"
                    className="h-32 w-52 rounded-xl object-cover"
                  />
                  <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600 dark:bg-blue-900/20 dark:text-blue-300">
                    AI detected: {prettifyIssueType(complaint.type)} - 94%
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  After photo (mandatory)
                </p>
                <label className="mt-3 block cursor-pointer">
                  {proofPreview ? (
                    <div className="relative">
                      <img src={proofPreview} alt="After proof" className="h-60 w-full rounded-xl object-cover" />
                      <div className="absolute bottom-3 right-3 rounded-full bg-black/65 px-3 py-1 text-xs font-bold text-white">
                        Change photo
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-52 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-center dark:border-slate-700 dark:bg-slate-800/50">
                      <Camera className="mb-3 text-slate-400" size={30} />
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Upload resolution proof photo</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        This photo will be sent to citizen as proof of resolution
                      </p>
                      <p className="mt-2 text-[11px] text-slate-500">JPEG/PNG, up to 5MB</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    className="hidden"
                    onChange={(e) => onFileChange(e.target.files?.[0])}
                  />
                </label>
                {!proofFile && (
                  <p className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
                    Proof photo is mandatory before marking as resolved
                  </p>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Resolution notes</p>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={4}
                  className="mt-3 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  placeholder="Describe what was done... e.g. Pothole filled with concrete mix, road surface levelled"
                />
                <p className="mt-2 text-xs text-slate-500">Minimum 20 characters</p>
              </section>

              <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Resolution summary</p>
                <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Time taken to resolve:</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{durationLabel(reportedAt, new Date())}</p>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400">Field Officer:</label>
                    <input
                      type="text"
                      value={officerName}
                      onChange={(e) => setOfficerName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      placeholder="Officer name"
                    />
                  </div>
                </div>
              </section>

              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-300">
                  {error}
                </div>
              )}

              <button
                type="button"
                disabled={!canSubmit || isSubmitting}
                onClick={submit}
                className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-black uppercase tracking-wide text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Uploading...' : 'Upload Proof & Mark Resolved'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
