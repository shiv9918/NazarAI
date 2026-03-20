import { useState } from 'react';
import { LayoutDashboard, List, BarChart3, Menu, X } from 'lucide-react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import WeatherAlert from '../../components/WeatherAlert';
import { useAuth } from '../../context/AuthContext';

export default function DashboardLayout() {
  const location = useLocation();
  const { user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isDept = user?.role === 'department';
  const basePath = isDept ? '/dept-dashboard' : '/dashboard';

  const sidebarLinks = isDept 
    ? [{ name: 'Overview', path: basePath, icon: <LayoutDashboard size={20} /> }]
    : [
        { name: 'Overview', path: basePath, icon: <LayoutDashboard size={20} /> },
        { name: 'Issue Management', path: `${basePath}/issues`, icon: <List size={20} /> },
        { name: 'Performance & Analytics', path: `${basePath}/insights`, icon: <BarChart3 size={20} /> },
      ];

  const portalName = isDept ? 'Department Portal' : 'Admin Portal';

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden dark:bg-slate-950">
      {/* Sidebar for Desktop */}
      <aside className="w-64 border-r border-slate-200 bg-white hidden lg:flex flex-col dark:border-slate-800 dark:bg-slate-950">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-blue-600 font-bold text-xl dark:text-blue-400">
            <LayoutDashboard size={24} />
            {portalName}
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {sidebarLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                location.pathname === link.path 
                  ? 'bg-blue-50 text-blue-600 shadow-sm dark:bg-blue-900/20 dark:text-blue-400' 
                  : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-900'
              }`}
            >
              {link.icon}
              {link.name}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 text-slate-600 dark:text-slate-400"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {sidebarLinks.find(l => l.path === location.pathname)?.name || 'Dashboard'}
            </h2>
          </div>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="mb-6">
            <WeatherAlert />
          </div>
          <Outlet />
        </div>
      </main>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
          <aside className="fixed inset-y-0 left-0 w-64 bg-white shadow-xl dark:bg-slate-950">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-600 font-bold text-xl dark:text-blue-400">
                  <LayoutDashboard size={24} />
                  {portalName}
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)}>
                  <X size={24} className="text-slate-400" />
                </button>
              </div>
            </div>
            <nav className="p-4 space-y-2">
              {sidebarLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    location.pathname === link.path 
                      ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' 
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {link.icon}
                  {link.name}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </div>
  );
}
