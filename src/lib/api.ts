import { supabase } from './supabase';

const resolvedSupabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
const resolvedAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!resolvedSupabaseUrl || !resolvedAnonKey) {
  throw new Error('Missing Supabase environment variables for API client.');
}

const API_BASE_URL = `${resolvedSupabaseUrl}/functions/v1`;

type AuthHeaderOptions = {
  requireSession?: boolean;
};

const getAuthHeaders = async (options?: AuthHeaderOptions) => {
  const requireSession = options?.requireSession ?? true;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    if (requireSession) {
      throw new Error('Authentication required for this request.');
    }

    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resolvedAnonKey}`,
      apikey: resolvedAnonKey,
    };
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    apikey: resolvedAnonKey,
  };
};

// Auth API
export const authAPI = {
  signup: async (userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    experienceLevel: string;
  }) => {
    const response = await fetch(`${API_BASE_URL}/auth`, {
      method: 'POST',
      headers: await getAuthHeaders({ requireSession: false }),
      body: JSON.stringify({
        action: 'signup',
        email: userData.email,
        password: userData.password,
        userData,
      }),
    });
    return response.json();
  },

  login: async (credentials: { email: string; password: string }) => {
    const response = await fetch(`${API_BASE_URL}/auth`, {
      method: 'POST',
      headers: await getAuthHeaders({ requireSession: false }),
      body: JSON.stringify({
        action: 'signin',
        email: credentials.email,
        password: credentials.password,
      }),
    });
    return response.json();
  },

  resetPassword: async (email: string) => {
    const response = await fetch(`${API_BASE_URL}/auth`, {
      method: 'POST',
      headers: await getAuthHeaders({ requireSession: false }),
      body: JSON.stringify({
        action: 'reset-password',
        email,
      }),
    });
    return response.json();
  },
};

// Programs API
export const programsAPI = {
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/programs`, {
      headers: await getAuthHeaders({ requireSession: false }),
    });
    return response.json();
  },

  getById: async (id: string) => {
    const response = await fetch(`${API_BASE_URL}/programs/${id}`, {
      headers: await getAuthHeaders({ requireSession: false }),
    });
    return response.json();
  },

  create: async (programData: any) => {
    const response = await fetch(`${API_BASE_URL}/programs`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(programData),
    });
    return response.json();
  },

  update: async (id: string, programData: any) => {
    const response = await fetch(`${API_BASE_URL}/programs/${id}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(programData),
    });
    return response.json();
  },
};

// Enrollments API
export const enrollmentsAPI = {
  create: async (programId: string, userData: any) => {
    const response = await fetch(`${API_BASE_URL}/enrollments`, {
      method: 'POST',
      headers: await getAuthHeaders({ requireSession: false }),
      body: JSON.stringify({
        program_id: programId,
        user_data: userData,
      }),
    });
    return response.json();
  },

  getUserEnrollments: async () => {
    const response = await fetch(`${API_BASE_URL}/enrollments`, {
      headers: await getAuthHeaders(),
    });
    return response.json();
  },

  updateStatus: async (id: string, status: string) => {
    const response = await fetch(`${API_BASE_URL}/enrollments/${id}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ status }),
    });
    return response.json();
  },
};

// Assessments API
export const assessmentsAPI = {
  create: async (assessmentData: any) => {
    const response = await fetch(`${API_BASE_URL}/assessments`, {
      method: 'POST',
      headers: await getAuthHeaders({ requireSession: false }),
      body: JSON.stringify(assessmentData),
    });
    return response.json();
  },

  getUserAssessments: async () => {
    const response = await fetch(`${API_BASE_URL}/assessments`, {
      headers: await getAuthHeaders(),
    });
    return response.json();
  },
};

// Workouts API
export const workoutsAPI = {
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/workouts`, {
      headers: await getAuthHeaders(),
    });
    return response.json();
  },

  getById: async (id: string) => {
    const response = await fetch(`${API_BASE_URL}/workouts/${id}`, {
      headers: await getAuthHeaders(),
    });
    return response.json();
  },

  create: async (workoutData: any) => {
    const response = await fetch(`${API_BASE_URL}/workouts`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(workoutData),
    });
    return response.json();
  },

  update: async (id: string, workoutData: any) => {
    const response = await fetch(`${API_BASE_URL}/workouts/${id}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(workoutData),
    });
    return response.json();
  },

  delete: async (id: string) => {
    const response = await fetch(`${API_BASE_URL}/workouts/${id}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    });
    return response.json();
  },
};

// Notifications API
export const notificationsAPI = {
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/notifications`, {
      headers: await getAuthHeaders(),
    });
    return response.json();
  },

  markAsRead: async (id: string) => {
    const response = await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
    });
    return response.json();
  },

  markAllAsRead: async () => {
    const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
    });
    return response.json();
  },
};

// Admin API
export const adminAPI = {
  getDashboard: async () => {
    const response = await fetch(`${API_BASE_URL}/admin/dashboard`, {
      headers: await getAuthHeaders(),
    });
    return response.json();
  },

  getUsers: async () => {
    const response = await fetch(`${API_BASE_URL}/admin/users`, {
      headers: await getAuthHeaders(),
    });
    return response.json();
  },

  getEnrollments: async () => {
    const response = await fetch(`${API_BASE_URL}/admin/enrollments`, {
      headers: await getAuthHeaders(),
    });
    return response.json();
  },

  getPrograms: async () => {
    const response = await fetch(`${API_BASE_URL}/admin/programs`, {
      headers: await getAuthHeaders(),
    });
    return response.json();
  },

  createProgram: async (programData: any) => {
    const response = await fetch(`${API_BASE_URL}/admin/programs`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(programData),
    });
    return response.json();
  },

  updateProgram: async (id: string, programData: any) => {
    const response = await fetch(`${API_BASE_URL}/admin/programs/${id}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(programData),
    });
    return response.json();
  },

  deleteProgram: async (id: string) => {
    const response = await fetch(`${API_BASE_URL}/admin/programs/${id}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    });
    return response.json();
  },

  getCheckIns: async () => {
    const response = await fetch(`${API_BASE_URL}/admin/checkins`, {
      headers: await getAuthHeaders(),
    });
    return response.json();
  },

  updateEnrollmentStatus: async (id: string, status: string) => {
    const response = await fetch(`${API_BASE_URL}/admin/enrollments/${id}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ status }),
    });
    return response.json();
  },

  deleteUser: async (id: string) => {
    const response = await fetch(`${API_BASE_URL}/admin/users/${id}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    });
    return response.json();
  },

  sendAccountAccessEmail: async (id: string, payload?: { subject?: string; html?: string }) => {
    const response = await fetch(`${API_BASE_URL}/admin/users/${id}/invite`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload ?? {}),
    });
    return response.json();
  },

  updateCheckIn: async (id: string, payload: { status: string; coach_notes?: string }) => {
    const response = await fetch(`${API_BASE_URL}/admin/checkins/${id}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return response.json();
  },

  sendBroadcast: async (title: string, message: string, type: string, userIds?: string[]) => {
    const response = await fetch(`${API_BASE_URL}/admin/broadcast`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        title,
        message,
        type,
        user_ids: userIds,
      }),
    });
    return response.json();
  },

  createCoach: async (payload: {
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
  }) => {
    const response = await fetch(`${API_BASE_URL}/admin/coaches`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return response.json();
  },

  assignCoachUsers: async (coachId: string, userIds: string[]) => {
    const response = await fetch(`${API_BASE_URL}/admin/coaches/${coachId}/users`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ user_ids: userIds }),
    });
    return response.json();
  },
};
