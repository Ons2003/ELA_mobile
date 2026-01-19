import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, resolveProfileAvatar, sendCoachMessage, getCoachMessages, markCoachMessageRead } from '../lib/supabase';
import type { WorkoutWithRelations, WorkoutCheckIn, CoachMessage } from '../lib/supabase';
import { adminAPI } from '../lib/api';

export interface AdminUserProfile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  location?: string;
  role: string;
  experience_level: string;
  created_at: string;
  avatar_url?: string | null;
}

export interface AdminProgramEnrollment {
  id: string;
  user_id: string | null;
  program_id: string;
  status: string;
  enrolled_at: string;
  progress_percentage?: number;
  notes?: string;
  program?: {
    title: string;
    price: number;
    currency: string;
    is_active?: boolean;
  };
  profile?: AdminUserProfile | null;
  lead_first_name?: string | null;
  lead_last_name?: string | null;
  lead_email?: string | null;
  lead_phone?: string | null;
  lead_age?: number | null;
  lead_location?: string | null;
  lead_experience_level?: string | null;
  lead_goals?: string | null;
  lead_injuries?: string | null;
  lead_additional_info?: string | null;
  is_women_only?: boolean | null;
  start_date?: string | null;
  end_date?: string | null;
}

const normalizeAdminUsers = (entries: AdminUserProfile[]): AdminUserProfile[] =>
  entries.map((user) => {
    const resolved = resolveProfileAvatar(user);
    return (resolved ?? user) as AdminUserProfile;
  });

const normalizeAdminEnrollments = (entries: AdminProgramEnrollment[]): AdminProgramEnrollment[] =>
  entries.map((enrollment) => ({
    ...enrollment,
    profile: enrollment.profile
      ? ((resolveProfileAvatar(enrollment.profile) ?? enrollment.profile) as AdminUserProfile)
      : null,
  }));

interface AdminStats {
  totalUsers: number;
  totalEnrollments: number;
  totalRevenue: number;
  activePrograms: number;
  totalCheckIns: number;
  pendingCheckIns: number;
  totalWorkouts: number;
}

interface UseAdminDashboardArgs {
  onNavigateBack: () => void;
}

const ATHLETE_PRESENCE_CHANNEL = 'presence:athletes';

type OnlineUserPresence = Record<
  string,
  {
    firstName?: string;
    lastName?: string;
    lastSeenAt?: string;
  }
>;

type CreateCoachUserInput = {
  email: string;
  firstName: string;
  lastName?: string;
  phone?: string;
};

const PASSWORD_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789!@$%';

const generateRandomPassword = (length = 16): string => {
  const cryptoCandidate =
    typeof globalThis !== 'undefined' &&
    typeof (globalThis as { crypto?: Crypto }).crypto?.getRandomValues === 'function'
      ? (globalThis as { crypto?: Crypto }).crypto
      : null;

  if (cryptoCandidate) {
    const buffer = new Uint32Array(length);
    cryptoCandidate.getRandomValues(buffer);
    return Array.from(buffer, (value) => PASSWORD_CHARSET[value % PASSWORD_CHARSET.length]).join('');
  }

  let password = '';
  for (let index = 0; index < length; index += 1) {
    const charIndex = Math.floor(Math.random() * PASSWORD_CHARSET.length);
    password += PASSWORD_CHARSET[charIndex];
  }
  return password;
};

export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  topic?: string | null;
  message: string;
  created_at: string;
}

