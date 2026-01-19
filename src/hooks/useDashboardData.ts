import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  supabase,
  getCurrentUser,
  getUserWorkouts,
  getUserNotifications,
  getWorkoutCheckIns,
  submitWorkoutCheckIn,
  getUserSettings,
  resolveProfileAvatar,
  getCoachMessages,
  sendCoachMessage,
  markCoachMessageRead,
  getWeeklyGoalsForUser,
  getProgramRatingsForUser,
  upsertProgramRating,
  supabase,
} from '../lib/supabase';
import type {
  Profile,
  ProgramEnrollment,
  WorkoutWithRelations,
  WorkoutCheckIn,
  Notification,
  StrengthAssessment,
  SubmitWorkoutCheckInPayload,
  CoachMessage,
  WeeklyGoal,
} from '../lib/supabase';
import type { PrivacySettings } from '../types/settings';

const addWeeks = (date: Date, weeks: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + weeks * 7);
  return copy;
};

export interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: 'workout' | 'milestone' | 'assessment';
  status: 'pending' | 'active' | 'completed';
  programId?: string;
  workoutId?: string;
  description?: string;
  duration?: number;
}

export interface UserStats {
  totalWorkouts: number;
  completedWorkouts: number;
  currentStreak: number;
  totalPrograms: number;
  unreadNotifications: number;
}

export interface PersonalRecord {
  exercise: string;
  weight: number;
  date: string;
  unit: string;
}

interface UseDashboardDataArgs {
  onNavigateHome: () => void;
}

type SubmitCheckInArgs = Omit<SubmitWorkoutCheckInPayload, 'userId'>;

const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  showOnlineStatus: true,
  dataSharing: false,
};

const ATHLETE_PRESENCE_CHANNEL = 'presence:athletes';

