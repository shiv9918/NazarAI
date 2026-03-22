import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Bell, Shield, Globe, Moon, Save, Camera, Mail, Phone, MapPin, Navigation, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getAddressFromCoords, getCurrentPosition } from '../utils/location';
import { useTranslation } from 'react-i18next';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const AUTH_TOKEN_KEY = 'nazarai_auth_token';

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { user, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [notifications, setNotifications] = useState({
    issueUpdates: user?.notifyIssueUpdates ?? true,
    newRewards: user?.notifyNewRewards ?? true,
    cityAlerts: user?.notifyCityAlerts ?? true,
  });
  const [securityForm, setSecurityForm] = useState({
    currentPassword: '',
    newPassword: '',
  });
  const [preferences, setPreferences] = useState({
    theme: (user?.preferredTheme || theme) as 'light' | 'dark',
    language: (user?.preferredLanguage || (i18n.language === 'hi' ? 'hi' : 'en')) as 'en' | 'hi',
  });
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    location: user?.location || '',
    bio: user?.bio || '',
    department: user?.department || '',
  });

  React.useEffect(() => {
    if (!user) return;
    setFormData({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      location: user.location || '',
      bio: user.bio || '',
      department: user.department || '',
    });

    setNotifications({
      issueUpdates: user.notifyIssueUpdates ?? true,
      newRewards: user.notifyNewRewards ?? true,
      cityAlerts: user.notifyCityAlerts ?? true,
    });

    const incomingTheme = (user.preferredTheme || theme) as 'light' | 'dark';
    const incomingLanguage = (user.preferredLanguage || (i18n.language === 'hi' ? 'hi' : 'en')) as 'en' | 'hi';
    setPreferences({
      theme: incomingTheme,
      language: incomingLanguage,
    });

    setTheme(incomingTheme);
    i18n.changeLanguage(incomingLanguage);
  }, [user]);

  const detectLocation = async () => {
    setIsDetecting(true);
    try {
      const pos = await getCurrentPosition();
      const address = await getAddressFromCoords(pos.coords.latitude, pos.coords.longitude);
      setFormData(prev => ({ ...prev, location: address }));
    } catch (error) {
      console.error("Error detecting location:", error);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleSave = async () => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      setSaveMessage('Session expired. Please login again.');
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const payload: Record<string, string | null> = {
        fullName: formData.name,
        email: formData.email,
      };

      if (user?.role === 'citizen') {
        payload.phone = formData.phone || null;
        payload.location = formData.location || null;
        payload.bio = formData.bio || null;
        payload.notifyIssueUpdates = notifications.issueUpdates;
        payload.notifyNewRewards = notifications.newRewards;
        payload.notifyCityAlerts = notifications.cityAlerts;
        payload.preferredTheme = preferences.theme;
        payload.preferredLanguage = preferences.language;

        if (securityForm.newPassword) {
          payload.currentPassword = securityForm.currentPassword;
          payload.newPassword = securityForm.newPassword;
        }
      }

      if (user?.role === 'department' || user?.role === 'admin') {
        payload.department = formData.department || null;
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || 'Failed to save profile changes.');
      }

      await refreshUser();
      if (user?.role === 'citizen') {
        setTheme(preferences.theme);
        i18n.changeLanguage(preferences.language);
        setSecurityForm({ currentPassword: '', newPassword: '' });
      }
      setSaveMessage('Profile updated successfully.');
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : 'Failed to save profile changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    { id: 'profile', name: t('settings_page.tabs.profile'), icon: <User size={20} /> },
    { id: 'notifications', name: t('settings_page.tabs.notifications'), icon: <Bell size={20} /> },
    { id: 'security', name: t('settings_page.tabs.security'), icon: <Shield size={20} /> },
    { id: 'preferences', name: t('settings_page.tabs.preferences'), icon: <Globe size={20} /> },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 dark:bg-slate-950">
      <div className="mb-10">
        <h1 className="text-4xl font-black text-slate-900 tracking-tight dark:text-white">{t('settings_page.title')}</h1>
        <p className="text-slate-500 mt-2 dark:text-slate-400">{t('settings_page.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Tabs */}
        <div className="lg:col-span-1 space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex w-full items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-100 dark:shadow-blue-900/20'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900'
              }`}
            >
              {tab.icon}
              {tab.name}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden dark:bg-slate-900 dark:border-slate-800"
          >
            {activeTab === 'profile' && (
              <div className="p-8 md:p-12">
                <div className="flex flex-col md:flex-row gap-10 items-start">
                  {/* Avatar Section */}
                  <div className="relative group">
                    <div className="h-32 w-32 rounded-[2rem] overflow-hidden ring-4 ring-slate-50 shadow-lg dark:ring-slate-800">
                      <img src={user?.avatar} alt="Profile" className="h-full w-full object-cover" />
                    </div>
                    <button className="absolute -bottom-2 -right-2 bg-blue-600 text-white p-2.5 rounded-xl shadow-lg hover:bg-blue-700 transition-all">
                      <Camera size={18} />
                    </button>
                  </div>

                  {/* Form Section */}
                  <div className="flex-1 w-full space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1 dark:text-slate-500">{t('settings_page.profile.fullName')}</label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full rounded-2xl border-none bg-slate-50 py-4 px-5 text-slate-900 ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 transition-all outline-none dark:bg-slate-950 dark:text-white dark:ring-slate-800"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1 dark:text-slate-500">{t('settings_page.profile.email')}</label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full rounded-2xl border-none bg-slate-50 py-4 px-5 text-slate-900 ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 transition-all outline-none dark:bg-slate-950 dark:text-white dark:ring-slate-800"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1 dark:text-slate-500">Role</label>
                        <input
                          type="text"
                          value={user?.role || 'citizen'}
                          disabled
                          className="w-full rounded-2xl border-none bg-slate-100 py-4 px-5 text-slate-500 ring-1 ring-slate-200 outline-none capitalize dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-800"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1 dark:text-slate-500">Department</label>
                        <input
                          type="text"
                          value={formData.department || 'Not assigned'}
                          disabled
                          className="w-full rounded-2xl border-none bg-slate-100 py-4 px-5 text-slate-500 ring-1 ring-slate-200 outline-none dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-800"
                        />
                      </div>

                      {user?.role === 'citizen' && (
                        <>
                          <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1 dark:text-slate-500">{t('settings_page.profile.phone')}</label>
                            <div className="relative">
                              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                              <input
                                type="tel"
                                placeholder="+91 98765 43210"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full rounded-2xl border-none bg-slate-50 py-4 pl-12 pr-5 text-slate-900 ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 transition-all outline-none dark:bg-slate-950 dark:text-white dark:ring-slate-800"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1 dark:text-slate-500">{t('settings_page.profile.location')}</label>
                            <div className="relative">
                              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                              <input
                                type="text"
                                placeholder="New Delhi, India"
                                value={formData.location}
                                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                className="w-full rounded-2xl border-none bg-slate-50 py-4 pl-12 pr-12 text-slate-900 ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 transition-all outline-none dark:bg-slate-950 dark:text-white dark:ring-slate-800"
                              />
                              <button
                                type="button"
                                onClick={detectLocation}
                                disabled={isDetecting}
                                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-blue-600 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                                title="Detect current location"
                              >
                                <Navigation className={`h-5 w-5 ${isDetecting ? 'animate-pulse' : ''}`} />
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {user?.role === 'citizen' && (
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1 dark:text-slate-500">{t('settings_page.profile.bio')}</label>
                        <textarea
                          rows={4}
                          placeholder={t('settings_page.profile.bioPlaceholder')}
                          value={formData.bio}
                          onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                          className="w-full rounded-2xl border-none bg-slate-50 py-4 px-5 text-slate-900 ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 transition-all outline-none resize-none dark:bg-slate-950 dark:text-white dark:ring-slate-800 dark:placeholder-slate-500"
                        ></textarea>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="p-8 md:p-12 space-y-8">
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('settings_page.notifications.emailTitle')}</h3>
                  <div className="space-y-4">
                    {[
                      {
                        key: 'issueUpdates',
                        title: t('settings_page.notifications.issueUpdates'),
                        desc: t('settings_page.notifications.issueUpdatesDesc')
                      },
                      {
                        key: 'newRewards',
                        title: t('settings_page.notifications.newRewards'),
                        desc: t('settings_page.notifications.newRewardsDesc')
                      },
                      {
                        key: 'cityAlerts',
                        title: t('settings_page.notifications.cityAlerts'),
                        desc: t('settings_page.notifications.cityAlertsDesc')
                      }
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 dark:border dark:border-slate-800">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{item.title}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{item.desc}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={notifications[item.key as keyof typeof notifications]}
                            onChange={(e) => {
                              setNotifications((prev) => ({
                                ...prev,
                                [item.key]: e.target.checked,
                              }));
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 dark:bg-slate-800"></div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="p-8 md:p-12 space-y-8">
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('settings_page.security.changePassword')}</h3>
                  <div className="space-y-4 max-w-md">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1 dark:text-slate-500">{t('settings_page.security.currentPassword')}</label>
                      <input
                        type="password"
                        value={securityForm.currentPassword}
                        onChange={(e) => setSecurityForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                        className="w-full rounded-2xl border-none bg-slate-50 py-4 px-5 text-slate-900 ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 transition-all outline-none dark:bg-slate-950 dark:text-white dark:ring-slate-800"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1 dark:text-slate-500">{t('settings_page.security.newPassword')}</label>
                      <input
                        type="password"
                        value={securityForm.newPassword}
                        onChange={(e) => setSecurityForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                        className="w-full rounded-2xl border-none bg-slate-50 py-4 px-5 text-slate-900 ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 transition-all outline-none dark:bg-slate-950 dark:text-white dark:ring-slate-800"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'preferences' && (
              <div className="p-8 md:p-12 space-y-8">
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('settings_page.preferences.appPreferences')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100 dark:bg-slate-950 dark:border-slate-800">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-xl dark:bg-blue-900/20 dark:text-blue-400">
                          {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
                        </div>
                        <span className="font-bold dark:text-white">{t('settings_page.preferences.appearance')}</span>
                      </div>
                      <select 
                        value={preferences.theme}
                        onChange={(e) => {
                          const newTheme = e.target.value as 'light' | 'dark';
                          setPreferences((prev) => ({ ...prev, theme: newTheme }));
                          setTheme(newTheme);
                        }}
                        className="w-full rounded-xl border-none bg-white py-3 px-4 text-slate-900 ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-900 dark:text-white dark:ring-slate-800"
                      >
                        <option value="light">{t('settings_page.preferences.lightMode')}</option>
                        <option value="dark">{t('settings_page.preferences.darkMode')}</option>
                      </select>
                    </div>
                    <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100 dark:bg-slate-950 dark:border-slate-800">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl dark:bg-emerald-900/20 dark:text-emerald-400">
                          <Globe size={20} />
                        </div>
                        <span className="font-bold dark:text-white">{t('settings_page.preferences.language')}</span>
                      </div>
                      <select 
                        value={preferences.language}
                        onChange={(e) => {
                          const newLanguage = e.target.value as 'en' | 'hi';
                          setPreferences((prev) => ({ ...prev, language: newLanguage }));
                          i18n.changeLanguage(newLanguage);
                        }}
                        className="w-full rounded-xl border-none bg-white py-3 px-4 text-slate-900 ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-900 dark:text-white dark:ring-slate-800"
                      >
                        <option value="en">English</option>
                        <option value="hi">Hindi (हिन्दी)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Footer Actions */}
            <div className="bg-slate-50 p-6 flex justify-end border-t border-slate-100 dark:bg-slate-900 dark:border-slate-800">
              {saveMessage && (
                <div className={`mr-auto self-center text-sm font-semibold ${saveMessage.toLowerCase().includes('success') ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {saveMessage}
                </div>
              )}
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all disabled:opacity-70 dark:shadow-blue-900/20"
              >
                {isSaving ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Save size={20} />
                    {t('settings_page.saveChanges')}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
