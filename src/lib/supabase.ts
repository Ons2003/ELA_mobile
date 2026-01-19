import { createClient } from '@supabase/supabase-js'
import type { PostgrestError } from '@supabase/supabase-js'
import type { DisplaySettings, NotificationSettings, PrivacySettings, UserSettings } from '../types/settings'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const enableUserSettingsEnv = import.meta.env.VITE_ENABLE_USER_SETTINGS
const userSettingsFeatureEnabled =
  enableUserSettingsEnv === undefined || enableUserSettingsEnv === null
    ? true
    : enableUserSettingsEnv === 'true'

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

const WORKOUT_CHECKIN_BUCKET = 'workout-checkins'
const resolveAccessToken = async (): Promise<string | null> => {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession()

    if (error) {
      console.error('Error fetching current session:', error)
    }

    if (session?.access_token) {
      return session.access_token
    }

    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()

    if (refreshError) {
      console.error('Error refreshing session for workouts function:', refreshError)
      return null
    }

    return refreshed.session?.access_token ?? null
  } catch (tokenError) {
    console.error('Unexpected error resolving access token:', tokenError)
    return null
  }
}

const invokeWorkoutsFunction = async <T>(
  action: 'create' | 'update' | 'delete' | 'detail' | 'checkins' | 'update_checkin_status',
  payload: Record<string, any>,
): Promise<T | null> => {
  try {
    const accessToken = await resolveAccessToken()

    if (!accessToken) {
      console.error('Unable to invoke workouts function: missing auth token')
      return null
    }

    const { data, error } = await supabase.functions.invoke<T>('workouts', {
      body: { action, payload },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
      },
    })

    if (error) {
      console.error('Error invoking workouts function:', error)
      return null
    }

    return data ?? null
  } catch (error) {
    console.error('Error invoking workouts function:', error)
    return null
  }
}

export type DiscountTokenPayload = {
  partnerName: string
  couponCode: string
}

export type DiscountTokenResponse = {
  token: string
  expiresAt: string
  verifyUrl: string
}

export const createDiscountToken = async (
  payload: DiscountTokenPayload,
): Promise<DiscountTokenResponse> => {
  const { data, error } = await supabase.functions.invoke<DiscountTokenResponse>('discounts', {
    body: { action: 'create_token', payload },
  })

  if (error) {
    const context = (error as { context?: { body?: string } } | null)?.context
    let message = 'Unable to create discount token.'
    let meta: Record<string, any> | null = null
    if (context?.body) {
      try {
        const parsed = JSON.parse(context.body)
        if (parsed?.error) {
          message = parsed.error
        } else if (parsed?.message) {
          message = parsed.message
        }
        meta = parsed ?? null
      } catch {
        // Ignore parse errors and fall back to default message.
      }
    }
    const enrichedError = new Error(message) as Error & { meta?: Record<string, any> }
    if (meta) {
      enrichedError.meta = meta
    }
    console.error('Error creating discount token:', enrichedError)
    throw enrichedError
  }

  if (!data) {
    throw new Error('No discount token returned')
  }

  return data
}

const WORKOUT_RELATIONAL_FIELDS = `
      *,
      program:programs(*),
      workout_exercises (
        *,
        exercise_sets (*)
      ),
      checkins:workout_checkins (
        *,
        media:workout_checkin_media (*)
      )
    `

// Enhanced error handler for Supabase requests
export const handleSupabaseError = (error: any) => {
  // Use warning for temporary schema errors, error for others
  if (error?.message?.includes('Database error querying schema')) {
    console.warn('Supabase Warning:', error)
  } else {
    console.error('Supabase Error:', error)
  }
  
  // Handle specific schema errors
  if (error?.message?.includes('Database error querying schema')) {
    return {
      error: 'Authentication service is temporarily unavailable. Please try again later.',
      code: 'SERVICE_UNAVAILABLE',
      temporary: true
    }
  }
  
  // Handle other auth errors
  if (error?.message?.includes('Invalid login credentials')) {
    return {
      error: 'Invalid email or password. Please check your credentials.',
      code: 'INVALID_CREDENTIALS',
      temporary: false
    }
  }
  
  return {
    error: error?.message || 'An unexpected error occurred',
    code: error?.code || 'UNKNOWN_ERROR',
    temporary: false
  }
}

// Auth helper functions
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

export const signUp = async (email: string, password: string, userData: any) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: userData
    }
  });
  
  return { data, error };
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

// Database types
export interface Profile {
  id: string
  email: string
  first_name?: string
  last_name?: string
  avatar_url?: string
  phone?: string
  date_of_birth?: string
  location?: string
  bio?: string
  role: 'user' | 'coach' | 'admin'
  experience_level: 'beginner' | 'intermediate' | 'advanced' | 'all_levels'
  bodyweight?: number
  height?: number
  units: 'metric' | 'imperial'
  emergency_contact_name?: string
  emergency_contact_phone?: string
  emergency_contact_relationship?: string
  created_at: string
  updated_at: string
}

export interface Program {
  id: string
  title: string
  subtitle?: string
  description?: string
  program_type: 'powerlifting' | 'olympic_weightlifting' | 'general_fitness' | 'mobility' | 'competition_prep'
  level: 'beginner' | 'intermediate' | 'advanced' | 'all_levels'
  duration_weeks: number
  price: number
  currency: string
  image_url?: string
  features: string[]
  is_popular: boolean
  is_active: boolean
  max_participants?: number
  current_participants: number
  created_by?: string
  created_at: string
  updated_at: string
  average_rating?: number | null
  rating_count?: number
  enrollment_count?: number | null
}

