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
  phone: string | null;
  location: string | null;
  bio: string | null;
  notify_issue_updates: boolean;
  notify_new_rewards: boolean;
  notify_city_alerts: boolean;
  preferred_theme: string | null;
  preferred_language: string | null;
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
  phone?: string;
  location?: string;
  bio?: string;
  notifyIssueUpdates?: boolean;
  notifyNewRewards?: boolean;
  notifyCityAlerts?: boolean;
  preferredTheme?: string;
  preferredLanguage?: string;
}
