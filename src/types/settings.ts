export interface NotificationSettings {
  email: {
    workoutReminders: boolean;
    coachFeedback: boolean;
    programUpdates: boolean;
    marketing: boolean;
  };
  push: {
    workoutReminders: boolean;
    coachMessages: boolean;
    achievements: boolean;
  };
}

export interface PrivacySettings {
  showOnlineStatus: boolean;
  dataSharing: boolean;
}

export interface DisplaySettings {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  timezone: string;
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  units: 'metric' | 'imperial';
}

export interface UserSettings {
  id: string;
  user_id: string;
  notifications: NotificationSettings | null;
  privacy: PrivacySettings | null;
  display: DisplaySettings | null;
  created_at: string;
  updated_at: string;
}