export interface ProgramEnrollment {
  id: string
  user_id: string | null
  program_id: string
  status: 'pending' | 'active' | 'completed' | 'cancelled'
  enrolled_at: string
  start_date?: string
  end_date?: string
  progress_percentage: number
  notes?: string
  created_at: string
  updated_at: string
  program?: Program
  profile?: Profile | null
  lead_first_name?: string | null
  lead_last_name?: string | null
  lead_email?: string | null
  lead_phone?: string | null
  lead_age?: number | null
  lead_location?: string | null
  lead_experience_level?: string | null
  lead_goals?: string | null
  lead_injuries?: string | null
  lead_additional_info?: string | null
  is_women_only?: boolean | null
}

export interface WeeklyGoal {
  id: string
  user_id: string
  coach_id: string
  week_start: string
  goal_text: string
  status: 'pending' | 'achieved' | 'partial' | 'not_achieved'
  reflection: string | null
  created_at: string
  updated_at: string
}

export interface StrengthAssessment {
  id: string
  user_id: string
  squat_max?: number
  bench_max?: number
  deadlift_max?: number
  overhead_press_max?: number
  bodyweight_at_assessment?: number
  assessment_date: string
  goals: string[]
  limitations?: string
  overall_level?: string
  recommended_programs: string[]
  created_at: string
}

export interface Workout {
  id: string
  user_id: string
  program_id?: string | null
  title: string
  description?: string | null
  day_number: number
  duration_minutes?: number | null
  is_completed: boolean
  intensity_zone?: string | null
  coach_notes?: string | null
  user_notes?: string | null
  rating?: number | null
  created_at: string
  updated_at: string
}

export interface WorkoutExercise {
  id: string
  workout_id: string
  exercise_name: string
  exercise_type?: string
  order_in_workout: number
  target_sets?: number
  target_reps?: string
  target_weight?: number
  target_rpe?: number
  rest_seconds?: number
  notes?: string
  image_url?: string | null
  created_at: string
}

export interface ExerciseLibraryEntry {
  id: string
  exercise_name: string
  exercise_type?: string
  target_sets?: number
  target_reps?: string
  target_weight?: number
  target_rpe?: number
  rest_seconds?: number
  notes?: string
  image_url?: string | null
  created_at: string
}

export interface ExerciseSet {
  id: string
  workout_exercise_id: string
  set_number: number
  weight?: number
  reps?: number
  rpe?: number
  is_completed: boolean
  notes?: string
  created_at: string
}

export interface WorkoutExerciseWithSets extends WorkoutExercise {
  exercise_sets?: ExerciseSet[]
}

export interface WorkoutExerciseRequest {
  exerciseName: string
  exerciseType?: string | null
  order?: number | null
  targetSets?: number | null
  targetReps?: string | null
  targetWeight?: number | null
  targetRpe?: number | null
  restSeconds?: number | null
  notes?: string | null
  imageUrl?: string | null
  sourceExerciseId?: string | null
  sets?: Array<{
    setNumber: number
    weight?: number | null
    reps?: number | null
    rpe?: number | null
    isCompleted?: boolean | null
    notes?: string | null
  }>
}

export interface WorkoutCheckInMedia {
  id: string
  checkin_id: string
  media_url: string
  media_type: 'video' | 'image'
  thumbnail_url?: string
  created_at: string
}

export interface WorkoutCheckIn {
  id: string
  workout_id: string
  user_id: string
  status: 'submitted' | 'reviewed' | 'needs_revision'
  readiness_score?: number
  energy_level?: 'low' | 'medium' | 'high'
  soreness_level?: 'low' | 'medium' | 'high'
  notes?: string
  coach_notes?: string
  video_url?: string
  created_at: string
  updated_at: string
  revision_requested_at?: string | null
  achieved_pr?: boolean
  pr_exercise?: string | null
  pr_value?: number | null
  pr_unit?: string | null
  performance_metrics?: Record<string, any> | null
  workout?: WorkoutWithRelations
  profile?: Profile
  media?: WorkoutCheckInMedia[]
}

export interface WorkoutWithRelations extends Workout {
  workout_exercises?: WorkoutExerciseWithSets[]
  checkins?: WorkoutCheckIn[]
  profile?: Profile | null
  program?: Program | null
  is_template?: boolean
  scheduled_date?: string
  scheduledDateObject?: Date
}

export interface CoachMessage {
  id: string
  sender_id: string
  receiver_id: string
  sender_role: 'athlete' | 'coach'
  message: string
  is_read: boolean
  read_at?: string | null
  created_at: string
  sender?: Profile | null
  receiver?: Profile | null
}

export interface CreateWorkoutRequest {
  athleteId: string
  title: string
  description?: string | null
  programId?: string | null
  dayNumber?: number | null
  durationMinutes?: number | null
  scheduledDate?: string | Date | null
  coachNotes?: string | null
  exercises?: WorkoutExerciseRequest[]
}

export interface UpdateWorkoutRequest {
  title?: string | null
  description?: string | null
  programId?: string | null
  dayNumber?: number | null
  durationMinutes?: number | null
  scheduledDate?: string | Date | null
  coachNotes?: string | null
  isCompleted?: boolean | null
  exercises?: WorkoutExerciseRequest[]
}

export interface AccountSummary {
  lastLogin: string | null
  accountCreated: string | null
  totalWorkouts: number
  totalEnrollments: number
  totalCheckIns: number
  totalNotifications: number
  approximateDataSize: number
}

export interface CoachFeedback {
  id: string
  user_id: string
  coach_id: string
  workout_id?: string
  feedback_text: string
  is_read: boolean
  created_at: string
}

export interface ProgressPhoto {
  id: string
  user_id: string
  photo_url: string
  photo_type: string
  bodyweight?: number
  notes?: string
  taken_at: string
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: 'workout_reminder' | 'coach_feedback' | 'program_update' | 'payment' | 'achievement'
  is_read: boolean
  action_url?: string
  created_at: string
}

export interface PaymentRecord {
  id: string
  user_id: string
  program_id?: string
  amount: number
  currency: string
  status: 'pending' | 'completed' | 'failed' | 'refunded'
  payment_method?: string
  transaction_id?: string
  payment_date?: string
  created_at: string
  updated_at: string
}

