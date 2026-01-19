import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bell,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Dumbbell,
  Eye,
  Flame,
  Heart,
  Loader,
  LogOut,
  MessageCircle,
  MessageSquare,
  Download,
  PlayCircle,
  Plus,
  Settings,
  SkipForward,
  Stethoscope,
  Target,
  Timer,
  Trophy,
  Star,
  X,
  Zap,
} from 'lucide-react';
import {
  updateWorkoutCheckIn,
  createDiscountToken,
  getExerciseImagePublicUrl,
  getPrograms,
  supabase,
  type WorkoutWithRelations,
  type WorkoutCheckIn,
  type WorkoutCheckInMedia,
  type CoachMessage,
  type Program,
} from '../lib/supabase';
import { useDashboardData } from '../hooks/useDashboardData';
import CoachDashboard from './CoachDashboard';
import { getWorkoutFocusArea, deserializeCoachNotes } from '../lib/workoutNotes';
import EnrollmentModal from './EnrollmentModal';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

const SELECTED_WORKOUT_PLAN_MAX_HEIGHT_REM = 42;
const WEEKLY_VISIBLE_DAYS = 3;
const REVISION_WINDOW_MS = 24 * 60 * 60 * 1000;
const INITIAL_MESSAGES_COUNT = 1;
const MESSAGES_PAGE_SIZE = 12;
const WEEKLY_GOAL_STATUS_META: Record<
  'pending' | 'achieved' | 'partial' | 'not_achieved',
  { label: string; badge: string; description: string }
> = {
  pending: {
    label: 'In progress',
    badge: 'bg-yellow-100 text-yellow-800',
    description: 'This goal is currently underway.',
  },
  achieved: {
    label: 'Achieved',
    badge: 'bg-emerald-100 text-emerald-800',
    description: 'You and your coach marked this goal as complete.',
  },
  partial: {
    label: 'Somewhat achieved',
    badge: 'bg-blue-100 text-blue-800',
    description: 'Progress was made, but there is room for improvement.',
  },
  not_achieved: {
    label: 'Not achieved',
    badge: 'bg-red-100 text-red-800',
    description: 'Discuss adjustments with your coach for the coming week.',
  },
};

type CheckInMeta = {
  checkIn: WorkoutCheckIn;
  canEdit: boolean;
  revisionDeadline: number | null;
};

interface DashboardProps {
  onNavigateHome: () => void;
  onNavigateSettings: () => void;
  onNavigateProgress: (options?: { athleteId?: string; athleteName?: string | null }) => void;
  view?: 'calendar' | 'messages' | 'physician' | 'discounts';
}

type EnergyLevel = 'low' | 'medium' | 'high';

const PHYSICIAN_REQUEST_PREFIX = '[PHYSICIAN_REQUEST]';

const parseDateValue = (value?: string | Date | null) => {
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
};

