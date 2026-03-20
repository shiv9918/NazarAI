export const USER_ROLES = ['citizen', 'municipal', 'department', 'admin'] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type LoginPortalRole = 'citizen' | 'municipal' | 'department';

export interface UserRecord {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  department: string | null;
  points: number;
  avatar: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface PublicUser {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  points?: number;
  avatar: string;
}
