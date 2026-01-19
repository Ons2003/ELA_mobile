import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  supabase,
  resolveProfileAvatar,
  getCoachMessages,
  sendCoachMessage,
  markCoachMessageRead,
  createWorkout,
  deleteWorkout,
  getWorkoutDetail,
  getUserWorkouts,
  fetchCoachCheckIns,
  updateWorkoutCheckInStatus,
  updateWorkout,
  getWeeklyGoalsForUser,
  upsertWeeklyGoalForAthlete,
  updateWeeklyGoalStatus,
} from '../lib/supabase';
import { serializeCoachNotes } from '../lib/workoutNotes';
import type {
  Program,
  ProgramEnrollment,
  Profile,
  Workout,
  ExerciseLibraryEntry,
  WorkoutWithRelations,
  WorkoutCheckIn,
  CoachMessage,
  UpdateWorkoutRequest,
  WeeklyGoal,
} from '../lib/supabase';

interface UseCoachDashboardArgs {
  onNavigateHome: () => void;
}

type CompactProgram = Pick<
  Program,
  'id' | 'title' | 'level' | 'program_type' | 'duration_weeks' | 'price' | 'currency' | 'is_active' | 'image_url'
> & {
  created_by?: string | null;
};

interface CoachProgramSummary {
  program: CompactProgram;
  enrollments: (ProgramEnrollment & { profile: Profile | null })[];
}

interface CoachAthleteSummary {
  userId: string;
  profile: Profile | null;
  enrollments: ProgramEnrollment[];
  programs: CompactProgram[];
  totalCheckIns: number;
  pendingCheckIns: number;
  latestCheckIn: WorkoutCheckIn | null;
  averageProgress: number;
  activeProgramCount: number;
}

interface CoachAthleteProgressOverview {
  averageReadiness: number | null;
  totalCheckIns: number;
  personalRecords: number;
  readinessTrend: Array<{ label: string; readiness: number | null }>;
  lastCheckInAt: string | null;
}

interface CoachAthleteDetails {
  athleteId: string;
  summary: CoachAthleteSummary;
  workouts: WorkoutWithRelations[];
  checkIns: WorkoutCheckIn[];
  progressOverview: CoachAthleteProgressOverview | null;
  weeklyGoals: WeeklyGoal[];
}

interface CoachDashboardStats {
  totalPrograms: number;
  totalAthletes: number;
  pendingCheckIns: number;
  unreadMessages: number;
}

export type CreateAthleteWorkoutInput = {
  title: string;
  description?: string;
  dayNumber?: number;
  durationMinutes?: number;
  focusArea?: string;
  programId?: string | null;
  coachNotes?: string;
  scheduledDate?: string | Date | null;
  exercises?: CoachWorkoutExerciseInput[];
};

export type UpdateAthleteWorkoutInput = Partial<CreateAthleteWorkoutInput> & {
  status?: Workout['status'];
  scheduledDate?: string | Date | null;
};

export type CoachWorkoutExerciseInput = {
  name: string;
  order?: number;
  exerciseType?: string | null;
  targetSets?: number | null;
  targetReps?: string | null;
  targetWeight?: number | null;
  targetRpe?: number | null;
  restSeconds?: number | null;
  notes?: string | null;
  imageUrl?: string | null;
  sourceExerciseId?: string | null;
};

export interface UseCoachDashboardReturn {
  loading: boolean;
  refreshing: boolean;
  coachId: string | null;
  profile: Profile | null;
  programs: CoachProgramSummary[];
  athleteSummaries: CoachAthleteSummary[];
  selectedAthleteId: string | null;
  setSelectedAthleteId: (athleteId: string | null) => void;
  selectedAthleteDetails: CoachAthleteDetails | null;
  selectedAthleteLoading: boolean;
  stats: CoachDashboardStats;
  coachMessages: CoachMessage[];
  isSendingMessage: boolean;
  selectedConversationUserId: string | null;
  setSelectedConversationUserId: (athleteId: string | null) => void;
  sendCoachMessageToAthlete: (athleteId: string, message: string) => Promise<CoachMessage | null>;
  markMessageRead: (messageId: string) => Promise<void>;
  refreshCoachMessages: () => Promise<void>;
  refreshCoachData: () => Promise<void>;
  updateCheckInStatus: (
    checkInId: string,
    status: WorkoutCheckIn['status'],
    coachNotes?: string,
  ) => Promise<WorkoutCheckIn | null>;
  createAthleteWorkout: (athleteId: string, input: CreateAthleteWorkoutInput) => Promise<boolean>;
  updateAthleteWorkout: (
    athleteId: string,
    workoutId: string,
    updates: UpdateAthleteWorkoutInput,
  ) => Promise<boolean>;
  deleteAthleteWorkout: (athleteId: string, workoutId: string) => Promise<boolean>;
  error: string | null;
  exerciseLibrary: ExerciseLibraryEntry[];
  refreshExerciseLibrary: () => Promise<void>;
}