export interface Testimonial {
  id: string
  name: string
  role: string | null
  location: string | null
  image: string | null
  quote: string
  achievement: string | null
  before_after: { before: string; after: string }
  rating: number
  program: string | null
  duration: string | null
  created_at: string
}


const STORAGE_URL_PROTOCOL = 'storage://';
const DEFAULT_PROGRAM_IMAGE_BUCKET = import.meta.env.VITE_SUPABASE_PROGRAM_IMAGES_BUCKET || 'program-images';
const PROFILE_AVATAR_BUCKET = import.meta.env.VITE_SUPABASE_AVATAR_BUCKET || 'profile-avatars';

type AvatarRecord = { avatar_url?: string | null };

const getStoragePublicUrl = (bucket: string | null | undefined, rawPath: string | null | undefined) => {
  if (!bucket || !rawPath) {
    return null;
  }

  const sanitizedPath = rawPath.replace(/^\/+/, '');
  if (!sanitizedPath) {
    return null;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(sanitizedPath);
  return data?.publicUrl ?? null;
};

export const resolveSupabaseImageUrl = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  if (/^data:/i.test(value)) {
    return value;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith(STORAGE_URL_PROTOCOL)) {
    const resource = value.slice(STORAGE_URL_PROTOCOL.length);
    const [bucket, ...pathParts] = resource.split('/');
    if (!bucket || pathParts.length === 0) {
      return null;
    }
    const storagePath = pathParts.join('/');
    return getStoragePublicUrl(bucket, storagePath) ?? value;
  }

  if (value.includes('::')) {
    const [bucket, storagePath] = value.split('::', 2);
    const resolved = getStoragePublicUrl(bucket, storagePath);
    if (resolved) {
      return resolved;
    }
  }

  const defaultBucketUrl = getStoragePublicUrl(DEFAULT_PROGRAM_IMAGE_BUCKET, value);
  if (defaultBucketUrl) {
    return defaultBucketUrl;
  }

  return value;
};

export const resolveProfileAvatar = <T extends AvatarRecord>(
  profile: T | null | undefined,
): T | null => {
  if (!profile) {
    return profile ?? null;
  }

  const normalizedAvatar = resolveSupabaseImageUrl(profile.avatar_url) ?? profile.avatar_url ?? null;
  if (normalizedAvatar === profile.avatar_url) {
    return profile;
  }

  return {
    ...profile,
    avatar_url: normalizedAvatar,
  };
};