const formatDateKey = (value?: string | Date | null) => {
  const date = parseDateValue(value);
  if (!date) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDisplayDate = (value?: string | Date | null, options?: Intl.DateTimeFormatOptions) => {
  const date = parseDateValue(value);
  if (!date) {
    return '';
  }
  return date.toLocaleDateString('en-US', options);
};

const getWeekStartSunday = (value?: Date | null) => {
  if (!value) {
    return null;
  }
  const copy = new Date(value);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const renderExerciseDetails = (
  workout: WorkoutWithRelations | null,
  onImagePreview?: (payload: { name: string; url: string }) => void,
) => {
  if (!workout?.workout_exercises?.length) {
    return (
      <p className="text-sm text-gray-500">
        No exercises are attached to this workout yet. Check with your coach to confirm the programming.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {workout.workout_exercises.map((exercise, index) => {
        const targetSummaryItems: React.ReactNode[] = [];
        if (exercise.target_sets) {
          targetSummaryItems.push(
            <span
              key="sets"
              className="inline-flex items-center gap-1 rounded-md border border-red-100 bg-red-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-red-700"
            >
              {exercise.target_sets} sets
            </span>,
          );
        }
        if (exercise.target_reps) {
          targetSummaryItems.push(
            <span
              key="reps"
              className="inline-flex items-center gap-1 rounded-md border border-red-100 bg-red-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-red-700"
            >
              {exercise.target_reps} reps
            </span>,
          );
        }
        if (exercise.target_weight) {
          targetSummaryItems.push(
            <span
              key="weight"
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600"
            >
              <Dumbbell className="h-3 w-3" />
              {exercise.target_weight}
            </span>,
          );
        }
        if (exercise.rest_seconds) {
          targetSummaryItems.push(
            <span key="rest" className="inline-flex items-center gap-1">{`Rest ${exercise.rest_seconds}s`}</span>,
          );
        }

        const sortedSets =
          exercise.exercise_sets?.slice().sort((a, b) => (a.set_number ?? 0) - (b.set_number ?? 0)) ?? [];

        const exerciseImageUrl = getExerciseImagePublicUrl(exercise.image_url);

        return (
          <div
            key={exercise.id ?? `${workout.id}-exercise-${index}`}
            className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-gray-900">{exercise.exercise_name}</p>
                  <span className="text-xs font-semibold text-gray-400">#{index + 1}</span>
                </div>
                {targetSummaryItems.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">{targetSummaryItems}</div>
                )}
              </div>
              {exerciseImageUrl && (
                <button
                  type="button"
                  onClick={() => onImagePreview?.({ name: exercise.exercise_name, url: exerciseImageUrl })}
                  className="overflow-hidden rounded-lg border border-gray-200 bg-white"
                  aria-label={`View ${exercise.exercise_name} preview`}
                >
                  <img src={exerciseImageUrl} alt={exercise.exercise_name} className="h-16 w-16 object-cover" />
                </button>
              )}
            </div>

            {sortedSets.length > 0 && (
              <div className="mt-3 overflow-hidden rounded-lg border border-gray-100">
                <div className="grid grid-cols-4 bg-gray-50 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <div className="px-3 py-2">Set</div>
                  <div className="px-3 py-2">Weight</div>
                  <div className="px-3 py-2">Reps</div>
                  <div className="px-3 py-2">RPE</div>
                </div>
                {sortedSets.map((set) => (
                  <div key={set.id ?? `${exercise.id}-set-${set.set_number}`} className="grid grid-cols-4 bg-white text-xs text-gray-700">
                    <div className="px-3 py-2 border-t border-gray-100">{set.set_number ?? '-'}</div>
                    <div className="px-3 py-2 border-t border-gray-100">{set.weight ?? '-'}</div>
                    <div className="px-3 py-2 border-t border-gray-100">{set.reps ?? '-'}</div>
                    <div className="px-3 py-2 border-t border-gray-100">{set.rpe ?? '-'}</div>
                  </div>
                ))}
              </div>
            )}

            {exercise.notes && (
              <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">{exercise.notes}</p>
            )}
          </div>
        );
      })}
    </div>
  );
};

const Dashboard = ({ onNavigateHome, onNavigateSettings, onNavigateProgress, view = 'calendar' }: DashboardProps) => {
  const {
    user,
    profile,
    weeklyGoals,
    enrollments,
    stats,
    loading,
    calendarView,
    setCalendarView,
    calendarDays,
    currentWeekRange,
    weekDays,
    selectedDate,
    setSelectedDate,
    weeklyWorkouts,
    workouts,
    getEventsForDate,
    checkIns,
    submitCheckIn,
    isSubmittingCheckIn,
    refreshCheckIns,
    refreshWeeklySchedule,
    activeEnrollments,
    recentNotifications,
    greeting,
    coachContacts,
    coachMessages,
    primaryCoachId,
    endingSoonEnrollments,
    programRatings,
    rateProgram,
    requestRenewal,
    sendCoachMessage,
    refreshCoachMessages,
    markCoachMessageRead,
    isSendingCoachMessage,
    handleSignOut,
    lastOnlineAt,
    isOnline,
    reload,
  } = useDashboardData({ onNavigateHome });

  const [activeExperience, setActiveExperience] = useState<'athlete' | 'coach'>('athlete');
  const coachViewInitializedRef = useRef(false);
  const hasCoachAccess = profile?.role === 'coach' || profile?.role === 'admin';

  useEffect(() => {
    if (hasCoachAccess) {
      if (!coachViewInitializedRef.current) {
        setActiveExperience('coach');
        coachViewInitializedRef.current = true;
      }
    } else {
      coachViewInitializedRef.current = false;
      setActiveExperience('athlete');
    }
  }, [hasCoachAccess]);

  const loadAvailablePrograms = useCallback(async () => {
    setIsProgramsLoading(true);
    setProgramsError(null);
    try {
      const programs = await getPrograms();
      setAvailablePrograms(programs);
    } catch (error) {
      console.error('Error loading programs:', error);
      setProgramsError('Unable to load programs right now.');
    } finally {
      setIsProgramsLoading(false);
    }
  }, []);

  const discountCoupons = useMemo(
    () => [
      { title: 'BIWAI Vibe', detail: '20% off any order', code: 'ONLY MEMBERS' },
      { title: 'IMPACT Sports Nutrition', detail: '8% off any purchase', code: 'lift08' },
      { title: 'CACTUS FIT', detail: '30% off forever', code: 'ONLY MEMBERS' },
    ],
    [],
  );

  useEffect(() => {
    if (activeExperience !== 'athlete') {
      return;
    }
    loadAvailablePrograms();
  }, [activeExperience, loadAvailablePrograms]);

  useEffect(() => {
    if (activeExperience !== 'athlete') {
      setSelectedProgramForEnrollment(null);
    }
  }, [activeExperience]);

  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [detailsWorkout, setDetailsWorkout] = useState<WorkoutWithRelations | null>(null);
  const [isWorkoutSessionOpen, setIsWorkoutSessionOpen] = useState(false);
  const [sessionWorkout, setSessionWorkout] = useState<WorkoutWithRelations | null>(null);
  const [sessionExerciseIndex, setSessionExerciseIndex] = useState(0);
  const [sessionTransitionDirection, setSessionTransitionDirection] = useState<'next' | 'prev' | null>(null);
  const [sessionCompletedSets, setSessionCompletedSets] = useState(0);
  const [isRestTimerActive, setIsRestTimerActive] = useState(false);
  const [restTimeLeft, setRestTimeLeft] = useState(0);
  const [selectedProgramEnrollmentId, setSelectedProgramEnrollmentId] = useState<string | null>(null);
  const [renewalMessage, setRenewalMessage] = useState<string | null>(null);
  const [showAllCoupons, setShowAllCoupons] = useState(false);
  const [activeDiscountId, setActiveDiscountId] = useState<string | null>(null);
  const [discountQrUrl, setDiscountQrUrl] = useState<string | null>(null);
  const [discountQrExpiresAt, setDiscountQrExpiresAt] = useState<string | null>(null);
  const [discountQrLoading, setDiscountQrLoading] = useState(false);
  const [discountQrError, setDiscountQrError] = useState<string | null>(null);
  const [discountQrNextAvailableAt, setDiscountQrNextAvailableAt] = useState<string | null>(null);
  const activeDiscountCoupon = useMemo(() => {
    if (!activeDiscountId) {
      return null;
    }
    return discountCoupons.find((coupon) => (coupon.id ?? coupon.title) === activeDiscountId) ?? null;
  }, [activeDiscountId, discountCoupons]);
  useEffect(() => {
    if (!activeDiscountCoupon) {
      setDiscountQrUrl(null);
      setDiscountQrExpiresAt(null);
      setDiscountQrError(null);
      setDiscountQrLoading(false);
      return;
    }

    let isActive = true;
    setDiscountQrLoading(true);
    setDiscountQrError(null);
    setDiscountQrUrl(null);
    setDiscountQrExpiresAt(null);
    setDiscountQrNextAvailableAt(null);

    createDiscountToken({
      partnerName: activeDiscountCoupon.title,
      couponCode: activeDiscountCoupon.code,
    })
      .then((data) => {
        if (!isActive) {
          return;
        }
        setDiscountQrUrl(data.verifyUrl);
        setDiscountQrExpiresAt(data.expiresAt);
      })
      .catch((error) => {
        console.error('Error generating discount token:', error);
        if (!isActive) {
          return;
        }
        const nextAvailableAt =
          (error as { meta?: { nextAvailableAt?: string } } | null)?.meta?.nextAvailableAt ?? null;
        if (nextAvailableAt) {
          setDiscountQrNextAvailableAt(nextAvailableAt);
        }
        setDiscountQrError(error?.message || 'Unable to generate the QR code. Please try again.');
      })
      .finally(() => {
        if (isActive) {
          setDiscountQrLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [activeDiscountCoupon, createDiscountToken]);
  const detailsWorkoutFocusArea = useMemo(() => (detailsWorkout ? getWorkoutFocusArea(detailsWorkout) ?? '' : ''), [detailsWorkout]);
  const [editingCheckInId, setEditingCheckInId] = useState<string | null>(null);
  const [readiness, setReadiness] = useState(7);
  const [energy, setEnergy] = useState<EnergyLevel>('medium');
  const [soreness, setSoreness] = useState<EnergyLevel>('medium');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [existingMedia, setExistingMedia] = useState<WorkoutCheckInMedia[]>([]);
  const [mediaNotice, setMediaNotice] = useState<string | null>(null);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [achievedPR, setAchievedPR] = useState(false);
  const [prExercise, setPrExercise] = useState('');
  const [prValue, setPrValue] = useState('');
  const [prUnit, setPrUnit] = useState('kg');
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isPhysicianBookingOpen, setIsPhysicianBookingOpen] = useState(false);
  const [physicianBookingDate, setPhysicianBookingDate] = useState<Date | null>(null);
  const [physicianCalendarAnchor, setPhysicianCalendarAnchor] = useState<Date>(() => new Date());
  const [physicianBookingError, setPhysicianBookingError] = useState<string | null>(null);
  const [physicianSessionType, setPhysicianSessionType] = useState('');
  const [physicianSessionDetails, setPhysicianSessionDetails] = useState('');
  const [isSendingPhysicianRequest, setIsSendingPhysicianRequest] = useState(false);
  const [physicianBookingSuccess, setPhysicianBookingSuccess] = useState<string | null>(null);
  const [physicianAppointments, setPhysicianAppointments] = useState<Array<any>>([]);
  const [selectedCoachIdForMessage, setSelectedCoachIdForMessage] = useState<string | null>(null);
  const [coachMessageBody, setCoachMessageBody] = useState('');
  const [coachMessageError, setCoachMessageError] = useState<string | null>(null);
  const [exerciseImagePreview, setExerciseImagePreview] = useState<{ name: string; url: string } | null>(null);
  const [isExportingWorkoutDetails, setIsExportingWorkoutDetails] = useState(false);
  const [availablePrograms, setAvailablePrograms] = useState<Program[]>([]);
  const [isProgramsLoading, setIsProgramsLoading] = useState(false);
  const [programsError, setProgramsError] = useState<string | null>(null);
  const [selectedProgramForEnrollment, setSelectedProgramForEnrollment] = useState<Program | null>(null);
  const [isExploreProgramsOpen, setIsExploreProgramsOpen] = useState(false);
  const workoutDetailsRef = useRef<HTMLDivElement | null>(null);
  const [weeklyStartIndex, setWeeklyStartIndex] = useState(0);

  const maxWeeklyStartIndex = Math.max(0, weekDays.length - WEEKLY_VISIBLE_DAYS);
  const visibleWeekDays = useMemo(
    () => weekDays.slice(weeklyStartIndex, weeklyStartIndex + WEEKLY_VISIBLE_DAYS),
    [weekDays, weeklyStartIndex],
  );
  const weeklyRangeLabel = useMemo(() => {
    if (visibleWeekDays.length === 0) {
      return '';
    }
    const start = visibleWeekDays[0];
    const end = visibleWeekDays[visibleWeekDays.length - 1];
    const startLabel = start ? formatDisplayDate(start, { month: 'short', day: 'numeric' }) : '';
    const endLabel = end ? formatDisplayDate(end, { month: 'short', day: 'numeric' }) : '';
    if (!startLabel) {
      return '';
    }
    if (!endLabel || startLabel === endLabel) {
      return startLabel;
    }
    return `${startLabel} – ${endLabel}`;
  }, [visibleWeekDays]);
  useEffect(() => {
    setWeeklyStartIndex((current) => Math.min(current, maxWeeklyStartIndex));
  }, [maxWeeklyStartIndex]);

  const enrolledProgramIds = useMemo(() => {
    const ids = new Set<string>();
    (enrollments ?? []).forEach((enrollment) => {
      if (enrollment.program_id) {
        ids.add(enrollment.program_id);
      }
    });
    return ids;
  }, [enrollments]);

  const discoverablePrograms = useMemo(
    () => availablePrograms.filter((program) => !enrolledProgramIds.has(program.id)),
    [availablePrograms, enrolledProgramIds],
  );

  const weeklyGoalsSorted = useMemo(
    () => weeklyGoals.slice().sort((a, b) => new Date(b.week_start).getTime() - new Date(a.week_start).getTime()),
    [weeklyGoals],
  );
  const weeklyGoalStatusCounts = useMemo(() => {
    const base = {
      pending: 0,
      achieved: 0,
      partial: 0,
      not_achieved: 0,
    };
    weeklyGoalsSorted.forEach((goal) => {
      base[goal.status] += 1;
    });
    return base;
  }, [weeklyGoalsSorted]);

  const currentWeekStartDate = getWeekStartSunday(selectedDate);
  const currentWeekKey = currentWeekStartDate ? currentWeekStartDate.toISOString().slice(0, 10) : null;
  const currentWeekGoal = currentWeekKey
    ? weeklyGoalsSorted.find((goal) => goal.week_start === currentWeekKey)
    : null;
  const recentWeeklyGoals = weeklyGoalsSorted.filter((goal) => goal.week_start !== currentWeekKey);

  const formatWeekRange = useCallback((weekStart: string) => {
    const start = parseDateValue(weekStart);
    if (!start) {
      return 'Week';
    }
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${formatDisplayDate(start, { month: 'short', day: 'numeric' })} – ${formatDisplayDate(end, {
      month: 'short',
      day: 'numeric',
    })}`;
  }, []);

  const latestEnrollment = useMemo(() => {
    if (!enrollments || enrollments.length === 0) {
      return null;
    }

    return enrollments.reduce((latest, current) => {
      const latestDate = latest?.enrolled_at ?? latest?.created_at ?? '';
      const currentDate = current.enrolled_at ?? current.created_at ?? '';
      if (!latestDate) {
        return current;
      }
      const latestTime = Date.parse(latestDate);
      const currentTime = Date.parse(currentDate);
      return Number.isFinite(currentTime) && currentTime > latestTime ? current : latest;
    }, enrollments[0]);
  }, [enrollments]);

  const resolveAgeFromProfile = useCallback((): string => {
    if (!profile?.date_of_birth) {
      return '';
    }
    const birthDate = parseDateValue(profile.date_of_birth);
    if (!birthDate) {
      return '';
    }
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDelta = today.getMonth() - birthDate.getMonth();
    const hasNotHadBirthday = monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate());
    if (hasNotHadBirthday) {
      age -= 1;
    }
    return age > 0 ? String(age) : '';
  }, [profile?.date_of_birth]);

  const enrollmentPrefill = useMemo(
    () => ({
      firstName:
        profile?.first_name ??
        latestEnrollment?.profile?.first_name ??
        latestEnrollment?.lead_first_name ??
        '',
      lastName:
        profile?.last_name ??
        latestEnrollment?.profile?.last_name ??
        latestEnrollment?.lead_last_name ??
        '',
      email:
        profile?.email ??
        user?.email ??
        latestEnrollment?.lead_email ??
        '',
      phone: profile?.phone ?? latestEnrollment?.lead_phone ?? '',
      location: profile?.location ?? latestEnrollment?.lead_location ?? '',
      experience: profile?.experience_level ?? latestEnrollment?.lead_experience_level ?? '',
      goals: latestEnrollment?.lead_goals ?? '',
      injuries: latestEnrollment?.lead_injuries ?? '',
      additionalInfo: latestEnrollment?.lead_additional_info ?? '',
      age: resolveAgeFromProfile() || (latestEnrollment?.lead_age != null ? String(latestEnrollment.lead_age) : ''),
      womenOnly: latestEnrollment?.is_women_only ?? false,
    }),
    [
      profile?.first_name,
      profile?.last_name,
      profile?.email,
      profile?.phone,
      profile?.location,
      profile?.experience_level,
      user?.email,
      latestEnrollment?.profile?.first_name,
      latestEnrollment?.profile?.last_name,
      latestEnrollment?.lead_first_name,
      latestEnrollment?.lead_last_name,
      latestEnrollment?.lead_email,
      latestEnrollment?.lead_phone,
      latestEnrollment?.lead_location,
      latestEnrollment?.lead_experience_level,
      latestEnrollment?.lead_goals,
      latestEnrollment?.lead_injuries,
      latestEnrollment?.lead_additional_info,
      latestEnrollment?.lead_age,
      latestEnrollment?.is_women_only,
      resolveAgeFromProfile,
    ],
  );

  const handleEnrollmentComplete = useCallback(
    async (_programId?: string) => {
      setSelectedProgramForEnrollment(null);
      await Promise.all([reload(), loadAvailablePrograms()]);
    },
    [loadAvailablePrograms, reload],
  );

  const programCompletionAlerts = useMemo(() => {
    if (!enrollments?.length) {
      return [];
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return enrollments
      .map((enrollment) => {
        const endDate = parseDateValue(enrollment.end_date ?? null);
        if (!endDate) {
          return null;
        }
        const normalizedEnd = new Date(endDate);
        normalizedEnd.setHours(0, 0, 0, 0);
        const daysSinceEnd = Math.round((today.getTime() - normalizedEnd.getTime()) / (24 * 60 * 60 * 1000));
        if (daysSinceEnd !== 1) {
          return null;
        }
        return {
          id: enrollment.id,
          title: enrollment.program?.title ?? 'Program',
          endDateLabel: formatDisplayDate(endDate, { month: 'short', day: 'numeric', year: 'numeric' }),
          status: enrollment.status,
        };
      })
      .filter(
        (item): item is { id: string; title: string; endDateLabel: string; status: string } =>
          Boolean(item),
      );
  }, [enrollments, formatDisplayDate, parseDateValue]);

  const endingSoonAlerts = useMemo(() => {
    if (!endingSoonEnrollments?.length) {
      return [];
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return endingSoonEnrollments
      .map((enrollment: any) => {
        const endDate = parseDateValue(enrollment.end_date ?? null);
        if (!endDate) {
          return null;
        }
        const normalizedEnd = new Date(endDate);
        normalizedEnd.setHours(0, 0, 0, 0);
        if (normalizedEnd < today) {
          return null;
        }
        const daysRemaining = typeof enrollment.daysRemaining === 'number' ? enrollment.daysRemaining : null;
        return {
          id: enrollment.id,
          title: enrollment.program?.title ?? 'Program',
          endDateLabel: formatDisplayDate(endDate, { month: 'short', day: 'numeric', year: 'numeric' }),
          daysRemaining,
          programId: enrollment.program_id,
        };
      })
      .filter(
        (
          item,
        ): item is { id: string; title: string; endDateLabel: string; daysRemaining: number | null; programId: string | null } =>
          Boolean(item),
      );
  }, [endingSoonEnrollments, formatDisplayDate, parseDateValue]);

  const notificationItems = useMemo(
    () => [
      ...programCompletionAlerts.map((alert) => ({
        id: `program-complete-${alert.id}`,
        title: 'Program completed',
        message: `${alert.title} ended on ${alert.endDateLabel}.`,
        type: 'completed' as const,
        createdAt: alert.endDateLabel,
      })),
      ...endingSoonAlerts.map((alert) => ({
        id: `program-ending-${alert.id}`,
        title: 'Program ending soon',
        message:
          typeof alert.daysRemaining === 'number'
            ? `${alert.title} ends in ${alert.daysRemaining} day${alert.daysRemaining === 1 ? '' : 's'}.`
            : `${alert.title} is ending soon.`,
        type: 'ending' as const,
        createdAt: alert.daysRemaining != null ? `${alert.daysRemaining}d` : '',
      })),
      ...recentNotifications.map((notification) => ({
        id: notification.id,
        title: notification.title,
        message: notification.message,
        type: 'system' as const,
        createdAt: new Date(notification.created_at).toLocaleDateString(),
      })),
    ],
    [endingSoonAlerts, programCompletionAlerts, recentNotifications],
  );

  const notificationsCount =
    (stats?.unreadNotifications ?? 0) + programCompletionAlerts.length + endingSoonAlerts.length;

  const selectedWorkout: WorkoutWithRelations | null = useMemo(() => {
    if (!selectedWorkoutId) {
      return null;
    }
    return (
      weeklyWorkouts.find((workout) => workout.id === selectedWorkoutId) ??
      workouts.find((workout) => workout.id === selectedWorkoutId) ??
      null
    );
  }, [selectedWorkoutId, weeklyWorkouts, workouts]);
  const sessionExercises = useMemo(() => {
    if (!sessionWorkout?.workout_exercises) {
      return [];
    }
    return sessionWorkout.workout_exercises.slice();
  }, [sessionWorkout]);
  const sessionExercise = sessionExercises[sessionExerciseIndex] ?? null;
  const sessionExerciseImage = sessionExercise
    ? getExerciseImagePublicUrl(sessionExercise.image_url)
    : '';
  const sessionExerciseCount = sessionExercises.length;
  const isFirstSessionExercise = sessionExerciseIndex <= 0;
  const isLastSessionExercise = sessionExerciseIndex >= sessionExerciseCount - 1;
  const sessionTargetSets = sessionExercise?.target_sets ?? 0;
  const sessionSetProgress = Math.min(sessionCompletedSets, sessionTargetSets);
  const isSessionSetComplete = sessionTargetSets > 0 && sessionSetProgress >= sessionTargetSets;
  const sessionSetProgressPercent =
    sessionTargetSets > 0 ? Math.round((sessionSetProgress / sessionTargetSets) * 100) : 0;
  const showWorkoutCompleteCelebration =
    isWorkoutSessionOpen && Boolean(sessionExercise) && isLastSessionExercise && isSessionSetComplete;
  const sessionCardAnimationClass =
    sessionTransitionDirection === 'next'
      ? 'animate-in slide-in-from-right fade-in-0 duration-300'
      : sessionTransitionDirection === 'prev'
        ? 'animate-in slide-in-from-left fade-in-0 duration-300'
        : '';
  const restTimeLabel = useMemo(() => {
    const minutes = Math.floor(restTimeLeft / 60);
    const seconds = restTimeLeft % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }, [restTimeLeft]);
  const startRestTimer = useCallback((seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return;
    }
    setRestTimeLeft(Math.round(seconds));
    setIsRestTimerActive(true);
  }, []);
  const cancelRestTimer = useCallback(() => {
    setIsRestTimerActive(false);
    setRestTimeLeft(0);
  }, []);

  useEffect(() => {
    if (!isRestTimerActive) {
      return;
    }
    if (restTimeLeft <= 0) {
      setIsRestTimerActive(false);
      return;
    }
    const timer = window.setInterval(() => {
      setRestTimeLeft((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isRestTimerActive, restTimeLeft]);

  useEffect(() => {
    if (!sessionWorkout) {
      return;
    }
    if (sessionExerciseIndex >= sessionExercises.length) {
      setSessionExerciseIndex(Math.max(sessionExercises.length - 1, 0));
    }
  }, [sessionExerciseIndex, sessionExercises.length, sessionWorkout]);
  useEffect(() => {
    if (!isWorkoutSessionOpen) {
      setSessionCompletedSets(0);
      return;
    }
    setSessionCompletedSets(0);
  }, [isWorkoutSessionOpen, sessionExerciseIndex, sessionWorkout?.id]);
  const selectedWorkoutDate = useMemo(
    () =>
      selectedWorkout
        ? parseDateValue(selectedWorkout.scheduledDateObject ?? selectedWorkout.scheduled_date ?? null)
        : null,
    [selectedWorkout],
  );
  const selectedWorkoutFocusArea = useMemo(
    () => (selectedWorkout ? getWorkoutFocusArea(selectedWorkout) ?? '' : ''),
    [selectedWorkout],
  );
  const physicianAppointmentLabel = useMemo(
    () =>
      physicianBookingDate
        ? formatDisplayDate(physicianBookingDate, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })
        : 'Pick a date from the calendar',
    [physicianBookingDate],
  );
  useEffect(() => {
    if (!isPhysicianBookingOpen) {
      return;
    }
    const fallbackDate = selectedWorkoutDate ?? selectedDate ?? new Date();
    setPhysicianBookingDate(fallbackDate);
    setPhysicianCalendarAnchor(fallbackDate);
    setPhysicianBookingError(null);
    setPhysicianSessionType('');
    setPhysicianSessionDetails('');
    setPhysicianBookingSuccess(null);
    if (user?.id) {
      supabase
        .from('physician_appointments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => setPhysicianAppointments(data ?? []));
    }
  }, [isPhysicianBookingOpen, selectedDate, selectedWorkoutDate]);
  const selectedProgramEnrollment = useMemo(
    () => activeEnrollments.find((enrollment) => enrollment.id === selectedProgramEnrollmentId) ?? null,
    [activeEnrollments, selectedProgramEnrollmentId],
  );
  const selectedProgramEndDate = useMemo(() => {
    if (!selectedProgramEnrollment) return null;
    const explicitEnd = parseDateValue(selectedProgramEnrollment.end_date ?? null);
    if (explicitEnd) {
      return explicitEnd;
    }
    const durationWeeks = selectedProgramEnrollment.program?.duration_weeks;
    const start =
      parseDateValue(selectedProgramEnrollment.start_date ?? null) ??
      parseDateValue((selectedProgramEnrollment as { enrolled_at?: string }).enrolled_at ?? null) ??
      parseDateValue(selectedProgramEnrollment.created_at ?? null);
    if (!start || typeof durationWeeks !== 'number' || !Number.isFinite(durationWeeks) || durationWeeks <= 0) {
      return null;
    }
    const end = new Date(start);
    end.setDate(start.getDate() + durationWeeks * 7 - 1);
    return end;
  }, [parseDateValue, selectedProgramEnrollment]);
  const selectedProgramTimeProgress = useMemo(() => {
    if (!selectedProgramEnrollment) return null;
    const start = parseDateValue(selectedProgramEnrollment.start_date ?? null);
    const end = selectedProgramEndDate;
    if (!start || !end) return null;
    const now = new Date();
    const total = end.getTime() - start.getTime();
    if (total <= 0) return 100;
    const elapsed = Math.min(Math.max(now.getTime() - start.getTime(), 0), total);
    return Math.round((elapsed / total) * 100);
  }, [parseDateValue, selectedProgramEndDate, selectedProgramEnrollment]);
  const coachOptions = useMemo(
    () =>
      coachContacts.map((contact) => ({
        id: contact.id,
        name: [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Coach',
        email: contact.email,
        avatar: contact.avatar_url,
      })),
    [coachContacts],
  );
  const coachLookup = useMemo(() => {
    const map = new Map<string, { name: string; avatar: string | null }>();
    coachOptions.forEach((coach) => {
      map.set(coach.id, { name: coach.name, avatar: coach.avatar ?? null });
    });
    return map;
  }, [coachOptions]);
  const enrollmentHighlights = useMemo(
    () =>
      activeEnrollments.map((enrollment) => {
        const programTitle = enrollment.program?.title ?? 'Program';
        const coachId = enrollment.program?.created_by ?? null;
        const coachMeta = coachId ? coachLookup.get(coachId) : undefined;
        const fallbackCoach = coachId ? coachContacts.find((contact) => contact.id === coachId) : undefined;
        const coachName =
          coachMeta?.name ??
          (fallbackCoach ? [fallbackCoach.first_name, fallbackCoach.last_name].filter(Boolean).join(' ') : null) ??
          'Coach';
        const coachAvatar = coachMeta?.avatar ?? fallbackCoach?.avatar_url ?? null;
        const coachInitials =
          coachName
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((segment) => segment.charAt(0).toUpperCase())
            .join('') || 'C';

        return {
          id: enrollment.id,
          programTitle,
          coachName,
          coachAvatar,
          coachInitials,
          subtitle: enrollment.program?.subtitle ?? null,
        };
      }),
    [activeEnrollments, coachContacts, coachLookup],
  );
  const programSummaries = useMemo(() => {
    const unique = new Map<string, { programTitle: string; subtitle: string | null }>();
    enrollmentHighlights.forEach((highlight) => {
      if (!unique.has(highlight.programTitle)) {
        unique.set(highlight.programTitle, { programTitle: highlight.programTitle, subtitle: highlight.subtitle });
      }
    });
    return Array.from(unique.values());
  }, [enrollmentHighlights]);
  const shouldShowExplorePrograms =
    activeExperience === 'athlete' && (activeEnrollments.length === 0 || endingSoonEnrollments.length > 0);
  const coachSummaries = useMemo(() => {
    const unique = new Map<string, { coachName: string; coachAvatar: string | null; coachInitials: string }>();
    enrollmentHighlights.forEach((highlight) => {
      if (!unique.has(highlight.coachName)) {
        unique.set(highlight.coachName, {
          coachName: highlight.coachName,
          coachAvatar: highlight.coachAvatar,
          coachInitials: highlight.coachInitials,
        });
      }
    });
    return Array.from(unique.values());
  }, [enrollmentHighlights]);
  const verifiedCoachFeedback = useMemo(() => {
    return checkIns
      .map((entry) => {
        if (entry.status !== 'reviewed' || !entry.coach_notes) {
          return null;
        }
        const parsedNotes = deserializeCoachNotes(entry.coach_notes);
        const displayNotes =
          parsedNotes.coachNotes || (parsedNotes.focusArea ? `Focus Area: ${parsedNotes.focusArea}` : '');
        if (!displayNotes) {
          return null;
        }
        const timestamp = entry.updated_at ?? entry.created_at;
        const sortValue = timestamp ? new Date(timestamp).getTime() : 0;
        return { entry, displayNotes, sortValue };
      })
      .filter((item): item is { entry: WorkoutCheckIn; displayNotes: string; sortValue: number } => Boolean(item))
      .sort((a, b) => b.sortValue - a.sortValue);
  }, [checkIns]);
  const profileAvatarUrl = profile?.avatar_url ?? null;
  const profileInitials = useMemo(() => {
    const first = profile?.first_name?.charAt(0) ?? '';
    const last = profile?.last_name?.charAt(0) ?? '';
    const initials = `${first}${last}`.trim();
    if (initials) {
      return initials.toUpperCase();
    }
    if (profile?.email?.length) {
      return profile.email.charAt(0).toUpperCase();
    }
    return 'A';
  }, [profile?.email, profile?.first_name, profile?.last_name]);
  const activeCoachId = useMemo(() => {
    return selectedCoachIdForMessage ?? primaryCoachId ?? coachOptions[0]?.id ?? null;
  }, [coachOptions, primaryCoachId, selectedCoachIdForMessage]);
  const conversation = useMemo(() => {
    if (!activeCoachId) {
    return [] as CoachMessage[];
    }
    return coachMessages
      .filter(
        (message) =>
          (message.sender_id === user?.id && message.receiver_id === activeCoachId) ||
          (message.sender_id === activeCoachId && message.receiver_id === user?.id),
      )
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [activeCoachId, coachMessages, user?.id]);

  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollAdjustRef = useRef<{ prevScrollHeight: number } | null>(null);
  const messagesLoadCooldownRef = useRef(0);
  const messagesTouchStartRef = useRef<number | null>(null);
  const sessionSwipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const [visibleMessageCount, setVisibleMessageCount] = useState(INITIAL_MESSAGES_COUNT);

  const visibleConversation = useMemo(() => {
    if (conversation.length <= visibleMessageCount) {
      return conversation;
    }
    return conversation.slice(-visibleMessageCount);
  }, [conversation, visibleMessageCount]);

  const hasMoreMessages = visibleMessageCount < conversation.length;

  const unreadCoachMessages = useMemo(() => {
    if (!user?.id) {
      return 0;
    }
    return coachMessages.filter((message) => message.receiver_id === user.id && !message.is_read).length;
  }, [coachMessages, user?.id]);

  const coachUnreadCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (!user?.id) {
      return counts;
    }
    coachMessages.forEach((message) => {
      if (message.receiver_id !== user.id || message.is_read) {
        return;
      }
      const senderId = message.sender_id;
      if (!senderId) {
        return;
      }
      counts.set(senderId, (counts.get(senderId) ?? 0) + 1);
    });
    return counts;
  }, [coachMessages, user?.id]);

  useEffect(() => {
    if (!selectedCoachIdForMessage && (primaryCoachId || coachOptions[0]?.id)) {
      setSelectedCoachIdForMessage(primaryCoachId ?? coachOptions[0]?.id ?? null);
    }
  }, [coachOptions, primaryCoachId, selectedCoachIdForMessage]);

  useEffect(() => {
    setVisibleMessageCount(INITIAL_MESSAGES_COUNT);
    pendingScrollAdjustRef.current = null;
    messagesLoadCooldownRef.current = 0;
    const container = messagesScrollRef.current;
    if (container) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  }, [activeCoachId]);

  const requestLoadEarlierMessages = useCallback(() => {
    const container = messagesScrollRef.current;
    if (!container || !hasMoreMessages) {
      return;
    }
    const now = Date.now();
    if (now - messagesLoadCooldownRef.current < 250) {
      return;
    }
    messagesLoadCooldownRef.current = now;
    pendingScrollAdjustRef.current = { prevScrollHeight: container.scrollHeight };
    setVisibleMessageCount((prev) => Math.min(conversation.length, prev + MESSAGES_PAGE_SIZE));
  }, [conversation.length, hasMoreMessages]);

  const handleMessagesScroll = useCallback(() => {
    const container = messagesScrollRef.current;
    if (!container || !hasMoreMessages) {
      return;
    }
    if (container.scrollTop <= 24) {
      requestLoadEarlierMessages();
    }
  }, [hasMoreMessages, requestLoadEarlierMessages]);

  const handleMessagesWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      const container = messagesScrollRef.current;
      if (!container || !hasMoreMessages) {
        return;
      }
      if (container.scrollTop <= 24 && event.deltaY < 0) {
        requestLoadEarlierMessages();
      }
    },
    [hasMoreMessages, requestLoadEarlierMessages],
  );

  const handleMessagesTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    messagesTouchStartRef.current = event.touches[0]?.clientY ?? null;
  }, []);

  const handleMessagesTouchMove = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      const container = messagesScrollRef.current;
      if (!container || !hasMoreMessages) {
        return;
      }
      const startY = messagesTouchStartRef.current;
      const currentY = event.touches[0]?.clientY ?? null;
      if (startY == null || currentY == null) {
        return;
      }
      if (container.scrollTop <= 24 && currentY - startY > 24) {
        requestLoadEarlierMessages();
      }
    },
    [hasMoreMessages, requestLoadEarlierMessages],
  );

  useLayoutEffect(() => {
    const container = messagesScrollRef.current;
    const pending = pendingScrollAdjustRef.current;
    if (!container || !pending) {
      return;
    }
    const nextScrollHeight = container.scrollHeight;
    const delta = nextScrollHeight - pending.prevScrollHeight;
    container.scrollTo({ top: container.scrollTop + delta, behavior: 'smooth' });
    pendingScrollAdjustRef.current = null;
  }, [visibleConversation.length]);

  useEffect(() => {
    if (!sessionTransitionDirection) {
      return;
    }
    const timer = window.setTimeout(() => {
      setSessionTransitionDirection(null);
    }, 260);
    return () => window.clearTimeout(timer);
  }, [sessionTransitionDirection, sessionExerciseIndex]);
  const selectWorkoutForDate = useCallback(
    (target: Date, preserveIfMatch = false) => {
      const targetKey = formatDateKey(target);
      if (!targetKey) {
        return;
      }

      const matching = workouts
        .map((workout) => {
          const date = parseDateValue(
            workout.scheduledDateObject ?? workout.scheduled_date ?? null,
          );
          return {
            workout,
            key: formatDateKey(workout.scheduled_date ?? workout.scheduledDateObject),
            date,
          };
        })
        .filter((entry) => entry.key === targetKey)
        .sort((a, b) => {
          const aTime = a.date?.getTime() ?? 0;
          const bTime = b.date?.getTime() ?? 0;
          return aTime - bTime;
        })
        .map((entry) => entry.workout);

      if (matching.length === 0) {
        if (!preserveIfMatch) {
          setSelectedWorkoutId(null);
        }
        return;
      }

      setSelectedWorkoutId((current) => {
        if (preserveIfMatch && current && matching.some((workout) => workout.id === current)) {
          return current;
        }
        return matching[0].id;
      });
    },
    [workouts],
  );

  useEffect(() => {
    selectWorkoutForDate(selectedDate, true);
  }, [selectedDate, selectWorkoutForDate]);

  useEffect(() => {
    if (weeklyWorkouts.length === 0) {
      setSelectedWorkoutId(null);
      return;
    }
    selectWorkoutForDate(selectedDate, true);
  }, [weeklyWorkouts, selectWorkoutForDate, selectedDate]);

  const submittedCheckInDates = useMemo(() => {
    const dateSet = new Set<string>();
    checkIns.forEach((checkIn) => {
      const rawDate =
        checkIn.workout?.scheduled_date ?? checkIn.workout?.scheduledDateObject ?? checkIn.created_at;
      const key = formatDateKey(rawDate);
      if (!key) {
        return;
      }
      dateSet.add(key);
    });
    return dateSet;
  }, [checkIns]);

  const checkInLookup = useMemo(() => {
    const map = new Map<string, CheckInMeta>();
    const now = Date.now();

    checkIns.forEach((checkIn) => {
      const submittedAt = new Date(checkIn.created_at).getTime();
      let canEdit = now - submittedAt <= REVISION_WINDOW_MS;

      let revisionDeadline: number | null = null;
      if (checkIn.status === 'needs_revision' && checkIn.revision_requested_at) {
        const revisionRequestedAt = new Date(checkIn.revision_requested_at).getTime();
        if (Number.isFinite(revisionRequestedAt)) {
          revisionDeadline = revisionRequestedAt + REVISION_WINDOW_MS;
          if (!canEdit) {
            canEdit = now <= revisionDeadline;
          }
        }
      }

      const existing = map.get(checkIn.workout_id);
      if (!existing || canEdit) {
        map.set(checkIn.workout_id, { checkIn, canEdit, revisionDeadline });
      }
    });
    return map;
  }, [checkIns]);
  const selectedCheckInMeta = selectedWorkout ? checkInLookup.get(selectedWorkout.id) ?? null : null;
  const revisionDeadlineLabel =
    selectedCheckInMeta?.revisionDeadline != null
      ? new Date(selectedCheckInMeta.revisionDeadline).toLocaleString()
      : null;

  const openCheckInModal = useCallback(
    (workout: WorkoutWithRelations) => {
      const checkInMeta = checkInLookup.get(workout.id);
      if (checkInMeta) {
        if (!checkInMeta.canEdit) {
          const lockedMessage =
            checkInMeta.checkIn.status === 'needs_revision'
              ? 'The 24-hour revision window has expired for this check-in.'
              : 'This check-in is locked because it was submitted more than 24 hours ago.';
          setCheckInError(lockedMessage);
          return;
        }
        const { checkIn } = checkInMeta;
        setEditingCheckInId(checkIn.id);
        setReadiness(checkIn.readiness_score ?? 7);
        setEnergy((checkIn.energy_level as EnergyLevel) ?? 'medium');
        setSoreness((checkIn.soreness_level as EnergyLevel) ?? 'medium');
        setNotes(checkIn.notes ?? '');
        setFiles([]);
        setExistingMedia(checkIn.media ?? []);
        setAchievedPR(Boolean(checkIn.achieved_pr));
        setPrExercise(checkIn.pr_exercise ?? '');
        setPrValue(checkIn.pr_value != null ? String(checkIn.pr_value) : '');
        setPrUnit(checkIn.pr_unit ?? 'kg');
      } else {
        setEditingCheckInId(null);
        setReadiness(7);
        setEnergy('medium');
        setSoreness('medium');
        setNotes('');
        setFiles([]);
        setExistingMedia([]);
        setAchievedPR(false);
        setPrExercise('');
        setPrValue('');
        setPrUnit('kg');
      }
      setSelectedWorkoutId(workout.id);
      const parsedDate = parseDateValue(workout.scheduledDateObject ?? workout.scheduled_date ?? null);
      if (parsedDate) {
        setSelectedDate(parsedDate);
      }
      setIsCheckInModalOpen(true);
    },
    [checkInLookup, setSelectedDate],
  );

  const openWorkoutDetails = useCallback(
    (workout: WorkoutWithRelations) => {
      setSelectedWorkoutId(workout.id);
      setDetailsWorkout(workout);
      const parsedDate = parseDateValue(workout.scheduledDateObject ?? workout.scheduled_date ?? null);
      if (parsedDate) {
        setSelectedDate(parsedDate);
      }
      setIsDetailsModalOpen(true);
    },
    [setSelectedDate],
  );

  const closeWorkoutDetails = useCallback(() => {
    setDetailsWorkout(null);
    setIsDetailsModalOpen(false);
  }, []);

  const startWorkoutSession = useCallback(
    (workout: WorkoutWithRelations) => {
      cancelRestTimer();
      setSelectedWorkoutId(workout.id);
      setSessionWorkout(workout);
      setSessionExerciseIndex(0);
      setSessionCompletedSets(0);
      setSessionTransitionDirection(null);
      const parsedDate = parseDateValue(workout.scheduledDateObject ?? workout.scheduled_date ?? null);
      if (parsedDate) {
        setSelectedDate(parsedDate);
      }
      setIsWorkoutSessionOpen(true);
    },
    [cancelRestTimer, setSelectedDate],
  );

  const closeWorkoutSession = useCallback(() => {
    cancelRestTimer();
    setIsWorkoutSessionOpen(false);
    setSessionWorkout(null);
    setSessionExerciseIndex(0);
    setSessionTransitionDirection(null);
  }, [cancelRestTimer]);

  const handleWorkoutCompleteDismiss = useCallback(() => {
    closeWorkoutSession();
    onNavigateHome();
  }, [closeWorkoutSession, onNavigateHome]);

  const handleSessionPrev = useCallback(() => {
    setSessionTransitionDirection('prev');
    setSessionExerciseIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleSessionNext = useCallback(() => {
    setSessionTransitionDirection('next');
    setSessionExerciseIndex((prev) => prev + 1);
  }, []);

  const handleLogSet = useCallback(() => {
    if (!sessionExercise || sessionTargetSets <= 0 || sessionSetProgress >= sessionTargetSets) {
      return;
    }
    const nextCount = Math.min(sessionSetProgress + 1, sessionTargetSets);
    setSessionCompletedSets(nextCount);
    if (sessionExercise.rest_seconds && nextCount < sessionTargetSets) {
      startRestTimer(sessionExercise.rest_seconds);
    }
  }, [sessionExercise, sessionSetProgress, sessionTargetSets, startRestTimer]);

  const handleSessionTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) {
      return;
    }
    sessionSwipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleSessionTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      const start = sessionSwipeStartRef.current;
      sessionSwipeStartRef.current = null;
      if (!start) {
        return;
      }
      const touch = event.changedTouches[0];
      if (!touch) {
        return;
      }
      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;
      if (Math.abs(deltaX) < 60 || Math.abs(deltaX) < Math.abs(deltaY)) {
        return;
      }
      if (deltaX < 0) {
        if (isLastSessionExercise) {
          closeWorkoutSession();
        } else {
          handleSessionNext();
        }
        return;
      }
      if (!isFirstSessionExercise) {
        handleSessionPrev();
      }
    },
    [closeWorkoutSession, handleSessionNext, handleSessionPrev, isFirstSessionExercise, isLastSessionExercise],
  );

  const closeFeedbackModal = useCallback(() => {
    setIsFeedbackModalOpen(false);
  }, []);

  
  const handleExportWorkoutDetails = useCallback(async () => {
    if (!detailsWorkout) {
      return;
    }

    setIsExportingWorkoutDetails(true);

    try {
      const { jsPDF } = await import('jspdf');

      const escapeText = (value: string | number | null | undefined) =>
        String(value ?? '').replace(/\s+/g, ' ').trim() || '—';
      const formatSeconds = (seconds?: number | null) => {
        if (!seconds || Number.isNaN(seconds)) {
          return '—';
        }
        if (seconds >= 60) {
          const mins = Math.floor(seconds / 60);
          const rem = seconds % 60;
          return rem ? `${mins}m ${rem}s` : `${mins}m`;
        }
        return `${seconds}s`;
      };

      const workoutTitle = escapeText(detailsWorkout.title ?? 'Workout');
      const safeTitle =
        detailsWorkout.title?.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, '') || 'workout';
      const displayDate = formatDisplayDate(
        detailsWorkout.scheduledDateObject ?? detailsWorkout.scheduled_date ?? null,
        {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        },
      );
      const coachNotes = deserializeCoachNotes(detailsWorkout.coach_notes).coachNotes ?? '';
      const exercises = (detailsWorkout.workout_exercises ?? []).map((exercise, idx) => {
        const sets = (exercise.exercise_sets ?? []).map((set, setIdx) => {
          const label = set.set_number ?? setIdx + 1;
          const reps = set.reps ?? '—';
          const weight = set.weight ? `${set.weight}` : '';
          const rpe = set.rpe ? ` · RPE ${set.rpe}` : '';
          const weightPart = weight ? ` @ ${weight}` : '';
          return `Set ${label}: ${reps}${weightPart}${rpe}`;
        });

        const targetSets = exercise.target_sets ?? null;
        const targetReps = exercise.target_reps ?? null;
        const targetWeight = exercise.target_weight ?? null;
        const targetRpe = exercise.target_rpe ?? null;
        const basePrescription =
          targetSets || targetReps || targetWeight || targetRpe
            ? `${targetSets ?? '—'} x ${targetReps ?? 'reps'}${targetWeight ? ` @ ${targetWeight}` : ''}${
                targetRpe ? ` · RPE ${targetRpe}` : ''
              }`
            : '—';

        return {
          order: exercise.order_in_workout ?? idx + 1,
          name: escapeText(exercise.exercise_name ?? 'Exercise'),
          prescription: escapeText(sets.length > 0 ? sets.join(' | ') : basePrescription),
          rest: escapeText(formatSeconds(exercise.rest_seconds ?? null)),
          notes: escapeText(exercise.notes ?? ''),
          imageUrl: exercise.image_url ?? null,
        };
      });

      const toDataUrl = async (
        url: string | null,
      ): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG'; width: number; height: number } | null> => {
        if (!url) {
          return null;
        }
        try {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`status ${response.status}`);
          }
          const blob = await response.blob();
          const bitmap = await createImageBitmap(blob);
          const width = bitmap.width || 1;
          const height = bitmap.height || 1;
          const arrayBuffer = await blob.arrayBuffer();
          const base64 = btoa(new Uint8Array(arrayBuffer).reduce((acc, byte) => acc + String.fromCharCode(byte), ''));
          bitmap.close?.();

          const contentType = response.headers.get('Content-Type') || 'image/png';
          const format = contentType.includes('jpeg') || contentType.includes('jpg') ? 'JPEG' : 'PNG';
          return { dataUrl: `data:${contentType};base64,${base64}`, format, width, height };
        } catch (imageError) {
          console.warn('Image fetch failed for export', url, imageError);
          return null;
        }
      };

      const logoUrl = new URL('/black_logo.png', window.location.origin).href;
      const logoDataUrl = await toDataUrl(logoUrl);

      const exerciseImages = await Promise.all(
        exercises.map(async (exercise) => ({
          name: exercise.name,
          image: await toDataUrl(exercise.imageUrl ?? null),
        })),
      );

      const doc = new jsPDF();
      const margin = 14;
      const pageHeight = doc.internal.pageSize.getHeight();
      const tableWidths = [10, 40, 60, 20, 52];
      const lineHeight = 6;
      let y = margin;

      const fitImage = (width: number, height: number, maxWidth: number, maxHeight: number) => {
        if (!width || !height) {
          return { width: maxWidth, height: maxHeight };
        }
        const scale = Math.min(maxWidth / width, maxHeight / height, 1);
        return { width: width * scale, height: height * scale };
      };

      const ensureSpace = (height: number) => {
        if (y + height > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
      };

      doc.setFontSize(18);
      if (logoDataUrl) {
        const logoDims = fitImage(logoDataUrl.width, logoDataUrl.height, 48, 18);
        doc.addImage(logoDataUrl.dataUrl, logoDataUrl.format, margin, y - 2, logoDims.width, logoDims.height);
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.text('ELYES LIFT ACADEMY', margin + logoDims.width + 8, y + 4);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(14);
        doc.text(workoutTitle, margin + logoDims.width + 8, y + 14);
        y += Math.max(logoDims.height + 8, 20);
        doc.setFontSize(16);
      } else {
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.text('ELYES LIFT ACADEMY', margin, y + 4);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(14);
        doc.text(workoutTitle, margin, y + 14);
        y += 20;
        doc.setFontSize(16);
      }

      doc.setFontSize(11);
      if (displayDate) {
        doc.text(escapeText(displayDate), margin, y);
        y += 6;
      }

      const metaChips = [
        detailsWorkoutFocusArea ? `Focus: ${escapeText(detailsWorkoutFocusArea)}` : null,
        detailsWorkout.duration_minutes ? `Duration: ${detailsWorkout.duration_minutes} min` : null,
      ].filter(Boolean) as string[];
      if (metaChips.length > 0) {
        doc.text(metaChips.join('   •   '), margin, y);
        y += 8;
      }

      ensureSpace(12);
      const tableWidthTotal = tableWidths.reduce((a, b) => a + b, 0);
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.setFillColor(239, 68, 68); // red header band
      doc.rect(margin, y, tableWidthTotal, 10, 'F');
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y + 10, tableWidthTotal, 2, 'F');
      doc.setFont('helvetica', 'bold');
      const headers = ['#', 'Exercise', 'Prescription', 'Rest', 'Notes'];
      let x = margin + 2;
      headers.forEach((header, idx) => {
        doc.text(header, x, y + 7);
        x += tableWidths[idx];
      });
      doc.setFont('helvetica', 'normal');
      y += 10;

      if (exercises.length === 0) {
        ensureSpace(12);
        doc.text('No exercises listed.', margin, y + 6);
        y += 12;
      } else {
        exercises.forEach((exercise) => {
          const cells = [
            String(exercise.order),
            exercise.name,
            exercise.prescription,
            exercise.rest,
            exercise.notes || '—',
          ];
          const wrapped = cells.map((cell, idx) => doc.splitTextToSize(cell, tableWidths[idx] - 4));
          const rowHeight = Math.max(...wrapped.map((lines: string[]) => Math.max(lines.length, 1))) * lineHeight + 4;
          ensureSpace(rowHeight);

          let cellX = margin;
          wrapped.forEach((lines: string[], idx) => {
            doc.setDrawColor(226, 232, 240);
            doc.rect(cellX, y, tableWidths[idx], rowHeight);
            doc.text(lines, cellX + 2, y + 6);
            cellX += tableWidths[idx];
          });
          y += rowHeight;
        });
      }

      ensureSpace(18);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Coach notes', margin, y + 4);
      doc.setFont('helvetica', 'normal');
      const notesLines = doc.splitTextToSize(coachNotes || '—', tableWidthTotal - 4);
      const notesHeight = Math.max(notesLines.length, 1) * lineHeight + 6;
      y += 8;
      ensureSpace(notesHeight);
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, y, tableWidthTotal, notesHeight);
      doc.text(notesLines, margin + 2, y + 6);
      y += notesHeight;

      const imagesToRender = exerciseImages.filter((entry) => Boolean(entry.image));
      if (imagesToRender.length > 0) {
        ensureSpace(30);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Exercise visuals', margin, y + 4);
        doc.setFont('helvetica', 'normal');
        y += 10;

        const maxWidth = 70;
        const maxHeight = 40;
        let col = 0;
        let rowTop = y;
        imagesToRender.forEach((entry) => {
          const xPos = margin + col * (maxWidth + 10);
          const dims = fitImage(entry.image!.width, entry.image!.height, maxWidth, maxHeight);
          ensureSpace(dims.height + 18);
          doc.addImage(entry.image!.dataUrl, entry.image!.format, xPos, rowTop, dims.width, dims.height);
          doc.text(entry.name, xPos, rowTop + dims.height + 6);
          col += 1;
          if (col === 2) {
            col = 0;
            rowTop += Math.max(dims.height, maxHeight) + 14;
            y = rowTop;
          }
        });
        y = rowTop + maxHeight + 14;
      }

      // Footer
      const footerY = pageHeight - margin / 2;
      doc.setFontSize(9);
      doc.setTextColor(75, 85, 99);
      doc.text('elyesaccademylift@gmail.com  •  Strength Training · Coaching · Programming', margin, footerY);

      doc.save(`${safeTitle}-plan.pdf`);
    } catch (error) {
      console.error('Failed to export workout plan', error);
    } finally {
      setIsExportingWorkoutDetails(false);
    }
  }, [detailsWorkout, detailsWorkoutFocusArea]);


  const handleMonthStep = useCallback(
    (offset: number) => {
      const next = new Date(selectedDate);
      next.setDate(1);
      next.setMonth(next.getMonth() + offset);
      setSelectedDate(next);
    },
    [selectedDate],
  );

  const buildPhysicianCalendarDays = useCallback((anchor: Date) => {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    const days: Date[] = [];
    const startDay = start.getDay();

    for (let i = startDay; i > 0; i -= 1) {
      const date = new Date(start);
      date.setDate(start.getDate() - i);
      days.push(date);
    }

    for (let day = 1; day <= end.getDate(); day += 1) {
      days.push(new Date(anchor.getFullYear(), anchor.getMonth(), day));
    }

    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i += 1) {
      const date = new Date(end);
      date.setDate(end.getDate() + i);
      days.push(date);
    }

    return days;
  }, []);

  const physicianCalendarDays = useMemo(
    () => buildPhysicianCalendarDays(physicianCalendarAnchor),
    [buildPhysicianCalendarDays, physicianCalendarAnchor],
  );

  const handlePhysicianMonthStep = useCallback((offset: number) => {
    setPhysicianCalendarAnchor((current) => {
      const next = new Date(current);
      next.setDate(1);
      next.setMonth(next.getMonth() + offset);
      return next;
    });
  }, []);

  const hasWorkoutScheduledOnDate = useCallback(
    (day: Date) => {
      const dayKey = formatDateKey(day);
      if (!dayKey) {
        return false;
      }
      return (
        weeklyWorkouts.some(
          (workout) => formatDateKey(workout.scheduled_date ?? workout.scheduledDateObject) === dayKey,
        ) ||
        workouts.some((workout) => formatDateKey(workout.scheduled_date ?? workout.scheduledDateObject) === dayKey)
      );
    },
    [weeklyWorkouts, workouts],
  );

  const sendPhysicianAppointmentEmail = useCallback(async () => {
    if (!physicianBookingDate) {
      setPhysicianBookingError('Pick an appointment date from the calendar.');
      return;
    }
    if (!physicianSessionType) {
      setPhysicianBookingError('Choose a session type to include with your request.');
      return;
    }
    if (!primaryCoachId) {
      setPhysicianBookingError('No coach is assigned yet. Please message support to connect a coach.');
      return;
    }
    if (primaryCoachId === user?.id) {
      setPhysicianBookingError('Unable to send to yourself. Please contact support to update your coach assignment.');
      return;
    }
    if (!user?.id) {
      setPhysicianBookingError('You must be signed in to send this request.');
      return;
    }

    const dateLabel = formatDisplayDate(physicianBookingDate, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const athleteName =
      [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() ||
      profile?.email ||
      user?.email ||
      'ELA athlete';
    const athleteEmail = profile?.email ?? user?.email ?? '';
    const athletePhone = profile?.phone ?? '';
    const programTitle =
      selectedProgramEnrollment?.program?.title ??
      activeEnrollments[0]?.program?.title ??
      'Program not specified';
    const sessionLabel = physicianSessionType;
    const sessionDetails = physicianSessionDetails.trim();

    const requestDate = [
      physicianBookingDate.getFullYear(),
      String(physicianBookingDate.getMonth() + 1).padStart(2, '0'),
      String(physicianBookingDate.getDate()).padStart(2, '0'),
    ].join('-');

    const appointmentResponse = await supabase.functions.invoke<{
      success: boolean;
      appointment?: { id: string };
      error?: string;
    }>('physician-appointments', {
      body: {
        action: 'request',
        requestedDate: requestDate,
        sessionType: sessionLabel,
        sessionDetails,
      },
    });

    if (appointmentResponse.error || !appointmentResponse.data?.success || !appointmentResponse.data.appointment?.id) {
      setPhysicianBookingError('Unable to create appointment. Please try again.');
      return;
    }

    const appointmentId = appointmentResponse.data.appointment.id;

    const payload = {
      id: appointmentId,
      kind: 'physician_request',
      status: 'pending' as const,
      requestedDate: requestDate,
      dateLabel,
      sessionType: sessionLabel,
      sessionDetails,
      athlete: {
        id: user.id,
        name: athleteName,
        email: athleteEmail || null,
        phone: athletePhone || null,
        program: programTitle,
      },
      createdAt: new Date().toISOString(),
    };

    setIsSendingPhysicianRequest(true);
    setPhysicianBookingError(null);
    setPhysicianBookingSuccess(null);
    const result = await sendCoachMessage(primaryCoachId, `${PHYSICIAN_REQUEST_PREFIX} ${JSON.stringify(payload)}`);
    setIsSendingPhysicianRequest(false);

    if (!result?.success) {
      setPhysicianBookingError('Unable to send the request. Please try again or message your coach.');
      return;
    }

    setPhysicianBookingSuccess('Request sent to your coach. They will approve or send next steps.');
    supabase
      .from('physician_appointments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setPhysicianAppointments(data ?? []));
  }, [
    activeEnrollments,
    physicianBookingDate,
    physicianSessionDetails,
    physicianSessionType,
    primaryCoachId,
    profile?.email,
    profile?.first_name,
    profile?.last_name,
    profile?.phone,
    selectedProgramEnrollment,
    sendCoachMessage,
    user?.email,
    user?.id,
  ]);

  const closeCheckInModal = useCallback(() => {
    setIsCheckInModalOpen(false);
    setCheckInError(null);
    setEditingCheckInId(null);
    setReadiness(7);
    setEnergy('medium');
    setSoreness('medium');
    setNotes('');
    setFiles([]);
    setExistingMedia([]);
    setMediaNotice(null);
    setAchievedPR(false);
    setPrExercise('');
    setPrValue('');
    setPrUnit('kg');
  }, []);

  const MAX_CHECKIN_MEDIA = 5;

  const handleFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    if (selected.length === 0) {
      return;
    }

    const remainingSlots = Math.max(0, MAX_CHECKIN_MEDIA - existingMedia.length - files.length);
    if (remainingSlots <= 0) {
      setMediaNotice('You already have five uploads. Remove one to add a new clip.');
      const input = event.target as HTMLInputElement;
      input.value = '';
      return;
    }

    const next = selected.slice(0, remainingSlots);
    if (next.length < selected.length) {
      const plural = remainingSlots === 1 ? '' : 's';
      setMediaNotice(`Only ${remainingSlots} more video${plural} can be added. Remove an upload to free up space.`);
    } else {
      setMediaNotice(null);
    }

    setFiles([...files, ...next]);
    const input = event.target as HTMLInputElement;
    input.value = '';
  };

  const handleFileRemove = (index: number) => {
    setFiles((previous) => {
      const next = previous.filter((_, idx) => idx !== index);
      if (next.length + existingMedia.length < MAX_CHECKIN_MEDIA) {
        setMediaNotice(null);
      }
      return next;
    });
  };

  const handleExistingMediaRemove = (mediaId: string) => {
    setExistingMedia((previous) => previous.filter((media) => media.id !== mediaId));
    setMediaNotice(null);
  };

  const openMessageModal = useCallback(
    (coachId?: string) => {
      setCoachMessageError(null);
      setCoachMessageBody('');
      setSelectedCoachIdForMessage(coachId ?? primaryCoachId ?? coachOptions[0]?.id ?? null);
      setIsMessageModalOpen(true);
      if (user?.id) {
        refreshCoachMessages(user.id);
      }
    },
    [coachOptions, primaryCoachId, refreshCoachMessages, user?.id],
  );

  const closeMessageModal = useCallback(() => {
    setIsMessageModalOpen(false);
    setCoachMessageBody('');
    setCoachMessageError(null);
  }, []);

  const handleSendCoachMessage = useCallback(async () => {
    if (!activeCoachId) {
      setCoachMessageError('No coach selected.');
      return;
    }
    if (!coachMessageBody.trim()) {
      setCoachMessageError('Please enter a message.');
      return;
    }
    const result = await sendCoachMessage(activeCoachId, coachMessageBody.trim());
    if (!result.success) {
      setCoachMessageError(typeof result.error === 'string' ? result.error : 'Unable to send message.');
      return;
    }
    setCoachMessageBody('');
    setCoachMessageError(null);
  }, [activeCoachId, coachMessageBody, sendCoachMessage]);

  const handleSubmitCheckIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedWorkout) {
      setCheckInError('Select a workout to submit a check-in.');
      return;
    }
    setCheckInError(null);

    if (!user?.id) {
      setCheckInError('You must be signed in to submit a check-in.');
      return;
    }

    let success = false;
    const trimmedExercise = prExercise.trim();
    const trimmedUnit = prUnit.trim();
    const parsedPrValue =
      prValue.trim().length > 0 && !Number.isNaN(Number(prValue)) ? Number(prValue) : undefined;

    if (achievedPR) {
      if (!trimmedExercise) {
        setCheckInError('Please provide the exercise name for your new personal record.');
        return;
      }
      if (parsedPrValue === undefined) {
        setCheckInError('Please enter a valid value for your personal record.');
        return;
      }
      if (!trimmedUnit) {
        setCheckInError('Please specify the unit for your personal record (kg, lb, reps, etc.).');
        return;
      }
    }

    const sessionMetrics = {
      readinessScore: readiness,
      energyLevel: energy,
      sorenessLevel: soreness,
      notesLength: notes.trim().length,
      achievedPR,
      prExercise: trimmedExercise || null,
      prValue: parsedPrValue ?? null,
      prUnit: trimmedUnit || null,
    };

    const shouldResetRevision = selectedCheckInMeta?.checkIn.status === 'needs_revision';

    if (editingCheckInId) {
      const result = await updateWorkoutCheckIn(editingCheckInId, {
        notes: notes.trim() || undefined,
        readinessScore: readiness,
        energyLevel: energy,
        sorenessLevel: soreness,
        achievedPR,
        prExercise: trimmedExercise || undefined,
        prValue: parsedPrValue,
        prUnit: trimmedUnit || undefined,
        performanceMetrics: sessionMetrics,
        retainMediaIds: existingMedia.map((media) => media.id),
        mediaFiles: files,
        userId: user.id,
        workoutId: selectedWorkout.id,
        resetRevision: shouldResetRevision,
      });
      if (!result) {
        setCheckInError('Unable to update your check-in. Please try again.');
        return;
      }
      success = true;
    } else {
      const result = await submitCheckIn({
        workoutId: selectedWorkout.id,
        notes: notes.trim() || undefined,
        readinessScore: readiness,
        energyLevel: energy,
        sorenessLevel: soreness,
        achievedPR,
        prExercise: trimmedExercise || undefined,
        prValue: parsedPrValue,
        prUnit: trimmedUnit || undefined,
        performanceMetrics: sessionMetrics,
        mediaFiles: files,
      });
      if (!result.success) {
        const message =
          typeof result.error === 'string'
            ? result.error
            : (result.error as { message?: string })?.message ?? 'Unable to submit check-in. Please try again.';
        setCheckInError(message);
        return;
      }
      success = true;
    }

    if (success && user?.id) {
      await refreshCheckIns(user.id);
    }
    if (success) {
      await refreshWeeklySchedule(selectedDate);
    }
    closeCheckInModal();
  };

  const renderCalendarCell = (day: Date) => {
    const events = getEventsForDate(day);
    const hasWorkoutEvent = events.some((event) => event.type === 'workout');
    const isCurrentMonth = day.getMonth() === selectedDate.getMonth();
    const isToday = day.toDateString() === new Date().toDateString();
    const isSelected = day.toDateString() === selectedDate.toDateString();
    const dateKey = formatDateKey(day);
    const hasSubmittedCheckIn = dateKey ? submittedCheckInDates.has(dateKey) : false;
    return (
      <button
        key={dateKey ?? day.toISOString()}
        onClick={() => {
          const next = new Date(day);
          setSelectedDate(next);
          selectWorkoutForDate(next);
        }}
        className={`p-2 text-sm rounded-lg border relative min-h-[48px] transition-colors ${
          hasSubmittedCheckIn ? 'bg-green-200 text-green-900 font-semibold border-green-300' : 'bg-white text-gray-600 border-gray-100'
        } ${isSelected ? 'ring-2 ring-red-500 ring-offset-1' : ''} ${isToday ? 'border-red-200' : ''} ${
          isCurrentMonth ? 'hover:bg-gray-50' : 'opacity-40 pointer-events-none'
        }`}
      >
        <div>{day.getDate()}</div>
        {hasWorkoutEvent && (
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          </div>
        )}
      </button>
    );
  };
  const renderPhysicianCalendarCell = (day: Date) => {
    const hasWorkoutEvent = hasWorkoutScheduledOnDate(day) || getEventsForDate(day).some((event) => event.type === 'workout');
    const isCurrentMonth = day.getMonth() === physicianCalendarAnchor.getMonth();
    const isToday = day.toDateString() === new Date().toDateString();
    const isSelected = physicianBookingDate && formatDateKey(day) === formatDateKey(physicianBookingDate);
    const dateKey = formatDateKey(day);
    return (
      <button
        key={dateKey ?? day.toISOString()}
        onClick={() => {
          setPhysicianBookingDate(new Date(day));
          setPhysicianBookingError(null);
        }}
        className={`p-2 text-sm rounded-lg border relative min-h-[52px] transition-colors ${
          isSelected
            ? 'bg-red-50 text-red-700 border-red-200 ring-2 ring-red-500 ring-offset-1'
            : 'bg-white text-gray-600 border-gray-100'
        } ${isCurrentMonth ? 'hover:bg-gray-50' : 'opacity-50'} ${isToday ? 'border-red-200' : ''}`}
      >
        <div className="flex items-center justify-between">
          <span className="font-medium">{day.getDate()}</span>
          {hasWorkoutEvent && <span className="w-2 h-2 rounded-full bg-red-500" />}
        </div>
        {isToday && <div className="absolute bottom-1 right-2 text-[10px] uppercase text-red-500 font-semibold">Today</div>}
      </button>
    );
  };
  const renderWeeklyRow = (day: Date) => {
    const dayKey = formatDateKey(day);
    const workoutsForDay = dayKey
      ? weeklyWorkouts.filter((workout) =>
          formatDateKey(workout.scheduled_date ?? workout.scheduledDateObject) === dayKey,
        )
      : [];
    return (
      <div key={dayKey ?? day.toISOString()} className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-gray-500">{day.toLocaleDateString('en-US', { weekday: 'short' })}</p>
            <p className="text-lg font-semibold text-gray-900">
              {day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          </div>
          <div className="text-sm text-gray-500">{workoutsForDay.length} workouts</div>
        </div>
        <div className="space-y-3">
          {workoutsForDay.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">
              Recovery / off-day
            </div>
          )}
          {workoutsForDay.map((workout) => {
            return (
              <div
                key={workout.id}
                className={`rounded-xl border p-4 transition shadow-sm ${
                  selectedWorkoutId === workout.id ? 'border-red-300 bg-red-50/80' : 'border-gray-200 bg-white'
                }`}
              >
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedWorkoutId(workout.id);
                      startWorkoutSession(workout);
                    }}
                    className="inline-flex items-center justify-center rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:border-red-200 hover:bg-red-100"
                  >
                    Start workout
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(checkInLookup.get(workout.id)) && !checkInLookup.get(workout.id)?.canEdit}
                    onClick={() => openCheckInModal(workout)}
                    className={`inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold text-white ${
                      Boolean(checkInLookup.get(workout.id)) && !checkInLookup.get(workout.id)?.canEdit
                        ? 'bg-gray-300 cursor-not-allowed'
                        : 'bg-red-600 shadow-sm hover:bg-red-700'
                    }`}
                  >
                    {checkInLookup.get(workout.id)
                      ? checkInLookup.get(workout.id)?.canEdit
                        ? 'Edit check-in'
                        : 'Submitted'
                      : 'Log check-in'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const workoutSessionContent =
    isWorkoutSessionOpen && sessionWorkout ? (
      <div className="fixed inset-0 z-50 bg-white">
        {showWorkoutCompleteCelebration && (
          <button
            type="button"
            onClick={handleWorkoutCompleteDismiss}
            className="absolute inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm px-6 text-center"
            aria-label="Workout complete. Tap to return home."
          >
            <div className="relative w-full max-w-xs">
              <span className="absolute -top-6 left-6 h-3 w-3 rounded-full bg-emerald-400 animate-ping" />
              <span className="absolute -top-2 right-8 h-2 w-2 rounded-full bg-amber-400 animate-ping" />
              <span className="absolute top-6 -left-2 h-2.5 w-2.5 rounded-full bg-red-400 animate-ping" />
              <span className="absolute top-10 right-0 h-3 w-3 rounded-full bg-blue-400 animate-ping" />
              <span className="absolute -bottom-4 left-10 h-2 w-2 rounded-full bg-pink-400 animate-ping" />
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 shadow-lg">
                <Trophy className="h-10 w-10" />
              </div>
              <h3 className="mt-5 text-2xl font-semibold text-gray-900">Workout complete</h3>
              <p className="mt-2 text-sm text-gray-500">
                Great work. Tap anywhere to head back home.
              </p>
              <div className="mt-6 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-600">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                Don't forget your check-in
              </div>
            </div>
          </button>
        )}
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-red-600 bg-red-600 px-4 py-3 text-white">
            <div>
              <p className="text-xs uppercase tracking-wide text-red-100">Workout session</p>
              <h2 className="text-lg font-semibold text-white">{sessionWorkout.title}</h2>
              <p className="text-xs text-red-100">
                {sessionExerciseCount > 0
                  ? `Exercise ${sessionExerciseIndex + 1} of ${sessionExerciseCount}`
                  : 'No exercises attached'}
              </p>
            </div>
            <button
              type="button"
              onClick={closeWorkoutSession}
              className="rounded-full border border-white/40 p-2 text-white/90 hover:border-white hover:text-white"
              aria-label="Close workout session"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {isRestTimerActive && restTimeLeft > 0 && (
            <div className="px-4 pt-4">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-orange-200/80 bg-gradient-to-r from-orange-50 via-white to-amber-50 px-4 py-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                    <Timer className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-orange-500">Rest timer</p>
                    <p className="text-xl font-semibold text-gray-900">{restTimeLabel}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={cancelRestTimer}
                  className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-orange-600 transition hover:bg-orange-50"
                >
                  <SkipForward className="h-4 w-4" />
                  Skip
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 px-4 py-4 min-h-0">
            {sessionExercise ? (
              <div
                key={`${sessionExercise.exercise_name}-${sessionExerciseIndex}`}
                className={`flex h-full flex-col gap-4 ${sessionCardAnimationClass}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-red-500">Current exercise</p>
                    <h3 className="text-xl font-semibold text-gray-900">{sessionExercise.exercise_name}</h3>
                  </div>
                  {sessionExercise.rest_seconds && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                      Rest {sessionExercise.rest_seconds}s
                    </span>
                  )}
                </div>

                <div
                  className="flex-1 min-h-0 overflow-hidden rounded-3xl border border-red-100 bg-red-50/30 shadow-[0_16px_36px_rgba(220,38,38,0.15)]"
                  onTouchStart={handleSessionTouchStart}
                  onTouchEnd={handleSessionTouchEnd}
                >
                  {sessionExerciseImage ? (
                    <img
                      src={sessionExerciseImage}
                      alt={sessionExercise.exercise_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-base text-gray-400">
                      No preview available
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-3 text-sm">
                  {sessionExercise.target_sets && (
                    <span className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 font-semibold text-red-700">
                      {sessionExercise.target_sets} sets
                    </span>
                  )}
                  {sessionExercise.target_reps && (
                    <span className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 font-semibold text-red-700">
                      {sessionExercise.target_reps} reps
                    </span>
                  )}
                  {sessionExercise.target_weight && (
                    <span className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-white px-4 py-2 font-semibold text-gray-700">
                      <Dumbbell className="h-4 w-4" />
                      {sessionExercise.target_weight}
                    </span>
                  )}
                  {sessionExercise.target_rpe && (
                    <span className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-white px-4 py-2 font-semibold text-gray-700">
                      RPE {sessionExercise.target_rpe}
                    </span>
                  )}
                </div>

                {(sessionExercise.exercise_sets?.length ?? 0) > 0 && (
                  <div className="overflow-hidden rounded-2xl border border-red-100">
                    <div className="grid grid-cols-4 bg-red-50 text-xs font-semibold uppercase tracking-wide text-red-600">
                      <div className="px-4 py-3">Set</div>
                      <div className="px-4 py-3">Weight</div>
                      <div className="px-4 py-3">Reps</div>
                      <div className="px-4 py-3">RPE</div>
                    </div>
                    {sessionExercise.exercise_sets
                      ?.slice()
                      .sort((a, b) => (a.set_number ?? 0) - (b.set_number ?? 0))
                      .map((set) => (
                        <div
                          key={set.id ?? `${sessionExercise.exercise_name}-set-${set.set_number}`}
                          className="grid grid-cols-4 bg-white text-sm text-gray-700"
                        >
                          <div className="px-4 py-3 border-t border-gray-100">{set.set_number ?? '-'}</div>
                          <div className="px-4 py-3 border-t border-gray-100">{set.weight ?? '-'}</div>
                          <div className="px-4 py-3 border-t border-gray-100">{set.reps ?? '-'}</div>
                          <div className="px-4 py-3 border-t border-gray-100">{set.rpe ?? '-'}</div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
                No exercises attached yet. Check back once your coach updates the workout.
              </div>
            )}
          </div>

          <div className="flex items-center justify-center border-t border-red-100 bg-red-50/40 px-4 py-3">
            <div className="flex w-full max-w-sm flex-col items-center gap-2">
              {sessionTargetSets > 0 && (
                <div className="w-full space-y-2">
                  <button
                    type="button"
                    onClick={handleLogSet}
                    disabled={isSessionSetComplete}
                    className={`w-full inline-flex items-center justify-center gap-2 rounded-full border px-4 py-3 text-[11px] font-semibold uppercase tracking-wide shadow-sm transition ${
                      isSessionSetComplete
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                        : 'border-red-200 bg-white text-red-600 hover:bg-red-50'
                    }`}
                  >
                    {isSessionSetComplete ? <CheckCircle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                    {isSessionSetComplete
                      ? 'All sets complete'
                      : `Log set ${sessionSetProgress + 1} of ${sessionTargetSets}`}
                  </button>
                  <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-red-500">
                    <span>
                      {sessionSetProgress} / {sessionTargetSets} sets
                    </span>
                    {isSessionSetComplete && <span className="text-emerald-500">Done</span>}
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-red-100">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isSessionSetComplete ? 'bg-emerald-400' : 'bg-red-400'
                      }`}
                      style={{ width: `${sessionSetProgressPercent}%` }}
                    />
                  </div>
                </div>
              )}
              <button
                type="button"
                className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-red-200 bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-red-600 shadow-sm transition hover:bg-red-50"
              >
                <PlayCircle className="h-4 w-4" />
                Watch video tutorial
              </button>
              {sessionExerciseCount > 0 && (
                <div className="flex flex-col items-center gap-1 text-xs text-red-600">
                  <span>
                    {sessionExerciseIndex + 1} / {sessionExerciseCount}
                  </span>
                  <span className="uppercase tracking-wide text-[10px] text-red-400">Swipe left/right</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    ) : null;

  const workoutSessionPortal =
    typeof document !== 'undefined' && workoutSessionContent
      ? createPortal(workoutSessionContent, document.body)
      : workoutSessionContent;

  const experienceToggle = hasCoachAccess ? (
    <div className="fixed top-5 right-5 z-40">
      <Tabs
        value={activeExperience}
        onValueChange={(value) => setActiveExperience(value as 'athlete' | 'coach')}
      >
        <TabsList className="bg-white shadow-lg">
          <TabsTrigger value="athlete" className="text-xs font-semibold uppercase tracking-wide">
            Athlete
          </TabsTrigger>
          <TabsTrigger value="coach" className="text-xs font-semibold uppercase tracking-wide">
            Coach
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  ) : null;

  const statsCards = [
    { label: 'Total Workouts', value: stats.totalWorkouts, icon: Dumbbell, color: 'text-red-600 bg-red-50' },
    {
      label: 'Completed Workouts',
      value: stats.completedWorkouts,
      icon: CheckCircle,
      color: 'text-green-600 bg-green-50',
    },
    { label: 'Programs', value: stats.totalPrograms, icon: Target, color: 'text-blue-600 bg-blue-50' },
    { label: 'Current Streak', value: stats.currentStreak, icon: Flame, color: 'text-amber-600 bg-amber-50' },
  ].filter(Boolean);

  const resolvedView = view ?? 'calendar';
  const isCalendarView = resolvedView === 'calendar';
  const isMessagesView = resolvedView === 'messages';
  const isPhysicianView = resolvedView === 'physician';
  const isDiscountsView = resolvedView === 'discounts';
  const activeCoach = coachOptions.find((coach) => coach.id === activeCoachId);
  const canMessageCoach = Boolean(activeCoachId);

  useEffect(() => {
    if ((!isMessageModalOpen && !isMessagesView) || !activeCoachId) {
      return;
    }
    conversation
      .filter((message) => message.sender_id === activeCoachId && !message.is_read)
      .forEach((message) => {
        markCoachMessageRead(message.id);
      });
  }, [activeCoachId, conversation, isMessageModalOpen, isMessagesView, markCoachMessageRead]);

  const selectedDateKey = formatDateKey(selectedDate);
  const workoutsForSelectedDate = useMemo(() => {
    if (!selectedDateKey) {
      return [];
    }
    return workouts.filter(
      (workout) => formatDateKey(workout.scheduled_date ?? workout.scheduledDateObject) === selectedDateKey,
    );
  }, [workouts, selectedDateKey]);
  const hasSubmittedCheckInForDay = selectedDateKey ? submittedCheckInDates.has(selectedDateKey) : false;
  const currentWeekLabel = useMemo(() => {
    if (!currentWeekRange?.start || !currentWeekRange?.end) {
      return '';
    }
    const startLabel = formatDisplayDate(currentWeekRange.start, { month: 'short', day: 'numeric' });
    const endLabel = formatDisplayDate(currentWeekRange.end, { month: 'short', day: 'numeric' });
    if (!startLabel) {
      return '';
    }
    return endLabel ? `${startLabel} - ${endLabel}` : startLabel;
  }, [currentWeekRange]);
  const isSelectedToday = selectedDate?.toDateString() === new Date().toDateString();
  const primaryWorkout = workoutsForSelectedDate[0] ?? null;
  const secondaryWorkouts = workoutsForSelectedDate.slice(1);
  const primaryWorkoutCheckIn = primaryWorkout ? checkInLookup.get(primaryWorkout.id) ?? null : null;
  const primaryWorkoutExercises = primaryWorkout?.workout_exercises?.slice(0, 4) ?? [];
  const handleShiftSelectedDate = useCallback(
    (offset: number) => {
      const baseDate = selectedDate ?? new Date();
      const next = new Date(baseDate);
      next.setDate(baseDate.getDate() + offset);
      setSelectedDate(next);
      selectWorkoutForDate(next);
    },
    [selectedDate, setSelectedDate, selectWorkoutForDate],
  );

  useEffect(() => {
    if (isMessagesView) {
      setIsMessageModalOpen(false);
    }
    if (isPhysicianView) {
      setIsPhysicianBookingOpen(false);
    }
  }, [isMessagesView, isPhysicianView]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader className="w-10 h-10 animate-spin text-red-600" />
      </div>
    );
  }

  if (hasCoachAccess && activeExperience === 'coach') {
    return (
      <>
        {experienceToggle}
        <CoachDashboard
          onNavigateHome={onNavigateHome}
          onNavigateSettings={onNavigateSettings}
          onNavigateProgress={onNavigateProgress}
        />
      </>
    );
  }

  return (
    <>
      {experienceToggle}
      <div className={`min-h-screen bg-[#f7f4ef] text-gray-900 ${isMessagesView ? 'flex flex-col h-[100dvh] overflow-hidden' : ''}`}>
        {isCalendarView && (
          <header className="relative overflow-hidden border-b border-red-100 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -top-20 right-4 h-40 w-40 rounded-full bg-red-200/50 blur-3xl" />
              <div className="absolute bottom-0 left-10 h-28 w-28 rounded-full bg-orange-200/60 blur-3xl" />
            </div>
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-3 pt-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative">
                        <Avatar className="h-12 w-12 scale-110 border-2 border-red-200 bg-red-50">
                          {profileAvatarUrl && (
                            <AvatarImage src={profileAvatarUrl} alt="Profile avatar" className="object-cover" />
                          )}
                          <AvatarFallback className="bg-red-50 text-sm font-semibold text-red-700">
                            {profileInitials}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white ${isOnline ? 'bg-emerald-500' : 'bg-gray-400'}`}
                          aria-hidden="true"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-red-500">{greeting}</p>
                        <h1 className="truncate text-xl font-semibold text-gray-900">
                          {profile?.first_name ?? 'Athlete'}
                        </h1>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Sheet>
                        <SheetTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="relative border-gray-200 text-gray-700"
                            aria-label="Open notifications"
                          >
                            <Bell className="h-4 w-4" />
                            {notificationsCount > 0 && (
                              <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
                                {notificationsCount > 9 ? '9+' : notificationsCount}
                              </span>
                            )}
                          </Button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
                          <SheetHeader className="text-left">
                            <SheetTitle>Notifications</SheetTitle>
                            <SheetDescription>Updates from your programs and coaches.</SheetDescription>
                          </SheetHeader>
                          <div className="mt-6 space-y-3">
                            {notificationItems.length > 0 ? (
                              notificationItems.map((item) => {
                                const tone =
                                  item.type === 'completed'
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : item.type === 'ending'
                                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                                      : 'border-gray-200 bg-white text-gray-700';
                                const Icon = item.type === 'completed' ? CheckCircle : item.type === 'ending' ? Clock : Bell;
                                return (
                                  <div key={item.id} className={`rounded-2xl border p-4 ${tone}`}>
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex items-start gap-3">
                                        <div className="mt-0.5 rounded-full bg-white/70 p-2 text-current">
                                          <Icon className="h-4 w-4" />
                                        </div>
                                        <div>
                                          <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                                          <p className="text-xs text-gray-600">{item.message}</p>
                                        </div>
                                      </div>
                                      {item.createdAt && (
                                        <span className="text-[10px] uppercase tracking-wide text-gray-400">
                                          {item.createdAt}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
                                No notifications yet.
                              </div>
                            )}
                          </div>
                        </SheetContent>
                      </Sheet>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={handleSignOut}
                        aria-label="Sign out"
                        className="bg-red-600 text-white hover:bg-red-700"
                      >
                        <LogOut className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-white/80 px-2 py-0.5 text-orange-600">
                      <Flame className="h-3.5 w-3.5" />
                      {stats.currentStreak} day streak
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white/80 px-2 py-0.5 text-gray-600">
                      <Dumbbell className="h-3.5 w-3.5 text-gray-500" />
                      {stats.completedWorkouts} done
                    </span>
                  </div>
                  {programSummaries.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const match = activeEnrollments.find(
                          (enrollment) => enrollment.program?.title === programSummaries[0].programTitle,
                        );
                        if (match) {
                          setSelectedProgramEnrollmentId(match.id);
                        }
                      }}
                      className="flex flex-col items-start rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 via-white to-rose-50 px-3 py-2 text-left text-xs text-orange-700 shadow-sm hover:shadow-md"
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-orange-500">Active program</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">
                          {programSummaries[0].programTitle}
                        </span>
                        {programSummaries.length > 1 && (
                          <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                            +{programSummaries.length - 1}
                          </span>
                        )}
                      </div>
                    </button>
                  )}
                </div>
                {shouldShowExplorePrograms && (
                  <div className="flex items-start">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsExploreProgramsOpen(true)}
                      className="border-gray-200 text-gray-700"
                    >
                      Explore programs
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </header>
        )}

      <main className={`mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-24 pt-6 sm:px-6 lg:px-8 ${isMessagesView ? 'flex-1 min-h-0 overflow-hidden' : ''}`}>
        {isCalendarView && (
          <div className="relative flex flex-col gap-6">
        {checkInError && !isCheckInModalOpen && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="flex items-start justify-between gap-3 p-4 text-sm text-red-700">
              <span>{checkInError}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setCheckInError(null)}
                aria-label="Dismiss message"
                className="text-red-600 hover:text-red-700"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="relative overflow-hidden border-red-100 bg-white/90 shadow-sm">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -right-24 top-10 h-40 w-40 rounded-full bg-red-100/70 blur-3xl" />
            <div className="absolute -left-24 bottom-0 h-32 w-32 rounded-full bg-orange-100/70 blur-3xl" />
          </div>
          <CardHeader className="relative flex flex-col gap-4 pb-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <Badge variant="secondary" className="bg-red-100 text-red-600">
                  {isSelectedToday ? 'Today' : 'Selected day'}
                </Badge>
                <CardTitle className="mt-2 text-2xl text-gray-900">
                  {formatDisplayDate(selectedDate, { month: 'short', day: 'numeric' })}
                </CardTitle>
                <CardDescription className="text-sm text-gray-500">
                  {workoutsForSelectedDate.length} session{workoutsForSelectedDate.length === 1 ? '' : 's'} scheduled
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleShiftSelectedDate(-1)}
                  aria-label="Previous day"
                  className="border-gray-200 text-gray-700"
                >
                  <ChevronLeft className="h-4 w-4 text-gray-900" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleShiftSelectedDate(1)}
                  aria-label="Next day"
                  className="border-gray-200 text-gray-700"
                >
                  <ChevronRight className="h-4 w-4 text-gray-900" />
                </Button>
                <Sheet>
                  <SheetTrigger asChild>
                    <Button type="button" variant="outline" size="icon" aria-label="Open calendar">
                      <CalendarDays className="h-4 w-4 text-gray-900" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side="bottom"
                    className="max-h-[85vh] overflow-y-auto border-t border-gray-200 bg-white text-gray-900"
                  >
                    <SheetHeader className="text-left">
                      <SheetTitle>Calendar</SheetTitle>
                      <SheetDescription>Jump to another training day.</SheetDescription>
                    </SheetHeader>
                    <div className="mt-6 space-y-4">
                      <Tabs
                        value={calendarView}
                        onValueChange={(value) => setCalendarView(value as 'monthly' | 'weekly')}
                        className="w-full"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                            <Calendar className="w-4 h-4 text-gray-900" />
                            {calendarView === 'monthly' ? (
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleMonthStep(-1)}
                                  aria-label="Previous month"
                                  className="border-gray-200 text-gray-700 hover:bg-gray-50"
                                >
                                  <ChevronLeft className="w-4 h-4 text-gray-900" />
                                </Button>
                                <span>{formatDisplayDate(selectedDate, { month: 'long', year: 'numeric' })}</span>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleMonthStep(1)}
                                  aria-label="Next month"
                                  className="border-gray-200 text-gray-700 hover:bg-gray-50"
                                >
                                  <ChevronRight className="w-4 h-4 text-gray-900" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => setWeeklyStartIndex((prev) => Math.max(0, prev - 1))}
                                  aria-label="Show previous day range"
                                  disabled={weeklyStartIndex === 0}
                                  className="border-gray-200 text-gray-700 hover:bg-gray-50"
                                >
                                  <ChevronLeft className="w-4 h-4 text-gray-900" />
                                </Button>
                                <span>{weeklyRangeLabel || formatDisplayDate(selectedDate, { month: 'short', day: 'numeric' })}</span>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => setWeeklyStartIndex((prev) => Math.min(maxWeeklyStartIndex, prev + 1))}
                                  aria-label="Show next day range"
                                  disabled={weeklyStartIndex >= maxWeeklyStartIndex}
                                  className="border-gray-200 text-gray-700 hover:bg-gray-50"
                                >
                                  <ChevronRight className="w-4 h-4 text-gray-900" />
                                </Button>
                              </div>
                            )}
                          </div>
                          <TabsList className="bg-gray-100">
                            <TabsTrigger value="monthly">Month</TabsTrigger>
                            <TabsTrigger value="weekly">Week</TabsTrigger>
                          </TabsList>
                        </div>
                        <TabsContent value="monthly" className="mt-4">
                          <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                              <div key={day}>{day}</div>
                            ))}
                          </div>
                          <div className="grid grid-cols-7 gap-1">{calendarDays.map(renderCalendarCell)}</div>
                        </TabsContent>
                        <TabsContent value="weekly" className="mt-4">
                          <div className="space-y-4">{visibleWeekDays.map(renderWeeklyRow)}</div>
                        </TabsContent>
                      </Tabs>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              <span className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-gray-500" />
                This week
              </span>
              <span>{currentWeekLabel}</span>
            </div>
          </CardHeader>
          <CardContent className="relative space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
              {weekDays.map((day) => {
                const dateKey = formatDateKey(day);
                const events = getEventsForDate(day);
                const workoutEvents = events.filter((event) => event.type === 'workout');
                const isSelected = day.toDateString() === selectedDate.toDateString();
                const isToday = day.toDateString() === new Date().toDateString();
                const hasCheckIn = dateKey ? submittedCheckInDates.has(dateKey) : false;
                const workoutLabel =
                  workoutEvents.length > 1
                    ? `${workoutEvents.length} sessions`
                    : workoutEvents[0]?.title ?? 'Rest';
                const dayLabel = day.toLocaleDateString('en-US', { weekday: 'short' });
                return (
                  <button
                    key={dateKey ?? day.toISOString()}
                    type="button"
                    onClick={() => {
                      const next = new Date(day);
                      setSelectedDate(next);
                      selectWorkoutForDate(next);
                    }}
                    className={`group relative flex w-20 flex-shrink-0 flex-col items-center rounded-2xl border px-2 py-3 text-center text-xs transition ${
                      isSelected
                        ? 'border-red-500 bg-gradient-to-b from-red-500 to-orange-500 text-white shadow-lg shadow-red-500/30'
                        : hasCheckIn
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-red-200 hover:shadow-sm'
                    }`}
                  >
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wide ${
                        isSelected ? 'text-white/80' : 'text-gray-400 group-hover:text-red-500'
                      }`}
                    >
                      {dayLabel}
                    </span>
                    <span className={`mt-1 text-lg font-semibold ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                      {day.getDate()}
                    </span>
                    <span
                      className={`mt-1 w-full truncate text-[10px] font-medium ${
                        isSelected
                          ? 'text-white/80'
                          : hasCheckIn
                            ? 'text-emerald-600'
                            : 'text-gray-500'
                      }`}
                    >
                      {workoutLabel}
                    </span>
                    {hasCheckIn && !isSelected && (
                      <span className="mt-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                    {isToday && !isSelected && (
                      <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
                    )}
                  </button>
                );
              })}
            </div>
            {hasSubmittedCheckInForDay && (
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                <CheckCircle className="h-4 w-4" />
                Check-in complete
              </div>
            )}
            {workoutsForSelectedDate.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white/70 p-5 text-sm text-gray-500">
                No workouts scheduled. Use this as a recovery or mobility day.
              </div>
            ) : (
              <div className="space-y-4">
                {primaryWorkout && (
                  <div className="rounded-3xl border border-red-200 bg-gradient-to-br from-red-50 via-white to-orange-50 p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-red-500">
                          {isSelectedToday ? "Today's session" : 'Training session'}
                        </p>
                        <h3 className="mt-1 text-2xl font-semibold text-gray-900">{primaryWorkout.title}</h3>
                        <p className="text-sm text-gray-500">{primaryWorkout.program?.title ?? 'Personalized'}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-white px-2 py-0.5">
                            <Clock className="h-3.5 w-3.5 text-gray-400" />
                            {primaryWorkout.duration_minutes ?? 60} mins
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-white px-2 py-0.5">
                            <Dumbbell className="h-3.5 w-3.5 text-gray-400" />
                            {primaryWorkout.workout_exercises?.length ?? 0} exercises
                          </span>
                          {primaryWorkoutCheckIn && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              {primaryWorkoutCheckIn.checkIn.status === 'needs_revision' ? 'Needs revision' : 'Checked in'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          type="button"
                          onClick={() => startWorkoutSession(primaryWorkout)}
                          className="bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-sm hover:shadow-md"
                        >
                          Start workout
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => openCheckInModal(primaryWorkout)}
                          disabled={Boolean(primaryWorkoutCheckIn) && !primaryWorkoutCheckIn?.canEdit}
                          className="border-red-200 text-red-600 hover:bg-red-50"
                        >
                          {primaryWorkoutCheckIn
                            ? primaryWorkoutCheckIn.canEdit
                              ? 'Edit check-in'
                              : 'Check-in locked'
                            : 'Log check-in'}
                        </Button>
                      </div>
                    </div>
                    {primaryWorkoutExercises.length > 0 && (
                      <div className="mt-4 grid gap-2 text-xs text-gray-600 sm:grid-cols-2">
                        {primaryWorkoutExercises.map((exercise, index) => (
                          <div
                            key={exercise.id ?? `${primaryWorkout.id}-exercise-${index}`}
                            className="flex items-center gap-2 rounded-xl border border-red-100 bg-white/70 px-3 py-2"
                          >
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-[10px] font-semibold text-red-600">
                              {index + 1}
                            </span>
                            <span className="truncate">{exercise.exercise_name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {secondaryWorkouts.length > 0 && (
                  <div className="space-y-3">
                    {secondaryWorkouts.map((workout) => {
                      const checkInMeta = checkInLookup.get(workout.id);
                      return (
                        <div key={workout.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{workout.title}</p>
                              <p className="text-xs text-gray-500">{workout.program?.title ?? 'Personalized'}</p>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5 text-gray-400" />
                                  {workout.duration_minutes ?? 60} mins
                                </span>
                                {checkInMeta && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                    {checkInMeta.checkIn.status === 'needs_revision' ? 'Needs revision' : 'Checked in'}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => startWorkoutSession(workout)}
                                className="border-red-200 text-red-600 hover:bg-red-50"
                              >
                                Start workout
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => openCheckInModal(workout)}
                                disabled={Boolean(checkInMeta) && !checkInMeta.canEdit}
                                className="bg-red-600 text-white hover:bg-red-700"
                              >
                                {checkInMeta ? (checkInMeta.canEdit ? 'Edit check-in' : 'Check-in locked') : 'Log check-in'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-red-100 bg-white/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-600">
                <Target className="h-4 w-4" />
              </span>
              <div>
                <CardTitle className="text-base font-semibold text-gray-900">Weekly goal</CardTitle>
                <CardDescription className="text-xs text-gray-500">Your focus for the week.</CardDescription>
              </div>
            </div>
            {currentWeekGoal && (
              <Badge
                variant="secondary"
                className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${WEEKLY_GOAL_STATUS_META[currentWeekGoal.status].badge}`}
              >
                {WEEKLY_GOAL_STATUS_META[currentWeekGoal.status].label}
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {currentWeekGoal ? (
              <>
                <p className="text-sm font-semibold text-gray-900 leading-relaxed">{currentWeekGoal.goal_text}</p>
                <p className="mt-3 text-xs text-gray-500">
                  {WEEKLY_GOAL_STATUS_META[currentWeekGoal.status].description}
                </p>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
                <Target className="mx-auto mb-3 h-6 w-6 text-gray-300" />
                A weekly goal will appear after your coach publishes it.
              </div>
            )}
          </CardContent>
        </Card>

        {activeExperience === 'athlete' && endingSoonAlerts.length > 0 && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-blue-900">Programs ending soon</CardTitle>
              <CardDescription className="text-sm text-blue-700">
                Renew to keep access without interruptions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {endingSoonAlerts.slice(0, 4).map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-white px-3 py-2 text-xs text-blue-900"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-blue-600" />
                    <span className="font-semibold">{alert.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {typeof alert.daysRemaining === 'number' && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                        {alert.daysRemaining}d
                      </span>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedProgramEnrollmentId(alert.id)}
                      className="text-blue-700"
                    >
                      Renew
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="border-red-100 bg-white/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-base font-semibold text-gray-900">Snapshot</CardTitle>
              <CardDescription className="text-xs text-gray-500">Your training pulse.</CardDescription>
            </div>
            <Badge variant="secondary" className="bg-red-100 text-red-600">
              This week
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 overflow-x-auto pb-2">
              {statsCards.map((card) => (
                <div
                  key={card.label}
                  className="min-w-[160px] rounded-2xl border border-red-100/70 bg-gradient-to-br from-white via-white to-orange-50/40 p-4 shadow-sm"
                >
                  <div className={`inline-flex items-center justify-center rounded-xl ${card.color} w-10 h-10 mb-3`}>
                    <card.icon className="w-5 h-5" />
                  </div>
                  <p className="text-xs text-gray-500">{card.label}</p>
                  <p className="mt-1 text-xl font-semibold text-gray-900">{card.value}</p>
                </div>
              ))}
            </div>
            {stats.currentStreak > 0 ? (
              <div className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-amber-50 px-4 py-3 text-amber-700">
                <div className="flex items-center gap-2">
                  <Flame className="h-5 w-5 text-amber-500" />
                  <p className="text-sm font-semibold">You&apos;re on a {stats.currentStreak}-day streak!</p>
                </div>
                <p className="text-xs text-amber-600">
                  Keep logging your workouts to build momentum and stay consistent.
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-amber-700">
                <Flame className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-sm font-semibold">Start your streak</p>
                  <p className="text-xs text-amber-600">
                    Log your next workout check-in to ignite your consistency streak.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

          </div>
        )}

        {isMessagesView && (
          <>
          <section className="flex min-h-0 flex-1 flex-col gap-6">
            <div className="shrink-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Messages</p>
              <h1 className="mt-2 text-2xl font-semibold text-gray-900">Chat with your coach</h1>
              <p className="mt-1 text-sm text-gray-500">
                Stay in sync with {activeCoach?.name ?? 'your coach'} between sessions.
              </p>
            </div>

            {coachOptions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
                No coach assigned yet. Enroll in a program to start messaging.
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-6">
                <div className="space-y-3 shrink-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Chats</p>
                    {unreadCoachMessages > 0 && (
                      <span className="text-xs font-semibold text-red-600">
                        {unreadCoachMessages} unread
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
                    {coachOptions.map((coach) => {
                      const isActive = coach.id === activeCoachId;
                      const unreadCount = coachUnreadCounts.get(coach.id) ?? 0;
                      const initials =
                        coach.name
                          .split(' ')
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((part) => part.charAt(0).toUpperCase())
                          .join('') || 'C';
                      return (
                        <button
                          key={coach.id}
                          type="button"
                          onClick={() => setSelectedCoachIdForMessage(coach.id)}
                          className={`flex min-w-[170px] items-center gap-3 rounded-2xl border px-3 py-2 text-left transition ${
                            isActive
                              ? 'border-red-500 bg-red-50 text-gray-900 shadow-sm'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-red-200'
                          }`}
                        >
                          <Avatar className="h-10 w-10">
                            {coach.avatar && <AvatarImage src={coach.avatar} alt={coach.name} />}
                            <AvatarFallback className="bg-gray-100 text-xs font-semibold text-gray-600">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{coach.name}</p>
                            <p className="text-xs text-gray-500">Coach</p>
                          </div>
                          {unreadCount > 0 && (
                            <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
                              {unreadCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-4">
                  <div className="flex-1 min-h-0">
                    {conversation.length > 0 ? (
                      <div
                        ref={messagesScrollRef}
                        onScroll={handleMessagesScroll}
                        onWheel={handleMessagesWheel}
                        onTouchStart={handleMessagesTouchStart}
                        onTouchMove={handleMessagesTouchMove}
                        className="h-full overflow-y-auto pr-1 space-y-3 overscroll-contain"
                      >
                        {hasMoreMessages && (
                          <div className="text-center text-xs text-gray-400">
                            Scroll up to load earlier messages
                          </div>
                        )}
                        {visibleConversation.map((message) => {
                          const isSender = message.sender_id === user?.id;
                          return (
                            <div key={message.id} className={`flex ${isSender ? 'justify-end' : 'justify-start'}`}>
                              <div
                                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                                  isSender ? 'bg-red-600 text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none border border-gray-100'
                                }`}
                              >
                                <p>{message.message}</p>
                                <p className={`mt-2 text-[10px] uppercase tracking-wide ${isSender ? 'text-red-100' : 'text-gray-400'}`}>
                                  {new Date(message.created_at).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
                        <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                        Start the conversation with your coach.
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 shrink-0">
                    {coachMessageError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                        {coachMessageError}
                      </div>
                    )}
                    <div className="flex items-end gap-2 rounded-2xl border border-gray-200 bg-white p-2">
                      <div className="flex-1">
                        <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 block mb-1 px-1">
                          Message
                        </label>
                        <textarea
                          rows={2}
                          value={coachMessageBody}
                          onChange={(event) => setCoachMessageBody(event.target.value)}
                          placeholder="Ask for feedback, share an update, or set expectations for upcoming sessions."
                          disabled={!canMessageCoach}
                          className="w-full resize-none bg-transparent px-2 py-1 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none disabled:opacity-60"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSendCoachMessage}
                        disabled={isSendingCoachMessage || !canMessageCoach}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 text-white transition hover:bg-red-700 disabled:opacity-60"
                        aria-label="Send message"
                      >
                        {isSendingCoachMessage ? (
                          <Loader className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowRight className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
          </>
        )}

        {isPhysicianView && (
          <Card className="border-gray-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-gray-900">Physician appointment</CardTitle>
              <CardDescription className="text-sm text-gray-500">
                Book with our sports physician partner and use lift&recover for 10% off.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-[2fr,1fr]">
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm font-medium text-gray-700">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span>{formatDisplayDate(physicianCalendarAnchor, { month: 'long', year: 'numeric' })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handlePhysicianMonthStep(-1)}
                        aria-label="Previous month"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handlePhysicianMonthStep(1)}
                        aria-label="Next month"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div key={day}>{day}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">{physicianCalendarDays.map(renderPhysicianCalendarCell)}</div>
                </div>
                <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-[0.35em] text-gray-500">Your selection</p>
                  <h4 className="text-xl font-semibold text-gray-900 leading-tight">{physicianAppointmentLabel}</h4>
                  <p className="text-sm text-gray-600">
                    {physicianBookingDate
                      ? 'We will request this date with the physician partner.'
                      : 'Click a training day to set your preferred appointment date.'}
                  </p>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">
                      Session type
                    </label>
                    <select
                      value={physicianSessionType}
                      onChange={(event) => {
                        setPhysicianSessionType(event.target.value);
                        setPhysicianBookingError(null);
                      }}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    >
                      <option value="">Select a session type</option>
                      <option value="Injury assessment">Injury assessment</option>
                      <option value="Recovery & rehab">Recovery & rehab</option>
                      <option value="Performance consult">Performance consult</option>
                      <option value="Follow-up appointment">Follow-up appointment</option>
                      <option value="Mobility & pain check">Mobility & pain check</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">
                      Session details (optional)
                    </label>
                    <textarea
                      value={physicianSessionDetails}
                      onChange={(event) => {
                        setPhysicianSessionDetails(event.target.value);
                        setPhysicianBookingError(null);
                      }}
                      rows={3}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      placeholder="Add symptoms, injury history, or goals for this visit."
                    />
                  </div>
                  {physicianBookingError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                      {physicianBookingError}
                    </div>
                  )}
                  {physicianBookingSuccess && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      {physicianBookingSuccess}
                    </div>
                  )}
                  {physicianAppointments.some((appt) => appt.status === 'slots_proposed') && (
                    <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
                      <p className="text-xs uppercase tracking-[0.35em] text-blue-700">Proposed slots</p>
                      {physicianAppointments
                        .filter((appt) => appt.status === 'slots_proposed')
                        .map((appt) => (
                          <div key={appt.id} className="space-y-2">
                            <p className="text-sm text-gray-800">
                              Date: {appt.requested_date} - Session: {appt.session_type}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {(appt.proposed_slots ?? []).map((slot: string) => (
                                <button
                                  key={slot}
                                  onClick={async () => {
                                    const { data, error } = await supabase.functions.invoke<{ success: boolean; error?: string }>(
                                      'physician-appointments',
                                      {
                                        body: { action: 'select_slot', appointmentId: appt.id, selectedSlot: slot },
                                      },
                                    );
                                    if (error || !data?.success) {
                                      setPhysicianBookingError(data?.error ?? error?.message ?? 'Unable to select slot.');
                                      return;
                                    }
                                    setPhysicianBookingSuccess(`You selected ${slot}. We'll notify the physician.`);
                                    setPhysicianBookingError(null);
                                    supabase
                                      .from('physician_appointments')
                                      .select('*')
                                      .eq('user_id', user?.id ?? '')
                                      .order('created_at', { ascending: false })
                                      .then(({ data: rows }) => setPhysicianAppointments(rows ?? []));
                                  }}
                                  className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                                >
                                  {slot}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
              <Button
                type="button"
                onClick={sendPhysicianAppointmentEmail}
                disabled={isSendingPhysicianRequest}
                className="w-full"
              >
                {isSendingPhysicianRequest ? 'Sending request...' : 'Send request to coach'}
              </Button>
              <p className="text-[11px] text-gray-500">
                Your coach receives this request and will approve or reply with guidance before scheduling with the physician partner.
              </p>
            </CardContent>
          </Card>
        )}

        {isDiscountsView && (
          <section className="w-full bg-[#f5f5f5] px-3 py-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Member discounts</h2>
              {discountCoupons.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllCoupons((prev) => !prev)}
                  className="text-xs font-semibold text-red-600 hover:text-red-700"
                >
                  {showAllCoupons ? 'Show less' : 'Show all'}
                </button>
              )}
            </div>

            <p className="mb-4 text-sm text-gray-600">
              Tap "Use my discount" to generate a one-time QR. Partners scan it to validate your membership and apply the offer.
            </p>

            <div className="space-y-6">
              {(showAllCoupons ? discountCoupons : discountCoupons.slice(0, 3)).map((coupon, idx) => {
                const couponId = coupon.id ?? coupon.title;
                const isActiveCoupon = activeDiscountId === couponId;
                const percentMatch = coupon.detail.match(/(\d+)%/);
                const percentLabel = percentMatch ? `${percentMatch[1]}%` : coupon.detail;
                const theme =
                  coupon.title.toLowerCase().includes('biwai')
                    ? 'biwai'
                    : coupon.title.toLowerCase().includes('cactus')
                      ? 'cactus'
                      : 'impact';

                if (theme === 'biwai') {
                  return (
                    <div
                      key={coupon.id ?? `${coupon.title}-${idx}`}
                      className="relative flex h-[200px] w-full overflow-hidden rounded-lg bg-[#1a1a2e] font-[Arial,_sans-serif] text-white"
                    >
                      <div className="relative z-10 flex-1 p-5">
                        <div className="absolute left-4 top-4 flex h-4 w-4 items-center justify-center rounded-full bg-[#00ff00] text-[9px] font-bold text-[#1a1a2e]">
                          {coupon.title.charAt(0).toUpperCase()}
                        </div>
                        <div className="absolute bottom-10 left-0 h-[50px] w-[60px] bg-[repeating-linear-gradient(45deg,#333_0px,#333_8px,transparent_8px,transparent_16px)]" />
                        <div className="absolute bottom-12 left-5">
                          <h3 className="text-2xl font-bold">{coupon.title}</h3>
                          <p className="text-lg font-bold">{coupon.detail}</p>
                        </div>
                        <div className="absolute inset-x-0 bottom-0 h-[30px] bg-[#00cc00]" />
                        <div className="absolute right-10 top-4 text-xs tracking-[0.3em] text-white">X X X</div>
                      </div>
                      <div className="my-2 w-[2px] border-l-2 border-dashed border-white/80" />
                      <div className="relative z-10 flex w-[150px] flex-col items-center justify-center pb-10">
                        <div className="absolute right-0 top-0 h-10 w-10 bg-[repeating-linear-gradient(-45deg,#ffffff_0px,#ffffff_4px,transparent_4px,transparent_8px)]" />
                        <div className="rounded bg-[#00cc00] px-6 py-3 text-center outline outline-2 outline-white">
                          <span className="block text-3xl font-bold text-white">{percentLabel}</span>
                          <span className="text-2xl font-bold italic text-white">OFF</span>
                        </div>
                        <p className="mt-3 text-[11px] text-white">
                          use code: <span className="font-mono">{coupon.code}</span>
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveDiscountId((prev) => {
                              return prev === couponId ? null : couponId;
                            })
                          }
                          disabled={isActiveCoupon && discountQrLoading}
                          className="mt-2 inline-flex items-center justify-center rounded-full bg-red-600 px-3 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
                        >
                          {isActiveCoupon && discountQrLoading ? 'Generating...' : 'Use my discount'}
                        </button>
                        <div className="absolute inset-x-0 bottom-0 h-[30px] bg-[#00cc00]" />
                      </div>
                    </div>
                  );
                }

                if (theme === 'cactus') {
                  return (
                    <div
                      key={coupon.id ?? `${coupon.title}-${idx}`}
                      className="relative flex h-[200px] w-full overflow-hidden rounded-lg bg-[#1a1a2e] font-[Arial,_sans-serif] text-white"
                    >
                      <div className="relative flex-1 p-5">
                        <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ffeb00]">
                          <span className="sr-only">{coupon.title}</span>
                        </div>
                        <div className="absolute right-10 top-4 text-xs tracking-[0.3em] text-white">X X X</div>
                        <div className="absolute inset-x-0 bottom-0 h-[25px] bg-[#ffeb00]" />
                        <div className="absolute bottom-12 left-5">
                          <p className="text-lg font-bold">{coupon.title}</p>
                          <p className="text-sm font-semibold">{coupon.detail}</p>
                        </div>
                      </div>
                      <div className="my-2 w-[2px] border-l-2 border-dashed border-white/80" />
                      <div className="relative flex w-[150px] flex-col items-center justify-center pb-10">
                        <div className="bg-[#ffeb00] px-6 py-3 text-center text-[#333] outline outline-2 outline-white">
                          <span className="block text-3xl font-bold">{percentLabel}</span>
                          <span className="text-2xl font-bold italic">OFF</span>
                        </div>
                        <p className="mt-3 font-mono text-[12px] text-white">use code: {coupon.code}</p>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveDiscountId((prev) => {
                              return prev === couponId ? null : couponId;
                            })
                          }
                          disabled={isActiveCoupon && discountQrLoading}
                          className="relative z-10 mt-2 inline-flex items-center justify-center rounded-full bg-red-600 px-3 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
                        >
                          {isActiveCoupon && discountQrLoading ? 'Generating...' : 'Use my discount'}
                        </button>
                        <div className="absolute bottom-[25px] right-0 z-0 h-10 w-[50px] bg-[repeating-linear-gradient(-45deg,#333_0px,#333_6px,#ffeb00_6px,#ffeb00_12px)]" />
                        <div className="absolute inset-x-0 bottom-0 h-[25px] bg-[#ffeb00]" />
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={coupon.id ?? `${coupon.title}-${idx}`}
                    className="relative flex h-[200px] w-full overflow-hidden rounded-lg bg-[#1a1a2e] font-[Arial,_sans-serif] text-white"
                  >
                    <div className="relative flex-1 p-5">
                      <div className="absolute left-4 top-4 flex h-4 w-4 items-center justify-center rounded-full bg-[#00bfff] text-[9px] font-bold text-[#1a1a2e]">
                        {coupon.title.charAt(0).toUpperCase()}
                      </div>
                      <div className="absolute bottom-8 left-0 h-[50px] w-[50px] bg-[repeating-linear-gradient(45deg,#666_0px,#666_8px,transparent_8px,transparent_16px)]" />
                      <div className="absolute right-10 top-4 text-xs tracking-[0.3em] text-white">X X X</div>
                      <div className="absolute inset-x-0 bottom-0 h-[25px] bg-[#00bfff]" />
                      <div className="absolute bottom-12 left-5">
                        <p className="text-lg font-bold">{coupon.title}</p>
                        <p className="text-sm font-semibold">{coupon.detail}</p>
                      </div>
                    </div>
                    <div className="my-2 w-[2px] border-l-2 border-dashed border-white/80" />
                    <div className="relative flex w-[150px] flex-col items-center justify-center pb-10">
                      <div className="bg-[#00bfff] px-6 py-3 text-center outline outline-2 outline-white">
                        <span className="block text-3xl font-bold text-white">{percentLabel}</span>
                        <span className="text-2xl font-bold text-white">OFF</span>
                      </div>
                      <p className="mt-3 font-mono text-[12px] text-white">USE CODE: {coupon.code}</p>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveDiscountId((prev) => {
                            return prev === couponId ? null : couponId;
                          })
                        }
                        disabled={isActiveCoupon && discountQrLoading}
                        className="mt-2 inline-flex items-center justify-center rounded-full bg-red-600 px-3 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
                      >
                        {isActiveCoupon && discountQrLoading ? 'Generating...' : 'Use my discount'}
                      </button>
                      <div className="absolute inset-x-0 bottom-0 h-[25px] bg-[#00bfff]" />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
      </div>

      {activeDiscountCoupon && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8"
          onClick={() => setActiveDiscountId(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-red-100 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Discount QR</p>
                <h4 className="text-lg font-semibold text-gray-900">{activeDiscountCoupon.title}</h4>
                <p className="text-sm text-gray-500">{activeDiscountCoupon.detail}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveDiscountId(null)}
                className="rounded-full bg-gray-100 p-2 text-gray-500 hover:bg-gray-200"
                aria-label="Close discount QR"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 flex flex-col items-center gap-3 text-center">
              {discountQrLoading && (
                <div className="text-sm font-semibold text-gray-700">Generating secure QR...</div>
              )}
              {discountQrError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                  {discountQrError}
                </div>
              )}
              {discountQrNextAvailableAt && (
                <p className="text-[11px] text-gray-500">
                  Next available {new Date(discountQrNextAvailableAt).toLocaleDateString()}.
                </p>
              )}
              {discountQrUrl && (
                <>
                  <div className="h-44 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                        discountQrUrl,
                      )}`}
                      alt="Discount QR code"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <p className="text-sm font-semibold text-gray-800">Show this QR to the partner</p>
                  <p className="text-xs text-gray-500">
                    It confirms your account and coupon code. No payment details are shared.
                  </p>
                  {discountQrExpiresAt && (
                    <p className="text-[11px] text-gray-500">
                      Expires {new Date(discountQrExpiresAt).toLocaleTimeString()}
                    </p>
                  )}
                  <div className="inline-flex items-center gap-2 rounded-full border border-dashed border-red-300 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                    Code: {activeDiscountCoupon.code}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {isCheckInModalOpen && selectedWorkout && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-2xl max-h-[calc(100vh-3rem)] overflow-hidden bg-white rounded-2xl shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  {editingCheckInId ? 'Edit check-in' : 'Log check-in'}
                </p>
                <h4 className="text-lg font-semibold text-gray-900">{selectedWorkout.title}</h4>
                <p className="text-xs text-gray-500">
                  {formatDisplayDate(selectedWorkoutDate, {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <button
                onClick={closeCheckInModal}
                className="rounded-full bg-gray-100 p-2 text-gray-500 hover:bg-gray-200"
                aria-label="Close check-in modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitCheckIn} className="px-6 py-6 space-y-6 flex-1 overflow-y-auto">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-800">Readiness (1-10)</label>
                  <span className="text-sm font-semibold text-red-600">{readiness}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={readiness}
                  onChange={(event) => setReadiness(Number(event.target.value))}
                  className="w-full accent-red-600"
                />
                <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-800 mb-2">Energy level</p>
                  <div className="flex gap-2">
                    {(['low', 'medium', 'high'] as const).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setEnergy(level)}
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize ${
                          energy === level ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800 mb-2">Soreness level</p>
                  <div className="flex gap-2">
                    {(['low', 'medium', 'high'] as const).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setSoreness(level)}
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize ${
                          soreness === level ? 'border-purple-400 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-600'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-800 mb-2 block">Notes for coach</label>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="How did the session feel? Any sets you’d like reviewed?"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                />
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <label className="flex items-center gap-3 text-sm font-medium text-gray-800">
                  <input
                    type="checkbox"
                    checked={achievedPR}
                    onChange={(event) => setAchievedPR(event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  Logged a new personal record today
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Capture PR details so we can chart your progress and share it with your coach.
                </p>
                {achievedPR && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">
                        Exercise
                      </label>
                      <input
                        type="text"
                        value={prExercise}
                        onChange={(event) => setPrExercise(event.target.value)}
                        placeholder="e.g. Trap-Bar Deadlift"
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">
                          Value
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="0.5"
                          value={prValue}
                          onChange={(event) => setPrValue(event.target.value)}
                          placeholder="e.g. 115"
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">
                          Unit
                        </label>
                        <input
                          type="text"
                          value={prUnit}
                          onChange={(event) => setPrUnit(event.target.value)}
                          placeholder="kg, lb, reps, time..."
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-800 mb-2 block">Upload workout videos</label>
                <input
                  type="file"
                  accept="video/*"
                  multiple
                  onChange={handleFilesChange}
                  className="w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-red-50 file:px-4 file:py-2 file:text-red-600 hover:file:bg-red-100"
                />
                <div className="space-y-1 text-xs text-gray-400 mt-1">
                  <p>
                    Share up to five clips for form review. Accepted formats: mp4, mov, webm. Remove existing uploads
                    below to free up space.
                  </p>
                  {mediaNotice && <p className="text-red-500">{mediaNotice}</p>}
                </div>
                {existingMedia.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Current uploads</p>
                    {existingMedia.map((media, index) => (
                      <div
                        key={media.id}
                        className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                      >
                        <div className="space-y-0.5">
                          <p className="font-semibold text-gray-800">Clip {index + 1}</p>
                          <a
                            href={media.media_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-red-600 underline"
                          >
                            Open in new tab
                          </a>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleExistingMediaRemove(media.id)}
                          className="rounded-full bg-gray-100 p-1 text-gray-500 hover:text-red-600"
                          aria-label="Remove upload"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {files.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      {editingCheckInId ? 'New uploads' : 'Selected uploads'}
                    </p>
                    {files.map((file, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium text-gray-800 break-words">{file.name}</p>
                          <p className="text-xs text-gray-500">{(file.size / (1024 * 1024)).toFixed(1)} MB</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleFileRemove(index)}
                          className="rounded-full bg-white p-1 text-gray-400 hover:text-red-600"
                          aria-label="Remove selected file"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {checkInError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{checkInError}</div>
              )}

              <button
                type="submit"
                disabled={isSubmittingCheckIn}
                className="w-full inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {isSubmittingCheckIn ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Submit check-in
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
      {selectedProgramEnrollment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8"
          onClick={() => setSelectedProgramEnrollmentId(null)}
        >
          <div
            className="relative w-full max-w-3xl max-h-[calc(100vh-3rem)] overflow-hidden rounded-3xl bg-white p-6 shadow-2xl flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50"
              onClick={() => setSelectedProgramEnrollmentId(null)}
              aria-label="Close program details"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex-1 space-y-5 overflow-y-auto pr-2">
              <div className="flex flex-wrap items-start justify-between gap-3 pr-12">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Active Program</p>
                  <h3 className="text-2xl font-semibold text-gray-900">
                    {selectedProgramEnrollment.program?.title ?? 'Program'}
                  </h3>
                  {selectedProgramEnrollment.program?.subtitle && (
                    <p className="text-sm text-gray-600">{selectedProgramEnrollment.program.subtitle}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Active
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      setRenewalMessage(null);
                      const result = await requestRenewal(selectedProgramEnrollment.id);
                      if (result.success) {
                        setRenewalMessage('Renewal request sent to admin for review.');
                        setTimeout(() => setRenewalMessage(null), 4000);
                      } else {
                        setRenewalMessage(result.error ?? 'Unable to send renewal request. Try again.');
                        setTimeout(() => setRenewalMessage(null), 5000);
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-red-500"
                  >
                    Renew
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Ends on</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatDisplayDate(selectedProgramEndDate, {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    }) || 'TBD'}
                  </p>
                  {typeof selectedProgramEnrollment.daysRemaining === 'number' && (
                    <p className="text-sm text-gray-600">
                      {selectedProgramEnrollment.daysRemaining} days remaining
                    </p>
                  )}
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Assigned coach</p>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-700">
                      {(() => {
                        const coachId = selectedProgramEnrollment.program?.created_by ?? null;
                        const coach = coachContacts.find((contact) => contact.id === coachId);
                        const name =
                          coach ? [coach.first_name, coach.last_name].filter(Boolean).join(' ') || coach.email : 'Coach';
                        const initials = name
                          .split(' ')
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((segment) => segment.charAt(0).toUpperCase())
                          .join('') || 'C';
                        return initials;
                      })()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {(() => {
                          const coachId = selectedProgramEnrollment.program?.created_by ?? null;
                          const coach = coachContacts.find((contact) => contact.id === coachId);
                          return coach
                            ? [coach.first_name, coach.last_name].filter(Boolean).join(' ') || coach.email
                            : 'Coach';
                        })()}
                      </p>
                      <p className="text-xs text-gray-600">Program coach</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Progress</p>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-lg font-semibold text-gray-900">
                      {selectedProgramTimeProgress ?? 0}%
                    </p>
                    <div className="text-sm text-gray-500">Keeps updating with your check-ins</div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-300"
                      style={{
                        width: `${Math.min(100, Math.max(0, selectedProgramTimeProgress ?? 0))}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Rate this program</p>
                  <div className="flex items-center gap-2">
                    {Array.from({ length: 5 }).map((_, index) => {
                      const value = index + 1;
                      const current = selectedProgramEnrollment.program_id
                        ? programRatings[selectedProgramEnrollment.program_id] ?? 0
                        : 0;
                      const isActive = value <= current;
                      return (
                        <button
                          key={value}
                          type="button"
                          className="text-yellow-500"
                          onClick={() => {
                            if (selectedProgramEnrollment.program_id) {
                              rateProgram(selectedProgramEnrollment.program_id, value);
                            }
                          }}
                          aria-label={`Rate ${value} star${value === 1 ? '' : 's'}`}
                        >
                          <Star className={`w-6 h-6 ${isActive ? 'fill-yellow-400 text-yellow-500' : 'text-gray-300'}`} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Key focus areas</p>
                {selectedProgramEnrollment.program?.features?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedProgramEnrollment.program.features.map((feature: string, idx: number) => (
                      <span
                        key={`${feature}-${idx}`}
                        className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 border border-red-100"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">Your coach will set focus areas soon.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {renewalMessage && (
        <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
          <div className="rounded-full bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm text-emerald-800 shadow">
            {renewalMessage}
          </div>
        </div>
      )}
      {exerciseImagePreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6"
          onClick={() => setExerciseImagePreview(null)}
        >
          <div
            className="max-w-3xl w-full"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="rounded-2xl bg-white p-4 shadow-2xl max-h-[calc(100vh-3rem)] overflow-hidden flex flex-col">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Exercise preview</p>
                  <h3 className="text-lg font-bold text-gray-900">{exerciseImagePreview.name}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setExerciseImagePreview(null)}
                  className="rounded-full border border-gray-200 p-2 text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  aria-label="Close exercise preview"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden rounded-xl border border-gray-200 bg-black/5">
                <img
                  src={exerciseImagePreview.url}
                  alt={exerciseImagePreview.name}
                  className="h-full w-full object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      )}
      {selectedProgramForEnrollment && (
        <EnrollmentModal
          program={selectedProgramForEnrollment}
          onClose={() => setSelectedProgramForEnrollment(null)}
          onEnrollmentComplete={() => handleEnrollmentComplete(selectedProgramForEnrollment.id)}
          prefillData={enrollmentPrefill}
        />
      )}
      {isExploreProgramsOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-3xl rounded-2xl border border-gray-100 bg-white shadow-2xl max-h-[calc(100vh-3rem)] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Programs</p>
                <h4 className="text-lg font-semibold text-gray-900">Request a new enrollment</h4>
                <p className="text-xs text-gray-500">Admin approval applies before the program appears on your calendar.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadAvailablePrograms}
                  disabled={isProgramsLoading}
                  className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isProgramsLoading ? 'Refreshing…' : 'Refresh'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsExploreProgramsOpen(false)}
                  className="rounded-full border border-gray-200 bg-white p-2 text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  aria-label="Close explore programs"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
              {programsError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {programsError}
                </div>
              )}
              {isProgramsLoading ? (
                <div className="py-6 text-center text-sm text-gray-500">Loading programs…</div>
              ) : discoverablePrograms.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
                  You’re already enrolled in every available program. Check back later for new offerings.
                </div>
              ) : (
                discoverablePrograms.map((program) => (
                  <div key={program.id} className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{program.title}</p>
                        {program.subtitle && <p className="text-xs text-gray-500">{program.subtitle}</p>}
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {program.duration_weeks} weeks
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-gray-600">
                      {program.description ?? 'Structured programming with built-in progressions.'}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-lg font-semibold text-gray-900">
                        {program.price} {program.currency}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProgramForEnrollment(program);
                          setIsExploreProgramsOpen(false);
                        }}
                        className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
                      >
                        Request enrollment
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {isPhysicianBookingOpen && !isPhysicianView && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[calc(100vh-3rem)] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Physician appointment</p>
                <h4 className="text-lg font-semibold text-gray-900">Book with our sports physician partner</h4>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.35em] text-emerald-700 border border-emerald-200">
                  lift&recover • 10% off
                </span>
                <button
                  onClick={() => setIsPhysicianBookingOpen(false)}
                  className="rounded-full bg-gray-100 p-2 text-gray-500 hover:bg-gray-200"
                  aria-label="Close book physician modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="grid md:grid-cols-[2fr,1fr] gap-6 px-6 py-6 flex-1 overflow-y-auto">
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm font-medium text-gray-700">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span>{formatDisplayDate(physicianCalendarAnchor, { month: 'long', year: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handlePhysicianMonthStep(-1)}
                      className="rounded-full border border-gray-200 p-1 text-gray-500 hover:bg-gray-100"
                      aria-label="Previous month"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePhysicianMonthStep(1)}
                      className="rounded-full border border-gray-200 p-1 text-gray-500 hover:bg-gray-100"
                      aria-label="Next month"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day}>{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">{physicianCalendarDays.map(renderPhysicianCalendarCell)}</div>
              </div>
              <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs uppercase tracking-[0.35em] text-gray-500">Your selection</p>
                <h4 className="text-xl font-semibold text-gray-900 leading-tight">{physicianAppointmentLabel}</h4>
                <p className="text-sm text-gray-600">
                  {physicianBookingDate
                    ? 'We will request this date with the physician partner.'
                    : 'Click a training day to set your preferred appointment date.'}
                </p>
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">
                    Session type
                  </label>
                  <select
                    value={physicianSessionType}
                    onChange={(event) => {
                      setPhysicianSessionType(event.target.value);
                      setPhysicianBookingError(null);
                    }}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="">Select a session type</option>
                    <option value="Injury assessment">Injury assessment</option>
                    <option value="Recovery & rehab">Recovery & rehab</option>
                    <option value="Performance consult">Performance consult</option>
                    <option value="Follow-up appointment">Follow-up appointment</option>
                    <option value="Mobility & pain check">Mobility & pain check</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">
                    Session details (optional)
                  </label>
                  <textarea
                    value={physicianSessionDetails}
                    onChange={(event) => {
                      setPhysicianSessionDetails(event.target.value);
                      setPhysicianBookingError(null);
                    }}
                    rows={3}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    placeholder="Add symptoms, injury history, or goals for this visit."
                  />
                </div>
                {physicianBookingError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {physicianBookingError}
                  </div>
                )}
                {physicianBookingSuccess && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    {physicianBookingSuccess}
                  </div>
                )}
                {physicianAppointments.some((appt) => appt.status === 'slots_proposed') && (
                  <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
                    <p className="text-xs uppercase tracking-[0.35em] text-blue-700">Proposed slots</p>
                    {physicianAppointments
                      .filter((appt) => appt.status === 'slots_proposed')
                      .map((appt) => (
                        <div key={appt.id} className="space-y-2">
                          <p className="text-sm text-gray-800">
                            Date: {appt.requested_date} - Session: {appt.session_type}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {(appt.proposed_slots ?? []).map((slot: string) => (
                              <button
                                key={slot}
                                onClick={async () => {
                                  const { data, error } = await supabase.functions.invoke<{ success: boolean; error?: string }>(
                                    'physician-appointments',
                                    {
                                      body: { action: 'select_slot', appointmentId: appt.id, selectedSlot: slot },
                                    },
                                  );
                                  if (error || !data?.success) {
                                    setPhysicianBookingError(data?.error ?? error?.message ?? 'Unable to select slot.');
                                    return;
                                  }
                                  setPhysicianBookingSuccess(`You selected ${slot}. We’ll notify the physician.`);
                                  setPhysicianBookingError(null);
                                  supabase
                                    .from('physician_appointments')
                                    .select('*')
                                    .eq('user_id', user?.id ?? '')
                                    .order('created_at', { ascending: false })
                                    .then(({ data: rows }) => setPhysicianAppointments(rows ?? []));
                                }}
                                className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                              >
                                {slot}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={sendPhysicianAppointmentEmail}
                  disabled={isSendingPhysicianRequest}
                  className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSendingPhysicianRequest ? 'Sending request...' : 'Send request to coach'}
                </button>
                <p className="text-[11px] text-gray-500">
                  Your coach receives this request and will approve or reply with guidance before scheduling with the physician partner.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {isMessageModalOpen && !isMessagesView && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl max-h-[calc(100vh-3rem)] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Message coach</p>
                <h4 className="text-lg font-semibold text-gray-900">
                  {coachOptions.find((coach) => coach.id === activeCoachId)?.name || 'Coach'}
                </h4>
                {coachOptions.find((coach) => coach.id === activeCoachId)?.email && (
                  <p className="text-xs text-gray-500">
                    {coachOptions.find((coach) => coach.id === activeCoachId)?.email}
                  </p>
                )}
              </div>
              <button
                onClick={closeMessageModal}
                className="rounded-full bg-gray-100 p-2 text-gray-500 hover:bg-gray-200"
                aria-label="Close message coach modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid md:grid-cols-[1fr,320px] gap-6 px-6 py-6 flex-1 overflow-y-auto">
              <div className="space-y-4">
                {coachOptions.length > 1 && (
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">
                      Select coach
                    </label>
                    <select
                      value={activeCoachId ?? ''}
                      onChange={(event) => setSelectedCoachIdForMessage(event.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                    >
                      {coachOptions.map((coach) => (
                        <option key={coach.id} value={coach.id}>
                          {coach.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 max-h-[44vh] overflow-y-auto">
                  {conversation.length > 0 ? (
                    <div className="space-y-3">
                      {conversation.map((message) => {
                        const isSender = message.sender_id === user?.id;
                        return (
                          <div key={message.id} className={`flex ${isSender ? 'justify-end' : 'justify-start'}`}>
                            <div
                              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                                isSender ? 'bg-red-600 text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none'
                              }`}
                            >
                              <p>{message.message}</p>
                              <p className={`mt-2 text-[10px] uppercase tracking-wide ${isSender ? 'text-red-100' : 'text-gray-400'}`}>
                                {new Date(message.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center text-sm text-gray-500 py-12">
                      <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                      Start the conversation with your coach.
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">
                    Your message
                  </label>
                  <textarea
                    rows={6}
                    value={coachMessageBody}
                    onChange={(event) => setCoachMessageBody(event.target.value)}
                    placeholder="Ask for feedback, share an update, or set expectations for upcoming sessions."
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                  />
                </div>
                {coachMessageError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                    {coachMessageError}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleSendCoachMessage}
                  disabled={isSendingCoachMessage || !activeCoachId}
                  className="w-full inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  {isSendingCoachMessage ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Send message
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {isFeedbackModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl max-h-[calc(100vh-3rem)] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Verified check-ins</p>
                <h4 className="text-lg font-semibold text-gray-900">Coach feedback</h4>
                <p className="text-xs text-gray-500">
                  Showing {verifiedCoachFeedback.length} reviewed check-in
                  {verifiedCoachFeedback.length === 1 ? '' : 's'}
                </p>
              </div>
              <button
                onClick={closeFeedbackModal}
                className="rounded-full bg-gray-100 p-2 text-gray-500 hover:bg-gray-200"
                aria-label="Close feedback modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-6 space-y-4 flex-1 overflow-y-auto">
              {verifiedCoachFeedback.length > 0 ? (
                verifiedCoachFeedback.map(({ entry, displayNotes }) => (
                  <div key={entry.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 shadow-sm">
                    <div className="flex items-start gap-4">
                      <div className="rounded-2xl bg-gray-900/10 p-3 text-gray-900">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{entry.workout?.title ?? 'Workout'}</p>
                            <p className="text-xs text-gray-500">
                              Reviewed {new Date(entry.updated_at ?? entry.created_at).toLocaleString()}
                            </p>
                          </div>
                          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Reviewed
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{displayNotes}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-sm text-gray-500">
                  <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                  No verified check-ins yet. Once your coach reviews them, feedback will appear here.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {workoutSessionPortal}
      {isDetailsModalOpen && detailsWorkout && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-center justify-center px-4 py-8">
          <div
            className="w-full max-w-3xl rounded-2xl shadow-2xl border border-red-100 bg-gradient-to-br from-white via-white to-red-50/30 max-h-[calc(100vh-3rem)] overflow-hidden flex flex-col"
            ref={workoutDetailsRef}
          >
            <div className="flex items-start justify-between px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Workout details</p>
                <h3 className="text-2xl font-semibold text-gray-900">{detailsWorkout.title}</h3>
                <p className="text-sm text-gray-500">
                  {formatDisplayDate(detailsWorkout.scheduledDateObject ?? detailsWorkout.scheduled_date ?? null, {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportWorkoutDetails}
                  disabled={isExportingWorkoutDetails}
                  className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-white px-3 py-2 text-sm font-semibold text-red-600 transition hover:border-red-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download className={`w-4 h-4 ${isExportingWorkoutDetails ? 'animate-spin' : ''}`} />
                  {isExportingWorkoutDetails ? 'Exporting…' : 'Export plan'}
                </button>
                <button
                  type="button"
                  onClick={closeWorkoutDetails}
                  className="rounded-full border border-red-100 bg-white p-2 text-red-500 hover:text-red-700"
                  aria-label="Close workout details"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="px-6 pb-6 space-y-4 flex-1 overflow-y-auto" data-scroll-export="true">
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-4">
                  {detailsWorkoutFocusArea && (
                    <div className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-red-700 border border-red-100">
                      <Target className="w-4 h-4 text-red-500" />
                      <span>{detailsWorkoutFocusArea}</span>
                    </div>
                  )}
                  {detailsWorkout.duration_minutes && (
                    <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-gray-700 border border-gray-200">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span>{detailsWorkout.duration_minutes} minutes</span>
                    </div>
                  )}
                  <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-gray-700 border border-gray-200">
                    <CalendarDays className="w-4 h-4 text-gray-500" />
                    <span>
                      {formatDisplayDate(detailsWorkout.scheduledDateObject ?? detailsWorkout.scheduled_date ?? null, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                  Workout plan ({detailsWorkout.workout_exercises?.length ?? 0} exercises)
                </p>
                {renderExerciseDetails(detailsWorkout)}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Dashboard;
