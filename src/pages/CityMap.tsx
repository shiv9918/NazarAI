import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useState, useEffect } from 'react';
import L from 'leaflet';
import { Filter, Info, AlertCircle, CheckCircle2, Clock, Zap, MapPin } from 'lucide-react';
import { getCurrentPosition } from '../utils/location';
import { db } from '../firebase';
import { collection, query, onSnapshot, where } from 'firebase/firestore';

// Custom Marker Creators
const createCustomIcon = (severity: number) => {
  const color = severity >= 8 ? '#ef4444' : severity >= 5 ? '#f59e0b' : '#2563eb';
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; color: white;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="m2 2 7.5 1.5"/><path d="m14 11 4 4"/></svg>
          </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
};

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
}

export default function CityMap() {
  const [reports, setReports] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [mapCenter, setMapCenter] = useState<[number, number]>([28.6139, 77.2090]);

  useEffect(() => {
    let q = query(collection(db, 'reports'));
    
    if (filter !== 'all') {
      q = query(collection(db, 'reports'), where('type', '==', filter));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reportsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setReports(reportsData);
    }, (error) => {
      console.error("Error fetching reports for map:", error);
    });
    
    return () => unsubscribe();
  }, [filter]);

  useEffect(() => {
    const getCenter = async () => {
      try {
        const pos = await getCurrentPosition();
        setMapCenter([pos.coords.latitude, pos.coords.longitude]);
      } catch (error) {
        console.error("Error getting location for map center:", error);
      }
    };
    getCenter();
  }, []);

  const delhiCenter = mapCenter;

  return (
    <div className="relative h-[calc(100vh-64px)] w-full overflow-hidden dark:bg-slate-950">
      {/* Sidebar Filter */}
      <div className="absolute left-6 top-6 z-[1000] w-72 rounded-3xl bg-white/90 p-6 shadow-2xl backdrop-blur-md border border-slate-200 dark:bg-slate-900/90 dark:border-slate-800">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 dark:text-white">
            <Filter size={20} className="text-blue-600 dark:text-blue-400" />
            Filters
          </h2>
          <div className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full dark:bg-blue-900/20 dark:text-blue-400">
            {reports.length} Active
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider dark:text-slate-500">Issue Type</label>
            <select 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            >
              <option value="all">All Issues</option>
              <option value="pothole">Potholes</option>
              <option value="garbage_overflow">Garbage Overflow</option>
              <option value="broken_streetlight">Streetlights</option>
              <option value="water_leakage">Water Leakage</option>
            </select>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider dark:text-slate-500">Severity Legend</label>
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <div className="h-3 w-3 rounded-full bg-rose-500"></div>
                <span className="text-slate-600 dark:text-slate-400">Critical (8-10)</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="h-3 w-3 rounded-full bg-amber-500"></div>
                <span className="text-slate-600 dark:text-slate-400">High (6-7)</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                <span className="text-slate-600 dark:text-slate-400">Medium (4-5)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <MapContainer center={delhiCenter} zoom={12} className="h-full w-full z-0">
        <MapUpdater center={delhiCenter} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {reports.map((report) => (
          <Marker 
            key={report.id} 
            position={[report.lat, report.lng]}
            icon={createCustomIcon(report.severity)}
          >
            <Popup className="custom-popup">
              <div className="w-56 p-1 dark:text-white">
                <div className="flex items-center justify-between mb-3">
                  <div className={`flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    report.severity >= 8 ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                  }`}>
                    {report.severity >= 8 ? <AlertCircle size={10} /> : <Zap size={10} />}
                    Severity {report.severity}
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold dark:text-slate-500">{report.id}</span>
                </div>
                
                <h3 className="font-bold text-slate-900 capitalize text-sm dark:text-white">{report.type.replace('_', ' ')}</h3>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 dark:text-slate-400">
                  <MapPin size={10} />
                  {report.location}
                </p>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1 uppercase dark:text-slate-500">
                    <span>Progress</span>
                    <span>{report.status === 'resolved' ? '100%' : report.status === 'in_progress' ? '65%' : '10%'}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden dark:bg-slate-800">
                    <div 
                      className={`h-full rounded-full ${
                        report.status === 'resolved' ? 'bg-emerald-500' :
                        report.status === 'in_progress' ? 'bg-blue-500' :
                        'bg-slate-300 dark:bg-slate-700'
                      }`}
                      style={{ width: report.status === 'resolved' ? '100%' : report.status === 'in_progress' ? '65%' : '10%' }}
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-slate-900 capitalize dark:text-white">
                    {report.status === 'resolved' ? <CheckCircle2 size={10} className="text-emerald-500" /> : <Clock size={10} className="text-blue-500" />}
                    {report.status.replace('_', ' ')}
                  </div>
                </div>

                <button className="mt-3 w-full rounded-lg bg-slate-900 py-2 text-[10px] font-bold text-white hover:bg-slate-800 transition-colors dark:bg-blue-600 dark:hover:bg-blue-700">
                  View Full Details
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
        
        {/* Heatmap circles for critical areas */}
        <Circle center={[28.6328, 77.2197]} radius={500} pathOptions={{ color: 'red', fillOpacity: 0.2 }} />
      </MapContainer>

      {/* Bottom Info Bar */}
      <div className="absolute bottom-6 right-6 z-[1000] flex items-center gap-4">
        <div className="rounded-2xl bg-white/90 px-4 py-2 shadow-xl backdrop-blur-md border border-slate-200 text-xs font-bold text-slate-600 flex items-center gap-2 dark:bg-slate-900/90 dark:border-slate-800 dark:text-slate-400">
          <Info size={14} className="text-blue-600 dark:text-blue-400" />
          Live updates every 30s
        </div>
      </div>
    </div>
  );
}
