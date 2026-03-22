const departmentByType: Record<string, string> = {
  garbage: 'sanitation',
  garbage_overflow: 'sanitation',
  illegal_dump: 'sanitation',
  dump: 'sanitation',
  pothole: 'roads',
  road: 'roads',
  broken_streetlight: 'electrical',
  streetlight: 'electrical',
  electrical: 'electrical',
  water: 'water',
  water_leakage: 'water',
  leakage: 'water',
};

export const validDepartments = new Set(['sanitation', 'roads', 'electrical', 'water', 'administration']);

export function normalizeDepartment(value?: string | null) {
  if (!value) return null;
  const normalized = value.toLowerCase().trim();
  if (normalized === 'road') return 'roads';
  if (normalized === 'electric') return 'electrical';
  if (normalized === 'admin') return 'administration';
  return normalized;
}

export function assignDepartment(issueType: string, requestedDepartment?: string | null) {
  const normalizedType = issueType.toLowerCase().trim().replace(/\s+/g, '_');
  if (departmentByType[normalizedType]) {
    return departmentByType[normalizedType];
  }

  if (normalizedType.includes('dump') || normalizedType.includes('garbage')) return 'sanitation';
  if (normalizedType.includes('pothole') || normalizedType.includes('road')) return 'roads';
  if (normalizedType.includes('light') || normalizedType.includes('electric')) return 'electrical';
  if (normalizedType.includes('water') || normalizedType.includes('leak')) return 'water';

  const fallback = normalizeDepartment(requestedDepartment) || '';
  if (validDepartments.has(fallback)) return fallback;

  return 'administration';
}
