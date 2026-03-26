const departmentByType: Record<string, string> = {
  // Pothole & Road Damage → PWD (Public Works Department)
  pothole: 'pwd',
  road: 'pwd',
  road_damage: 'pwd',
  road_crack: 'pwd',
  potholes: 'pwd',
  
  // Street Light & Wire → BSES / NDMC
  broken_streetlight: 'bses',
  streetlight: 'bses',
  street_light: 'bses',
  electrical: 'bses',
  light_not_working: 'bses',
  wire: 'bses',
  hanging_wire: 'bses',
  light_outage: 'bses',
  
  // Water Pipe & Sewage → DJB (Delhi Jal Board)
  water: 'djb',
  water_leakage: 'djb',
  water_leak: 'djb',
  leakage: 'djb',
  pipe_burst: 'djb',
  sewage: 'djb',
  sewage_leak: 'djb',
  waterlogging: 'djb',
  
  // Traffic Signal → Traffic Police
  traffic_signal: 'traffic_police',
  traffic: 'traffic_police',
  signal: 'traffic_police',
  
  // Tree → Forest Department
  tree: 'forest_dept',
  fallen_tree: 'forest_dept',
  tree_gira: 'forest_dept',
  
  // Fire → Delhi Fire Services
  fire: 'fire_services',
  aag: 'fire_services',
  accident: 'fire_services',
  
  // Sanitation (Garbage/Dump) → Keep as sanitation for now
  garbage: 'sanitation',
  garbage_overflow: 'sanitation',
  illegal_dump: 'sanitation',
  dump: 'sanitation',
};

export const validDepartments = new Set([
  'pwd',           // Public Works Department
  'bses',          // BSES/NDMC (Electrical)
  'djb',           // Delhi Jal Board (Water)
  'traffic_police', // Traffic Police
  'forest_dept',   // Forest Department
  'fire_services', // Delhi Fire Services
  'sanitation',    // Sanitation
  'administration' // Default fallback
]);

export const departmentLabels: Record<string, string> = {
  pwd: 'PWD (Public Works Dept)',
  bses: 'BSES / NDMC',
  djb: 'DJB (Delhi Jal Board)',
  traffic_police: 'Traffic Police',
  forest_dept: 'Forest Department',
  fire_services: 'Delhi Fire Services',
  sanitation: 'Sanitation Department',
  administration: 'Municipal Administration'
};

export function normalizeDepartment(value?: string | null) {
  if (!value) return null;
  const normalized = value.toLowerCase().trim();
  
  // Map various spellings to standard department codes
  if (normalized === 'road' || normalized === 'roads' || normalized === 'pwd') return 'pwd';
  if (normalized === 'electric' || normalized === 'electrical' || normalized === 'bses') return 'bses';
  if (normalized === 'water' || normalized === 'djb') return 'djb';
  if (normalized === 'traffic') return 'traffic_police';
  if (normalized === 'forest') return 'forest_dept';
  if (normalized === 'fire') return 'fire_services';
  if (normalized === 'admin') return 'administration';
  
  return normalized;
}

export function assignDepartment(issueType: string, requestedDepartment?: string | null) {
  const normalizedType = issueType.toLowerCase().trim().replace(/\s+/g, '_');
  
  // Direct lookup in mapping
  if (departmentByType[normalizedType]) {
    return departmentByType[normalizedType];
  }

  // Keyword-based fallback
  if (normalizedType.includes('pothole') || normalizedType.includes('road')) return 'pwd';
  if (normalizedType.includes('light') || normalizedType.includes('electric') || normalizedType.includes('wire')) return 'bses';
  if (normalizedType.includes('water') || normalizedType.includes('leak') || normalizedType.includes('pipe') || normalizedType.includes('sewage')) return 'djb';
  if (normalizedType.includes('traffic') || normalizedType.includes('signal')) return 'traffic_police';
  if (normalizedType.includes('tree')) return 'forest_dept';
  if (normalizedType.includes('fire') || normalizedType.includes('aag')) return 'fire_services';
  if (normalizedType.includes('garbage') || normalizedType.includes('dump')) return 'sanitation';

  // Use requested department if valid
  const fallback = normalizeDepartment(requestedDepartment) || '';
  if (validDepartments.has(fallback)) return fallback;

  return 'administration';
}