export const useAdminDashboard = ({ onNavigateBack }: UseAdminDashboardArgs) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'users' | 'enrollments' | 'programs' | 'check-ins' | 'workouts' | 'messages' | 'coach' | 'contact'
  >('overview');
  const [users, setUsers] = useState<AdminUserProfile[]>([]);
  const [enrollments, setEnrollments] = useState<AdminProgramEnrollment[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedEnrollment, setSelectedEnrollment] = useState<AdminProgramEnrollment | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUserProfile | null>(null);
  const [userEnrollments, setUserEnrollments] = useState<AdminProgramEnrollment[]>([]);
  const [loadingUserDetails, setLoadingUserDetails] = useState(false);
  const [checkIns, setCheckIns] = useState<WorkoutCheckIn[]>([]);
  const [selectedCheckIn, setSelectedCheckIn] = useState<WorkoutCheckIn | null>(null);
  const [checkInStatusFilter, setCheckInStatusFilter] = useState<'all' | 'submitted' | 'reviewed' | 'needs_revision'>('all');
  const [workouts, setWorkouts] = useState<WorkoutWithRelations[]>([]);
  const [workoutStatusFilter, setWorkoutStatusFilter] = useState<'all' | 'incomplete' | 'needs_review' | 'completed'>('all');
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([]);
  const [selectedConversationUserId, setSelectedConversationUserId] = useState<string | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [dashboardStatsSnapshot, setDashboardStatsSnapshot] = useState<Partial<AdminStats> | null>(null);
  const [recentEnrollmentsSnapshot, setRecentEnrollmentsSnapshot] = useState<AdminProgramEnrollment[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUserPresence>({});
  const [isCreatingCoach, setIsCreatingCoach] = useState(false);
  const [isAssigningUsers, setIsAssigningUsers] = useState(false);
  const [coachCreationResult, setCoachCreationResult] = useState<{ email: string; password: string } | null>(null);
  const [coachManagementError, setCoachManagementError] = useState<string | null>(null);
  const [coachUserAssignments, setCoachUserAssignments] = useState<Record<string, string[]>>({});
  const [discounts, setDiscounts] = useState<Array<{ id: string; title: string; detail: string; code: string }>>([]);
  const [contactMessages, setContactMessages] = useState<ContactSubmission[]>([]);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const adminPresenceKeyRef = useRef(`admin-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    const resolveAdminUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setAdminUserId(user?.id ?? null);
    };
    resolveAdminUser();
  }, []);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      const [
        usersResult,
        enrollmentsResult,
        programsResult,
        dashboardResult,
        checkInsResult,
        workoutsResult,
        messagesResult,
        assignmentsResult,
        contactResult,
        discountsResult,
      ] = await Promise.allSettled([
        adminAPI.getUsers(),
        adminAPI.getEnrollments(),
        adminAPI.getPrograms(),
        adminAPI.getDashboard(),
        adminAPI.getCheckIns(),
        supabase
          .from('workouts')
          .select(`
            *,
            profile:profiles(*),
            program:programs(*),
            checkins:workout_checkins (
              *,
              media:workout_checkin_media (*)
            )
          `)
          .order('day_number', { ascending: false })
          .limit(250),
        supabase
          .from('coach_messages')
          .select(`
            *,
            sender:profiles!coach_messages_sender_id_fkey(*),
            receiver:profiles!coach_messages_receiver_id_fkey(*)
          `)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase.from('coach_user_assignments').select('coach_id, user_id'),
        supabase
          .from('contact')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(250),
        supabase
          .from('discounts')
          .select('*')
          .order('created_at', { ascending: false }),
      ]);

      if (usersResult.status === 'fulfilled') {
        const payload = usersResult.value as any;
        if (Array.isArray(payload)) {
          setUsers(normalizeAdminUsers(payload as AdminUserProfile[]));
        } else if (payload?.data && Array.isArray(payload.data)) {
          setUsers(normalizeAdminUsers(payload.data as AdminUserProfile[]));
        } else {
          console.error('Unexpected admin users payload:', payload);
          setUsers([]);
        }
      } else {
        console.error('Error fetching users:', usersResult.reason);
        setUsers([]);
      }

      if (enrollmentsResult.status === 'fulfilled') {
        const payload = enrollmentsResult.value as any;
        if (Array.isArray(payload)) {
          setEnrollments(normalizeAdminEnrollments(payload as AdminProgramEnrollment[]));
        } else if (payload?.data && Array.isArray(payload.data)) {
          setEnrollments(normalizeAdminEnrollments(payload.data as AdminProgramEnrollment[]));
        } else {
          console.error('Unexpected admin enrollments payload:', payload);
          setEnrollments([]);
        }
      } else {
        console.error('Error fetching enrollments:', enrollmentsResult.reason);
        setEnrollments([]);
      }

      if (programsResult.status === 'fulfilled') {
        const payload = programsResult.value as any;
        if (Array.isArray(payload)) {
          setPrograms(payload);
        } else if (payload?.data && Array.isArray(payload.data)) {
          setPrograms(payload.data);
        } else {
          setPrograms([]);
        }
      } else {
        console.error('Error fetching programs:', programsResult.reason);
        setPrograms([]);
      }

      if (dashboardResult.status === 'fulfilled') {
        const payload = dashboardResult.value as any;
        if (payload?.stats) {
          setDashboardStatsSnapshot(payload.stats as Partial<AdminStats>);
        } else {
          setDashboardStatsSnapshot(null);
        }
        if (Array.isArray(payload?.recentEnrollments)) {
          setRecentEnrollmentsSnapshot(
            normalizeAdminEnrollments(payload.recentEnrollments as AdminProgramEnrollment[]),
          );
        } else {
          setRecentEnrollmentsSnapshot([]);
        }
      } else {
        console.error('Error fetching dashboard summary:', dashboardResult.reason);
        setDashboardStatsSnapshot(null);
        setRecentEnrollmentsSnapshot([]);
      }

      if (checkInsResult.status === 'fulfilled') {
        const payload = checkInsResult.value as any;
        let nextCheckIns: WorkoutCheckIn[] = [];
        if (Array.isArray(payload)) {
          nextCheckIns = payload as WorkoutCheckIn[];
        } else if (payload?.data && Array.isArray(payload.data)) {
          nextCheckIns = payload.data as WorkoutCheckIn[];
        }

        setCheckIns(nextCheckIns);
      } else {
        console.error('Error fetching check-ins:', checkInsResult.reason);
        setCheckIns([]);
      }

      if (workoutsResult.status === 'fulfilled') {
        const { data, error } = workoutsResult.value as { data: WorkoutWithRelations[] | null; error: any };
        if (error) {
          console.error('Error fetching workouts:', error);
          setWorkouts([]);
        } else {
          setWorkouts(data || []);
        }
      } else {
        console.error('Error fetching workouts:', workoutsResult.reason);
        setWorkouts([]);
      }

      if (messagesResult.status === 'fulfilled') {
        const { data, error } = messagesResult.value as { data: CoachMessage[] | null; error: any };
        if (error) {
          console.error('Error fetching coach messages:', error);
          setCoachMessages([]);
        } else {
          setCoachMessages(data ?? []);
        }
      } else {
        console.error('Error fetching coach messages:', messagesResult.reason);
        setCoachMessages([]);
      }

      if (assignmentsResult.status === 'fulfilled') {
        const rows = (assignmentsResult.value as any)?.data ?? assignmentsResult.value ?? [];
        const next: Record<string, string[]> = {};
        (rows as Array<{ coach_id?: string | null; user_id?: string | null }>).forEach((row) => {
          if (!row.coach_id || !row.user_id) {
            return;
          }
          if (!next[row.coach_id]) {
            next[row.coach_id] = [];
          }
          if (!next[row.coach_id].includes(row.user_id)) {
            next[row.coach_id].push(row.user_id);
          }
        });
        setCoachUserAssignments(next);
      } else {
        console.error('Error fetching coach athlete assignments:', assignmentsResult.reason);
        setCoachUserAssignments({});
      }

      if (contactResult.status === 'fulfilled') {
        const payload = (contactResult.value as any)?.data ?? contactResult.value ?? [];
        const sorted = [...(payload as ContactSubmission[])].sort(
          (first, second) => new Date(second.created_at).getTime() - new Date(first.created_at).getTime(),
        );
        setContactMessages(sorted);
      } else {
        console.error('Error fetching contact messages:', contactResult.reason);
        setContactMessages([]);
      }

      if (discountsResult.status === 'fulfilled') {
        const rows = (discountsResult.value as any)?.data ?? discountsResult.value ?? [];
        setDiscounts(
          (rows as Array<{ id?: string; title?: string; detail?: string; code?: string }>)
            .map((row) => ({
              id: row.id as string,
              title: row.title ?? '',
              detail: row.detail ?? '',
              code: row.code ?? '',
            }))
            .filter((entry) => entry.id),
        );
      } else {
        console.error('Error fetching discounts:', discountsResult.reason);
        setDiscounts([]);
      }
    } catch (error) {
      console.error('Error loading admin dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const mapPresenceState = useCallback((state: Record<string, any>): OnlineUserPresence => {
    const mapped: OnlineUserPresence = {};

    Object.entries(state).forEach(([key, value]) => {
      const metas = Array.isArray(value) ? value : value?.metas;
      if (!Array.isArray(metas) || metas.length === 0) {
        return;
      }

      const latestMeta = metas[metas.length - 1];
      if (!latestMeta || latestMeta.role === 'admin') {
        return;
      }

      const userId = latestMeta.userId || key;
      mapped[userId] = {
        firstName: latestMeta.firstName,
        lastName: latestMeta.lastName,
        lastSeenAt: latestMeta.lastSeenAt,
      };
    });

    return mapped;
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    const channel = supabase.channel(ATHLETE_PRESENCE_CHANNEL, {
      config: {
        presence: {
          key: adminPresenceKeyRef.current,
        },
      },
    });

    presenceChannelRef.current = channel;

    const syncPresence = () => {
      setOnlineUsers(mapPresenceState(channel.presenceState()));
    };

    channel.on('presence', { event: 'sync' }, syncPresence);
    channel.on('presence', { event: 'join' }, syncPresence);
    channel.on('presence', { event: 'leave' }, syncPresence);

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.track({
          userId: adminPresenceKeyRef.current,
          role: 'admin',
          lastSeenAt: new Date().toISOString(),
        });
        syncPresence();
      }
    });

    return () => {
      if (presenceChannelRef.current) {
        presenceChannelRef.current.untrack();
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
    };
  }, [mapPresenceState]);

  const handleViewUserDetails = useCallback(async (user: AdminUserProfile) => {
    setSelectedUser(user);
    setLoadingUserDetails(true);
    try {
      const cached = enrollments.filter((enrollment) => enrollment.user_id === user.id);
      if (cached.length > 0) {
        setUserEnrollments(cached);
        return;
      }

      const payload = await adminAPI.getEnrollments();
      if (Array.isArray(payload)) {
        const normalized = normalizeAdminEnrollments(payload as AdminProgramEnrollment[]);
        setUserEnrollments(normalized.filter((item) => item.user_id === user.id));
      } else if (payload?.data && Array.isArray(payload.data)) {
        const normalized = normalizeAdminEnrollments(payload.data as AdminProgramEnrollment[]);
        setUserEnrollments(normalized.filter((item) => item.user_id === user.id));
      } else {
        setUserEnrollments([]);
      }
    } catch (error) {
      console.error('Error loading user details:', error);
      setUserEnrollments([]);
    } finally {
      setLoadingUserDetails(false);
    }
  }, [enrollments]);

  const handleDeleteUser = useCallback(async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user? This will also delete all their enrollments and data. This action cannot be undone.')) {
      return;
    }

    try {
      const response = await adminAPI.deleteUser(userId);
      if (response?.error) {
        console.error('Error deleting user:', response.error);
        alert(response?.error || 'Error deleting user. Please try again.');
        return;
      }

      if (selectedUser?.id === userId) {
        setSelectedUser(null);
        setUserEnrollments([]);
      }

      await loadDashboardData();
      alert('User deleted successfully');
    } catch (error: any) {
      console.error('Error deleting user:', error);
      alert(error?.message || 'Error deleting user. Please try again.');
    }
  }, [loadDashboardData, selectedUser]);

  const buildInviteFeedback = useCallback((payload: any): string | null => {
    const status = payload?.invite_status;
    if (!status || status === 'skipped') {
      return null;
    }

    switch (status) {
      case 'invite_sent':
        return 'Account invite email sent to the learner.';
      case 'password_reset_sent':
        return 'Existing account detected. Sent a password reset email instead.';
      case 'missing_email':
        return 'No email was found for this profile, so no onboarding email could be delivered.';
      case 'failed':
        return `Unable to send onboarding email: ${payload?.invite_error ?? 'Unknown error'}.`;
      default:
        return null;
    }
  }, []);

  const handleUpdateEnrollmentStatus = useCallback(async (enrollmentId: string, newStatus: string) => {
    try {
      const response = await adminAPI.updateEnrollmentStatus(enrollmentId, newStatus);
      if (response?.error) {
        console.error('Error updating enrollment status:', response.error);
        alert(response.error || 'Error updating enrollment status. Please try again.');
        return;
      }

      if (selectedUser) {
        await handleViewUserDetails(selectedUser);
      }

      await loadDashboardData();
      const feedback = buildInviteFeedback(response);
      const statusMessage = `Enrollment status updated to ${newStatus}`;
      alert(feedback ? `${statusMessage}\n\n${feedback}` : statusMessage);
    } catch (error: any) {
      console.error('Error updating enrollment status:', error);
      alert(error?.message || 'Error updating enrollment status. Please try again.');
    }
  }, [buildInviteFeedback, handleViewUserDetails, loadDashboardData, selectedUser]);

  const deleteEnrollment = useCallback(async (enrollmentId: string) => {
    if (!window.confirm('Are you sure you want to delete this enrollment? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('program_enrollments')
        .delete()
        .eq('id', enrollmentId);

      if (error) {
        console.error('Error deleting enrollment:', error);
        alert('Error deleting enrollment. Please try again.');
        return;
      }

      if (selectedUser) {
        await handleViewUserDetails(selectedUser);
      }

      await loadDashboardData();
      alert('Enrollment deleted successfully');
    } catch (error: any) {
      console.error('Error deleting enrollment:', error);
      alert(error?.message || 'Unexpected error deleting enrollment');
    }
  }, [handleViewUserDetails, loadDashboardData, selectedUser]);

  const handleDeleteEnrollment = deleteEnrollment;

  const handleCreateProgram = useCallback(async (programData: any) => {
    try {
      const response = await adminAPI.createProgram(programData);
      if (response?.error) {
        console.error('Error creating program:', response.error);
        alert(response.error || 'Unable to create program. Please try again.');
        return null;
      }

      await loadDashboardData();
      return response;
    } catch (error: any) {
      console.error('Unexpected error creating program:', error);
      alert(error?.message || 'Unable to create program. Please try again.');
      return null;
    }
  }, [loadDashboardData]);

  const handleUpdateProgram = useCallback(async (programId: string, programData: any) => {
    try {
      const response = await adminAPI.updateProgram(programId, programData);
      if (response?.error) {
        console.error('Error updating program:', response.error);
        alert(response.error || 'Unable to update program. Please try again.');
        return null;
      }

      await loadDashboardData();
      return response;
    } catch (error: any) {
      console.error('Unexpected error updating program:', error);
      alert(error?.message || 'Unable to update program. Please try again.');
      return null;
    }
  }, [loadDashboardData]);

  const handleDeleteProgram = useCallback(async (programId: string) => {
    if (!window.confirm('Delete this program? This cannot be undone.')) {
      return false;
    }

    try {
      const response = await adminAPI.deleteProgram(programId);
      if (response?.error) {
        console.error('Error deleting program:', response.error);
        alert(response.error || 'Unable to delete program. Please try again.');
        return false;
      }

      await loadDashboardData();
      alert('Program deleted successfully.');
      return true;
    } catch (error: any) {
      console.error('Unexpected error deleting program:', error);
      alert(error?.message || 'Unable to delete program. Please try again.');
      return false;
    }
  }, [loadDashboardData]);

  const approveEnrollment = useCallback(async (enrollmentId: string) => {
    try {
      const response = await adminAPI.updateEnrollmentStatus(enrollmentId, 'active');
      if (response?.error) {
        alert(response.error || 'Approval failed');
        return;
      }

      await loadDashboardData();
      const feedback = buildInviteFeedback(response);
      alert(
        feedback
          ? `Enrollment approved!\n\n${feedback}`
          : 'Enrollment approved!',
      );
    } catch (error: any) {
      console.error('Error approving enrollment:', error);
      alert(error?.message || 'Approval failed');
    }
  }, [buildInviteFeedback, loadDashboardData]);

  const refreshCoachInbox = useCallback(async () => {
    if (!adminUserId) {
      return;
    }
    const messages = await getCoachMessages(adminUserId);
    setCoachMessages(messages);
  }, [adminUserId]);

  const handleSendCoachMessage = useCallback(
    async (athleteId: string, message: string) => {
      if (!adminUserId || !message.trim()) {
        return { success: false as const, error: 'Missing sender or message.' };
      }
      setIsSendingMessage(true);
      try {
        const result = await sendCoachMessage(adminUserId, athleteId, {
          senderRole: 'coach',
          message: message.trim(),
        });
        if (!result) {
          return { success: false as const, error: 'Unable to send message.' };
        }
        setCoachMessages((previous) => [result, ...previous]);
        return { success: true as const, message: result };
      } catch (error) {
        console.error('Error sending coach message:', error);
        return { success: false as const, error };
      } finally {
        setIsSendingMessage(false);
      }
    },
    [adminUserId],
  );

  const handleMarkCoachMessageRead = useCallback(async (messageId: string) => {
    await markCoachMessageRead(messageId);
    setCoachMessages((previous) =>
      previous.map((entry) => (entry.id === messageId ? { ...entry, is_read: true, read_at: new Date().toISOString() } : entry)),
    );
  }, []);

  const levelLabelMap: Record<string, string> = {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
    all_levels: 'All Levels',
  };

  const programTypeLabelMap: Record<string, string> = {
    powerlifting: 'Powerlifting',
    olympic_weightlifting: 'Olympic Weightlifting',
    general_fitness: 'General Fitness',
    mobility: 'Mobility',
    competition_prep: 'Competition Prep',
  };

  const formatLevelLabel = (level?: string) => levelLabelMap[level ?? ''] ?? 'All Levels';
  const formatGoalLabel = (type?: string) => programTypeLabelMap[type ?? ''] ?? 'Strength Training';
  const formatDurationLabel = (program: any) =>
    program?.duration_weeks ? `${program.duration_weeks} weeks` : 'Flexible schedule';
  const formatPriceLabel = (program: any) => {
    const priceValue = program?.price;
    if (priceValue === null || priceValue === undefined || priceValue === '') {
      return 'Contact us';
    }
    const numericPrice = typeof priceValue === 'number' ? priceValue : Number(priceValue);
    const formatted =
      Number.isFinite(numericPrice) && numericPrice > 0
        ? numericPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })
        : 'Included';
    const currency = program?.currency || 'TND';
    return `${formatted} ${currency}`.trim();
  };
  const truncate = (value: string, max = 140) => {
    if (!value) return '';
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
  };

  const fallbackProgramSlots = useMemo(
    () => [
      {
        title: 'Strength Foundations',
        description: 'A balanced starter plan to build technique, muscle, and confidence under the bar.',
        program_type: 'general_fitness',
        level: 'all_levels',
        duration_weeks: 6,
        price: 'Included',
        currency: 'TND',
      },
      {
        title: 'Powerlifting Total Builder',
        description: 'Squat, bench, and deadlift focus with progressive overload and accessories that matter.',
        program_type: 'powerlifting',
        level: 'intermediate',
        duration_weeks: 8,
        price: 'Included',
        currency: 'TND',
      },
      {
        title: 'Competition Peak Cycle',
        description: 'Meet prep structure with taper, attempts strategy, and technical checkpoints.',
        program_type: 'competition_prep',
        level: 'advanced',
        duration_weeks: 6,
        price: 'Included',
        currency: 'TND',
      },
    ],
    [],
  );

  const buildAccessEmailTemplate = useCallback(
    (user?: AdminUserProfile | null) => {
      const firstNameFallback =
        user?.first_name?.trim() ||
        user?.email?.split('@')?.[0]?.trim() ||
        'there';

      const programSlots = [...(programs ?? [])].slice(0, 3);
      while (programSlots.length < 3) {
        programSlots.push(fallbackProgramSlots[programSlots.length]);
      }

      const programRows = programSlots
        .map((program, index) => {
          const safeProgram = program ?? fallbackProgramSlots[index] ?? fallbackProgramSlots[0];
          const description = truncate(
            safeProgram.subtitle || safeProgram.description || 'A tailored program built by Elyes Zerai.',
            180,
          );
          return `
                  <tr>
                    <td style="padding:12px 8px; border-bottom:1px solid #e5e7eb;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="vertical-align:top; padding-right:8px;">
                            <h3 style="margin:0 0 4px; font-size:16px; color:#111827;">
                              ${safeProgram.title || `Program ${index + 1}`}
                            </h3>
                            <p style="margin:0 0 6px; font-size:13px; color:#4b5563;">
                              ${description}
                            </p>
                            <p style="margin:0; font-size:12px; color:#6b7280;">
                              <strong>Goal:</strong> ${formatGoalLabel(safeProgram.program_type)} &nbsp;•&nbsp;
                              <strong>Level:</strong> ${formatLevelLabel(safeProgram.level)} &nbsp;•&nbsp;
                              <strong>Duration:</strong> ${formatDurationLabel(safeProgram)}
                            </p>
                          </td>
                          <td align="right" style="vertical-align:middle; white-space:nowrap;">
                            <p style="margin:0 0 6px; font-size:14px; color:#111827; font-weight:bold;">
                              ${formatPriceLabel(safeProgram)}
                            </p>
                            <a href="https://elyesliftacademy.com/?page=programs"
                               style="display:inline-block; padding:6px 12px; border-radius:999px; font-size:12px; text-decoration:none; background-color:#0f172a; color:#f9fafb;">
                              See details
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>`;
        })
        .join('');

      const html = `<!DOCTYPE html>
<html lang="en" style="margin:0; padding:0;">
  <head>
    <meta charset="UTF-8" />
    <title>Elyes Lift Academy – Programs</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin:0; padding:0; background-color:#f3f4f6;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6; padding:20px 0;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:100%; background-color:#ffffff; border-radius:8px; overflow:hidden; font-family:Arial, Helvetica, sans-serif;">
            <tr>
              <td align="center" style="background-color:#0f172a; padding:24px 16px;">
                <h1 style="margin:0; font-size:24px; line-height:1.3; color:#f9fafb;">
                  Elyes Lift Academy
                </h1>
                <p style="margin:8px 0 0; font-size:14px; color:#e5e7eb;">
                  Elite Strength & Powerlifting Coaching
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 24px 8px; color:#111827; font-size:16px; line-height:1.5;">
                <p style="margin:0 0 12px;">
                  Hi <strong>${firstNameFallback}</strong>,
                </p>
                <p style="margin:0 0 12px;">
                  Welcome to <strong>Elyes Lift Academy</strong> – you’ve successfully created your account and you’re one step closer to your next PR.
                </p>
                <p style="margin:0 0 12px;">
                  To unlock your full experience on the platform, choose one of our coaching programs below and start your personalized strength journey today.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 24px 24px;">
                <a href="https://elyesliftacademy.com/?page=programs"
                   style="display:inline-block; background-color:#22c55e; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:999px; font-size:15px; font-weight:bold;">
                  View All Programs
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 8px;">
                <h2 style="margin:0; font-size:20px; color:#111827;">
                  Program Catalog
                </h2>
                <p style="margin:8px 0 0; font-size:14px; color:#4b5563;">
                  Choose the program that matches your goals and experience level.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 16px 24px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                  ${programRows}
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 24px 24px;">
                <p style="margin:0 0 8px; font-size:14px; color:#4b5563;">
                  Not sure which program fits you best?
                </p>
                <a href="https://elyesliftacademy.com/?page=programs"
                   style="display:inline-block; background-color:#22c55e; color:#ffffff; text-decoration:none; padding:10px 22px; border-radius:999px; font-size:14px; font-weight:bold;">
                  Compare programs
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px 24px; background-color:#f9fafb; font-size:11px; color:#6b7280; text-align:center;">
                <p style="margin:0 0 4px;">
                  You’re receiving this email because you created an account on Elyes Lift Academy.
                </p>
                <p style="margin:0;">
                  © Elyes Lift Academy – All rights reserved.
                </p>
                <p style="margin:8px 0 0;">
                  <a href="https://elyesliftacademy.com/unsubscribe" style="color:#9ca3af; text-decoration:underline;">
                    Unsubscribe
                  </a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

      return {
        subject: 'Elyes Lift Academy – Programs',
        html,
      };
    },
    [fallbackProgramSlots, programs],
  );

  const handleSendAccountAccessEmail = useCallback(async (userId: string) => {
    try {
      const targetUser = users.find((entry) => entry.id === userId) ?? null;
      const emailPayload = buildAccessEmailTemplate(targetUser);
      if (!emailPayload) {
        alert('Unable to build email content. Please try again.');
        return;
      }

      const result = await adminAPI.sendBroadcast(
        emailPayload.subject,
        emailPayload.html,
        'program_update',
        [userId],
      );

      if (result?.error) {
        alert(result.error ?? 'Unable to send onboarding email. Please try again.');
        return;
      }

      alert('Email sent.');
    } catch (error: any) {
      console.error('Error sending account access email:', error);
      alert(error?.message ?? 'Unable to send onboarding email. Please try again.');
    }
  }, [buildAccessEmailTemplate, users]);

  const handleSignOut = useCallback(async () => {
    if (presenceChannelRef.current) {
      presenceChannelRef.current.untrack();
      supabase.removeChannel(presenceChannelRef.current);
      presenceChannelRef.current = null;
    }
    await supabase.auth.signOut();
    onNavigateBack();
  }, [onNavigateBack]);

  const handleReviewCheckIn = useCallback(
    async (checkInId: string, status: 'reviewed' | 'needs_revision', coachNotes?: string) => {
      try {
        const updated = await adminAPI.updateCheckIn(checkInId, { status, coach_notes: coachNotes });
        if (updated?.id) {
          setCheckIns((previous) =>
            previous.map((checkIn) => (checkIn.id === updated.id ? updated : checkIn))
          );
          if (selectedCheckIn?.id === updated.id) {
            setSelectedCheckIn(updated);
          }
        }
      } catch (error) {
        console.error('Error updating check-in status:', error);
        alert('Unable to update check-in status. Please try again.');
      }
    },
    [selectedCheckIn],
  );

  const coachUsers = useMemo(
    () => users.filter((user) => user.role === 'coach' || user.role === 'admin'),
    [users],
  );

  const createCoachUser = useCallback(
    async (input: CreateCoachUserInput) => {
      setCoachManagementError(null);
      setCoachCreationResult(null);
      setIsCreatingCoach(true);

      const password = generateRandomPassword(18);

      try {
        const response = await adminAPI.createCoach({
          email: input.email,
          password,
          first_name: input.firstName,
          last_name: input.lastName,
          phone: input.phone,
        });

        if (response?.error) {
          throw new Error(
            typeof response.error === 'string'
              ? response.error
              : 'Unable to create coach account.',
          );
        }

        await loadDashboardData();
        setCoachCreationResult({ email: input.email, password });

        return { success: true as const, password, response };
      } catch (error: any) {
        const message = error?.message ?? 'Unable to create coach account. Please try again.';
        setCoachManagementError(message);
        return { success: false as const, error: message };
      } finally {
        setIsCreatingCoach(false);
      }
    },
    [loadDashboardData],
  );

  const assignUsersToCoach = useCallback(
    async (coachId: string, userIds: string[]) => {
      setCoachManagementError(null);
      setIsAssigningUsers(true);
      try {
        const response = await adminAPI.assignCoachUsers(coachId, userIds);
        if (response?.error) {
          throw new Error(
            typeof response.error === 'string'
              ? response.error
              : 'Unable to assign athletes to coach.',
          );
        }

        await loadDashboardData();
        return { success: true as const, response };
      } catch (error: any) {
        const message = error?.message ?? 'Unable to assign athletes to coach. Please try again.';
        setCoachManagementError(message);
        return { success: false as const, error: message };
      } finally {
        setIsAssigningUsers(false);
      }
    },
    [loadDashboardData],
  );

  const clearCoachManagementStatus = useCallback((options?: { clearResult?: boolean }) => {
    setCoachManagementError(null);
    if (options?.clearResult) {
      setCoachCreationResult(null);
    }
  }, []);

  const saveDiscount = useCallback(
    async (payload: { id?: string | null; title: string; detail: string; code: string }) => {
      const body = {
        title: payload.title.trim(),
        detail: payload.detail.trim(),
        code: payload.code.trim(),
        updated_at: new Date().toISOString(),
      };
      if (!body.title || !body.detail || !body.code) {
        return { success: false as const, error: 'All fields are required.' };
      }
      try {
        const { data, error } = await supabase
          .from('discounts')
          .upsert(
            payload.id
              ? { ...body, id: payload.id }
              : { ...body, created_at: new Date().toISOString() },
            { onConflict: 'id' },
          )
          .select('*')
          .single();
        if (error) throw error;
        if (data) {
          setDiscounts((prev) => {
            const filtered = prev.filter((entry) => entry.id !== data.id);
            return [{ id: data.id, title: data.title, detail: data.detail, code: data.code }, ...filtered];
          });
        }
        return { success: true as const };
      } catch (err: any) {
        console.error('Error saving discount:', err);
        return { success: false as const, error: err?.message ?? 'Unable to save discount.' };
      }
    },
    [],
  );

  const deleteDiscount = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('discounts').delete().eq('id', id);
      if (error) throw error;
      setDiscounts((prev) => prev.filter((entry) => entry.id !== id));
      return { success: true as const };
    } catch (err: any) {
      console.error('Error deleting discount:', err);
      return { success: false as const, error: err?.message ?? 'Unable to delete discount.' };
    }
  }, []);

  const filteredUsers = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();
    return users.filter((user) => {
      const matchesSearch =
        !lowerSearch ||
        user.email.toLowerCase().includes(lowerSearch) ||
        `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase().includes(lowerSearch);
      const matchesFilter = filterStatus === 'all' || user.role === filterStatus;
      return matchesSearch && matchesFilter;
    });
  }, [filterStatus, searchTerm, users]);

  const filteredEnrollments = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();
    return enrollments.filter((enrollment) => {
      const matchesSearch =
        !lowerSearch ||
        enrollment.profile?.email?.toLowerCase().includes(lowerSearch) ||
        enrollment.lead_email?.toLowerCase().includes(lowerSearch) ||
        `${enrollment.profile?.first_name || ''} ${enrollment.profile?.last_name || ''}`.toLowerCase().includes(lowerSearch) ||
        `${enrollment.lead_first_name || ''} ${enrollment.lead_last_name || ''}`.toLowerCase().includes(lowerSearch) ||
        enrollment.program?.title?.toLowerCase().includes(lowerSearch);
      const matchesFilter = filterStatus === 'all' || enrollment.status === filterStatus;
      return matchesSearch && matchesFilter;
    });
  }, [enrollments, filterStatus, searchTerm]);

  const filteredCheckIns = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();
    return checkIns.filter((checkIn) => {
      const matchesStatus = checkInStatusFilter === 'all' || checkIn.status === checkInStatusFilter;
      const matchesSearch =
        !lowerSearch ||
        checkIn.profile?.email?.toLowerCase().includes(lowerSearch) ||
        `${checkIn.profile?.first_name || ''} ${checkIn.profile?.last_name || ''}`.toLowerCase().includes(lowerSearch) ||
        checkIn.workout?.title?.toLowerCase().includes(lowerSearch);
      return matchesStatus && matchesSearch;
    });
  }, [checkInStatusFilter, checkIns, searchTerm]);

  const filteredWorkouts = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();
    return workouts.filter((workout) => {
      const matchesSearch =
        !lowerSearch ||
        workout.title.toLowerCase().includes(lowerSearch) ||
        workout.profile?.email?.toLowerCase().includes(lowerSearch) ||
        `${workout.profile?.first_name || ''} ${workout.profile?.last_name || ''}`.toLowerCase().includes(lowerSearch);

      const latestCheckIn = workout.checkins?.[0];
      const matchesStatus =
        workoutStatusFilter === 'all' ||
        (workoutStatusFilter === 'completed' && workout.is_completed) ||
        (workoutStatusFilter === 'needs_review' && latestCheckIn?.status === 'needs_revision') ||
        (workoutStatusFilter === 'incomplete' && !latestCheckIn && !workout.is_completed);

      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, workoutStatusFilter, workouts]);

  const recentCheckIns = useMemo(() => checkIns.slice(0, 5), [checkIns]);

  const localStats = useMemo(
    () => ({
      totalUsers: users.length,
      totalEnrollments: enrollments.length,
      totalRevenue: enrollments
        .filter((enrollment) => enrollment.status === 'active')
        .reduce((sum, enrollment) => sum + (enrollment.program?.price || 0), 0),
      activePrograms: programs.filter((program) => program.is_active).length,
      totalCheckIns: checkIns.length,
      pendingCheckIns: checkIns.filter((checkIn) => checkIn.status !== 'reviewed').length,
      totalWorkouts: workouts.length,
    }),
    [checkIns, enrollments, programs, users.length, workouts.length],
  );

  const stats: AdminStats = useMemo(
    () => ({
      totalUsers: dashboardStatsSnapshot?.totalUsers ?? localStats.totalUsers,
      totalEnrollments: dashboardStatsSnapshot?.totalEnrollments ?? localStats.totalEnrollments,
      totalRevenue: dashboardStatsSnapshot?.totalRevenue ?? localStats.totalRevenue,
      activePrograms: dashboardStatsSnapshot?.activePrograms ?? localStats.activePrograms,
      totalCheckIns: dashboardStatsSnapshot?.totalCheckIns ?? localStats.totalCheckIns,
      pendingCheckIns: dashboardStatsSnapshot?.pendingCheckIns ?? localStats.pendingCheckIns,
      totalWorkouts: dashboardStatsSnapshot?.totalWorkouts ?? localStats.totalWorkouts,
    }),
    [dashboardStatsSnapshot, localStats],
  );

  const recentEnrollments = useMemo(() => {
    if (recentEnrollmentsSnapshot.length > 0) {
      return recentEnrollmentsSnapshot;
    }
    return enrollments.slice(0, 5);
  }, [recentEnrollmentsSnapshot, enrollments]);

  return {
    activeTab,
    setActiveTab,
    users,
    enrollments,
    programs,
    loading,
    searchTerm,
    setSearchTerm,
    filterStatus,
    setFilterStatus,
    selectedEnrollment,
    setSelectedEnrollment,
    selectedUser,
    setSelectedUser,
    userEnrollments,
    loadingUserDetails,
    handleViewUserDetails,
    handleDeleteUser,
    handleUpdateEnrollmentStatus,
    handleDeleteEnrollment,
    deleteEnrollment,
    approveEnrollment,
    handleSendAccountAccessEmail,
    handleCreateProgram,
    handleUpdateProgram,
    handleDeleteProgram,
    handleSignOut,
    filteredUsers,
    filteredEnrollments,
    checkIns,
    filteredCheckIns,
    selectedCheckIn,
    setSelectedCheckIn,
    checkInStatusFilter,
    setCheckInStatusFilter,
    handleReviewCheckIn,
    recentCheckIns,
    workouts,
    filteredWorkouts,
    workoutStatusFilter,
    setWorkoutStatusFilter,
    stats,
    recentEnrollments,
    reload: loadDashboardData,
    onlineUsers,
    coachMessages,
    selectedConversationUserId,
    setSelectedConversationUserId,
    refreshCoachInbox,
    handleSendCoachMessage,
    handleMarkCoachMessageRead,
    isSendingMessage,
    adminUserId,
    coachUsers,
    createCoachUser,
    assignUsersToCoach,
    isCreatingCoach,
    isAssigningUsers,
    coachCreationResult,
    coachManagementError,
    clearCoachManagementStatus,
    coachUserAssignments,
    discounts,
    saveDiscount,
    deleteDiscount,
    contactMessages,
  };
};

export type UseAdminDashboardReturn = ReturnType<typeof useAdminDashboard>;
