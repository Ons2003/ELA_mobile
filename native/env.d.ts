declare const process: {
  env: {
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
    EXPO_PUBLIC_ENABLE_USER_SETTINGS?: string;
    EXPO_PUBLIC_ADMIN_EMAIL?: string;
    [key: string]: string | undefined;
  };
};