const sortByDateDesc = <T extends { created_at: string }>(entries: T[]) =>
  entries
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

const sanitizeProgram = (program: Program): CompactProgram => ({
  id: program.id,
  title: program.title,
  level: program.level,
  program_type: program.program_type,
  duration_weeks: program.duration_weeks,
  price: program.price,
  currency: program.currency,
  is_active: program.is_active,
  image_url: program.image_url,
  created_by: program.created_by ?? null,
});

const normalizeProfile = (profile: Profile | null | undefined): Profile | null => {
  if (!profile) {
    return null;
  }
  return resolveProfileAvatar(profile) ?? profile;
};

const buildProgressOverview = (checkIns: WorkoutCheckIn[]): CoachAthleteProgressOverview => {
  if (checkIns.length === 0) {
    return {
      averageReadiness: null,
      totalCheckIns: 0,
      personalRecords: 0,
      readinessTrend: [],
      lastCheckInAt: null,
    };
  }

  const readinessValues = checkIns
    .map((entry) => entry.readiness_score)
    .filter((value): value is number => typeof value === 'number');

  const averageReadiness =
    readinessValues.length > 0
      ? Math.round((readinessValues.reduce((sum, value) => sum + value, 0) / readinessValues.length) * 10) / 10
      : null;

  const personalRecords = checkIns.filter((entry) => entry.achieved_pr).length;

  const chronologicalCheckIns = checkIns
    .slice()
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const readinessTrend = chronologicalCheckIns.slice(-8).map((entry) => ({
    label: new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    readiness: entry.readiness_score ?? null,
  }));

  const latestCheckIn = chronologicalCheckIns.length > 0 ? chronologicalCheckIns[chronologicalCheckIns.length - 1] : null;

  return {
    averageReadiness,
    totalCheckIns: checkIns.length,
    personalRecords,
    readinessTrend,
    lastCheckInAt: latestCheckIn?.created_at ?? null,
  };
};

