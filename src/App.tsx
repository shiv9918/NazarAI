import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';

const Home = lazy(() => import('./pages/Home'));
const ReportIssue = lazy(() => import('./pages/ReportIssue'));
const TrackIssue = lazy(() => import('./pages/TrackIssue'));
const About = lazy(() => import('./pages/About'));
const DashboardLayout = lazy(() => import('./pages/dashboard/DashboardLayout'));
const DashboardHome = lazy(() => import('./pages/dashboard/DashboardHome'));
const IssueManagement = lazy(() => import('./pages/dashboard/IssueManagement'));
const Login = lazy(() => import('./pages/Login'));
const CitizenDashboard = lazy(() => import('./pages/CitizenDashboard'));
const CitizenDashboardLayout = lazy(() => import('./pages/CitizenDashboardLayout'));
const LeaderBoard = lazy(() => import('./pages/LeaderBoard'));
const Settings = lazy(() => import('./pages/Settings'));
const Insights = lazy(() => import('./pages/dashboard/Insights'));
const DepartmentDashboardHome = lazy(() => import('./pages/dashboard/DepartmentDashboardHome'));
const DepartmentIssueManagement = lazy(() => import('./pages/dashboard/DepartmentIssueManagement'));

import OfflineBanner from './components/OfflineBanner';

export default function App() {
  const host = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  const isPortalSubdomain = host.startsWith('admin.') || host.startsWith('dept.');

  return (
    <ThemeProvider>
          <Router>
            <AuthProvider>
              <LanguageProvider>
                <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-50">
                  <Navbar />
                  <main className="flex-1">
                    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">Loading...</div>}>
                      <Routes>
                        <Route path="/" element={isPortalSubdomain ? <Login /> : <Home />} />
                        <Route path="/login" element={<Login />} />
                        
                        {/* Citizen Portal Routes with Sidebar */}
                        <Route
                          element={(
                            <ProtectedRoute allowedRoles={['citizen']}>
                              <CitizenDashboardLayout />
                            </ProtectedRoute>
                          )}
                        >
                          <Route path="/citizen-dashboard" element={<CitizenDashboard />} />
                          <Route path="/report" element={<ReportIssue />} />
                          <Route path="/track" element={<TrackIssue />} />
                          <Route path="/leaderboard" element={<LeaderBoard />} />
                        </Route>

                        <Route path="/about" element={<About />} />
                        <Route
                          path="/settings"
                          element={(
                            <ProtectedRoute allowedRoles={['citizen', 'municipal', 'department', 'admin']}>
                              <Settings />
                            </ProtectedRoute>
                          )}
                        />
                        <Route
                          path="/dashboard"
                          element={(
                            <ProtectedRoute allowedRoles={['municipal', 'admin']}>
                              <DashboardLayout />
                            </ProtectedRoute>
                          )}
                        >
                          <Route index element={<DashboardHome />} />
                          <Route path="issues" element={<IssueManagement />} />
                          <Route path="insights" element={<Insights />} />
                        </Route>

                        <Route
                          path="/dept-dashboard"
                          element={(
                            <ProtectedRoute allowedRoles={['department']}>
                              <DashboardLayout />
                            </ProtectedRoute>
                          )}
                        >
                          <Route index element={<DepartmentDashboardHome />} />
                          <Route path="issues" element={<DepartmentIssueManagement />} />
                          <Route path="insights" element={<Insights />} />
                        </Route>
                      </Routes>
                    </Suspense>
                  </main>
                  <Footer />
                  <OfflineBanner />
                </div>
              </LanguageProvider>
            </AuthProvider>
          </Router>
    </ThemeProvider>
  );
}