export const useDashboardData = ({ onNavigateHome }: UseDashboardDataArgs) => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [enrollments, setEnrollments] = useState<ProgramEnrollment[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutWithRelations[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [assessments, setAssessments] = useState<StrengthAssessment[]>([]);
  const [checkIns, setCheckIns] = useState<WorkoutCheckIn[]>([]);
  const [stats, setStats] = useState<UserStats>({
    totalWorkouts: 0,
    completedWorkouts: 0,
    currentStreak: 0,
    totalPrograms: 0,
    unreadNotifications: 0,
  });
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'log-workout' | 'progress' | 'program-calendar' | 'message-coach'>('overview');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<'monthly' | 'weekly'>('monthly');
  const [weeklyWorkouts, setWeeklyWorkouts] = useState<WorkoutWithRelations[]>([]);
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutWithRelations | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [isSubmittingCheckIn, setIsSubmittingCheckIn] = useState(false);
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(null);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [accessibleProgramIds, setAccessibleProgramIds] = useState<string[]>([]);
  const workoutsRef = useRef<WorkoutWithRelations[]>([]);
  const [coachContacts, setCoachContacts] = useState<Profile[]>([]);
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([]);
  const [primaryCoachId, setPrimaryCoachId] = useState<string | null>(null);
  const [isSendingCoachMessage, setIsSendingCoachMessage] = useState(false);
  const selectedDateRef = useRef<Date>(selectedDate);
  const [weeklyGoals, setWeeklyGoals] = useState<WeeklyGoal[]>([]);
  const [programRatings, setProgramRatings] = useState<Record<string, number>>({});

  const TRAINING_DAYS_PER_WEEK = 6;

  const parseDateValue = useCallback((value?: string | Date | null): Date | null => {
    if (!value) {
      return null;
    }

    const normalize = (input: Date) => new Date(input.getFullYear(), input.getMonth(), input.getDate());

    if (value instanceof Date) {
      return normalize(value);
    }

    const stringValue = value.toString().trim();
    const match = stringValue.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (match) {
      const [, yearStr, monthStr, dayStr] = match;
      const year = Number(yearStr);
      const month = Number(monthStr);
      const day = Number(dayStr);
      if ([year, month, day].every((segment) => Number.isFinite(segment))) {
        return new Date(year, month - 1, day);
      }
    }

    const timestamp = Date.parse(stringValue);
    if (Number.isNaN(timestamp)) {
      return null;
    }

    return normalize(new Date(timestamp));
  }, []);

  const alignToMonday = useCallback((date?: Date | null) => {
    if (!date) {
      return null;
    }
    const aligned = new Date(date);
    aligned.setHours(0, 0, 0, 0);
    const day = aligned.getDay();
    if (day === 1) {
      return aligned;
    }
    const offset = day === 0 ? 1 : 8 - day;
    aligned.setDate(aligned.getDate() + offset);
    return aligned;
  }, []);

  const getWeekStartSunday = useCallback((date?: Date | null) => {
    const target = date ? new Date(date) : new Date();
    target.setHours(0, 0, 0, 0);
    const day = target.getDay();
    const sunday = new Date(target);
    sunday.setDate(target.getDate() - day);
    sunday.setHours(0, 0, 0, 0);
    return sunday;
  }, []);

  const computeScheduledDate = useCallback(
    (start: Date | null, dayNumber?: number | null) => {
      if (!start || !dayNumber || dayNumber <= 0) {
        return null;
      }
      const index = dayNumber - 1;
      const weeksOffset = Math.floor(index / TRAINING_DAYS_PER_WEEK);
      const dayOffset = index % TRAINING_DAYS_PER_WEEK;
      const scheduled = new Date(start);
      scheduled.setDate(start.getDate() + weeksOffset * 7 + dayOffset);
      scheduled.setHours(0, 0, 0, 0);
      return scheduled;
    },
    [TRAINING_DAYS_PER_WEEK],
  );

  const attachWorkoutsToCheckIns = useCallback(
    (entries: WorkoutCheckIn[], workoutsList: WorkoutWithRelations[]) => {
      if (!entries.length) {
        return entries;
      }
      const workoutMap = new Map<string, WorkoutWithRelations>();
      workoutsList.forEach((workout) => {
        workoutMap.set(workout.id, workout);
      });
      return entries.map((checkIn) => {
        const scheduledWorkout = workoutMap.get(checkIn.workout_id);
        if (!scheduledWorkout) {
          return checkIn;
        }
        return {
          ...checkIn,
          workout: scheduledWorkout,
        };
      });
    },
    [],
  );

  const resolveScheduledDate = useCallback(
    (workout: WorkoutWithRelations) =>
      workout.scheduledDateObject ?? parseDateValue(workout.scheduled_date ?? null),
    [parseDateValue],
  );

  const formatDateOnly = useCallback((date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const getDateKey = useCallback(
    (value?: string | Date | null) => {
      const parsed = parseDateValue(value);
      return parsed ? formatDateOnly(parsed) : null;
    },
    [formatDateOnly, parseDateValue],
  );

  const deriveProgramSchedule = useCallback(
    (enrollment: ProgramEnrollment) => {
      const rawStart =
        parseDateValue(enrollment.start_date) ??
        parseDateValue((enrollment as any).enrolled_at) ??
        parseDateValue(enrollment.created_at) ??
        null;
      const start = alignToMonday(rawStart ?? new Date());
      const explicitEnd = parseDateValue(enrollment.end_date);
      const durationWeeks = enrollment.program?.duration_weeks;
      let computedEnd = explicitEnd;

      if (!computedEnd && start && typeof durationWeeks === 'number' && Number.isFinite(durationWeeks)) {
        const end = new Date(start);
        end.setDate(start.getDate() + durationWeeks * 7 - 1);
        computedEnd = end;
      }

      const totalDays =
        typeof durationWeeks === 'number' && Number.isFinite(durationWeeks)
          ? durationWeeks * TRAINING_DAYS_PER_WEEK
          : undefined;

      return {
        start,
        end: computedEnd,
        totalDays,
      };
    },
    [TRAINING_DAYS_PER_WEEK, alignToMonday, parseDateValue],
  );

  const adjustWorkoutsForEnrollments = useCallback(
    ({
      workouts: rawWorkouts,
      enrollmentList,
      userId,
      dateRange,
    }: {
      workouts: WorkoutWithRelations[];
      enrollmentList: ProgramEnrollment[];
      userId?: string | null;
      dateRange?: { start: Date; end: Date };
    }): WorkoutWithRelations[] => {
      if (!rawWorkouts.length) {
        return [];
      }

      const scheduleByProgram = new Map<
        string,
        { start: Date | null; end: Date | null; totalDays?: number }
      >();

      enrollmentList
        .filter((enrollment) => enrollment.status === 'active' && enrollment.program_id)
        .forEach((enrollment) => {
          const schedule = deriveProgramSchedule(enrollment);
          if (schedule.start) {
            scheduleByProgram.set(enrollment.program_id as string, schedule);
          }
        });

      const userFallbackStart = new Map<string, Date | null>();

      const scheduled = rawWorkouts.reduce<WorkoutWithRelations[]>((acc, workout) => {
        const directDate =
          parseDateValue((workout as any).scheduledDateObject ?? null) ??
          parseDateValue((workout as any).scheduled_date ?? null);

        if (directDate) {
          if (!dateRange || (directDate >= dateRange.start && directDate <= dateRange.end)) {
            acc.push({
              ...workout,
              scheduled_date: formatDateOnly(directDate),
              scheduledDateObject: directDate,
              checkins: (workout.checkins ?? []).filter((checkIn) => checkIn.user_id === userId),
              is_template: workout.user_id ? workout.is_template : true,
            });
          }
          return acc;
        }

        const programId = workout.program_id ?? undefined;
        const schedule = programId ? scheduleByProgram.get(programId) : undefined;

        if (programId && !schedule) {
          return acc;
        }

        let startDate: Date | null = schedule?.start ?? null;

        if (!startDate && workout.user_id) {
          if (!userFallbackStart.has(workout.user_id)) {
            const fallback =
              parseDateValue((workout as any).created_at) ??
              parseDateValue((workout as any).updated_at) ??
              new Date();
            userFallbackStart.set(workout.user_id, alignToMonday(fallback));
          }
          startDate = userFallbackStart.get(workout.user_id) ?? null;
        }

        if (!startDate) {
          return acc;
        }

        if (schedule?.totalDays && workout.day_number > schedule.totalDays) {
          return acc;
        }

        const scheduledDate = computeScheduledDate(startDate, workout.day_number);
        if (!scheduledDate) {
          return acc;
        }

        if (schedule?.end && scheduledDate > schedule.end) {
          return acc;
        }

        if (dateRange && (scheduledDate < dateRange.start || scheduledDate > dateRange.end)) {
          return acc;
        }

        const scheduledDateString = formatDateOnly(scheduledDate);

        acc.push({
          ...workout,
          scheduled_date: scheduledDateString,
          scheduledDateObject: scheduledDate,
          checkins: (workout.checkins ?? []).filter((checkIn) => checkIn.user_id === userId),
          is_template: workout.user_id ? workout.is_template : true,
        });
        return acc;
      }, []);

      return scheduled.sort((a, b) => {
        const aTime = a.scheduledDateObject?.getTime() ?? 0;
        const bTime = b.scheduledDateObject?.getTime() ?? 0;
        return bTime - aTime;
      });
    },
    [alignToMonday, computeScheduledDate, deriveProgramSchedule, formatDateOnly, parseDateValue],
  );


  const teardownPresenceChannel = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }

    if (presenceChannelRef.current) {
      presenceChannelRef.current.untrack();
      supabase.removeChannel(presenceChannelRef.current);
      presenceChannelRef.current = null;
    }

    setIsOnline(false);
    setLastOnlineAt(null);
  }, []);

  const calculateStreak = useCallback(
    (allWorkouts: WorkoutWithRelations[]): number => {
      const completed = allWorkouts
        .map((workout) => {
          const checkIns = workout.checkins ?? [];
          let latestCheckInDate: Date | null = null;

          for (const entry of checkIns) {
            if (!entry?.created_at) {
              continue;
            }
            const parsed = new Date(entry.created_at);
            if (Number.isNaN(parsed.getTime())) {
              continue;
            }
            if (!latestCheckInDate || parsed.getTime() > latestCheckInDate.getTime()) {
              latestCheckInDate = parsed;
            }
          }

          const fallbackDate = resolveScheduledDate(workout);
          const completionDate = latestCheckInDate ?? fallbackDate;
          const isCompleted = workout.is_completed || Boolean(latestCheckInDate);

          if (!isCompleted || !completionDate) {
            return null;
          }

          return { workout, date: completionDate };
        })
        .filter((entry): entry is { workout: WorkoutWithRelations; date: Date } => Boolean(entry))
        .sort((a, b) => b.date.getTime() - a.date.getTime());

      let streak = 0;
      let currentDate = new Date();

      for (const entry of completed) {
        const workoutDate = entry.date;
        const daysDiff = Math.floor((currentDate.getTime() - workoutDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff <= 1) {
          streak += 1;
          currentDate = workoutDate;
        } else {
          break;
        }
      }

      return streak;
    },
    [resolveScheduledDate],
  );

  const calculatePersonalRecords = useCallback(
    (workoutsList: WorkoutWithRelations[], assessmentsList: StrengthAssessment[]): PersonalRecord[] => {
      const prs: PersonalRecord[] = [];

      if (assessmentsList.length > 0) {
        const latestAssessment = assessmentsList[0];
        if (latestAssessment.squat_max) {
          prs.push({
            exercise: 'Squat',
            weight: latestAssessment.squat_max,
            date: latestAssessment.assessment_date,
            unit: 'kg',
          });
        }
        if (latestAssessment.bench_max) {
          prs.push({
            exercise: 'Bench Press',
            weight: latestAssessment.bench_max,
            date: latestAssessment.assessment_date,
            unit: 'kg',
          });
        }
        if (latestAssessment.deadlift_max) {
          prs.push({
            exercise: 'Deadlift',
            weight: latestAssessment.deadlift_max,
            date: latestAssessment.assessment_date,
            unit: 'kg',
          });
        }
      }

      return prs;
    },
    [],
  );

  const getWeekRange = useCallback((date: Date) => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }, []);

  const computeWeeklySchedule = useCallback(
    (referenceDate: Date, sourceWorkouts?: WorkoutWithRelations[]) => {
      const { start, end } = getWeekRange(referenceDate);
      const dataset = sourceWorkouts ?? workouts;

      const filtered = dataset
        .map((workout) => ({
          workout,
          date: resolveScheduledDate(workout),
        }))
        .filter(
          (entry): entry is { workout: WorkoutWithRelations; date: Date } =>
            Boolean(entry.date) && entry.date >= start && entry.date <= end,
        )
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .map((entry) => entry.workout);

      setWeeklyWorkouts(filtered);
      return filtered;
    },
    [getWeekRange, resolveScheduledDate, workouts],
  );

  const loadCheckIns = useCallback(async (userId: string) => {
    const data = await getWorkoutCheckIns(userId);
    return data;
  }, []);

  const generateCalendarEvents = useCallback((workoutsList: WorkoutWithRelations[], enrollmentList: ProgramEnrollment[]) => {
    const events: CalendarEvent[] = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentWeek = getWeekRange(today);
    const nextWeekAnchor = new Date(currentWeek.end.getTime());
    nextWeekAnchor.setDate(nextWeekAnchor.getDate() + 1);
    nextWeekAnchor.setHours(0, 0, 0, 0);
    const nextWeek = getWeekRange(nextWeekAnchor);

    workoutsList.forEach((workout) => {
      const hasCheckIn = (workout.checkins?.length ?? 0) > 0;
      const latestCheckIn = hasCheckIn ? workout.checkins?.[0] : undefined;
      const derivedStatus: CalendarEvent['status'] =
        workout.is_completed || latestCheckIn?.status === 'reviewed'
          ? 'completed'
          : latestCheckIn?.status === 'needs_revision'
            ? 'pending'
            : hasCheckIn
              ? 'active'
              : workout.status === 'in_review'
                ? 'active'
                : 'pending';

      const eventDate = resolveScheduledDate(workout);
      if (!eventDate) {
        return;
      }

      const normalizedEventDate = new Date(eventDate);
      normalizedEventDate.setHours(0, 0, 0, 0);
      const isFutureWorkout = normalizedEventDate > today;
      if (isFutureWorkout && normalizedEventDate > nextWeek.end) {
        return;
      }

      events.push({
        id: workout.id,
        title: workout.title,
        date: eventDate,
        type: 'workout',
        status: derivedStatus,
        workoutId: workout.id,
        programId: workout.program_id || undefined,
        description:
          latestCheckIn
            ? `Latest check-in: ${latestCheckIn.status.replace('_', ' ')}`
            : workout.description || undefined,
        duration: workout.duration_minutes || undefined,
      });
    });

    enrollmentList.forEach((enrollment) => {
      const startDate = parseDateValue(enrollment.start_date);
      if (startDate) {
        const normalizedStart = new Date(startDate);
        normalizedStart.setHours(0, 0, 0, 0);
        events.push({
          id: `start-${enrollment.id}`,
          title: `Program starts: ${enrollment.program?.title || 'Program'}`,
          date: startDate,
          type: 'milestone',
          status: normalizedStart <= today ? 'completed' : 'pending',
          programId: enrollment.program_id,
          description: 'Program start date',
        });
      }

      const endDate = parseDateValue(enrollment.end_date);
      if (endDate) {
        const normalizedEnd = new Date(endDate);
        normalizedEnd.setHours(0, 0, 0, 0);
        events.push({
          id: `end-${enrollment.id}`,
          title: `Program ends: ${enrollment.program?.title || 'Program'}`,
          date: endDate,
          type: 'milestone',
          status: normalizedEnd <= today ? 'completed' : 'pending',
          programId: enrollment.program_id,
          description: 'Program completion date',
        });
      }
    });

    setCalendarEvents(events);
  }, [getWeekRange, parseDateValue, resolveScheduledDate]);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      const currentUser = await getCurrentUser();
      if (!currentUser) {
        onNavigateHome();
        return;
      }

      setUser(currentUser);

      // Ensure enrollments stay in sync with program duration/renewal windows
      try {
        await supabase.functions.invoke('enrollment-maintenance');
      } catch (maintenanceError) {
        console.error('Enrollment maintenance failed:', maintenanceError);
      }

      const existingMessages = await getCoachMessages(currentUser.id);
      setCoachMessages(existingMessages);

      const checkInsData = await loadCheckIns(currentUser.id);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      if (profileData) {
        setProfile(resolveProfileAvatar(profileData) ?? profileData);
      }

      const settings = await getUserSettings(currentUser.id);
      const resolvedPrivacy = settings?.privacy
        ? { ...DEFAULT_PRIVACY_SETTINGS, ...settings.privacy }
        : DEFAULT_PRIVACY_SETTINGS;
      setPrivacySettings(resolvedPrivacy);

      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from('program_enrollments')
        .select(`
          *,
          program:programs(*)
        `)
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (enrollmentsError) {
        console.error('Error fetching enrollments:', enrollmentsError);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const processedEnrollments = (enrollmentsData || []).map((enrollment) => {
        const startDate =
          parseDateValue(enrollment.start_date) ??
          parseDateValue((enrollment as any).enrolled_at) ??
          parseDateValue(enrollment.created_at) ??
          today;
        const durationWeeks =
          Number(enrollment.program?.duration_weeks ?? 0) > 0
            ? Number(enrollment.program?.duration_weeks)
            : 4;
        const endDate =
          parseDateValue(enrollment.end_date) ??
          (startDate ? addWeeks(startDate, durationWeeks) : null);

        const normalizedEnd = endDate ? new Date(endDate.getTime()) : null;
        if (normalizedEnd) {
          normalizedEnd.setHours(0, 0, 0, 0);
        }
        const daysRemaining = normalizedEnd
          ? Math.ceil((normalizedEnd.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
          : null;
        const isExpired = normalizedEnd ? normalizedEnd < today : false;
        const effectiveStatus =
          enrollment.status === 'active' && isExpired ? 'completed' : enrollment.status;
        const isEndingSoon =
          typeof daysRemaining === 'number' && daysRemaining <= 7 && daysRemaining >= 0;

        return {
          ...enrollment,
          start_date: startDate ? startDate.toISOString().split('T')[0] : enrollment.start_date,
          end_date: normalizedEnd ? normalizedEnd.toISOString().split('T')[0] : enrollment.end_date,
          effective_status: effectiveStatus,
          isEndingSoon,
          isExpired,
          daysRemaining,
        };
      });

      setEnrollments(processedEnrollments);

      const activePrograms = processedEnrollments
        .filter(
          (enrollment: any) =>
            enrollment.effective_status === 'active' &&
            !enrollment.isExpired &&
            Boolean(enrollment.program_id),
        )
        .map((enrollment) => enrollment.program_id as string);

      setAccessibleProgramIds(activePrograms);

      const coachIds = Array.from(
        new Set(
          (enrollmentsData || [])
            .map((enrollment) => enrollment.program?.created_by)
            .filter((value): value is string => Boolean(value)),
        ),
      );

      const { data: assignmentRows } = await supabase
        .from('coach_user_assignments')
        .select('coach_id')
        .eq('user_id', currentUser.id);

      const assignedCoachIds = Array.from(
        new Set(
          (assignmentRows ?? [])
            .map((row) => row.coach_id)
            .filter((value): value is string => Boolean(value)),
        ),
      );

      const { data: adminProfiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url, email, role')
        .eq('role', 'admin');

      const adminIds = (adminProfiles ?? []).map((admin) => admin.id).filter(Boolean) as string[];
      const combinedIds = Array.from(new Set([...assignedCoachIds, ...coachIds, ...adminIds]));

      if (combinedIds.length > 0) {
        const { data: coachProfiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url, email, role')
          .in('id', combinedIds);

        const uniqueProfiles: Record<string, any> = {};
        (coachProfiles ?? []).forEach((profile) => {
          if (profile?.id) {
            uniqueProfiles[profile.id] = profile;
          }
        });

        const orderedProfiles = combinedIds
          .map((id) => uniqueProfiles[id])
          .filter((profile): profile is any => Boolean(profile));

        setCoachContacts(orderedProfiles);
        setPrimaryCoachId(assignedCoachIds[0] ?? orderedProfiles[0]?.id ?? null);
      } else {
        setCoachContacts([]);
        setPrimaryCoachId(null);
      }

      const workoutsData = await getUserWorkouts(currentUser.id, activePrograms);
      const adjustedWorkouts = adjustWorkoutsForEnrollments({
        workouts: workoutsData,
        enrollmentList: enrollmentsData || [],
        userId: currentUser.id,
      });
      setWorkouts(adjustedWorkouts);
      workoutsRef.current = adjustedWorkouts;
      setCheckIns(attachWorkoutsToCheckIns(checkInsData ?? [], adjustedWorkouts));

      const [notificationsData, userRatings] = await Promise.all([
        getUserNotifications(currentUser.id),
        getProgramRatingsForUser(currentUser.id),
      ]);
      setNotifications(notificationsData);
      setProgramRatings(userRatings);

      const weeklyGoalsData = await getWeeklyGoalsForUser(currentUser.id);
      setWeeklyGoals(weeklyGoalsData);

      const { data: assessmentsData } = await supabase
        .from('strength_assessments')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

      setAssessments(assessmentsData || []);

      const completedWorkouts = adjustedWorkouts.filter(
        (workout) => workout.is_completed || (workout.checkins?.length ?? 0) > 0,
      ).length;
      const unreadNotifications = notificationsData.filter((notification) => !notification.is_read).length;

      setStats({
        totalWorkouts: adjustedWorkouts.length,
        completedWorkouts,
        currentStreak: calculateStreak(adjustedWorkouts),
        totalPrograms: enrollmentsData?.length || 0,
        unreadNotifications,
      });

      setPersonalRecords(calculatePersonalRecords(adjustedWorkouts, assessmentsData || []));

      generateCalendarEvents(adjustedWorkouts, processedEnrollments || []);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [
    adjustWorkoutsForEnrollments,
    calculatePersonalRecords,
    calculateStreak,
    generateCalendarEvents,
    attachWorkoutsToCheckIns,
    parseDateValue,
    loadCheckIns,
    onNavigateHome,
  ]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const userId = user?.id as string | undefined;

  useEffect(() => {
    if (!userId) {
      return;
    }
    computeWeeklySchedule(selectedDate);
  }, [computeWeeklySchedule, selectedDate, userId]);

  useEffect(() => {
    if (!user?.id || !profile || !privacySettings?.showOnlineStatus) {
      teardownPresenceChannel();
      return;
    }

    const channel = supabase.channel(ATHLETE_PRESENCE_CHANNEL, {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    presenceChannelRef.current = channel;

    const publishPresence = () => {
      if (!user?.id) {
        return;
      }

      const lastSeenAt = new Date().toISOString();
      channel.track({
        userId: user.id,
        firstName: profile.first_name,
        lastName: profile.last_name,
        role: profile.role,
        avatarUrl: profile.avatar_url,
        lastSeenAt,
      });
      setLastOnlineAt(new Date(lastSeenAt));
    };

    const syncPresenceState = () => {
      const state = channel.presenceState();
      const metas = state[user.id];
      if (Array.isArray(metas) && metas.length > 0) {
        const latest = metas[metas.length - 1];
        if (latest?.lastSeenAt) {
          setLastOnlineAt(new Date(latest.lastSeenAt));
        }
      }
    };

    channel.on('presence', { event: 'sync' }, syncPresenceState);

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        publishPresence();
        setIsOnline(true);
      }
    });

    heartbeatRef.current = setInterval(() => {
      publishPresence();
    }, 60_000);

    return () => {
      teardownPresenceChannel();
    };
  }, [
    privacySettings?.showOnlineStatus,
    profile,
    teardownPresenceChannel,
    user?.id,
  ]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const activeEnrollments = useMemo(() => {
    return enrollments.filter((enrollment: any) => {
      const status = enrollment.effective_status ?? enrollment.status;
      return status === 'active' && !enrollment.isExpired;
    });
  }, [enrollments]);

  const rateProgram = useCallback(
    async (programId: string, rating: number) => {
      const clamped = Math.min(5, Math.max(1, Math.round(rating)));
      const success = await upsertProgramRating(programId, clamped);
      if (success) {
        setProgramRatings((prev) => ({ ...prev, [programId]: clamped }));
      }
      return success;
    },
    [],
  );

  const requestRenewal = useCallback(
    async (enrollmentId: string) => {
      const { error, data } = await supabase
        .from('program_enrollments')
        .update({
          status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', enrollmentId)
        .select(
          `
          *,
          program:programs(*)
        `,
        )
        .single();

      if (error) {
        console.error('Error requesting renewal:', error);
        return { success: false as const, error: error.message };
      }

      setEnrollments((prev) =>
        prev.map((entry) =>
          entry.id === enrollmentId
            ? {
                ...entry,
                ...data,
                effective_status: 'pending',
                status: 'pending',
              }
            : entry,
        ),
      );
      return { success: true as const };
    },
    [],
  );

  const endingSoonEnrollments = useMemo(() => {
    return enrollments.filter(
      (enrollment: any) =>
        (enrollment.effective_status ?? enrollment.status) === 'active' &&
        enrollment.isEndingSoon,
    );
  }, [enrollments]);

  const recentNotifications = useMemo(() => notifications.slice(0, 5), [notifications]);

  const getEventsForDate = useCallback(
    (date: Date) => {
      const targetKey = formatDateOnly(date);
      return calendarEvents.filter((event) => formatDateOnly(event.date) === targetKey);
    },
    [calendarEvents, formatDateOnly],
  );

  const getWorkoutForDate = useCallback(
    (date: Date) => {
      const dateStr = formatDateOnly(date);
      return weeklyWorkouts.find(
        (workout) => getDateKey(workout.scheduled_date ?? workout.scheduledDateObject) === dateStr,
      );
    },
    [getDateKey, weeklyWorkouts],
  );

  const calendarDays = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: Date[] = [];
    const current = new Date(startDate);

    for (let i = 0; i < 42; i += 1) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return days;
  }, [selectedDate]);

  const weekDays = useMemo(() => {
    const startOfWeek = new Date(selectedDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day;
    startOfWeek.setDate(diff);

    const days: Date[] = [];
    for (let i = 0; i < 7; i += 1) {
      const next = new Date(startOfWeek);
      next.setDate(startOfWeek.getDate() + i);
      days.push(next);
    }

    return days;
  }, [selectedDate]);

  const currentWeekRange = useMemo(() => getWeekRange(selectedDate), [getWeekRange, selectedDate]);

  const weeklySchedule = useMemo(() => {
    return weeklyWorkouts.reduce<Record<string, WorkoutWithRelations[]>>((acc, workout) => {
      const key = getDateKey(workout.scheduled_date ?? workout.scheduledDateObject);
      if (!key) {
        return acc;
      }
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(workout);
      return acc;
    }, {});
  }, [getDateKey, weeklyWorkouts]);

  const openEventModal = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
    setShowEventModal(true);
  }, []);

  const closeEventModal = useCallback(() => {
    setShowEventModal(false);
    setSelectedEvent(null);
  }, []);

  const handleSubmitCheckIn = useCallback(
    async (payload: SubmitCheckInArgs) => {
      const currentUserId = user?.id as string | undefined;
      if (!currentUserId) {
        return { success: false, error: 'Not authenticated' as const };
      }

      setIsSubmittingCheckIn(true);

      try {
        const result = await submitWorkoutCheckIn({
          ...payload,
          userId: currentUserId,
        });

        if (!result) {
          return { success: false, error: 'Unable to submit check-in' as const };
        }

        let updatedWorkouts: WorkoutWithRelations[] = [];
        setWorkouts((previous) => {
          updatedWorkouts = previous.map((workout) => {
            if (workout.id !== result.workout_id) {
              return workout;
            }

            const withoutDuplicate = (workout.checkins ?? []).filter((entry) => entry.id !== result.id);
            return {
              ...workout,
              checkins: [result, ...withoutDuplicate],
              is_completed: true,
              status: result.status === 'needs_revision' ? 'in_review' : 'completed',
            };
          });

          return updatedWorkouts;
        });
        workoutsRef.current = updatedWorkouts;

        const scheduledWorkout = updatedWorkouts.find((workout) => workout.id === result.workout_id);
        const normalizedResult = scheduledWorkout ? { ...result, workout: scheduledWorkout } : result;

        setCheckIns((previous) => [normalizedResult, ...previous.filter((checkin) => checkin.id !== result.id)]);

        setWeeklyWorkouts((previous) =>
          previous.map((workout) => {
            if (workout.id !== result.workout_id) {
              return workout;
            }

            const withoutDuplicate = (workout.checkins ?? []).filter((entry) => entry.id !== result.id);
            return {
              ...workout,
              checkins: [normalizedResult, ...withoutDuplicate],
              is_completed: true,
              status: result.status === 'needs_revision' ? 'in_review' : 'completed',
            };
          }),
        );

        const completedCount = updatedWorkouts.filter(
          (workout) => workout.is_completed || (workout.checkins?.length ?? 0) > 0,
        ).length;

        setStats((previous) => ({
          ...previous,
          completedWorkouts: completedCount,
          currentStreak: calculateStreak(updatedWorkouts),
          totalWorkouts: updatedWorkouts.length,
        }));

        generateCalendarEvents(updatedWorkouts, enrollments);

        return { success: true, checkIn: result as WorkoutCheckIn };
      } catch (error) {
        console.error('Error submitting workout check-in:', error);
        return { success: false, error };
      } finally {
        setIsSubmittingCheckIn(false);
      }
    },
    [calculateStreak, enrollments, generateCalendarEvents, user],
  );

  const handleSignOut = useCallback(async () => {
    teardownPresenceChannel();
    await supabase.auth.signOut();
    onNavigateHome();
  }, [onNavigateHome, teardownPresenceChannel]);

  const refreshWeeklySchedule = useCallback(
    (referenceDate?: Date) => {
      if (!user?.id) {
        return;
      }
      computeWeeklySchedule(referenceDate ?? selectedDate);
    },
    [computeWeeklySchedule, selectedDate, user?.id],
  );

  const refreshCheckInsWithSchedule = useCallback(
    async (userId: string) => {
      const data = await loadCheckIns(userId);
      const normalized = attachWorkoutsToCheckIns(data ?? [], workoutsRef.current);
      setCheckIns(normalized);
      return data;
    },
    [attachWorkoutsToCheckIns, loadCheckIns],
  );

  const refreshWeeklyGoals = useCallback(
    async (userId: string) => {
      const goals = await getWeeklyGoalsForUser(userId);
      setWeeklyGoals(goals);
      return goals;
    },
    [],
  );

  const refreshCoachMessages = useCallback(
    async (userId: string) => {
      const messages = await getCoachMessages(userId);
      setCoachMessages(messages);
    },
    [],
  );

  const sendMessageToCoach = useCallback(
    async (receiverId: string, message: string) => {
      const senderId = user?.id;
      if (!senderId || !message.trim()) {
        return { success: false as const, error: 'Invalid message' };
      }

      setIsSendingCoachMessage(true);
      try {
        const result = await sendCoachMessage(senderId, receiverId, {
          senderRole: 'athlete',
          message: message.trim(),
        });

        if (!result) {
          return { success: false as const, error: 'Unable to send message' };
        }

        setCoachMessages((previous) => [result, ...previous]);
        return { success: true as const, message: result };
      } catch (error) {
        console.error('Error sending coach message:', error);
        return { success: false as const, error };
      } finally {
        setIsSendingCoachMessage(false);
      }
    },
    [user?.id],
  );

  const handleMarkMessageRead = useCallback(
    async (messageId: string) => {
      await markCoachMessageRead(messageId);
      setCoachMessages((previous) =>
        previous.map((entry) => (entry.id === messageId ? { ...entry, is_read: true, read_at: new Date().toISOString() } : entry)),
      );
    },
    [],
  );

  return {
    user,
    profile,
    enrollments,
    workouts,
    notifications,
    assessments,
    weeklyGoals,
    stats,
    personalRecords,
    loading,
    activeTab,
    setActiveTab,
    selectedDate,
    setSelectedDate,
    calendarView,
    setCalendarView,
    weeklyWorkouts,
    weeklySchedule,
    currentWeekRange,
    selectedWorkout,
    setSelectedWorkout,
    calendarEvents,
    calendarDays,
    weekDays,
    selectedEvent,
    showEventModal,
    openEventModal,
    closeEventModal,
    checkIns,
    isSubmittingCheckIn,
    submitCheckIn: handleSubmitCheckIn,
    activeEnrollments,
    recentNotifications,
    greeting,
    getEventsForDate,
    getWorkoutForDate,
    refreshWeeklySchedule,
    refreshCheckIns: refreshCheckInsWithSchedule,
    refreshWeeklyGoals,
    refreshCoachMessages,
    sendCoachMessage: sendMessageToCoach,
    markCoachMessageRead: handleMarkMessageRead,
    coachContacts,
    coachMessages,
    primaryCoachId,
    endingSoonEnrollments,
    programRatings,
    rateProgram,
    requestRenewal,
    isSendingCoachMessage,
    handleSignOut,
    reload: loadDashboardData,
    privacySettings,
    isOnline,
    lastOnlineAt,
  };
};

export type UseDashboardDataReturn = ReturnType<typeof useDashboardData>;
