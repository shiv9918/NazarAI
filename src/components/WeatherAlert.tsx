import { motion } from 'framer-motion';
import { BellRing, CloudRain, Send, CheckCircle2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const AUTH_TOKEN_KEY = 'nazarai_auth_token';

type RainfallSeverity = 'none' | 'watch' | 'warning' | 'emergency';

type WeatherSummaryResponse = {
  weather: {
    city: string;
    rainfall48hMm: number;
    generatedAt: string;
    severity: RainfallSeverity;
    label: string;
    bannerText: string;
    source: string;
  };
  latestAlert: {
    id: string;
    severity: RainfallSeverity;
    title: string;
    message: string;
    rainfall_48h_mm: number;
    created_at: string;
  } | null;
  canSendAlert: boolean;
};

type DepartmentNotification = {
  id: string;
  alertId: string;
  department: string;
  deliveredAt: string;
  acknowledgedAt: string | null;
  severity: RainfallSeverity;
  title: string;
  message: string;
  rainfall48hMm: number;
};

function severityStyles(severity: RainfallSeverity) {
  if (severity === 'emergency') {
    return {
      container: 'bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900/50',
      icon: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
      text: 'text-rose-800 dark:text-rose-200',
      button: 'bg-rose-600 hover:bg-rose-700 text-white',
    };
  }

  if (severity === 'warning') {
    return {
      container: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/50',
      icon: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
      text: 'text-amber-900 dark:text-amber-100',
      button: 'bg-amber-600 hover:bg-amber-700 text-white',
    };
  }

  if (severity === 'watch') {
    return {
      container: 'bg-sky-50 border-sky-200 dark:bg-sky-950/30 dark:border-sky-900/50',
      icon: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
      text: 'text-sky-900 dark:text-sky-100',
      button: 'bg-sky-600 hover:bg-sky-700 text-white',
    };
  }

  return {
    container: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/50',
    icon: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    text: 'text-emerald-900 dark:text-emerald-100',
    button: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  };
}

export default function WeatherAlert() {
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState(true);
  const [summary, setSummary] = useState<WeatherSummaryResponse | null>(null);
  const [departmentNotifications, setDepartmentNotifications] = useState<DepartmentNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendMessage, setSendMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const role = user?.role;
  const isAdminPortal = role === 'municipal' || role === 'admin';
  const isDepartmentPortal = role === 'department';

  const activeDepartmentNotification = useMemo(() => {
    return departmentNotifications.find((item) => !item.acknowledgedAt) || null;
  }, [departmentNotifications]);

  useEffect(() => {
    if (!role || (!isAdminPortal && !isDepartmentPortal)) {
      return;
    }

    let isMounted = true;

    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      setIsLoading(false);
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    const fetchData = async () => {
      try {
        setErrorMessage('');
        const summaryRes = await fetch(`${API_BASE_URL}/api/weather/summary`, { headers });
        const summaryJson = await summaryRes.json().catch(() => ({}));
        if (summaryRes.ok && isMounted) {
          setSummary(summaryJson as WeatherSummaryResponse);
        } else if (isMounted) {
          setSummary(null);
          setErrorMessage(String(summaryJson?.message || 'Unable to fetch live weather data.'));
        }

        if (isDepartmentPortal) {
          const notificationRes = await fetch(`${API_BASE_URL}/api/weather/department-notifications`, { headers });
          const notificationJson = await notificationRes.json().catch(() => ({}));
          if (notificationRes.ok && isMounted) {
            setDepartmentNotifications(Array.isArray(notificationJson.notifications) ? notificationJson.notifications : []);
          }
        }
      } catch (error) {
        console.error('Failed to fetch weather banner data:', error);
        if (isMounted) {
          setErrorMessage('Live weather service is currently unavailable.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void fetchData();
    const intervalId = setInterval(fetchData, 120000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [role, isAdminPortal, isDepartmentPortal]);

  useEffect(() => {
    if (activeDepartmentNotification || summary || errorMessage) {
      setIsVisible(true);
    }
  }, [activeDepartmentNotification, summary, errorMessage]);

  if (!role || (!isAdminPortal && !isDepartmentPortal)) return null;
  if (isLoading) return null;
  if (!isVisible) return null;

  const severity: RainfallSeverity =
    activeDepartmentNotification?.severity || summary?.weather?.severity || 'none';
  const styles = severityStyles(severity);

  const primaryText = activeDepartmentNotification
    ? `${activeDepartmentNotification.title} ${activeDepartmentNotification.message}`
    : summary
      ? `${summary.weather.city}: ${summary.weather.rainfall48hMm}mm rain expected in 48h. ${summary.weather.bannerText}`
      : errorMessage || null;

  if (!primaryText) {
    return null;
  }

  async function sendAlert() {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) return;

    setSending(true);
    setSendMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/weather/send-alert`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || 'Unable to send alert.');
      }

      setSendMessage('Alert sent to all departments. Teams can pre-deploy now.');
    } catch (error) {
      setSendMessage(error instanceof Error ? error.message : 'Unable to send alert.');
    } finally {
      setSending(false);
    }
  }

  async function acknowledgeDepartmentNotification() {
    if (!activeDepartmentNotification) return;
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/weather/department-notifications/${activeDepartmentNotification.id}/ack`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        return;
      }

      setDepartmentNotifications((prev) =>
        prev.map((item) =>
          item.id === activeDepartmentNotification.id
            ? { ...item, acknowledgedAt: new Date().toISOString() }
            : item
        )
      );
    } catch (error) {
      console.error('Failed to acknowledge department alert:', error);
    }
  }

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      className={`border-b ${styles.container}`}
    >
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-full ${styles.icon}`}>
              {activeDepartmentNotification ? <BellRing size={18} /> : <CloudRain size={18} />}
            </div>
            <p className={`text-sm font-semibold ${styles.text}`}>{primaryText}</p>
          </div>

          <div className="flex items-center gap-2">
            {isAdminPortal && summary?.canSendAlert && summary.weather.severity !== 'none' && (
              <button
                disabled={sending}
                onClick={sendAlert}
                className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold transition ${styles.button} disabled:opacity-70`}
              >
                <Send size={14} />
                {sending ? 'Sending...' : 'Send Alert'}
              </button>
            )}

            {isDepartmentPortal && activeDepartmentNotification && !activeDepartmentNotification.acknowledgedAt && (
              <button
                onClick={acknowledgeDepartmentNotification}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
              >
                <CheckCircle2 size={14} />
                Acknowledge
              </button>
            )}

            <button
              onClick={() => setIsVisible(false)}
              className={`text-xs font-bold opacity-80 hover:opacity-100 ${styles.text}`}
            >
              Dismiss
            </button>
          </div>
        </div>

        {sendMessage ? (
          <p className={`mt-2 text-xs font-medium ${styles.text}`}>{sendMessage}</p>
        ) : null}
      </div>
    </motion.div>
  );
}