const generateRandomSuffix = () => {
  const cryptoRef = typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined;
  if (cryptoRef?.randomUUID) {
    return cryptoRef.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeExtension = (extension: string | undefined) => {
  if (!extension) {
    return 'jpg';
  }
  const sanitized = extension.toLowerCase().replace(/[^a-z0-9]/g, '');
  return sanitized || 'jpg';
};

export const uploadProfileAvatar = async (
  userId: string,
  file: File,
): Promise<{ storageUri: string; publicUrl: string | null } | null> => {
  try {
    const extension = normalizeExtension(file.name.split('.').pop());
    const storagePath = `avatars/${userId}/${Date.now()}-${generateRandomSuffix()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(PROFILE_AVATAR_BUCKET)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || 'image/jpeg',
      });

    if (uploadError) {
      console.error('Error uploading profile avatar:', uploadError);
      return null;
    }

    const storageUri = `${STORAGE_URL_PROTOCOL}${PROFILE_AVATAR_BUCKET}/${storagePath}`;
    const publicUrl = getStoragePublicUrl(PROFILE_AVATAR_BUCKET, storagePath);

    return { storageUri, publicUrl };
  } catch (error) {
    console.error('Unexpected error uploading profile avatar:', error);
    return null;
  }
};

// Helper functions for common database operations
export const getProfile = async (userId: string): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Error fetching profile:', error)
    return null
  }

  return resolveProfileAvatar(data) as Profile
}

export const updateProfile = async (userId: string, updates: Partial<Profile>): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()

  if (error) {
    console.error('Error updating profile:', error)
    return null
  }

  return resolveProfileAvatar(data) as Profile
}

let userSettingsTableAvailable = true
let userSettingsFeatureLogged = false

const logUserSettingsDisabled = () => {
  if (userSettingsFeatureLogged) {
    return
  }
  userSettingsFeatureLogged = true
  console.info('User settings feature disabled; skipping user_settings queries.')
}

const isUserSettingsUnavailableError = (error: PostgrestError | null) => {
  if (!error) {
    return false
  }

  const knownCodes = ['PGRST116', 'PGRST204', 'PGRST301']
  if (knownCodes.includes(error.code ?? '')) {
    return true
  }

  const status = (error as unknown as { status?: number })?.status
  if (status === 406 || error.code === '406') {
    return true
  }

  return error.message?.toLowerCase().includes('user_settings') ?? false
}

export const getUserSettings = async (userId: string): Promise<UserSettings | null> => {
  if (!userSettingsFeatureEnabled) {
    logUserSettingsDisabled()
    return null
  }

  if (!userSettingsTableAvailable) {
    return null
  }

  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    if (isUserSettingsUnavailableError(error)) {
      userSettingsTableAvailable = false
      console.warn('User settings endpoints unavailable; skipping fetch until table exists.')
      return null
    }

    console.warn('Error fetching user settings:', error)
    return null
  }

  return data as UserSettings
}

export type UpsertUserSettingsResult = {
  data: UserSettings | null
  skipped: boolean
}

export const upsertUserSettings = async (
  userId: string,
  payload: {
    notifications: NotificationSettings
    privacy: PrivacySettings
    display: DisplaySettings
  }
): Promise<UpsertUserSettingsResult> => {
  if (!userSettingsFeatureEnabled) {
    logUserSettingsDisabled()
    return { data: null, skipped: true }
  }

  if (!userSettingsTableAvailable) {
    return { data: null, skipped: true }
  }

  const { data, error } = await supabase
    .from('user_settings')
    .upsert(
      {
        user_id: userId,
        notifications: payload.notifications,
        privacy: payload.privacy,
        display: payload.display,
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single()

  if (error) {
    if (isUserSettingsUnavailableError(error)) {
      userSettingsTableAvailable = false
      console.warn('User settings endpoints unavailable; skipping upsert until table exists.')
      return { data: null, skipped: true }
    }

    console.error('Error saving user settings:', error)
    return { data: null, skipped: false }
  }

  return { data: data as UserSettings, skipped: false }
}

export const getExerciseImagePublicUrl = (reference?: string | null) => {
  const trimmed = reference?.trim()
  if (!trimmed) {
    return null
  }
  return trimmed
}

export const changePassword = async (
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> => {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user?.email) {
    return { success: false, error: 'Unable to verify current session.' }
  }

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })

  if (reauthError) {
    return { success: false, error: 'Current password is incorrect.' }
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })

  if (updateError) {
    return { success: false, error: updateError.message ?? 'Unable to update password.' }
  }

  return { success: true }
}

type AccountFunctionResponse =
  | { success: true; summary: AccountSummary }
  | { success: true; message: string }
  | { success: false; error?: string }

export const getAccountSummary = async (): Promise<AccountSummary> => {
  const { data, error } = await supabase.functions.invoke<AccountFunctionResponse>('account', {
    body: { action: 'summary' },
  })

  if (error) {
    throw new Error(error.message ?? 'Unable to load account summary.')
  }

  if (!data || !('summary' in data) || !data.success) {
    throw new Error((data as { error?: string })?.error ?? 'Unable to load account summary.')
  }

  return data.summary
}

export const requestAccountDeletion = async (): Promise<void> => {
  const { data, error } = await supabase.functions.invoke<AccountFunctionResponse>('account', {
    body: { action: 'delete' },
  })

  if (error) {
    throw new Error(error.message ?? 'Unable to delete account.')
  }

  if (!data || !data.success) {
    throw new Error((data as { error?: string })?.error ?? 'Unable to delete account.')
  }
}

export const getPrograms = async (): Promise<Program[]> => { 
  const { data, error } = await supabase
    .from('programs')
    .select(`
      *,
      program_ratings:program_ratings(rating),
      program_enrollments:program_enrollments(status)
    `)
    .eq('is_active', true)
    .order('is_popular', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching programs:', error);
    return [];
  }

  const normalizedPrograms: Program[] = (data ?? []).map((program: any) => {
    const ratings = Array.isArray(program.program_ratings)
      ? program.program_ratings.map((entry: any) => entry.rating).filter((value: any) => typeof value === 'number')
      : [];
    const averageRating =
      ratings.length > 0
        ? Math.round((ratings.reduce((sum: number, val: number) => sum + val, 0) / ratings.length) * 10) / 10
        : null;
    const enrollmentCount = Array.isArray(program.program_enrollments)
      ? program.program_enrollments.filter((enrollment: any) => enrollment?.status === 'active').length
      : program.current_participants ?? 0;

    return {
      ...program,
      image_url: resolveSupabaseImageUrl(program.image_url) ?? program.image_url,
      average_rating: averageRating,
      rating_count: ratings.length,
      enrollment_count: enrollmentCount,
    };
  });

  return normalizedPrograms;
};


  
export const incrementProgramParticipants = async (programId: string): Promise<number | null> => {
  try {
    const { data, error } = await supabase
      .from('programs')
      .select('current_participants')
      .eq('id', programId)
      .single();

    if (error) {
      console.error('Error reading current participants:', error);
      return null;
    }

    const nextCount = (data?.current_participants ?? 0) + 1;

    const { data: updated, error: updateError } = await supabase
      .from('programs')
      .update({ current_participants: nextCount })
      .eq('id', programId)
      .select('current_participants')
      .single();

    if (updateError) {
      console.error('Error incrementing participants:', updateError);
      return null;
    }

    return updated?.current_participants ?? nextCount;
  } catch (err) {
    console.error('Unexpected error incrementing participants:', err);
    return null;
  }
}

export const enrollInProgram = async (userId: string, programId: string): Promise<ProgramEnrollment | null> => {
  const { data, error } = await supabase
    .from('program_enrollments')
    .insert({
      user_id: userId,
      program_id: programId,
      status: 'pending'
    })
    .select()
    .single()

  if (error) {
    console.error('Error enrolling in program:', error)
    return null
  }

  return data
}

export const getUserEnrollments = async (userId: string): Promise<ProgramEnrollment[]> => {
  const { data, error } = await supabase
    .from('program_enrollments')
    .select(`
      *,
      program:programs(*),
      profile:profiles!program_enrollments_user_id_fkey(*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching user enrollments:', error)
    return []
  }

  return data || []
}

export const saveStrengthAssessment = async (assessment: Omit<StrengthAssessment, 'id' | 'created_at'>): Promise<StrengthAssessment | null> => {
  const { data, error } = await supabase
    .from('strength_assessments')
    .insert(assessment)
    .select()
    .single()

  if (error) {
    console.error('Error saving strength assessment:', error)
    return null
  }

  return data
}

const mergeWorkouts = (lists: WorkoutWithRelations[][]): WorkoutWithRelations[] => {
  const map = new Map<string, WorkoutWithRelations>()
  lists.flat().forEach((workout) => {
    map.set(workout.id, workout)
  })

  return Array.from(map.values()).sort((a, b) => {
    if (a.program_id && b.program_id && a.program_id === b.program_id) {
      return (a.day_number ?? 0) - (b.day_number ?? 0)
    }
    if (a.program_id && !b.program_id) {
      return -1
    }
    if (!a.program_id && b.program_id) {
      return 1
    }
    const aTime = new Date(a.created_at).getTime()
    const bTime = new Date(b.created_at).getTime()
    return bTime - aTime
  })
}

export const getUserWorkouts = async (
  userId: string,
  programIds: string[] = []
): Promise<WorkoutWithRelations[]> => {
  const uniqueProgramIds = Array.from(new Set((programIds ?? []).filter(Boolean)))

  const userPromise = supabase
    .from('workouts')
    .select(WORKOUT_RELATIONAL_FIELDS)
    .eq('user_id', userId)
    .order('day_number', { ascending: true })
    .order('order_in_workout', { referencedTable: 'workout_exercises', ascending: true })
    .order('created_at', { referencedTable: 'workout_checkins', ascending: false })

  const { data: userData, error: userError } = await userPromise

  let templateData: WorkoutWithRelations[] | null = []
  let templateError: any = null

  if (uniqueProgramIds.length > 0) {
    const templateResponse = await supabase
      .from('workouts')
      .select(WORKOUT_RELATIONAL_FIELDS)
      .is('user_id', null)
      .in('program_id', uniqueProgramIds)
      .order('day_number', { ascending: true })
      .order('order_in_workout', { referencedTable: 'workout_exercises', ascending: true })
      .order('created_at', { referencedTable: 'workout_checkins', ascending: false })

    templateData = templateResponse.data
    templateError = templateResponse.error
  }

  if (userError) {
    console.error('Error fetching athlete workouts:', userError)
  }

  if (templateError) {
    console.error('Error fetching template workouts:', templateError)
  }

  const personalized = (userData ?? []).map((workout) => ({ ...workout, is_template: false }))
  const templates = (templateData ?? []).map((workout) => ({ ...workout, is_template: true }))

  return mergeWorkouts([personalized, templates])
}

export const getWeeklyWorkouts = async (
  userId: string,
  programIds: string[] = [],
  startDay: number,
  endDay: number
): Promise<WorkoutWithRelations[]> => {
  const uniqueProgramIds = Array.from(new Set((programIds ?? []).filter(Boolean)))

  const userPromise = supabase
    .from('workouts')
    .select(WORKOUT_RELATIONAL_FIELDS)
    .eq('user_id', userId)
    .gte('day_number', startDay)
    .lte('day_number', endDay)
    .order('day_number', { ascending: true })
    .order('order_in_workout', { referencedTable: 'workout_exercises', ascending: true })
    .order('created_at', { referencedTable: 'workout_checkins', ascending: false })

  const { data: userData, error: userError } = await userPromise

  let templateData: WorkoutWithRelations[] | null = []
  let templateError: any = null

  if (uniqueProgramIds.length > 0) {
    const templateResponse = await supabase
      .from('workouts')
      .select(WORKOUT_RELATIONAL_FIELDS)
      .is('user_id', null)
      .in('program_id', uniqueProgramIds)
      .gte('day_number', startDay)
      .lte('day_number', endDay)
      .order('day_number', { ascending: true })
      .order('order_in_workout', { referencedTable: 'workout_exercises', ascending: true })
      .order('created_at', { referencedTable: 'workout_checkins', ascending: false })

    templateData = templateResponse.data
    templateError = templateResponse.error
  }

  if (userError) {
    console.error('Error fetching weekly athlete workouts:', userError)
  }

  if (templateError) {
    console.error('Error fetching weekly template workouts:', templateError)
  }

  const personalized = (userData ?? []).map((workout) => ({ ...workout, is_template: false }))
  const templates = (templateData ?? []).map((workout) => ({ ...workout, is_template: true }))

  return mergeWorkouts([personalized, templates]).sort((a, b) => (a.day_number ?? 0) - (b.day_number ?? 0))
}

const resolveCheckInMediaType = (mimeType?: string): 'video' | 'image' => {
  if (mimeType?.startsWith('image/')) {
    return 'image'
  }
  return 'video'
}

const buildCheckInMediaPath = (userId: string, workoutId: string, fileName: string) => {
  const extension = fileName.split('.').pop() || 'bin'
  const uniqueId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return `${userId}/${workoutId}/${uniqueId}.${extension}`
}

export const uploadCheckInMedia = async (
  userId: string,
  workoutId: string,
  file: File
): Promise<{ url: string; type: 'video' | 'image' } | null> => {
  if (!WORKOUT_CHECKIN_BUCKET) {
    console.warn('Workout check-in bucket name is not configured')
    return null
  }

  const mediaPath = buildCheckInMediaPath(userId, workoutId, file.name)
  const { error: uploadError } = await supabase.storage
    .from(WORKOUT_CHECKIN_BUCKET)
    .upload(mediaPath, file, {
      cacheControl: '3600',
      contentType: file.type || 'application/octet-stream',
      upsert: true
    })

  if (uploadError) {
    console.error('Error uploading workout check-in media:', uploadError)
    return null
  }

  const { data, error: publicUrlError } = supabase.storage
    .from(WORKOUT_CHECKIN_BUCKET)
    .getPublicUrl(mediaPath)

  if (publicUrlError) {
    console.error('Error generating public URL for check-in media:', publicUrlError)
    return null
  }

  return {
    url: data.publicUrl,
    type: resolveCheckInMediaType(file.type)
  }
}

export interface SubmitWorkoutCheckInPayload {
  workoutId: string
  userId: string
  notes?: string
  readinessScore?: number
  energyLevel?: 'low' | 'medium' | 'high'
  sorenessLevel?: 'low' | 'medium' | 'high'
  achievedPR?: boolean
  prExercise?: string
  prValue?: number
  prUnit?: string
  performanceMetrics?: Record<string, any>
  mediaFiles?: File[]
}

export const submitWorkoutCheckIn = async (
  payload: SubmitWorkoutCheckInPayload
): Promise<WorkoutCheckIn | null> => {
  try {
    const uploads: { url: string; type: 'video' | 'image' }[] = []

    if (payload.mediaFiles && payload.mediaFiles.length > 0) {
      for (const file of payload.mediaFiles) {
        const uploaded = await uploadCheckInMedia(payload.userId, payload.workoutId, file)
        if (uploaded) {
          uploads.push(uploaded)
        }
      }
    }

    const baseMetrics = {
      readinessScore: payload.readinessScore ?? null,
      energyLevel: payload.energyLevel ?? null,
      sorenessLevel: payload.sorenessLevel ?? null
    }
    const performanceMetrics = {
      ...baseMetrics,
      ...(payload.performanceMetrics ?? {}),
      achievedPR: payload.achievedPR ?? false,
      prExercise: payload.prExercise ?? null,
      prValue: payload.prValue ?? null,
      prUnit: payload.prUnit ?? null
    }

    const { data: checkInRecord, error: insertError } = await supabase
      .from('workout_checkins')
      .insert({
        workout_id: payload.workoutId,
        user_id: payload.userId,
        notes: payload.notes,
        readiness_score: payload.readinessScore ?? null,
        energy_level: payload.energyLevel ?? null,
        soreness_level: payload.sorenessLevel ?? null,
        achieved_pr: payload.achievedPR ?? false,
        pr_exercise: payload.prExercise ?? null,
        pr_value: payload.prValue ?? null,
        pr_unit: payload.prUnit ?? null,
        performance_metrics: performanceMetrics,
        status: 'submitted'
      })
      .select()
      .single()

    if (insertError || !checkInRecord) {
      console.error('Error submitting workout check-in:', insertError)
      return null
    }

    if (uploads.length > 0) {
      const mediaPayload = uploads.map((media) => ({
        checkin_id: checkInRecord.id,
        media_url: media.url,
        media_type: media.type
      }))

      const { error: mediaError } = await supabase
        .from('workout_checkin_media')
        .insert(mediaPayload)

      if (mediaError) {
        console.error('Error saving workout check-in media:', mediaError)
      }
    }

    const { data: fullCheckIn, error: fetchError } = await supabase
      .from('workout_checkins')
      .select(`
        *,
        media:workout_checkin_media (*),
        workout:workouts (*)
      `)
      .eq('id', checkInRecord.id)
      .single()

    if (fetchError) {
      console.error('Error fetching newly created check-in:', fetchError)
      return checkInRecord as WorkoutCheckIn
    }

    return fullCheckIn as WorkoutCheckIn
  } catch (error) {
    console.error('Unexpected error submitting workout check-in:', error)
    return null
  }
}

export const getWorkoutCheckIns = async (userId: string): Promise<WorkoutCheckIn[]> => {
  const { data, error } = await supabase
    .from('workout_checkins')
    .select(`
      *,
      media:workout_checkin_media (*),
      workout:workouts (*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching workout check-ins:', error)
    return []
  }

  return (data ?? []) as WorkoutCheckIn[]
}

export const updateWorkoutCheckIn = async (
  checkinId: string,
  payload: {
    notes?: string
    readinessScore?: number
    energyLevel?: 'low' | 'medium' | 'high'
    sorenessLevel?: 'low' | 'medium' | 'high'
    achievedPR?: boolean
    prExercise?: string
    prValue?: number
    prUnit?: string
    performanceMetrics?: Record<string, any>
    mediaFiles?: File[]
    retainMediaIds?: string[]
    userId?: string
    workoutId?: string
    resetRevision?: boolean
  }
): Promise<WorkoutCheckIn | null> => {
  const MAX_MEDIA_ITEMS = 5

  const baseMetrics = {
    readinessScore: payload.readinessScore ?? null,
    energyLevel: payload.energyLevel ?? null,
    sorenessLevel: payload.sorenessLevel ?? null
  }
  const mergedMetrics = {
    ...baseMetrics,
    ...(payload.performanceMetrics ?? {}),
    achievedPR: payload.achievedPR ?? undefined,
    prExercise: payload.prExercise ?? undefined,
    prValue: payload.prValue ?? undefined,
    prUnit: payload.prUnit ?? undefined
  }
  const performanceMetrics = Object.fromEntries(
    Object.entries(mergedMetrics).filter(([, value]) => value !== undefined)
  )

  const hasRetainDirective = payload.retainMediaIds !== undefined
  const resetRevision = payload.resetRevision ?? false
  const retainMediaIds = Array.from(new Set((payload.retainMediaIds ?? []).filter(Boolean)))
  const newMediaFiles = payload.mediaFiles ?? []
  const shouldHandleMedia = hasRetainDirective || newMediaFiles.length > 0

  if (shouldHandleMedia) {
    if (retainMediaIds.length + newMediaFiles.length > MAX_MEDIA_ITEMS) {
      console.error('Exceeded maximum number of check-in media attachments')
      return null
    }

    const { data: existingMediaEntries, error: existingMediaError } = await supabase
      .from('workout_checkin_media')
      .select('id')
      .eq('checkin_id', checkinId)

    if (existingMediaError) {
      console.error('Error loading existing check-in media before update:', existingMediaError)
      return null
    }

    const existingIds = (existingMediaEntries ?? []).map((entry) => entry.id)
    const retainedSet = new Set(retainMediaIds.filter((id) => existingIds.includes(id)))
    const idsToDelete = existingIds.filter((id) => !retainedSet.has(id))

    if (idsToDelete.length > 0) {
      const { error: deleteMediaError } = await supabase
        .from('workout_checkin_media')
        .delete()
        .in('id', idsToDelete)

      if (deleteMediaError) {
        console.error('Error deleting removed check-in media:', deleteMediaError)
        return null
      }
    }

    if (newMediaFiles.length > 0) {
      let resolvedUserId = payload.userId
      let resolvedWorkoutId = payload.workoutId

      if (!resolvedUserId || !resolvedWorkoutId) {
        const { data: checkinRecord, error: checkinLookupError } = await supabase
          .from('workout_checkins')
          .select('user_id, workout_id')
          .eq('id', checkinId)
          .single()

        if (checkinLookupError || !checkinRecord) {
          console.error('Unable to resolve check-in owner for media upload:', checkinLookupError)
          return null
        }

        resolvedUserId = checkinRecord.user_id
        resolvedWorkoutId = checkinRecord.workout_id
      }

      const uploads: { url: string; type: 'video' | 'image' }[] = []

      for (const file of newMediaFiles) {
        const uploaded = await uploadCheckInMedia(resolvedUserId as string, resolvedWorkoutId as string, file)
        if (uploaded) {
          uploads.push(uploaded)
        }
      }

      if (uploads.length > 0) {
        const mediaPayload = uploads.map((media) => ({
          checkin_id: checkinId,
          media_url: media.url,
          media_type: media.type
        }))

        const { error: insertMediaError } = await supabase
          .from('workout_checkin_media')
          .insert(mediaPayload)

        if (insertMediaError) {
          console.error('Error adding new check-in media:', insertMediaError)
          return null
        }
      }
    }
  }

  const updatePayload: Record<string, any> = {
    notes: payload.notes ?? null,
    readiness_score: payload.readinessScore ?? null,
    energy_level: payload.energyLevel ?? null,
    soreness_level: payload.sorenessLevel ?? null,
    performance_metrics: performanceMetrics
  }

  if (resetRevision) {
    updatePayload.status = 'submitted'
    updatePayload.revision_requested_at = null
  }

  if (payload.achievedPR !== undefined) {
    updatePayload.achieved_pr = payload.achievedPR
  }
  if (payload.prExercise !== undefined) {
    updatePayload.pr_exercise = payload.prExercise ?? null
  }
  if (payload.prValue !== undefined) {
    updatePayload.pr_value = payload.prValue ?? null
  }
  if (payload.prUnit !== undefined) {
    updatePayload.pr_unit = payload.prUnit ?? null
  }

  const { data, error } = await supabase
    .from('workout_checkins')
    .update(updatePayload)
    .eq('id', checkinId)
    .select(`
      *,
      media:workout_checkin_media (*),
      workout:workouts (*)
    `)
    .single()

  if (error) {
    console.error('Error updating workout check-in:', error)
    return null
  }

  return data as WorkoutCheckIn
}

export const getWorkoutCheckInsForWorkout = async (
  workoutId: string
): Promise<WorkoutCheckIn[]> => {
  const { data, error } = await supabase
    .from('workout_checkins')
    .select(`
      *,
      media:workout_checkin_media (*),
      profile:profiles (*)
    `)
    .eq('workout_id', workoutId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching check-ins for workout:', error)
    return []
  }

  return (data ?? []) as WorkoutCheckIn[]
}

export const updateWorkoutCheckInStatus = async (
  checkinId: string,
  status: WorkoutCheckIn['status'],
  coachNotes?: string
): Promise<WorkoutCheckIn | null> => {
  const payload = {
    checkin_id: checkinId,
    status,
    coach_notes: coachNotes ?? null,
  }

  const result = await invokeWorkoutsFunction<WorkoutCheckIn>('update_checkin_status', payload)
  if (!result) {
    console.error('Error updating workout check-in status via edge function')
    return null
  }
  return result
}

export const getCoachMessages = async (userId: string): Promise<CoachMessage[]> => {
  const { data, error } = await supabase
    .from('coach_messages')
    .select(`
      *,
      sender:profiles!coach_messages_sender_id_fkey(*),
      receiver:profiles!coach_messages_receiver_id_fkey(*)
    `)
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('Error fetching coach messages:', error)
    return []
  }

  return (data ?? []) as CoachMessage[]
}

export const sendCoachMessage = async (
  senderId: string,
  receiverId: string,
  payload: { message: string; senderRole: 'athlete' | 'coach' }
): Promise<CoachMessage | null> => {
  const { data, error } = await supabase
    .from('coach_messages')
    .insert({
      sender_id: senderId,
      receiver_id: receiverId,
      sender_role: payload.senderRole,
      message: payload.message,
    })
    .select(`
      *,
      sender:profiles!coach_messages_sender_id_fkey(*),
      receiver:profiles!coach_messages_receiver_id_fkey(*)
    `)
    .single()

  if (error) {
    console.error('Error sending coach message:', error)
    return null
  }

  return data as CoachMessage
}

export const markCoachMessageRead = async (messageId: string): Promise<void> => {
  const { error } = await supabase
    .from('coach_messages')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', messageId)

  if (error) {
    console.error('Error marking coach message read:', error)
  }
}

const normalizeDateInput = (value?: string | Date | null): string | null => {
  if (!value) {
    return null
  }
  if (value instanceof Date) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const trimmed = value.toString().trim()
  if (!trimmed) {
    return null
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10)
  }
  const timestamp = Date.parse(trimmed)
  if (!Number.isNaN(timestamp)) {
    return normalizeDateInput(new Date(timestamp))
  }
  return null
}

export const createWorkout = async (request: CreateWorkoutRequest): Promise<WorkoutWithRelations | null> => {
  const payload: Record<string, any> = {
    athlete_id: request.athleteId,
    title: request.title,
    description: request.description ?? null,
    program_id: request.programId ?? null,
    duration_minutes: request.durationMinutes ?? null,
    scheduled_date: normalizeDateInput(request.scheduledDate),
    coach_notes: request.coachNotes ?? null,
    exercises: request.exercises?.map((exercise) => ({
      exercise_name: exercise.exerciseName,
      exercise_type: exercise.exerciseType ?? null,
      order_in_workout: exercise.order ?? null,
      target_sets: exercise.targetSets ?? null,
      target_reps: exercise.targetReps ?? null,
      target_weight: exercise.targetWeight ?? null,
      target_rpe: exercise.targetRpe ?? null,
      rest_seconds: exercise.restSeconds ?? null,
      notes: exercise.notes ?? null,
      image_url: exercise.imageUrl ?? null,
      source_exercise_id: exercise.sourceExerciseId ?? null,
      sets: exercise.sets?.map((set) => ({
        set_number: set.setNumber,
        weight: set.weight ?? null,
        reps: set.reps ?? null,
        rpe: set.rpe ?? null,
        is_completed: set.isCompleted ?? false,
        notes: set.notes ?? null,
      })),
    })),
  }

  if (request.dayNumber !== undefined) {
    payload.day_number = request.dayNumber
  }

  return await invokeWorkoutsFunction<WorkoutWithRelations>('create', payload)
}

export const updateWorkout = async (
  workoutId: string,
  updates: UpdateWorkoutRequest,
): Promise<WorkoutWithRelations | null> => {
  const payload: Record<string, any> = {
    workout_id: workoutId,
    updates: {
      title: updates.title ?? null,
      description: updates.description ?? null,
      program_id: updates.programId ?? null,
      duration_minutes: updates.durationMinutes ?? null,
      scheduled_date: normalizeDateInput(updates.scheduledDate),
      coach_notes: updates.coachNotes ?? null,
      is_completed: updates.isCompleted ?? null,
    },
  }

  if (updates.dayNumber !== undefined) {
    payload.updates.day_number = updates.dayNumber
  }

  if (updates.exercises) {
    payload.updates.exercises = updates.exercises.map((exercise) => ({
      exercise_name: exercise.exerciseName,
      exercise_type: exercise.exerciseType ?? null,
      order_in_workout: exercise.order ?? null,
      target_sets: exercise.targetSets ?? null,
      target_reps: exercise.targetReps ?? null,
      target_weight: exercise.targetWeight ?? null,
      target_rpe: exercise.targetRpe ?? null,
      rest_seconds: exercise.restSeconds ?? null,
      notes: exercise.notes ?? null,
      image_url: exercise.imageUrl ?? null,
      source_exercise_id: exercise.sourceExerciseId ?? null,
    }))
  }

  return await invokeWorkoutsFunction<WorkoutWithRelations>('update', payload)
}

export const deleteWorkout = async (workoutId: string): Promise<boolean> => {
  const result = await invokeWorkoutsFunction<{ message: string }>('delete', {
    workout_id: workoutId,
  })
  return Boolean(result)
}

export const getWorkoutDetail = async (workoutId: string): Promise<WorkoutWithRelations | null> => {
  return await invokeWorkoutsFunction<WorkoutWithRelations>('detail', {
    workout_id: workoutId,
  })
}

export const fetchCoachCheckIns = async (userIds: string[]): Promise<WorkoutCheckIn[]> => {
  if (userIds.length === 0) {
    return []
  }

  const payload =
    userIds.length === 1
      ? { user_id: userIds[0] }
      : { user_ids: userIds }

  const data = await invokeWorkoutsFunction<WorkoutCheckIn[]>('checkins', payload)
  return data ?? []
}

export const getWeeklyGoalsForUser = async (userId: string): Promise<WeeklyGoal[]> => {
  const { data, error } = await supabase
    .from('weekly_goals')
    .select('*')
    .eq('user_id', userId)
    .order('week_start', { ascending: false })

  if (error) {
    console.error('Error fetching weekly goals:', error)
    return []
  }

  return (data ?? []) as WeeklyGoal[]
}

export const upsertWeeklyGoalForAthlete = async (params: {
  goalId?: string
  userId: string
  coachId: string
  weekStart: string
  goalText: string
}): Promise<WeeklyGoal | null> => {
  const payload: Record<string, any> = {
    user_id: params.userId,
    coach_id: params.coachId,
    week_start: params.weekStart,
    goal_text: params.goalText,
  }

  if (params.goalId) {
    payload.id = params.goalId
  }

  const { data, error } = await supabase
    .from('weekly_goals')
    .upsert(payload, { onConflict: 'user_id,week_start' })
    .select('*')
    .single()

  if (error) {
    console.error('Error saving weekly goal:', error)
    return null
  }

  return data as WeeklyGoal
}

export const updateWeeklyGoalStatus = async (
  goalId: string,
  status: WeeklyGoal['status'],
  reflection?: string | null,
): Promise<WeeklyGoal | null> => {
  const { data, error } = await supabase
    .from('weekly_goals')
    .update({
      status,
      reflection: reflection ?? null,
    })
    .eq('id', goalId)
    .select('*')
    .single()

  if (error) {
    console.error('Error updating weekly goal status:', error)
    return null
  }

  return data as WeeklyGoal
}

export const getUserNotifications = async (userId: string): Promise<Notification[]> => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching notifications:', error)
    return []
  }

  return data || []
}

export const getProgramRatingsForUser = async (userId: string): Promise<Record<string, number>> => {
  const { data, error } = await supabase
    .from('program_ratings')
    .select('program_id, rating')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error loading program ratings:', error);
    return {};
  }

  return (data ?? []).reduce<Record<string, number>>((map, entry) => {
    if (entry.program_id) {
      map[entry.program_id] = entry.rating ?? null;
    }
    return map;
  }, {});
};

export const upsertProgramRating = async (programId: string, rating: number): Promise<boolean> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error('Not authenticated');
  }
  const { error } = await supabase
    .from('program_ratings')
    .upsert(
      {
        user_id: user.id,
        program_id: programId,
        rating,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,program_id' },
    );
  if (error) {
    console.error('Error saving rating:', error);
    return false;
  }
  return true;
};

export const getTestimonials = async (): Promise<Testimonial[]> => {
  const { data, error } = await supabase
    .from('testimonials')
    .select('id, name, role, location, image, quote, achievement, before_after, rating, program, duration, created_at')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching testimonials:', error)
    return []
  }

  return (data ?? []) as Testimonial[]
}

export const markNotificationAsRead = async (notificationId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)

  if (error) {
    console.error('Error marking notification as read:', error)
    return false
  }

  return true
}