export const useCoachDashboard = ({ onNavigateHome }: UseCoachDashboardArgs): UseCoachDashboardReturn => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [coachProfile, setCoachProfile] = useState<Profile | null>(null);
  const [programs, setPrograms] = useState<CoachProgramSummary[]>([]);
  const [athleteSummaries, setAthleteSummaries] = useState<CoachAthleteSummary[]>([]);
  const [checkInsByAthlete, setCheckInsByAthlete] = useState<Record<string, WorkoutCheckIn[]>>({});
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);
  const [selectedAthleteDetails, setSelectedAthleteDetails] = useState<CoachAthleteDetails | null>(null);
  const [selectedAthleteLoading, setSelectedAthleteLoading] = useState(false);
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([]);
  const [selectedConversationUserId, setSelectedConversationUserId] = useState<string | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exerciseLibrary, setExerciseLibrary] = useState<ExerciseLibraryEntry[]>([]);

  const stats = useMemo<CoachDashboardStats>(() => {
    const totalPrograms = programs.length;
    const totalAthletes = athleteSummaries.length;
    const pendingCheckIns = athleteSummaries.reduce((count, athlete) => count + athlete.pendingCheckIns, 0);
    const unreadMessages = coachMessages.reduce((count, message) => {
      if (!coachId) {
        return count;
      }
      return message.receiver_id === coachId && !message.is_read ? count + 1 : count;
    }, 0);

    return {
      totalPrograms,
      totalAthletes,
      pendingCheckIns,
      unreadMessages,
    };
  }, [programs, athleteSummaries, coachMessages, coachId]);

  const loadCoachMessages = useCallback(async () => {
    if (!coachId) {
      return;
    }
    const messages = await getCoachMessages(coachId);
    setCoachMessages(sortByDateDesc(messages));
  }, [coachId]);

  const mergeExerciseLibrary = useCallback((incoming: ExerciseLibraryEntry[]) => {
    if (!incoming || incoming.length === 0) {
      return;
    }
    setExerciseLibrary((previous) => {
      const seen = new Map<string, ExerciseLibraryEntry>();
      const addEntry = (entry: ExerciseLibraryEntry) => {
        const key = `${entry.exercise_name ?? ''}|${entry.exercise_type ?? ''}|${entry.target_reps ?? ''}|${entry.target_sets ?? ''}|${entry.image_url ?? ''}`;
        if (!seen.has(key)) {
          seen.set(key, entry);
        }
      };
      previous.forEach(addEntry);
      incoming.forEach(addEntry);
      return Array.from(seen.values());
    });
  }, []);

  const loadExerciseLibrary = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('exercises')
        .select(
          'id, exercise_name, exercise_type, target_sets, target_reps, target_weight, target_rpe, rest_seconds, notes, image_url, created_at',
        )
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        console.error('Error loading exercise library:', error);
        return;
      }

      mergeExerciseLibrary(data ?? []);
    } catch (libraryError) {
      console.error('Unexpected error loading exercise library:', libraryError);
    }
  }, [mergeExerciseLibrary]);

  const bootstrapCoach = useCallback(async () => {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        console.error('Error fetching coach session:', authError);
      }

      if (!user) {
        onNavigateHome();
        return;
      }

      setCoachId(user.id);
    } catch (authException) {
      console.error('Unexpected error bootstrapping coach session:', authException);
      onNavigateHome();
    }
  }, [onNavigateHome]);

  const buildAthleteSummaries = useCallback(
    (
      programSummaries: CoachProgramSummary[],
      checkInBuckets: Record<string, WorkoutCheckIn[]>,
    ): CoachAthleteSummary[] => {
      const map = new Map<string, CoachAthleteSummary>();

      programSummaries.forEach((entry) => {
        entry.enrollments.forEach((enrollment) => {
          if (!enrollment.user_id) {
            return;
          }
          const existing = map.get(enrollment.user_id);
          const normalizedProfile = normalizeProfile(enrollment.profile);
          const compactProgram = entry.program;

          if (existing) {
            existing.enrollments.push(enrollment);
            existing.programs.push(compactProgram);
            map.set(enrollment.user_id, existing);
            return;
          }

          map.set(enrollment.user_id, {
            userId: enrollment.user_id,
            profile: normalizedProfile,
            enrollments: [enrollment],
            programs: [compactProgram],
            totalCheckIns: 0,
            pendingCheckIns: 0,
            latestCheckIn: null,
            averageProgress: 0,
            activeProgramCount: enrollment.status === 'active' ? 1 : 0,
          });
        });
      });

      const summaries: CoachAthleteSummary[] = [];

      map.forEach((summary, userId) => {
        const checkIns = checkInBuckets[userId] ?? [];
        const totalCheckIns = checkIns.length;
        const pendingCheckIns = checkIns.filter((checkIn) => checkIn.status === 'submitted').length;
        const latestCheckIn = checkIns.length > 0 ? checkIns[0] : null;
        const progressValues = summary.enrollments
          .map((enrollment) => enrollment.progress_percentage ?? null)
          .filter((value): value is number => typeof value === 'number');
        const averageProgress =
          progressValues.length > 0
            ? Math.round((progressValues.reduce((acc, value) => acc + value, 0) / progressValues.length) * 10) / 10
            : 0;
        const activeProgramCount = summary.enrollments.filter((enrollment) => enrollment.status === 'active').length;

        summaries.push({
          ...summary,
          totalCheckIns,
          pendingCheckIns,
          latestCheckIn,
          averageProgress,
          activeProgramCount,
        });
      });

      return summaries.sort((a, b) => {
        const nameA = [a.profile?.first_name, a.profile?.last_name].filter(Boolean).join(' ').toLowerCase();
        const nameB = [b.profile?.first_name, b.profile?.last_name].filter(Boolean).join(' ').toLowerCase();
        if (!nameA && !nameB) {
          return 0;
        }
        if (!nameA) {
          return 1;
        }
        if (!nameB) {
          return -1;
        }
        return nameA.localeCompare(nameB);
      });
    },
    [],
  );

  const loadCoachData = useCallback(async () => {
    if (!coachId) {
      return;
    }

    setRefreshing(true);
    setError(null);

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', coachId)
        .single();

      if (profileError) {
        console.error('Error loading coach profile:', profileError);
      } else {
        setCoachProfile(normalizeProfile(profileData));
      }

      const isAdmin = profileData?.role === 'admin';

      let allowedProgramSummaries: CoachProgramSummary[] = [];

      if (isAdmin) {
        const programQuery = supabase
          .from('programs')
          .select(
            `
              *,
              enrollments:program_enrollments (
                *,
                profile:profiles(*)
              )
            `,
          )
          .order('created_at', { ascending: false });

        const { data: programsData, error: programsError } = await programQuery;

        if (programsError) {
          console.error('Error fetching coach programs:', programsError);
          setPrograms([]);
          setAthleteSummaries([]);
          setCheckInsByAthlete({});
          return;
        }

        allowedProgramSummaries = (programsData ?? []).map((program: any) => ({
          program: sanitizeProgram(program),
          enrollments: (program.enrollments ?? []).map((enrollment: ProgramEnrollment & { profile?: Profile | null }) => ({
            ...enrollment,
            profile: normalizeProfile(enrollment.profile),
            program: undefined,
          })),
        }));
      } else {
        const { data: assignmentRows, error: assignmentsError } = await supabase
          .from('coach_user_assignments')
          .select('user_id')
          .eq('coach_id', coachId);

        if (assignmentsError) {
          if (assignmentsError.code !== '42P01') {
            console.error('Error fetching coach athlete assignments:', assignmentsError);
          }
          setPrograms([]);
          setAthleteSummaries([]);
          setCheckInsByAthlete({});
          return;
        }

        const assignedUserIds = Array.from(
          new Set(
            (assignmentRows ?? [])
              .map((assignment) => assignment.user_id)
              .filter((value): value is string => Boolean(value)),
          ),
        );

        if (assignedUserIds.length === 0) {
          setPrograms([]);
          setAthleteSummaries([]);
          setCheckInsByAthlete({});
          setAthletePresence({});
          return;
        }

        const { data: enrollmentRows, error: enrollmentsError } = await supabase
          .from('program_enrollments')
          .select(
            `
              *,
              program:programs(*),
              profile:profiles(*)
            `,
          )
          .in('user_id', assignedUserIds)
          .order('enrolled_at', { ascending: false });

        if (enrollmentsError) {
          console.error('Error fetching assigned athlete enrollments:', enrollmentsError);
          setPrograms([]);
          setAthleteSummaries([]);
          setCheckInsByAthlete({});
          return;
        }

        const programMap = new Map<string, CoachProgramSummary>();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        (enrollmentRows ?? [])
          .filter((enrollment: any) => {
            if (enrollment?.status !== 'active') {
              return false;
            }
            if (enrollment?.end_date) {
              const endDate = new Date(enrollment.end_date);
              endDate.setHours(0, 0, 0, 0);
              if (endDate < today) {
                return false;
              }
            }
            return true;
          })
          .forEach((enrollment: any) => {
            if (!enrollment?.program) {
              return;
            }
            const normalizedProgram = sanitizeProgram(enrollment.program);
            const normalizedEnrollment = {
              ...(enrollment as ProgramEnrollment),
              profile: normalizeProfile(enrollment.profile),
              program: undefined,
            };
            const existing = programMap.get(normalizedProgram.id);
            if (existing) {
              existing.enrollments.push(normalizedEnrollment);
            } else {
              programMap.set(normalizedProgram.id, {
                program: normalizedProgram,
                enrollments: [normalizedEnrollment],
              });
            }
          });

        allowedProgramSummaries = Array.from(programMap.values());
      }

      const athleteIds = Array.from(
        new Set(
          allowedProgramSummaries
            .flatMap((entry) => entry.enrollments)
            .map((enrollment) => enrollment.user_id)
            .filter((value): value is string => Boolean(value)),
        ),
      );

      let athleteProfiles: Profile[] = [];

      if (athleteIds.length > 0) {
        const { data: athleteProfileRows, error: athleteProfilesError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', athleteIds);

        if (athleteProfilesError) {
          console.error('Error fetching athlete profiles:', athleteProfilesError);
        } else {
          athleteProfiles = (athleteProfileRows ?? []).map((profile) => normalizeProfile(profile)).filter(
            (profile): profile is Profile => Boolean(profile),
          );
        }
      }

      const athleteProfileMap = new Map<string, Profile>();
      athleteProfiles.forEach((profile) => {
        if (profile?.id) {
          athleteProfileMap.set(profile.id, profile);
        }
      });

      const programSummaries: CoachProgramSummary[] = allowedProgramSummaries
        .map((entry) => ({
          program: entry.program,
          enrollments: entry.enrollments
            .filter((enrollment) => Boolean(enrollment.user_id))
            .map((enrollment) => {
              const resolvedProfile =
                (enrollment.user_id ? athleteProfileMap.get(enrollment.user_id) : undefined) ?? enrollment.profile ?? null;
              return {
                ...enrollment,
                profile: resolvedProfile,
              };
            }),
        }));

      setPrograms(programSummaries);

      let checkInBuckets: Record<string, WorkoutCheckIn[]> = {};

      if (athleteIds.length > 0) {
        try {
          const checkInsData = await fetchCoachCheckIns(athleteIds);
          checkInBuckets = (checkInsData ?? []).reduce<Record<string, WorkoutCheckIn[]>>((acc, entry) => {
            const userId = entry.user_id;
            if (!userId) {
              return acc;
            }
            const bucket = acc[userId] ?? [];
            bucket.push(entry as WorkoutCheckIn);
            acc[userId] = bucket;
            return acc;
          }, {});

          Object.keys(checkInBuckets).forEach((userId) => {
            checkInBuckets[userId] = sortByDateDesc(checkInBuckets[userId]);
          });
        } catch (checkInsError) {
          console.error('Error loading athlete check-ins:', checkInsError);
        }
      }

      setCheckInsByAthlete(checkInBuckets);

      const summaries = buildAthleteSummaries(programSummaries, checkInBuckets);
      setAthleteSummaries(summaries);

      if (summaries.length > 0) {
        setSelectedAthleteId((previous) => previous ?? summaries[0].userId);
        setSelectedConversationUserId((previous) => previous ?? summaries[0].userId);
      } else {
        setSelectedAthleteId(null);
        setSelectedAthleteDetails(null);
      }
    } catch (loadError) {
      console.error('Unexpected error loading coach dashboard data:', loadError);
      setError('Unable to load coach dashboard data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [buildAthleteSummaries, coachId]);

  const loadAthleteDetails = useCallback(
    async (athleteId: string | null) => {
      if (!athleteId) {
        setSelectedAthleteDetails(null);
        return;
      }

      const summary = athleteSummaries.find((athlete) => athlete.userId === athleteId);
      if (!summary) {
        setSelectedAthleteDetails(null);
        return;
      }

      setSelectedAthleteLoading(true);

      try {
        const programIds = summary.enrollments
          .map((enrollment) => enrollment.program_id)
          .filter((value): value is string => Boolean(value));

        let workouts = await getUserWorkouts(athleteId, programIds);

        const workoutsNeedingDetail = workouts.filter(
          (workout) => !Array.isArray(workout.workout_exercises) || workout.workout_exercises.length === 0,
        );

        if (workoutsNeedingDetail.length > 0) {
          const detailedEntries = await Promise.all(
            workoutsNeedingDetail.map(async (workout) => {
              const detailed = await getWorkoutDetail(workout.id);
              return detailed ? { id: workout.id, workout: detailed } : null;
            }),
          );

          const detailMap = new Map<string, WorkoutWithRelations>();
          detailedEntries.forEach((entry) => {
            if (entry?.workout) {
              detailMap.set(entry.id, entry.workout);
            }
          });

          workouts = workouts.map((workout) => detailMap.get(workout.id) ?? workout);
        }

        let checkIns = checkInsByAthlete[athleteId];
        if (!checkIns) {
          checkIns = await fetchCoachCheckIns([athleteId]);
          checkIns = sortByDateDesc(checkIns);
          setCheckInsByAthlete((previous) => ({
            ...previous,
            [athleteId]: checkIns ?? [],
          }));
        }

        const normalizedCheckIns = checkIns ?? [];
        const progressOverview =
          normalizedCheckIns.length > 0 ? buildProgressOverview(normalizedCheckIns) : null;
        const weeklyGoalsData = await getWeeklyGoalsForUser(athleteId);

        const libraryFromWorkouts =
          workouts
            .flatMap((workout) => workout.workout_exercises ?? [])
            .map((exercise, index) => ({
              ...exercise,
              id: exercise.id ?? `${exercise.exercise_name ?? 'exercise'}-${index}`,
            })) ?? [];
        mergeExerciseLibrary(libraryFromWorkouts);

        setSelectedAthleteDetails({
          athleteId,
          summary,
          workouts,
          checkIns: normalizedCheckIns,
          progressOverview,
          weeklyGoals: weeklyGoalsData,
        });
      } catch (detailsError) {
        console.error('Error loading athlete details:', detailsError);
        setError('Unable to load athlete details. Please try again.');
      } finally {
        setSelectedAthleteLoading(false);
      }
    },
    [athleteSummaries, checkInsByAthlete, mergeExerciseLibrary],
  );

  useEffect(() => {
    bootstrapCoach();
  }, [bootstrapCoach]);

  useEffect(() => {
    if (!coachId) {
      return;
    }
    loadCoachData();
    loadCoachMessages();
    loadExerciseLibrary();
  }, [coachId, loadCoachData, loadCoachMessages, loadExerciseLibrary]);

  useEffect(() => {
    if (selectedAthleteId) {
      loadAthleteDetails(selectedAthleteId);
    }
  }, [selectedAthleteId, loadAthleteDetails]);

  useEffect(() => {
    if (!selectedAthleteDetails) {
      return;
    }

    const summary = athleteSummaries.find((athlete) => athlete.userId === selectedAthleteDetails.athleteId);

    if (!summary) {
      return;
    }

    if (summary === selectedAthleteDetails.summary) {
      return;
    }

    setSelectedAthleteDetails((previous) => (previous ? { ...previous, summary } : previous));
  }, [athleteSummaries, selectedAthleteDetails]);

  const refreshCoachMessages = useCallback(async () => {
    await loadCoachMessages();
  }, [loadCoachMessages]);

  const sendCoachMessageToAthlete = useCallback(
    async (athleteId: string, message: string) => {
      if (!coachId || !message.trim()) {
        return null;
      }

      setIsSendingMessage(true);
      try {
        const result = await sendCoachMessage(coachId, athleteId, {
          message,
          senderRole: 'coach',
        });

        if (result) {
          setCoachMessages((previous) => sortByDateDesc([result, ...previous]));
        }

        return result;
      } catch (sendError) {
        console.error('Error sending coach message:', sendError);
        setError('Unable to send message. Please try again.');
        return null;
      } finally {
        setIsSendingMessage(false);
      }
    },
    [coachId],
  );

  const markMessageRead = useCallback(async (messageId: string) => {
    try {
      await markCoachMessageRead(messageId);
      setCoachMessages((previous) =>
        previous.map((message) =>
          message.id === messageId
            ? {
                ...message,
                is_read: true,
                read_at: new Date().toISOString(),
              }
            : message,
        ),
      );
    } catch (markError) {
      console.error('Error marking coach message read:', markError);
    }
  }, []);

  const updateCheckInStatus = useCallback(
    async (checkInId: string, status: WorkoutCheckIn['status'], coachNotes?: string) => {
      const updated = await updateWorkoutCheckInStatus(checkInId, status, coachNotes);
      if (!updated) {
        return null;
      }

      let updatedBucket: WorkoutCheckIn[] | null = null;

      setCheckInsByAthlete((previous) => {
        const athleteId = updated.user_id;
        const bucket = previous[athleteId] ?? [];
        const nextBucket = sortByDateDesc(
          bucket.some((entry) => entry.id === updated.id)
            ? bucket.map((entry) => (entry.id === updated.id ? updated : entry))
            : [updated, ...bucket],
        );
        updatedBucket = nextBucket;
        return {
          ...previous,
          [athleteId]: nextBucket,
        };
      });

      const resolvedBucket =
        updatedBucket ??
        sortByDateDesc(
          (checkInsByAthlete[updated.user_id] ?? []).map((entry) =>
            entry.id === updated.id ? updated : entry,
          ),
        );

      setAthleteSummaries((previous) =>
        previous.map((athlete) => {
          if (athlete.userId !== updated.user_id) {
            return athlete;
          }
          const totalCheckIns = resolvedBucket.length;
          const pendingCheckIns = resolvedBucket.filter((entry) => entry.status === 'submitted').length;
          const latestCheckIn = resolvedBucket[0] ?? null;
          return {
            ...athlete,
            totalCheckIns,
            pendingCheckIns,
            latestCheckIn,
          };
        }),
      );

      setSelectedAthleteDetails((previous) => {
        if (!previous || previous.athleteId !== updated.user_id) {
          return previous;
        }
        const progressOverview =
          resolvedBucket.length > 0 ? buildProgressOverview(resolvedBucket) : null;
        return {
          ...previous,
          checkIns: resolvedBucket,
          progressOverview,
        };
      });

      return updated;
    },
    [checkInsByAthlete],
  );

  const createAthleteWorkout = useCallback(
    async (athleteId: string, input: CreateAthleteWorkoutInput) => {
      if (!athleteId || !input.title.trim()) {
        return false;
      }

      const programId = input.programId ?? null;
      const isProgramWorkout = Boolean(programId);

      const resolvedDayNumber =
        isProgramWorkout && typeof input.dayNumber === 'number' && Number.isFinite(input.dayNumber)
          ? input.dayNumber
          : isProgramWorkout
            ? 1
            : undefined;

      const exercisesPayload = (input.exercises ?? [])
        .filter((exercise) => Boolean(exercise?.name?.trim()))
        .map((exercise, index) => ({
          exerciseName: exercise.name.trim(),
          exerciseType: exercise.exerciseType ?? null,
          order: exercise.order ?? index + 1,
          targetSets: exercise.targetSets ?? null,
          targetReps: exercise.targetReps ?? null,
          targetWeight: exercise.targetWeight ?? null,
          targetRpe: exercise.targetRpe ?? null,
          restSeconds: exercise.restSeconds ?? null,
          notes: exercise.notes ?? null,
          imageUrl: exercise.imageUrl ?? null,
          sourceExerciseId: exercise.sourceExerciseId ?? null,
        }));

      try {
        const created = await createWorkout({
          athleteId,
          title: input.title.trim(),
          description: input.description?.trim() || null,
          programId,
          dayNumber: resolvedDayNumber,
          durationMinutes:
            typeof input.durationMinutes === 'number' && Number.isFinite(input.durationMinutes)
              ? input.durationMinutes
              : null,
          scheduledDate: input.scheduledDate ?? null,
          coachNotes: serializeCoachNotes(input.focusArea, input.coachNotes),
          exercises: exercisesPayload,
        });

        if (!created) {
          return false;
        }

        await loadAthleteDetails(athleteId);
        await loadExerciseLibrary();
        return true;
      } catch (createError) {
        console.error('Error creating athlete workout:', createError);
        setError('Unable to create workout. Please try again.');
        return false;
      }
    },
    [loadAthleteDetails, loadExerciseLibrary],
  );

  const updateAthleteWorkout = useCallback(
    async (athleteId: string, workoutId: string, updates: UpdateAthleteWorkoutInput) => {
      if (!athleteId || !workoutId) {
        return false;
      }

      const resolvedDayNumber =
        updates.dayNumber !== undefined && typeof updates.dayNumber === 'number' && Number.isFinite(updates.dayNumber)
          ? updates.dayNumber
          : undefined;

      try {
        const updatePayload: UpdateWorkoutRequest = {};

        if (updates.title !== undefined) {
          updatePayload.title = updates.title.trim() || null;
        }

        if (updates.description !== undefined) {
          updatePayload.description = updates.description.trim() || null;
        }

        if (updates.programId !== undefined) {
          updatePayload.programId = updates.programId ?? null;
        }

        if (resolvedDayNumber !== undefined) {
          updatePayload.dayNumber = resolvedDayNumber;
        }

        if (updates.durationMinutes !== undefined) {
          updatePayload.durationMinutes =
            typeof updates.durationMinutes === 'number' && Number.isFinite(updates.durationMinutes)
              ? updates.durationMinutes
              : null;
        }

        if (updates.scheduledDate !== undefined) {
          updatePayload.scheduledDate = updates.scheduledDate;
        }

        if (updates.focusArea !== undefined || updates.coachNotes !== undefined) {
          updatePayload.coachNotes = serializeCoachNotes(updates.focusArea, updates.coachNotes);
        }

        if (updates.exercises !== undefined) {
          updatePayload.exercises = updates.exercises;
        }

        const updated = await updateWorkout(workoutId, updatePayload);

        if (!updated) {
          return false;
        }

        await loadAthleteDetails(athleteId);
        await loadExerciseLibrary();
        return true;
      } catch (updateError) {
        console.error('Error updating athlete workout:', updateError);
        setError('Unable to update workout. Please try again.');
        return false;
      }
    },
    [loadAthleteDetails, loadExerciseLibrary],
  );

  const deleteAthleteWorkout = useCallback(
    async (athleteId: string, workoutId: string) => {
      if (!athleteId || !workoutId) {
        return false;
      }

      try {
        const success = await deleteWorkout(workoutId);
        if (!success) {
          return false;
        }
        await loadAthleteDetails(athleteId);
        return true;
      } catch (deleteError) {
        console.error('Error deleting athlete workout:', deleteError);
        setError('Unable to delete workout. Please try again.');
        return false;
      }
    },
    [loadAthleteDetails],
  );

  const saveWeeklyGoalForAthlete = useCallback(
    async (athleteId: string, weekStart: string, goalText: string, goalId?: string) => {
      if (!coachId) {
        return false;
      }
      const saved = await upsertWeeklyGoalForAthlete({
        goalId,
        userId: athleteId,
        coachId,
        weekStart,
        goalText,
      });
      if (!saved) {
        return false;
      }
      await loadAthleteDetails(athleteId);
      return true;
    },
    [coachId, loadAthleteDetails],
  );

  const updateWeeklyGoalStatusForAthlete = useCallback(
    async (goalId: string, status: WeeklyGoal['status'], reflection?: string | null) => {
      const updated = await updateWeeklyGoalStatus(goalId, status, reflection);
      if (!updated) {
        return false;
      }
      const athleteId = updated.user_id;
      await loadAthleteDetails(athleteId);
      return true;
    },
    [loadAthleteDetails],
  );

  return {
    loading,
    refreshing,
    coachId,
    profile: coachProfile,
    programs,
    athleteSummaries,
    selectedAthleteId,
    setSelectedAthleteId: (athleteId) => {
      setSelectedAthleteId(athleteId);
      if (athleteId) {
        setSelectedConversationUserId(athleteId);
      }
    },
    selectedAthleteDetails,
    selectedAthleteLoading,
    stats,
    coachMessages,
    isSendingMessage,
    selectedConversationUserId,
    setSelectedConversationUserId,
    sendCoachMessageToAthlete,
    markMessageRead,
    refreshCoachMessages,
    refreshCoachData: loadCoachData,
    updateCheckInStatus,
    createAthleteWorkout,
    updateAthleteWorkout,
    deleteAthleteWorkout,
    error,
    saveWeeklyGoalForAthlete,
    updateWeeklyGoalStatusForAthlete,
    exerciseLibrary,
    refreshExerciseLibrary: loadExerciseLibrary,
  };
};

export type {
  CoachProgramSummary,
  CoachAthleteSummary,
  CoachAthleteDetails,
  CoachAthleteProgressOverview,
  CoachDashboardStats,
};
