import { motion } from 'framer-motion';
import { ArrowRight, Camera, Search, CheckCircle, TrendingUp, Shield, Zap, AlertTriangle, MapPin, Smartphone, User, Send } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalToday: 247,
    resolvedToday: 124,
    avgTime: "2.3 days",
    emergencyIssues: 12
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        moneySaved: prev.moneySaved + Math.floor(Math.random() * 100)
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-slate-50 text-slate-900">
      {/* Top service strip */}
      <div className="bg-blue-600 text-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-2 text-xs sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <span className="font-semibold">Emergency: <span className="font-normal">911</span></span>
            <span>|</span>
            <span>Citizens Helpline: <span className="font-semibold">1800-123-456</span></span>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <span>24x7 Support</span>
            <span>|</span>
            <span>Fast, secure & transparent processing</span>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 py-16 sm:py-24">
        <div className="absolute inset-0 opacity-10">
          <img src="https://images.unsplash.com/photo-1497076086858-3f934a09acd7?auto=format&fit=crop&w=1400&q=80" alt="city background" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-800/70 to-indigo-700/60"></div>
        </div>

        <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-8 px-4 sm:px-6 lg:px-8 xl:flex-row xl:items-center">
          <div className="w-full xl:w-2/3">
            <p className="mb-3 inline-flex rounded-full bg-white/20 px-4 py-1 text-sm font-medium text-white">Empowering city </p>
            <h1 className="text-4xl font-extrabold leading-tight text-white sm:text-5xl md:text-6xl">
              AI-Powered Civic Monitoring for Delhi
            </h1>
            <p className="mt-6 max-w-2xl text-base text-white/90 sm:text-lg">
              Report issues in seconds. AI detects. Government resolves..
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                onClick={() => navigate(isAuthenticated ? '/report' : '/login')}
                className="rounded-full bg-white px-6 py-3 text-base font-semibold text-blue-700 transition duration-200 hover:scale-105 hover:bg-blue-50"
              >
                Report Issue
              </button>
              <button
                onClick={() => navigate(isAuthenticated ? '/track' : '/login')}
                className="rounded-full border border-white/80 px-6 py-3 text-base font-semibold text-white transition duration-200 hover:bg-white/20"
              >
                Track Application
              </button>
            </div>
          </div>

          <div className="w-full xl:w-1/3">
            <div className="rounded-3xl border border-white/30 bg-white/90 p-6 shadow-xl backdrop-blur-2xl">
              <h3 className="text-lg font-bold text-slate-800">Issue Success</h3>
              <p className="mt-2 text-sm text-slate-500">Thousands of Issues solved in the past in estimated time.</p>

              <div className="mt-5 grid grid-cols-2 gap-3 text-center">
                <div className="rounded-xl bg-blue-100 p-3 text-slate-900">
                  <p className="text-2xl font-bold">15k+</p>
                  <p className="text-xs font-medium">Issue Solved</p>
                </div>
                <div className="rounded-xl bg-emerald-100 p-3 text-slate-900">
                  <p className="text-2xl font-bold">98%</p>
                  <p className="text-xs font-medium">Success Rate</p>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-blue-500 p-3 text-sm text-white">
                <p className="font-semibold">Status: Live</p>
                <p className="text-xs">Make your city smart with AI.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Services Section */}
      <section className="bg-white py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">Government Officials</h2>
              <p className="mt-2 text-sm text-slate-500">Meet your city leaders and service coordinators.</p>
              <div className="mt-4 space-y-3">
                {[
                  { name: 'Hon. Bansi Joshi', title: 'City Municipal Commissioner', phone: '9876543210' },
                  { name: 'Dr. Meera Sharma', title: 'Chief Officer, Public Works', phone: '9887766550' },
                  { name: 'Eliza Rodriguez', title: 'Citizen Relation Head', phone: '9812345670' }
                ].map((person, i) => (
                  <div key={i} className="rounded-xl border border-slate-100 p-3">
                    <div className="text-sm font-semibold text-slate-900">{person.name}</div>
                    <div className="text-xs text-slate-500">{person.title}</div>
                    <div className="mt-1 text-xs text-slate-400">{person.phone}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">Public Services</h2>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-600">Explore more</span>
              </div>
              <div className="relative mt-4">
                <input
                  type="text"
                  placeholder="Search services like 'Water', 'Road', 'Traffic'..."
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-10 text-sm text-slate-700 outline-none focus:border-blue-500"
                />
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {['Water Leakage', 'Road Repair', 'Street Light', 'Sanitation', 'Pothole Fix', ].map((item, i) => (
                  <button key={i} className="rounded-xl border border-slate-200 bg-white p-3 text-left text-sm font-medium text-slate-700 transition hover:bg-blue-50">
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">Updates</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="font-semibold">Annual Property Tax Deadline Extended</div>
                  <div className="text-xs text-slate-500">3 min ago</div>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="font-semibold">New Digital ID Verification Center Opened</div>
                  <div className="text-xs text-slate-500">10 min ago</div>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="font-semibold">Road Maintenance Project Update</div>
                  <div className="text-xs text-slate-500">30 min ago</div>
                </div>
              </div>
              <div className="mt-6 rounded-xl bg-blue-500 p-4 text-white">
                <h3 className="font-bold">Citizen Assistance</h3>
                <p className="mt-1 text-sm">Need help? Call 911 or 1800-123-456</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Additional features section (kept from existing structure as optional) */}
      <section className="bg-slate-100 py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3 text-blue-600">
                <CheckCircle size={20} />
                <div>
                  <h4 className="font-bold text-slate-900">Transparency</h4>
                  <p className="text-sm text-slate-500">Track the entire lifecycle of your requests.</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3 text-emerald-600">
                <Shield size={20} />
                <div>
                  <h4 className="font-bold text-slate-900">Secure</h4>
                  <p className="text-sm text-slate-500">Your personal data is protected end-to-end.</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3 text-amber-500">
                <Zap size={20} />
                <div>
                  <h4 className="font-bold text-slate-900">Fast Processing</h4>
                  <p className="text-sm text-slate-500">Get your issues resolved quickly.</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3 text-indigo-600">
                <TrendingUp size={20} />
                <div>
                  <h4 className="font-bold text-slate-900">Continuous Improvement</h4>
                  <p className="text-sm text-slate-500">Data-driven decisions ensure better services.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
