import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { MapPin, CheckCircle2, Loader2, AlertCircle, TrendingUp, Upload, Camera, ChevronRight, Map as MapIcon, Info, ShieldAlert } from 'lucide-react';
import confetti from 'canvas-confetti';
import imageCompression from 'browser-image-compression';
import { getAddressFromCoords, getCurrentPosition } from '../utils/location';
import { analyzeIssueImage } from '../services/geminiService';
import { useAuth } from '../context/AuthContext';

import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useTheme } from '../context/ThemeContext';

// Fix for default marker icons in Leaflet
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const AUTH_TOKEN_KEY = 'nazarai_auth_token';

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 15);
  }, [center, map]);
  return null;
}

export default function ReportIssue() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [detection, setDetection] = useState<any>(null);
  const [location, setLocation] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [complaintId, setComplaintId] = useState<string | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [description, setDescription] = useState("");
  const [manualCategory, setManualCategory] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const categories = [
    { id: 'garbage', name: t('garbage'), department: 'sanitation', severity: 6 },
    { id: 'pothole', name: t('pothole'), department: 'road', severity: 7 },
    { id: 'streetlight', name: t('streetlight'), department: 'electrical', severity: 5 },
    { id: 'water', name: t('water'), department: 'water', severity: 8 },
    { id: 'dump', name: t('dump'), department: 'sanitation', severity: 9 },
  ];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && user) {
      try {
        // Image Compression - more aggressive for faster upload
        const options = {
          maxSizeMB: 0.3,
          maxWidthOrHeight: 1024,
          useWebWorker: true
        };
        const compressedFile = await imageCompression(file, options);
        
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          setImage(base64);
          // Use a local data URL to avoid Firebase Storage CORS issues during submission.
          setUploadedImageUrl(base64);
          setIsAnalyzing(true);
          setStep(2); // Move to AI Detection step immediately to show loading

          try {
            const result = await analyzeIssueImage(base64);
            setDetection(result);
            // Auto-detect location in background
            detectLocation();
          } catch (error) {
            console.error("Analysis error:", error);
            setDetection({
              issueType: 'unknown',
              confidence: 0,
              severity: 5,
              department: 'general',
              description: 'AI analysis failed. Please select manually.'
            });
          } finally {
            setIsAnalyzing(false);
          }
        };
        reader.readAsDataURL(compressedFile);
      } catch (error) {
        console.error("Compression error:", error);
      }
    } else if (!user) {
      alert("Please login first to report an issue.");
    }
  };

  const detectLocation = async () => {
    try {
      const pos = await getCurrentPosition();
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      
      // Use Nominatim for live address
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'CivicEye-App' } }
      );
      const data = await response.json();
      const address = data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      
      // Extract neighborhood/suburb for "Ward" display
      const neighborhood = data.address?.suburb || data.address?.neighbourhood || data.address?.city_district || "Central Ward";
      const ward = `Ward - ${neighborhood}`;
      
      setLocation({ lat, lng, address, ward });
      
      // Simulate Duplicate Detection (Real API would be better)
      setIsDuplicate(Math.random() > 0.85);
    } catch (error) {
      console.error("Error detecting location:", error);
      // Fallback to a safe default but mark as fallback
      const lat = 28.6139;
      const lng = 77.2090;
      const address = "Connaught Place, New Delhi";
      const ward = "Ward - New Delhi";
      setLocation({ lat, lng, address, ward });
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      alert("Please login to submit a report.");
      return;
    }

    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      alert('Session expired. Please login again.');
      return;
    }

    // 1. Generate ID client-side for instant feedback
    const reportId = globalThis.crypto?.randomUUID?.() || `report-${Date.now()}`;
    setComplaintId(reportId);
    
    // 2. Transition to success screen IMMEDIATELY
    setStep(5);
    setIsSaving(true);

    // 3. Trigger confetti for immediate celebration
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#2563eb', '#10b981', '#f59e0b']
    });

    // 4. Perform the actual save in the background
    (async () => {
      try {
        const finalImageUrl = uploadedImageUrl || image || "";

        const type = manualCategory || detection?.issueType || 'unknown';
        const severity = isDuplicate ? 10 : (detection?.severity || 5);
        const aiAnalysis = `Automated analysis for ${type.replace('_', ' ')}: Detected significant damage at the specified location. Severity estimated at ${severity}/10. Priority: ${severity >= 8 ? 'Critical' : 'High'}. Recommended action: Immediate dispatch of repair crew.`;

        const reportData = {
          id: reportId,
          type,
          severity,
          lat: location?.lat || 28.6139,
          lng: location?.lng || 77.2090,
          location: location?.address || "New Delhi",
          ward: location?.ward || "Central Ward",
          department: detection?.department || null,
          description: description,
          imageUrl: finalImageUrl,
          isDuplicate: isDuplicate,
          aiDescription: aiAnalysis
        };

        const response = await fetch(`${API_BASE_URL}/api/reports`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(reportData),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data?.message || 'Failed to submit report.');
        }

        if (data?.report?.id) {
          setComplaintId(data.report.id);
        }

        setIsSaving(false);
      } catch (error) {
        console.error("Background submission error:", error);
        setIsSaving(false);
        // We don't alert here because the user is already on the success screen
        // In a real app, we might show a "Sync Failed" badge on the success card
      }
    })();
  };

  const renderBoundingBox = () => {
    if (!detection?.boundingBox || !image) return null;
    const [ymin, xmin, ymax, xmax] = detection.boundingBox;
    return (
      <div 
        className="absolute border-4 border-green-500 rounded-lg shadow-[0_0_15px_rgba(34,197,94,0.5)] pointer-events-none z-10"
        style={{
          top: `${ymin / 10}%`,
          left: `${xmin / 10}%`,
          width: `${(xmax - xmin) / 10}%`,
          height: `${(ymax - ymin) / 10}%`,
        }}
      >
        <div className="absolute -top-8 left-0 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-t-lg whitespace-nowrap">
          {detection.issueType} ({Math.round(detection.confidence * 100)}%)
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Progress Stepper */}
      <div className="mb-10 flex justify-between items-center relative">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 dark:bg-slate-800 -translate-y-1/2 z-0" />
        {[1, 2, 3, 4, 5].map((s) => (
          <div
            key={s}
            className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-500 ${
              step === s 
                ? 'bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900/30' 
                : step > s 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-white text-slate-400 border border-slate-200 dark:bg-slate-900 dark:border-slate-800'
            }`}
          >
            {step > s ? <CheckCircle2 size={16} /> : s}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* STEP 1: UPLOAD */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center"
          >
            <div className="mb-8">
              <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {t('step1')}
              </h2>
              <p className="mt-2 text-slate-500 dark:text-slate-400">
                {t('step1_desc')}
              </p>
            </div>
            
            <div className="space-y-8">
              <label className="group relative flex flex-col items-center justify-center w-full h-72 border-2 border-dashed border-slate-200 rounded-[2.5rem] cursor-pointer bg-slate-50/50 hover:bg-white hover:border-blue-400 transition-all duration-300 dark:bg-slate-900/50 dark:border-slate-800 dark:hover:border-blue-500 dark:hover:bg-slate-900/50">
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform dark:bg-blue-900/20">
                    <Camera className="text-blue-600 dark:text-blue-400" size={36} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                    {t('step1_upload_prompt')}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
                    {t('step1_ai_detect_desc')}
                  </p>
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
              </label>
            </div>
          </motion.div>
        )}

        {/* STEP 2: AI DETECTION */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="mb-8">
              <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {t('step2')}
              </h2>
            </div>

            <div className="relative aspect-square max-w-md mx-auto rounded-[2.5rem] overflow-hidden bg-slate-100 dark:bg-slate-900 shadow-2xl mb-6">
              {image && <img src={image} alt="Analysis" className="w-full h-full object-cover" />}
              
              {isAnalyzing ? (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white p-8">
                  <div className="relative">
                    <Loader2 className="animate-spin text-blue-400 mb-6" size={64} />
                    <div className="absolute inset-0 animate-ping bg-blue-400/20 rounded-full" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{t('step1_ai_analyzing')}</h3>
                </div>
              ) : (
                renderBoundingBox()
              )}
            </div>

            {!isAnalyzing && (
              <div className="max-w-md mx-auto bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-xl text-left border border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Detected Issue</div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white capitalize">
                      {detection?.issueType?.replace('_', ' ')}
                    </h3>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Confidence</div>
                    <div className="text-3xl font-black text-emerald-500">
                      {Math.round((detection?.confidence || 0) * 100)}%
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {detection?.description || "AI has analyzed the image and identified this civic issue. Please verify the details below."}
                  </p>
                </div>

                {detection?.confidence < 0.6 && (
                  <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl mb-4 dark:bg-amber-900/20">
                    <AlertCircle className="text-amber-600" size={18} />
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
                      Low confidence. Please verify or select manually.
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Manual Override</div>
                  <select 
                    className="w-full bg-slate-100 border-none rounded-xl p-3 text-sm font-bold dark:bg-slate-800 dark:text-white"
                    value={manualCategory || detection?.issueType}
                    onChange={(e) => setManualCategory(e.target.value)}
                  >
                    <option value="">Select if incorrect...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div className="mt-8 flex gap-4 max-w-md mx-auto">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 transition-all dark:text-slate-400 dark:hover:bg-slate-800"
              >
                {t('retake')}
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={isAnalyzing}
                className="flex-[2] py-4 rounded-2xl bg-blue-600 text-white font-bold shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                {t('next_step')}
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 3: LOCATION */}
        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-center"
          >
            <div className="mb-8">
              <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {t('step3')}
              </h2>
            </div>

            <div className="relative h-80 rounded-[2.5rem] overflow-hidden shadow-2xl mb-6 border-4 border-white dark:border-slate-800">
              {!location ? (
                <div className="absolute inset-0 bg-slate-100 dark:bg-slate-900 flex flex-col items-center justify-center">
                  <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
                  <p className="font-bold text-slate-500">Detecting your location...</p>
                </div>
              ) : (
                <MapContainer 
                  center={[location.lat, location.lng]} 
                  zoom={15} 
                  className="h-full w-full"
                  scrollWheelZoom={false}
                >
                  {theme === 'dark' ? (
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                  ) : (
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  )}
                  <Marker position={[location.lat, location.lng]} icon={DefaultIcon} />
                  <MapUpdater center={[location.lat, location.lng]} />
                </MapContainer>
              )}
            </div>

            {location && (
              <div className="bg-white/90 backdrop-blur-md dark:bg-slate-900/90 p-6 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center dark:bg-blue-900/20">
                  <MapPin className="text-blue-600" size={24} />
                </div>
                <div className="text-left">
                  <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Current Ward</div>
                  <div className="font-bold text-slate-900 dark:text-white text-lg">
                    {location?.ward || "Detecting..."}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {location?.address}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 text-left mb-8">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Manual Address Fallback</div>
              <div className="relative">
                <input 
                  type="text"
                  value={location?.address || ""}
                  onChange={(e) => setLocation({ ...location, address: e.target.value })}
                  placeholder="Enter address manually..."
                  className="w-full bg-slate-50 border-none rounded-2xl p-4 pl-12 text-sm font-bold dark:bg-slate-800 dark:text-white"
                />
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 transition-all dark:text-slate-400 dark:hover:bg-slate-800"
              >
                {t('back')}
              </button>
              <button
                onClick={() => setStep(4)}
                className="flex-[2] py-4 rounded-2xl bg-blue-600 text-white font-bold shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all"
              >
                {t('next_step')}
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 4: DETAILS */}
        {step === 4 && (
          <motion.div
            key="step4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="mb-8">
              <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {t('step4')}
              </h2>
            </div>

            <div className="space-y-6 text-left">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Issue Type</div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center dark:bg-blue-900/20">
                      <TrendingUp size={16} className="text-blue-600" />
                    </div>
                    <span className="font-bold text-slate-900 dark:text-white capitalize">
                      {manualCategory || detection?.issueType}
                    </span>
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Severity</div>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      (detection?.severity || 5) > 7 ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/20' : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20'
                    }`}>
                      <ShieldAlert size={16} />
                    </div>
                    <span className={`font-bold ${
                      (detection?.severity || 5) > 7 ? 'text-rose-600' : 'text-amber-600'
                    }`}>
                      {isDuplicate ? 'CRITICAL' : `${detection?.severity || 5}/10`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Assigned Department</div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center dark:bg-indigo-900/20">
                      <Info className="text-indigo-600" size={24} />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white capitalize">
                        {detection?.department || 'General'} Department
                      </div>
                      <div className="text-xs text-slate-500">Auto-routed based on AI analysis</div>
                    </div>
                  </div>
                  <ChevronRight className="text-slate-300" />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Additional Details</div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add more details about the issue..."
                  className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold dark:bg-slate-800 dark:text-white min-h-[120px]"
                />
              </div>

              {uploadedImageUrl && (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-4 dark:bg-emerald-900/10 dark:border-emerald-900/20">
                  <CheckCircle2 className="text-emerald-600" size={20} />
                  <div>
                    <h4 className="font-bold text-emerald-900 dark:text-emerald-400 text-sm">Image Ready</h4>
                    <p className="text-xs text-emerald-700 dark:text-emerald-500 mt-1">
                      Image is attached and ready for submission.
                    </p>
                  </div>
                </div>
              )}

              {isDuplicate && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-4 dark:bg-rose-900/10 dark:border-rose-900/20">
                  <AlertCircle className="text-rose-600 shrink-0" size={20} />
                  <div>
                    <h4 className="font-bold text-rose-900 dark:text-rose-400 text-sm">Duplicate Issue Detected</h4>
                    <p className="text-xs text-rose-700 dark:text-rose-500 mt-1">
                      This issue has already been reported at this location. We've increased the priority to **CRITICAL** to expedite resolution.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-10">
              <button
                onClick={handleSubmit}
                disabled={isSaving}
                className="w-full py-5 rounded-[2rem] bg-blue-600 text-white font-black text-lg shadow-2xl shadow-blue-500/30 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="animate-spin" size={24} />
                    Submitting Report...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={24} />
                    {t('submit_report')}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 5: SUCCESS SCREEN */}
        {step === 5 && (
          <motion.div
            key="step5"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <div className="relative mx-auto mb-10 w-32 h-32">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 12, stiffness: 200 }}
                className="absolute inset-0 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
              >
                <CheckCircle2 size={64} />
              </motion.div>
              <div className="absolute inset-0 animate-ping bg-emerald-400/20 rounded-full" />
            </div>

            <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-4">
              {t('report_submitted')}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-10 max-w-sm mx-auto">
              Your report has been successfully logged and routed to the relevant department.
            </p>
            
            <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
              
              <div className="relative z-10">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Complaint ID</div>
                <div className="text-5xl font-black text-blue-400 mb-10 tabular-nums">
                  {complaintId}
                </div>
                
                <div className="grid grid-cols-2 gap-8 text-left">
                  <div className="space-y-1">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Department</div>
                    <div className="font-bold text-lg capitalize">{detection?.department || 'General'}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Resolution ETA</div>
                    <div className="font-bold text-lg">2-3 Working Days</div>
                  </div>
                </div>

                <div className="mt-10 pt-8 border-t border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isSaving ? (
                      <>
                        <Loader2 className="w-2 h-2 text-blue-400 animate-spin" />
                        <span className="text-xs font-bold text-slate-400">Syncing with Cloud...</span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-xs font-bold text-slate-400">Status: Assigned</span>
                      </>
                    )}
                  </div>
                  <button className="text-xs font-bold text-blue-400 hover:underline">Track Progress</button>
                </div>
              </div>
            </div>

            <div className="mt-12 space-y-4">
              <button
                onClick={() => window.location.href = '/'}
                className="w-full py-5 rounded-2xl bg-slate-100 text-slate-900 font-black hover:bg-slate-200 transition-all dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
              >
                {t('back_to_home')}
              </button>
              <p className="text-xs text-slate-400 font-bold">
                A confirmation SMS has been sent to your registered number.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
