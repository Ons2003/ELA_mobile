import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  Dumbbell,
  FilePlus,
  Loader,
  MessageCircle,
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
  RefreshCw,
  Send,
  Target,
  Users,
  X,
  Settings,
  Search,
} from 'lucide-react';
import { useCoachDashboard } from '../hooks/useCoachDashboard';
import type {
  CreateAthleteWorkoutInput,
  CoachAthleteDetails,
  CoachAthleteSummary,
  CoachWorkoutExerciseInput,
  UpdateAthleteWorkoutInput,
} from '../hooks/useCoachDashboard';
import { getExerciseImagePublicUrl, supabase } from '../lib/supabase';
import type { ProgramEnrollment, WorkoutWithRelations, WorkoutCheckIn, WeeklyGoal } from '../lib/supabase';
import { deserializeCoachNotes, getWorkoutFocusArea } from '../lib/workoutNotes';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

interface CoachDashboardProps {
  onNavigateHome: () => void;
  onNavigateSettings: () => void;
  onNavigateProgress: () => void;
}

const CHECKIN_STATUS_STYLES: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-700 border border-blue-200',
  reviewed: 'bg-green-100 text-green-700 border border-green-200',
  needs_revision: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
};

const TRAINING_DAYS_PER_WEEK = 6;
const WEEKLY_VISIBLE_DAYS = 3;

type CheckInFilterValue = WorkoutCheckIn['status'];

const CHECKIN_FILTERS: Array<{ value: CheckInFilterValue; label: string; activeClass: string }> = [
  {
    value: 'submitted',
    label: 'Pending',
    activeClass: 'border-blue-500 bg-blue-50 text-blue-700',
  },
  {
    value: 'needs_revision',
    label: 'Needs Revision',
    activeClass: 'border-yellow-500 bg-yellow-50 text-yellow-700',
  },
  {
    value: 'reviewed',
    label: 'Reviewed',
    activeClass: 'border-green-500 bg-green-50 text-green-700',
  },
];

const WEEKLY_GOAL_STATUS_META: Record<
  'pending' | 'achieved' | 'partial' | 'not_achieved',
  { label: string; badge: string }
> = {
  pending: { label: 'In progress', badge: 'bg-yellow-100 text-yellow-800' },
  achieved: { label: 'Achieved', badge: 'bg-emerald-100 text-emerald-800' },
  partial: { label: 'Somewhat achieved', badge: 'bg-blue-100 text-blue-800' },
  not_achieved: { label: 'Not achieved', badge: 'bg-red-100 text-red-800' },
};

const getWeekStartSunday = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
};

const formatDateTime = (value?: string | null, withTime = true) => {
  if (!value) {
    return 'Unknown';
  }
  const date = new Date(value);
  const datePart = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  if (!withTime) {
    return datePart;
  }
  const timePart = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${datePart} • ${timePart}`;
};

const safeName = (summary?: CoachAthleteSummary | null) => {
  if (!summary) {
    return 'Athlete';
  }

  const profileName = summary.profile
    ? [summary.profile.first_name, summary.profile.last_name].filter(Boolean).join(' ')
    : '';
  if (profileName.trim()) {
    return profileName.trim();
  }

  const enrollmentWithLead = summary.enrollments.find(
    (enrollment) => enrollment.lead_first_name || enrollment.lead_last_name || enrollment.lead_email,
  );
  if (enrollmentWithLead) {
    const leadName = [
      enrollmentWithLead.lead_first_name ?? '',
      enrollmentWithLead.lead_last_name ?? '',
    ]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (leadName) {
      return leadName;
    }
    if (enrollmentWithLead.lead_email) {
      return enrollmentWithLead.lead_email;
    }
  }

  if (summary.profile?.email) {
    return summary.profile.email;
  }

  return 'Athlete';
};

const getProfileInitials = (profile?: CoachAthleteSummary['profile']) => {
  if (!profile) {
    return 'A';
  }
  const first = profile.first_name?.charAt(0) ?? '';
  const last = profile.last_name?.charAt(0) ?? '';
  const initials = `${first}${last}`.trim();
  if (initials) {
    return initials.toUpperCase();
  }
  if (profile.email) {
    return profile.email.charAt(0).toUpperCase();
  }
  return 'A';
};

type WorkoutFormState = CreateAthleteWorkoutInput & { scheduledDate?: Date | null };

const PHYSICIAN_REQUEST_PREFIX = '[PHYSICIAN_REQUEST]';
const PHYSICIAN_RESPONSE_PREFIX = '[PHYSICIAN_RESPONSE]';
const DEFAULT_APPOINTMENT_SLOTS = ['10-11', '11-12', '12-1', '1-2', '2-3', '3-4', '4-5', '5-6'];

type WorkoutExerciseDraft = {
  id: string;
  name: string;
  targetSets: string;
  targetReps: string;
  targetWeight: string;
  targetRpe: string;
  restSeconds: string;
  notes: string;
  sourceExerciseId?: string;
  imageUrl?: string;
};

const CoachDashboard = ({ onNavigateHome, onNavigateSettings, onNavigateProgress }: CoachDashboardProps) => {
  const {
    loading,
    refreshing,
    coachId,
    profile,
    programs,
    athleteSummaries,
    selectedAthleteId,
    setSelectedAthleteId,
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
    refreshCoachData,
    updateCheckInStatus,
    createAthleteWorkout,
    updateAthleteWorkout,
    deleteAthleteWorkout,
    error,
    saveWeeklyGoalForAthlete,
    updateWeeklyGoalStatusForAthlete,
    exerciseLibrary,
    refreshExerciseLibrary,
  } = useCoachDashboard({ onNavigateHome });

  const [messageBody, setMessageBody] = useState('');
  const [showWorkoutForm, setShowWorkoutForm] = useState(false);
  const [workoutForm, setWorkoutForm] = useState<WorkoutFormState>({
    title: '',
    description: '',
    dayNumber: undefined,
    durationMinutes: undefined,
    focusArea: '',
    programId: undefined,
    coachNotes: '',
    scheduledDate: undefined,
  });
  const [checkInNotes, setCheckInNotes] = useState<Record<string, string>>({});
  const [checkInStatusFilter, setCheckInStatusFilter] = useState<CheckInFilterValue>('submitted');
  const [exerciseImagePreview, setExerciseImagePreview] = useState<{ name: string; url: string } | null>(null);
  const [physicianDecisionNotes, setPhysicianDecisionNotes] = useState<Record<string, string>>({});
  const [dashboardView, setDashboardView] = useState<'overview' | 'athlete-detail' | 'inbox'>('overview');
  const [activeAthleteTab, setActiveAthleteTab] = useState<'summary' | 'checkins' | 'programs' | 'messages'>('programs');
  const [calendarView, setCalendarView] = useState<'monthly' | 'weekly'>('monthly');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [rosterSearchTerm, setRosterSearchTerm] = useState('');
  const [rosterSort, setRosterSort] = useState<'alpha' | 'pending'>('alpha');
  const [physicianActionLoading, setPhysicianActionLoading] = useState<Record<string, boolean>>({});
  const [physicianResendLoading, setPhysicianResendLoading] = useState<Record<string, boolean>>({});
  const [pageError, setPageError] = useState<string | null>(null);
  const [physicianSlotSelections, setPhysicianSlotSelections] = useState<Record<string, string[]>>({});
  const [physicianStatusFilter, setPhysicianStatusFilter] = useState<'all' | 'pending' | 'slots_proposed' | 'slot_selected' | 'denied'>('pending');

  useEffect(() => {
    setCheckInStatusFilter('submitted');
  }, [selectedAthleteId]);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
  const [weeklyStartIndex, setWeeklyStartIndex] = useState(0);
  const [workoutFormError, setWorkoutFormError] = useState<string | null>(null);
  const [editWorkoutFormError, setEditWorkoutFormError] = useState<string | null>(null);
  const [newWeeklyGoalText, setNewWeeklyGoalText] = useState('');
  const [isSavingWeeklyGoal, setIsSavingWeeklyGoal] = useState(false);
  const [weeklyGoalError, setWeeklyGoalError] = useState<string | null>(null);
  const [statusUpdatingGoalId, setStatusUpdatingGoalId] = useState<string | null>(null);
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [editWorkoutForm, setEditWorkoutForm] = useState<WorkoutFormState>({
    title: '',
    description: '',
    dayNumber: undefined,
    durationMinutes: undefined,
    focusArea: '',
    programId: undefined,
    coachNotes: '',
    scheduledDate: undefined,
  });
  const [workoutExercises, setWorkoutExercises] = useState<WorkoutExerciseDraft[]>([]);
  const [editWorkoutExercises, setEditWorkoutExercises] = useState<WorkoutExerciseDraft[]>([]);
  const userAdjustedCalendarRef = useRef(false);
  const [deletingWorkoutId, setDeletingWorkoutId] = useState<string | null>(null);

  const generateDraftId = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const createExerciseDraft = (): WorkoutExerciseDraft => ({
    id: generateDraftId(),
    name: '',
    targetSets: '',
    targetReps: '',
    targetWeight: '',
    targetRpe: '',
    restSeconds: '',
    notes: '',
    sourceExerciseId: '',
    imageUrl: '',
  });


  const buildEmptyWorkoutForm = useCallback(
    (date?: Date | null): WorkoutFormState => ({
      title: '',
      description: '',
      dayNumber: undefined,
      durationMinutes: undefined,
      focusArea: '',
      programId: undefined,
      coachNotes: '',
      scheduledDate: date ?? undefined,
    }),
    [],
  );

  const renderAthleteRoster = () => {
    const searchTerm = rosterSearchTerm.trim().toLowerCase();
    const matchesSearch = (athlete: CoachAthleteSummary, programTitle: string) => {
      if (!searchTerm) return true;
      const name = safeName(athlete).toLowerCase();
      const email = (athlete.profile?.email ?? '').toLowerCase();
      const programText = (programTitle ?? '').toLowerCase();
      return name.includes(searchTerm) || email.includes(searchTerm) || programText.includes(searchTerm);
    };

    const sortAthletes = (list: CoachAthleteSummary[]) => {
      const copy = [...list];
      if (rosterSort === 'pending') {
        return copy.sort((a, b) => {
          if (b.pendingCheckIns === a.pendingCheckIns) {
            return safeName(a).localeCompare(safeName(b));
          }
          return (b.pendingCheckIns ?? 0) - (a.pendingCheckIns ?? 0);
        });
      }
      return copy.sort((a, b) => safeName(a).localeCompare(safeName(b)));
    };

    const programSections = programs
      .map(({ program, enrollments }) => {
        const seen = new Set<string>();
        const roster = enrollments
          .map((enrollment) => {
            const athleteId = enrollment.user_id ?? '';
            if (!athleteId || seen.has(athleteId)) {
              return null;
            }
            seen.add(athleteId);
            return athleteMap.get(athleteId) ?? null;
          })
          .filter((athlete): athlete is CoachAthleteSummary => Boolean(athlete))
          .filter((athlete) => matchesSearch(athlete, program.title));

        return {
          program,
          athletes: sortAthletes(roster),
        };
      })
      .filter((section) => section.athletes.length > 0);

    const groupedIds = new Set<string>();
    programSections.forEach((section) => {
      section.athletes.forEach((athlete) => groupedIds.add(athlete.userId));
    });

    const ungroupedAthletes = athleteSummaries
      .filter((athlete) => !groupedIds.has(athlete.userId))
      .filter((athlete) => matchesSearch(athlete, 'Ungrouped'));

    const filteredTotal =
      programSections.reduce((sum, section) => sum + section.athletes.length, 0) + ungroupedAthletes.length;

    const emptyState = programSections.length === 0 && ungroupedAthletes.length === 0;

    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Athlete roster</p>
            <h3 className="text-lg font-semibold text-gray-900">Athletes by program</h3>
            <p className="text-sm text-gray-500">
              Browse each program’s roster. Athletes without a program appear under Ungrouped.
            </p>
          </div>
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            {filteredTotal} {searchTerm ? 'matching' : 'active'}
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={rosterSearchTerm}
              onChange={(event) => setRosterSearchTerm(event.target.value)}
              placeholder="Filter by athlete or program..."
              className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm focus:border-red-400 focus:ring-2 focus:ring-red-100"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="text-xs uppercase tracking-wide text-gray-500">Sort</span>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setRosterSort('alpha')}
                className={`px-3 py-1.5 text-xs font-semibold ${
                  rosterSort === 'alpha' ? 'bg-red-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                A–Z
              </button>
              <button
                type="button"
                onClick={() => setRosterSort('pending')}
                className={`px-3 py-1.5 text-xs font-semibold border-l border-gray-200 ${
                  rosterSort === 'pending' ? 'bg-red-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                Pending
              </button>
            </div>
          </div>
        </div>

        {emptyState ? (
          <p className="mt-4 text-sm text-gray-500">
            {searchTerm
              ? 'No athletes match your search.'
              : 'No athletes are enrolled yet. Once an admin assigns them, you can manage their training here.'}
          </p>
        ) : (
          <div className="mt-6 space-y-6">
            {programSections.map(({ program, athletes }) => (
              <div key={program.id} className="rounded-2xl border border-gray-100 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{program.title}</p>
                    <p className="text-xs text-gray-500 capitalize">
                      {program.program_type.replace(/_/g, ' ')} • {program.level}
                    </p>
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {athletes.length} athlete{athletes.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="mt-3 rounded-xl border border-gray-200">
                  <div className="grid grid-cols-[1.6fr,1fr,0.9fr,1fr,1fr] items-center gap-3 bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    <span>Athlete</span>
                    <span>Program</span>
                    <span>Check-ins</span>
                    <span>Status</span>
                    <span className="text-right">Progress</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {athletes.map((athlete) => renderAthleteCard(athlete, program.title))}
                  </div>
                </div>
              </div>
            ))}

            {ungroupedAthletes.length > 0 && (
              <div className="rounded-2xl border border-gray-100 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Ungrouped athletes</p>
                    <p className="text-xs text-gray-500">Athletes without an active program assignment.</p>
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {ungroupedAthletes.length} athlete{ungroupedAthletes.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="mt-3 rounded-xl border border-gray-200">
                  <div className="grid grid-cols-[1.6fr,1fr,0.9fr,1fr,1fr] items-center gap-3 bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    <span>Athlete</span>
                    <span>Program</span>
                    <span>Check-ins</span>
                    <span>Status</span>
                    <span className="text-right">Progress</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {ungroupedAthletes.map((athlete) => renderAthleteCard(athlete, 'Ungrouped'))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const handleAddExerciseDraft = () => {
    setWorkoutExercises((previous) => [...previous, createExerciseDraft()]);
  };

  const handleRemoveExerciseDraft = (exerciseId: string) => {
    setWorkoutExercises((previous) => previous.filter((exercise) => exercise.id !== exerciseId));
  };

  const handleExerciseDraftChange = (
    exerciseId: string,
    field: keyof WorkoutExerciseDraft,
    value: string,
  ) => {
    setWorkoutExercises((previous) =>
      previous.map((exercise) => (exercise.id === exerciseId ? { ...exercise, [field]: value } : exercise)),
    );
  };

  const applyTemplateToExerciseDraft = (
    exerciseId: string,
    templateId: string,
    mode: 'create' | 'edit',
  ) => {
    const template = exerciseLibrary.find((entry) => entry.id === templateId);

    const updater =
      mode === 'create'
        ? setWorkoutExercises
        : setEditWorkoutExercises;

    updater((previous) =>
      previous.map((exercise) => {
        if (exercise.id !== exerciseId) {
          return exercise;
        }

        if (!template) {
          return { ...exercise, sourceExerciseId: '' };
        }

        return {
          ...exercise,
          sourceExerciseId: template.id,
          name: template.exercise_name ?? exercise.name,
          targetSets:
            template.target_sets != null ? String(template.target_sets) : exercise.targetSets,
          targetReps: template.target_reps ?? exercise.targetReps,
          targetWeight:
            template.target_weight != null ? String(template.target_weight) : exercise.targetWeight,
          targetRpe:
            template.target_rpe != null ? String(template.target_rpe) : exercise.targetRpe,
          restSeconds:
            template.rest_seconds != null ? String(template.rest_seconds) : exercise.restSeconds,
          notes: template.notes ?? exercise.notes,
          imageUrl: template.image_url ?? exercise.imageUrl,
        };
      }),
    );
  };

  const handleAddEditExerciseDraft = () => {
    setEditWorkoutExercises((previous) => [...previous, createExerciseDraft()]);
  };

  const handleRemoveEditExerciseDraft = (exerciseId: string) => {
    setEditWorkoutExercises((previous) => previous.filter((exercise) => exercise.id !== exerciseId));
  };

  const handleEditExerciseDraftChange = (
    exerciseId: string,
    field: keyof WorkoutExerciseDraft,
    value: string,
  ) => {
    setEditWorkoutExercises((previous) =>
      previous.map((exercise) => (exercise.id === exerciseId ? { ...exercise, [field]: value } : exercise)),
    );
  };

  const parseDateValue = useCallback((value?: string | Date | null) => {
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
        return normalize(new Date(year, month - 1, day));
      }
    }

    const timestamp = Date.parse(stringValue);
    if (Number.isNaN(timestamp)) {
      return null;
    }

    return normalize(new Date(timestamp));
  }, []);

  const formatDateOnly = useCallback((date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const formatWeekRangeLabel = useCallback(
    (weekStart: string) => {
      const start = parseDateValue(weekStart);
      if (!start) {
        return 'Week';
      }
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `${formatDateTime(start.toISOString(), false)} – ${formatDateTime(end.toISOString(), false)}`;
    },
    [formatDateTime, parseDateValue],
  );

  const formatDateKey = useCallback(
    (value?: string | Date | null) => {
      const parsed = parseDateValue(value);
      return parsed ? formatDateOnly(parsed) : null;
    },
    [formatDateOnly, parseDateValue],
  );

  const formatDisplayDate = useCallback(
    (value?: string | Date | null, options?: Intl.DateTimeFormatOptions) => {
      const parsed = parseDateValue(value);
      if (!parsed) {
        return '';
      }
      return parsed.toLocaleDateString('en-US', options);
    },
    [parseDateValue],
  );

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
    const offset = day === 0 ? -6 : 1 - day;
    aligned.setDate(aligned.getDate() + offset);
    return aligned;
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
    [],
  );

  const computeDayNumberFromDate = useCallback((start: Date | null, target: Date | null) => {
    if (!start || !target) {
      return null;
    }
    const base = new Date(start);
    base.setHours(0, 0, 0, 0);
    const compared = new Date(target);
    compared.setHours(0, 0, 0, 0);
    if (compared < base) {
      return null;
    }
    const diffDays = Math.floor((compared.getTime() - base.getTime()) / (24 * 60 * 60 * 1000));
    const weeksOffset = Math.floor(diffDays / 7);
    const dayOffset = diffDays % 7;
    if (dayOffset >= TRAINING_DAYS_PER_WEEK) {
      return null;
    }
    return weeksOffset * TRAINING_DAYS_PER_WEEK + dayOffset + 1;
  }, []);

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
    [alignToMonday, parseDateValue],
  );

  const resolveScheduledDate = useCallback(
    (workout: WorkoutWithRelations) =>
      parseDateValue(workout.scheduledDateObject ?? workout.scheduled_date ?? null),
    [parseDateValue],
  );

  const adjustWorkoutsForCalendar = useCallback(
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
    }) => {
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
          scheduleByProgram.set(enrollment.program_id as string, schedule);
        });

      const scheduled = rawWorkouts.reduce<WorkoutWithRelations[]>((acc, workout) => {
        const directDate = resolveScheduledDate(workout);
        if (directDate) {
          if (!dateRange || (directDate >= dateRange.start && directDate <= dateRange.end)) {
            acc.push({
              ...workout,
              scheduled_date: formatDateOnly(directDate),
              scheduledDateObject: directDate,
              checkins: (workout.checkins ?? []).filter((checkIn) => checkIn.user_id === userId),
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
          const fallback =
            parseDateValue((workout as any).scheduled_date) ??
            parseDateValue((workout as any).created_at) ??
            parseDateValue((workout as any).updated_at) ??
            new Date();
          startDate = alignToMonday(fallback);
        }

        if (!startDate) {
          return acc;
        }

        if (schedule?.totalDays && workout.day_number && workout.day_number > schedule.totalDays) {
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

        acc.push({
          ...workout,
          scheduled_date: formatDateOnly(scheduledDate),
          scheduledDateObject: scheduledDate,
          checkins: (workout.checkins ?? []).filter((checkIn) => checkIn.user_id === userId),
        });
        return acc;
      }, []);

      return scheduled.sort((a, b) => {
        const aTime = resolveScheduledDate(a)?.getTime() ?? 0;
        const bTime = resolveScheduledDate(b)?.getTime() ?? 0;
        return aTime - bTime;
      });
    },
    [alignToMonday, computeScheduledDate, deriveProgramSchedule, formatDateOnly, resolveScheduledDate, parseDateValue],
  );

  useEffect(() => {
    if (!selectedAthleteDetails) {
      setCheckInNotes({});
      return;
    }
    const notesMap = selectedAthleteDetails.checkIns.reduce<Record<string, string>>((acc, checkIn) => {
      acc[checkIn.id] = checkIn.coach_notes ?? '';
      return acc;
    }, {});
    setCheckInNotes(notesMap);
  }, [selectedAthleteDetails]);

  useEffect(() => {
    setShowWorkoutForm(false);
    setWorkoutForm(buildEmptyWorkoutForm());
    setWorkoutExercises([]);
    setEditingWorkoutId(null);
    setEditWorkoutForm({
      title: '',
      description: '',
      dayNumber: undefined,
      durationMinutes: undefined,
      focusArea: '',
      programId: undefined,
      coachNotes: '',
      scheduledDate: undefined,
    });
    setWorkoutFormError(null);
    setEditWorkoutFormError(null);
    setEditWorkoutExercises([]);
  }, [buildEmptyWorkoutForm, selectedAthleteId]);

  const renderWorkoutPlan = (workout: WorkoutWithRelations) => {
    if (!workout?.workout_exercises?.length) {
      return (
        <p className="mt-3 text-sm text-gray-500">
          No exercises are attached to this workout yet. Add movements to complete this training session.
        </p>
      );
    }

    return (
      <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Workout plan ({workout.workout_exercises.length} exercises)
        </p>
        <div className="mt-3 space-y-3">
          {workout.workout_exercises.map((exercise, index) => {
            const sortedSets =
              exercise.exercise_sets?.slice().sort((a, b) => (a.set_number ?? 0) - (b.set_number ?? 0)) ?? [];
            const exerciseImageUrl = getExerciseImagePublicUrl(exercise.image_url);

            return (
              <div
                key={exercise.id ?? `${exercise.exercise_name}-${index}`}
                className="rounded-xl border border-gray-100 bg-gray-50 p-3"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gray-900">{exercise.exercise_name}</p>
                      <span className="text-xs font-semibold text-gray-400">#{index + 1}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                      {exercise.target_sets && (
                        <span className="inline-flex items-center rounded-md border border-red-200 bg-red-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-red-700">
                          {exercise.target_sets} sets
                        </span>
                      )}
                      {exercise.target_reps && (
                        <span className="inline-flex items-center rounded-md border border-red-200 bg-red-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-red-700">
                          {exercise.target_reps} reps
                        </span>
                      )}
                      {exercise.target_weight != null && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                          <Dumbbell className="h-3 w-3" />
                          {exercise.target_weight}
                        </span>
                      )}
                      {exercise.target_rpe != null && (
                        <span className="inline-flex items-center rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                          RPE {exercise.target_rpe}
                        </span>
                      )}
                      {exercise.rest_seconds && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                          <Clock className="h-3 w-3" />
                          Rest {exercise.rest_seconds}s
                        </span>
                      )}
                    </div>
                  </div>
                  {exerciseImageUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        setExerciseImagePreview({
                          name: exercise.exercise_name,
                          url: exerciseImageUrl,
                        })
                      }
                      className="overflow-hidden rounded-lg border border-gray-200 bg-white"
                      aria-label={`View ${exercise.exercise_name} preview`}
                    >
                      <img
                        src={exerciseImageUrl}
                        alt={exercise.exercise_name}
                        className="h-16 w-16 object-cover"
                      />
                    </button>
                  )}
                </div>
                {sortedSets.length > 0 && (
                  <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
                    <div className="grid grid-cols-4 bg-white text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      <div className="px-3 py-2">Set</div>
                      <div className="px-3 py-2">Weight</div>
                      <div className="px-3 py-2">Reps</div>
                      <div className="px-3 py-2">RPE</div>
                    </div>
                    {sortedSets.map((set) => (
                      <div
                        key={set.id ?? `${exercise.id}-set-${set.set_number}`}
                        className="grid grid-cols-4 bg-white text-xs text-gray-700"
                      >
                        <div className="px-3 py-2 border-t border-gray-100">{set.set_number ?? '-'}</div>
                        <div className="px-3 py-2 border-t border-gray-100">
                          {set.weight != null ? `${set.weight}` : '-'}
                        </div>
                        <div className="px-3 py-2 border-t border-gray-100">{set.reps ?? '-'}</div>
                        <div className="px-3 py-2 border-t border-gray-100">{set.rpe ?? '-'}</div>
                      </div>
                    ))}
                  </div>
                )}
                {exercise.notes && (
                  <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-gray-600">{exercise.notes}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  const handleSelectAthlete = (athleteId: string) => {
    setSelectedAthleteId(athleteId);
    setDashboardView('athlete-detail');
    setActiveAthleteTab('programs');
  };

  const handleBackToOverview = () => {
    setDashboardView('overview');
  };

  const handleOpenInbox = useCallback(() => {
    setDashboardView('inbox');
  }, []);

  const handleOpenConversation = useCallback(
    (athleteId: string | null) => {
      if (!athleteId) {
        return;
      }
      setSelectedAthleteId(athleteId);
      setSelectedConversationUserId(athleteId);
      setActiveAthleteTab('messages');
      setDashboardView('athlete-detail');
    },
    [setSelectedAthleteId, setSelectedConversationUserId],
  );

  const resolveAthleteName = (athleteId?: string | null) => {
    if (!athleteId) {
      return 'Athlete';
    }
    const summary = athleteSummaries.find((athlete) => athlete.userId === athleteId);
    return safeName(summary);
  };

  type PhysicianRequest = {
    id: string;
    status: 'pending' | 'approved' | 'denied' | 'slots_proposed' | 'slot_selected';
    requestedDate: string | null;
    dateLabel: string;
    sessionType: string;
    sessionDetails: string;
    proposedSlots?: string[];
    athleteId: string | null;
    athleteName: string;
    athleteEmail: string | null;
    athletePhone: string | null;
    programTitle: string;
    createdAt: string;
    decidedAt?: string;
    coachNote?: string;
  };

  const parsePhysicianPayload = useCallback(
    (message: CoachMessage) => {
      const trimmed = message.message.trim();
      const hasRequestPrefix = trimmed.includes(PHYSICIAN_REQUEST_PREFIX);
      const hasResponsePrefix = trimmed.includes(PHYSICIAN_RESPONSE_PREFIX);
      const isRequest = hasRequestPrefix && !hasResponsePrefix;
      const isResponse = hasResponsePrefix && !hasRequestPrefix;
      if (!isRequest && !isResponse) {
        return null;
      }

      const prefix = isRequest ? PHYSICIAN_REQUEST_PREFIX : PHYSICIAN_RESPONSE_PREFIX;
      const index = trimmed.indexOf(prefix);
      const jsonPart = trimmed.slice(index + prefix.length).trim();
      try {
        const parsed = JSON.parse(jsonPart);
        if (!parsed.id) {
          return null;
        }
        const athleteName = resolveAthleteName(parsed.athlete?.id) || parsed.athlete?.name || 'Athlete';
        const base: PhysicianRequest = {
          id: parsed.id,
          status: parsed.status ?? 'pending',
          requestedDate: parsed.requestedDate ?? null,
          dateLabel: parsed.dateLabel ?? 'Requested date',
          sessionType: parsed.sessionType ?? 'Session',
          sessionDetails: parsed.sessionDetails ?? '',
          proposedSlots: parsed.proposedSlots ?? undefined,
          athleteId: parsed.athlete?.id ?? null,
          athleteName,
          athleteEmail: parsed.athlete?.email ?? null,
          athletePhone: parsed.athlete?.phone ?? null,
          programTitle: parsed.athlete?.program ?? 'Program not specified',
          createdAt: parsed.createdAt ?? message.created_at,
          decidedAt: parsed.decidedAt,
          coachNote: parsed.coachNote,
        };
        return { payload: base, isResponse };
      } catch {
        return null;
      }
    },
    [resolveAthleteName],
  );

  const physicianRequests = useMemo(() => {
    const map = new Map<string, PhysicianRequest>();
    coachMessages.forEach((message) => {
      const parsed = parsePhysicianPayload(message);
      if (!parsed || parsed.isResponse) {
        return;
      }
      map.set(parsed.payload.id, parsed.payload);
    });

    coachMessages.forEach((message) => {
      const parsed = parsePhysicianPayload(message);
      if (!parsed || !parsed.isResponse) {
        return;
      }
      const existing = map.get(parsed.payload.id);
      if (existing) {
        map.set(parsed.payload.id, { ...existing, ...parsed.payload });
      }
    });

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [coachMessages, parsePhysicianPayload]);

  const selectedSummary = selectedAthleteDetails?.summary ?? athleteSummaries.find((athlete) => athlete.userId === selectedAthleteId);

  const scheduledWorkouts = useMemo(() => {
    if (!selectedAthleteDetails || !selectedSummary) {
      return [];
    }
    return adjustWorkoutsForCalendar({
      workouts: selectedAthleteDetails.workouts,
      enrollmentList: selectedSummary.enrollments,
      userId: selectedAthleteDetails.athleteId,
    });
  }, [adjustWorkoutsForCalendar, selectedAthleteDetails, selectedSummary]);

  const workoutsByDate = useMemo(() => {
    return scheduledWorkouts.reduce<Record<string, WorkoutWithRelations[]>>((acc, workout) => {
      const key = formatDateKey(workout.scheduled_date ?? workout.scheduledDateObject);
      if (!key) {
        return acc;
      }
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(workout);
      return acc;
    }, {});
  }, [formatDateKey, scheduledWorkouts]);

  const calendarDays = useMemo(() => {
    const year = selectedCalendarDate.getFullYear();
    const month = selectedCalendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: Date[] = [];
    const cursor = new Date(startDate);
    for (let i = 0; i < 42; i += 1) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }, [selectedCalendarDate]);

  const weekDays = useMemo(() => {
    const startOfWeek = new Date(selectedCalendarDate);
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
  }, [selectedCalendarDate]);

  const maxWeeklyStartIndex = useMemo(
    () => Math.max(0, weekDays.length - WEEKLY_VISIBLE_DAYS),
    [weekDays],
  );

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
    const startLabel = formatDisplayDate(start, { month: 'short', day: 'numeric' });
    const endLabel = formatDisplayDate(end, { month: 'short', day: 'numeric' });
    if (!startLabel) {
      return '';
    }
    if (!endLabel || startLabel === endLabel) {
      return startLabel;
    }
    return `${startLabel} – ${endLabel}`;
  }, [formatDisplayDate, visibleWeekDays]);

  useEffect(() => {
    setWeeklyStartIndex((current) => Math.min(current, maxWeeklyStartIndex));
  }, [maxWeeklyStartIndex]);

  const selectedDayWorkouts = useMemo(() => {
    const key = formatDateOnly(selectedCalendarDate);
    return workoutsByDate[key] ?? [];
  }, [formatDateOnly, selectedCalendarDate, workoutsByDate]);

  const selectedWorkout = useMemo(() => {
    if (!selectedWorkoutId) {
      return null;
    }
    return scheduledWorkouts.find((workout) => workout.id === selectedWorkoutId) ?? null;
  }, [scheduledWorkouts, selectedWorkoutId]);

  useEffect(() => {
    if (userAdjustedCalendarRef.current) {
      userAdjustedCalendarRef.current = false;
      return;
    }

    if (scheduledWorkouts.length === 0) {
      setSelectedWorkoutId(null);
      return;
    }

    const currentKey = formatDateOnly(selectedCalendarDate);
    if (workoutsByDate[currentKey]?.length) {
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sorted = scheduledWorkouts
      .map((workout) => ({
        workout,
        date: resolveScheduledDate(workout),
      }))
      .filter((entry): entry is { workout: WorkoutWithRelations; date: Date } => Boolean(entry.date))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (sorted.length === 0) {
      return;
    }

    const next = sorted.find((entry) => entry.date >= today) ?? sorted[sorted.length - 1];
    setSelectedCalendarDate(next.date);
  }, [formatDateOnly, resolveScheduledDate, scheduledWorkouts, selectedCalendarDate, workoutsByDate]);

  useEffect(() => {
    const key = formatDateOnly(selectedCalendarDate);
    const workoutsForDay = workoutsByDate[key] ?? [];
    if (workoutsForDay.length === 0) {
      setSelectedWorkoutId(null);
      return;
    }
    setSelectedWorkoutId((current) => {
      if (current && workoutsForDay.some((workout) => workout.id === current)) {
        return current;
      }
      return workoutsForDay[0].id;
    });
  }, [formatDateOnly, selectedCalendarDate, workoutsByDate]);

  useEffect(() => {
    if (!selectedSummary) {
      return;
    }
    setWorkoutForm((previous) => ({
      ...previous,
      programId: previous.programId ?? selectedSummary.programs[0]?.id ?? undefined,
    }));
  }, [selectedSummary]);

  const resolveDayNumberForProgram = useCallback(
    (programId: string | null | undefined, targetDate: Date | null) => {
      if (!targetDate) {
        return null;
      }
      if (programId) {
        const enrollment = selectedSummary?.enrollments.find((entry) => entry.program_id === programId);
        if (!enrollment) {
          return null;
        }
        const schedule = deriveProgramSchedule(enrollment);
        return computeDayNumberFromDate(schedule.start ?? null, targetDate);
      }
      const startAnchor = alignToMonday(targetDate);
      return computeDayNumberFromDate(startAnchor, targetDate);
    },
    [alignToMonday, computeDayNumberFromDate, deriveProgramSchedule, selectedSummary?.enrollments],
  );

  const conversationMessages = useMemo(() => {
    if (!selectedConversationUserId) {
      return [];
    }
    return coachMessages
      .filter(
        (message) =>
          (message.sender_id === selectedConversationUserId && message.receiver_id === coachId) ||
          (message.sender_id === coachId && message.receiver_id === selectedConversationUserId),
      )
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [coachMessages, selectedConversationUserId, coachId]);

  const inboxMessages = useMemo(() => {
    const sorted = coachMessages.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const seen = new Set<string>();
    const uniqueThreads: CoachMessage[] = [];

    sorted.forEach((message) => {
      const partnerId = message.sender_id === coachId ? message.receiver_id : message.sender_id;
      if (!partnerId || seen.has(partnerId)) {
        return;
      }
      seen.add(partnerId);
      uniqueThreads.push(message);
    });

    return uniqueThreads;
  }, [coachMessages, coachId]);

  const pendingCheckIns = selectedAthleteDetails?.summary.pendingCheckIns ?? 0;
  const athleteWeeklyGoals = selectedAthleteDetails?.weeklyGoals ?? [];
  const sortedAthleteWeeklyGoals = useMemo(
    () => athleteWeeklyGoals.slice().sort((a, b) => new Date(b.week_start).getTime() - new Date(a.week_start).getTime()),
    [athleteWeeklyGoals],
  );
  const coachWeekStart = getWeekStartSunday(new Date());
  const coachWeekKey = coachWeekStart.toISOString().slice(0, 10);
  const coachCurrentWeekGoal = sortedAthleteWeeklyGoals.find((goal) => goal.week_start === coachWeekKey) ?? null;
  const previousWeeklyGoals = sortedAthleteWeeklyGoals.filter((goal) => goal.week_start !== coachWeekKey);

  useEffect(() => {
    setNewWeeklyGoalText(coachCurrentWeekGoal?.goal_text ?? '');
    setWeeklyGoalError(null);
  }, [coachCurrentWeekGoal?.goal_text, selectedAthleteId]);
  const athleteMap = useMemo(() => {
    const map = new Map<string, CoachAthleteSummary>();
    athleteSummaries.forEach((athlete) => {
      map.set(athlete.userId, athlete);
    });
    return map;
  }, [athleteSummaries]);

  const handleSubmitMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedConversationUserId || !messageBody.trim()) {
      return;
    }
    const result = await sendCoachMessageToAthlete(selectedConversationUserId, messageBody.trim());
    if (result) {
      setMessageBody('');
    }
  };

  const buildPhysicianEmailPayload = (request: PhysicianRequest, slots: string[]) => {
    const slotsList = slots.map((slot) => `- ${slot}`).join('\n');
    const baseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
    const functionBase = baseUrl.replace('.supabase.co', '.functions.supabase.co');
    const supabaseBase = functionBase || baseUrl;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
    const slotButtons = slots
      .map((slot) => {
        const link = `${supabaseBase}/physician-appointments?action=select_slot_external&appointmentId=${request.id}&slot=${encodeURIComponent(slot)}${anonKey ? `&apikey=${anonKey}` : ''}`;
        return `<a href="${link}" style="display:inline-block;margin:4px 4px 0 0;padding:10px 14px;border-radius:8px;background:#16a34a;color:#fff;text-decoration:none;font-weight:bold;">${slot}</a>`;
      })
      .join('');

    const emailContent = `Request approved from ELA coach desk.

Requested date: ${request.dateLabel}
Session type: ${request.sessionType}
Details: ${request.sessionDetails || 'Not provided'}
Slots offered:
${slotsList}
Athlete: ${request.athleteName}
Email: ${request.athleteEmail || 'Not provided'}
Phone: ${request.athletePhone || 'Not provided'}
Program: ${request.programTitle}

Please select a time slot to finalize scheduling for this athlete.`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px;">
        <h2 style="margin-bottom: 12px;">Physician appointment request</h2>
        <p>${emailContent.replace(/\n/g, '<br/>')}</p>
        <div style="margin-top:16px; display:flex; gap:8px; flex-wrap: wrap;">${slotButtons}</div>
      </div>
    `;

    return { emailContent, html };
  };

  const handlePhysicianDecision = useCallback(
    async (request: PhysicianRequest, status: 'approved' | 'denied') => {
      if (!request.athleteId) {
        setPageError('Unable to notify athlete: missing athlete id on request.');
        return;
      }
      const note = (physicianDecisionNotes[request.id] ?? '').trim();
      if (status === 'denied' && !note) {
        setPageError('Please add a note explaining the denial before sending.');
        return;
      }
      const slots = physicianSlotSelections[request.id] ?? [];
      if (status === 'approved' && slots.length === 0) {
        setPageError('Select at least one slot to send to the physician.');
        return;
      }
      setPageError(null);
      setPhysicianActionLoading((previous) => ({ ...previous, [request.id]: true }));
      const payloadStatus = status === 'approved' ? 'slots_proposed' : 'denied';
      const payload = {
        ...request,
        status: payloadStatus,
        decidedAt: new Date().toISOString(),
        coachNote: note || undefined,
        proposedSlots: slots,
      };

      if (status === 'approved') {
        const { data, error } = await supabase.functions.invoke<{ success: boolean; error?: string }>('physician-appointments', {
          body: { action: 'propose_slots', appointmentId: request.id, slots },
        });
        if (error || !data?.success) {
          setPageError(data?.error ?? error?.message ?? 'Unable to send physician email. Please retry.');
          setPhysicianActionLoading((previous) => ({ ...previous, [request.id]: false }));
          return;
        }

        const result = await sendCoachMessageToAthlete(
          request.athleteId,
          `${PHYSICIAN_RESPONSE_PREFIX} ${JSON.stringify(payload)}`,
        );
        if (!result) {
          setPageError('Unable to send decision to athlete. Please try again.');
          setPhysicianActionLoading((previous) => ({ ...previous, [request.id]: false }));
          return;
        }

      } else {
        await supabase.functions.invoke('physician-appointments', {
          body: { action: 'deny', appointmentId: request.id },
        });
        const result = await sendCoachMessageToAthlete(
          request.athleteId,
          `${PHYSICIAN_RESPONSE_PREFIX} ${JSON.stringify(payload)}`,
        );
        if (!result) {
          setPageError('Unable to send decision to athlete. Please try again.');
          setPhysicianActionLoading((previous) => ({ ...previous, [request.id]: false }));
          return;
        }
      }
      setPhysicianDecisionNotes((previous) => ({ ...previous, [request.id]: '' }));
      setPhysicianSlotSelections((previous) => ({ ...previous, [request.id]: [] }));
      refreshCoachMessages();
      setPhysicianActionLoading((previous) => ({ ...previous, [request.id]: false }));
    },
    [physicianDecisionNotes, physicianSlotSelections, refreshCoachMessages, sendCoachMessageToAthlete],
  );

  const handleResendPhysicianEmail = useCallback(
    async (request: PhysicianRequest) => {
      const slots =
        (request.proposedSlots && request.proposedSlots.length > 0 && request.proposedSlots) ||
        physicianSlotSelections[request.id] ||
        [];
      if (slots.length === 0) {
        setPageError('No time slots to resend. Please add slots first.');
        return;
      }
      setPageError(null);
      setPhysicianResendLoading((previous) => ({ ...previous, [request.id]: true }));
      const { emailContent, html } = buildPhysicianEmailPayload(request, slots);
      const { data: emailResult, error: emailError } = await supabase.functions.invoke<{ success: boolean; error?: string }>('physician-email', {
        body: {
          to: 'onsouenniche6@gmail.com',
          subject: `Physician appointment request - ${request.dateLabel}`,
          content: emailContent,
          html,
        },
      });
      if (emailError || !emailResult?.success) {
        setPageError(emailResult?.error ?? emailError?.message ?? 'Unable to resend physician email. Please retry.');
      }
      setPhysicianResendLoading((previous) => ({ ...previous, [request.id]: false }));
    },
    [buildPhysicianEmailPayload, physicianSlotSelections],
  );

  const handleWeeklyGoalSubmit = useCallback(async () => {
    if (!selectedSummary) {
      return;
    }

    if (!newWeeklyGoalText.trim()) {
      setWeeklyGoalError('Please describe the weekly goal before publishing.');
      return;
    }

    setWeeklyGoalError(null);
    setIsSavingWeeklyGoal(true);
    const isoWeekStart = coachWeekStart.toISOString().slice(0, 10);
    const success = await saveWeeklyGoalForAthlete(
      selectedSummary.userId,
      isoWeekStart,
      newWeeklyGoalText.trim(),
      coachCurrentWeekGoal?.id,
    );
    setIsSavingWeeklyGoal(false);
    if (!success) {
      setWeeklyGoalError('Unable to save weekly goal. Please try again.');
      return;
    }
    if (!coachCurrentWeekGoal) {
      setNewWeeklyGoalText('');
    }
  }, [coachCurrentWeekGoal, coachWeekStart, newWeeklyGoalText, saveWeeklyGoalForAthlete, selectedSummary]);

  const handleWeeklyGoalStatusChange = useCallback(
    async (goalId: string, status: 'pending' | 'achieved' | 'partial' | 'not_achieved') => {
      setStatusUpdatingGoalId(goalId);
      const success = await updateWeeklyGoalStatusForAthlete(goalId, status);
      setStatusUpdatingGoalId(null);
      if (!success) {
        setWeeklyGoalError('Unable to update goal status. Please try again.');
      }
    },
    [updateWeeklyGoalStatusForAthlete],
  );

  const handleCheckInUpdate = async (checkInId: string, status: 'reviewed' | 'needs_revision') => {
    const notes = checkInNotes[checkInId] ?? '';
    await updateCheckInStatus(checkInId, status, notes);
  };

  const handleSaveCoachNotes = async (checkInId: string) => {
    const notes = checkInNotes[checkInId] ?? '';
    const existing = selectedAthleteDetails?.checkIns.find((checkIn) => checkIn.id === checkInId);
    if (!existing) {
      return;
    }
    await updateCheckInStatus(checkInId, existing.status, notes);
  };

  const handleCreateWorkout = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedAthleteDetails) {
      return;
    }
    setWorkoutFormError(null);

    const scheduledDate = workoutForm.scheduledDate ?? selectedCalendarDate;
    const scheduledDateString = scheduledDate ? formatDateOnly(scheduledDate) : undefined;
    const programId = workoutForm.programId ?? null;
    const isProgramWorkout = Boolean(programId);

    if (!workoutForm.title.trim()) {
      setWorkoutFormError('Workout title is required.');
      return;
    }

    const hasManualDayNumber =
      typeof workoutForm.dayNumber === 'number' && Number.isFinite(workoutForm.dayNumber) && workoutForm.dayNumber > 0;

    let resolvedDayNumber: number | undefined;
    if (isProgramWorkout) {
      if (scheduledDate) {
        const computedDay = resolveDayNumberForProgram(programId, scheduledDate);
        if (!computedDay) {
          setWorkoutFormError('Selected date is outside this program schedule. Choose another day or adjust the program start.');
          return;
        }
        resolvedDayNumber = hasManualDayNumber ? workoutForm.dayNumber ?? computedDay : computedDay;
      } else if (hasManualDayNumber) {
        resolvedDayNumber = workoutForm.dayNumber ?? undefined;
      } else {
        resolvedDayNumber = 1;
      }
    }

    const { exercisesPayload, hasMissingExerciseName, hasInvalidExerciseNumber } = buildExercisesPayload(workoutExercises);

    if (hasMissingExerciseName) {
      setWorkoutFormError('Give each exercise a name or remove the empty row.');
      return;
    }

    if (hasInvalidExerciseNumber) {
      setWorkoutFormError('Use numeric values for sets, weight, RPE, and rest time.');
      return;
    }

    const payload: CreateAthleteWorkoutInput = {
      title: workoutForm.title,
      description: workoutForm.description,
      durationMinutes: workoutForm.durationMinutes,
      focusArea: workoutForm.focusArea,
      programId,
      coachNotes: workoutForm.coachNotes,
      scheduledDate: scheduledDateString,
    };

    if (resolvedDayNumber !== undefined) {
      payload.dayNumber = resolvedDayNumber;
    }

    if (exercisesPayload.length > 0) {
      payload.exercises = exercisesPayload;
    }

    const success = await createAthleteWorkout(selectedAthleteDetails.athleteId, payload);
    if (success) {
      setWorkoutForm(buildEmptyWorkoutForm(scheduledDate));
      setWorkoutExercises([createExerciseDraft()]);
      setShowWorkoutForm(false);
      setWorkoutFormError(null);
    }
  };

  const handleUpdateWorkout = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedAthleteDetails || !editingWorkoutId) {
      return;
    }
    setEditWorkoutFormError(null);

    if (!editWorkoutForm.title.trim()) {
      setEditWorkoutFormError('Workout title is required.');
      return;
    }

    const scheduledDate = editWorkoutForm.scheduledDate ?? selectedCalendarDate;
    const scheduledDateString = scheduledDate ? formatDateOnly(scheduledDate) : undefined;
    const programId = editWorkoutForm.programId ?? null;
    const isProgramWorkout = Boolean(programId);

    const hasManualDayNumber =
      typeof editWorkoutForm.dayNumber === 'number' && Number.isFinite(editWorkoutForm.dayNumber) && editWorkoutForm.dayNumber > 0;

    let resolvedDayNumber: number | undefined;
    if (isProgramWorkout) {
      if (scheduledDate) {
        const computedDay = resolveDayNumberForProgram(programId, scheduledDate);
        if (!computedDay) {
          setEditWorkoutFormError('Selected date is outside this program schedule. Choose another day or adjust the program start.');
          return;
        }
        resolvedDayNumber = hasManualDayNumber ? editWorkoutForm.dayNumber ?? computedDay : computedDay;
      } else if (hasManualDayNumber) {
        resolvedDayNumber = editWorkoutForm.dayNumber;
      } else {
        resolvedDayNumber = 1;
      }
    }

    const { exercisesPayload: editExercisesPayload, hasMissingExerciseName, hasInvalidExerciseNumber } =
      buildExercisesPayload(editWorkoutExercises);

    if (hasMissingExerciseName) {
      setEditWorkoutFormError('Give each exercise a name or remove the empty row.');
      return;
    }

    if (hasInvalidExerciseNumber) {
      setEditWorkoutFormError('Use numeric values for sets, weight, RPE, and rest time.');
      return;
    }

    const payload: UpdateAthleteWorkoutInput = {
      title: editWorkoutForm.title,
      description: editWorkoutForm.description,
      durationMinutes: editWorkoutForm.durationMinutes,
      focusArea: editWorkoutForm.focusArea,
      programId,
      coachNotes: editWorkoutForm.coachNotes,
      scheduledDate: scheduledDateString,
    };

    if (resolvedDayNumber !== undefined) {
      payload.dayNumber = resolvedDayNumber;
    }

    if (editWorkoutExercises.length > 0 || editExercisesPayload.length > 0) {
      payload.exercises = editExercisesPayload;
    }

    const success = await updateAthleteWorkout(selectedAthleteDetails.athleteId, editingWorkoutId, payload);
    if (success) {
      setEditingWorkoutId(null);
      setEditWorkoutForm({
        title: '',
        description: '',
        dayNumber: undefined,
        durationMinutes: undefined,
        focusArea: '',
        programId: selectedSummary?.programs[0]?.id ?? undefined,
        coachNotes: '',
        scheduledDate: undefined,
      });
      setEditWorkoutExercises([]);
      setEditWorkoutFormError(null);
    }
  };

  const handleStartEditingWorkout = (workout: WorkoutWithRelations) => {
    const scheduledDate = resolveScheduledDate(workout) ?? selectedCalendarDate;
    const { focusArea, coachNotes } = deserializeCoachNotes(workout.coach_notes);
    setEditingWorkoutId(workout.id);
    setEditWorkoutForm({
      title: workout.title ?? '',
      description: workout.description ?? '',
      dayNumber: workout.day_number ?? undefined,
      durationMinutes: workout.duration_minutes ?? undefined,
      focusArea: focusArea,
      programId: workout.program_id ?? null,
      coachNotes,
      scheduledDate,
    });
    setShowWorkoutForm(false);
    setEditWorkoutFormError(null);
    const drafts =
      workout.workout_exercises && workout.workout_exercises.length > 0
        ? workout.workout_exercises.map((exercise) => ({
            id: generateDraftId(),
            name: exercise.exercise_name ?? '',
            targetSets: exercise.target_sets != null ? String(exercise.target_sets) : '',
            targetReps: exercise.target_reps ?? '',
            targetWeight: exercise.target_weight != null ? String(exercise.target_weight) : '',
            targetRpe: exercise.target_rpe != null ? String(exercise.target_rpe) : '',
            restSeconds: exercise.rest_seconds != null ? String(exercise.rest_seconds) : '',
            notes: exercise.notes ?? '',
            sourceExerciseId: '',
            imageUrl: exercise.image_url ?? '',
          }))
        : [createExerciseDraft()];
    setEditWorkoutExercises(drafts);
  };

  const handleDeleteWorkout = async (workoutId: string) => {
    if (!selectedAthleteDetails) {
      return;
    }
    const shouldDelete =
      typeof window === 'undefined' ? true : window.confirm('Delete this personal workout? This cannot be undone.');
    if (!shouldDelete) {
      return;
    }
    setDeletingWorkoutId(workoutId);
    const success = await deleteAthleteWorkout(selectedAthleteDetails.athleteId, workoutId);
    if (!success) {
      setWorkoutFormError('Unable to delete workout. Please try again.');
    } else if (selectedWorkoutId === workoutId) {
      setSelectedWorkoutId(null);
    }
    setDeletingWorkoutId(null);
  };


  const handleCancelEditWorkout = () => {
    setEditingWorkoutId(null);
    setEditWorkoutFormError(null);
    setEditWorkoutExercises([]);
  };

  const handleSelectCalendarDay = useCallback(
    (day: Date) => {
      const normalized = new Date(day);
      normalized.setHours(0, 0, 0, 0);
      const dayKey = formatDateOnly(normalized);
      const workoutsForDay = workoutsByDate[dayKey] ?? [];
      userAdjustedCalendarRef.current = true;

      setSelectedCalendarDate(normalized);
      setSelectedWorkoutId(workoutsForDay[0]?.id ?? null);
      setEditingWorkoutId(null);
      setEditWorkoutFormError(null);
      setWorkoutFormError(null);
      setWorkoutForm(buildEmptyWorkoutForm(normalized));

      setWorkoutExercises([]);
      setShowWorkoutForm(false);
    },
    [buildEmptyWorkoutForm, createExerciseDraft, formatDateOnly, workoutsByDate],
  );

  const handleOpenCreateWorkout = useCallback(
    (day: Date) => {
      const normalized = new Date(day);
      normalized.setHours(0, 0, 0, 0);
      userAdjustedCalendarRef.current = true;
      setSelectedCalendarDate(normalized);
      setShowWorkoutForm(true);
      setEditingWorkoutId(null);
      setWorkoutExercises((previous) => (previous.length > 0 ? previous : [createExerciseDraft()]));
      setWorkoutForm(buildEmptyWorkoutForm(normalized));
      setWorkoutFormError(null);
    },
    [buildEmptyWorkoutForm, createExerciseDraft],
  );

  const handleCloseWorkoutModal = useCallback(() => {
    setShowWorkoutForm(false);
    setWorkoutFormError(null);
  }, []);

  const handleMonthStep = useCallback(
    (offset: number) => {
      const next = new Date(selectedCalendarDate);
      next.setDate(1);
      next.setMonth(next.getMonth() + offset);
      userAdjustedCalendarRef.current = true;
      setSelectedCalendarDate(next);
    },
    [selectedCalendarDate],
  );

  const renderCalendarCell = (day: Date) => {
    const dayKey = formatDateKey(day);
    const workoutsForDay = dayKey ? workoutsByDate[dayKey] ?? [] : [];
    const isCurrentMonth = day.getMonth() === selectedCalendarDate.getMonth();
    const isToday = day.toDateString() === new Date().toDateString();
    const isSelected = day.toDateString() === selectedCalendarDate.toDateString();

    return (
      <button
        key={dayKey ?? day.toISOString()}
        onClick={() => handleSelectCalendarDay(day)}
        className={`p-2 text-sm rounded-lg border relative min-h-[48px] transition-colors ${
          isSelected ? 'ring-2 ring-red-500 ring-offset-1' : ''
        } ${isToday ? 'border-red-200' : 'border-gray-100'} ${
          isCurrentMonth ? 'bg-white text-gray-600 hover:bg-gray-50' : 'bg-gray-50 text-gray-400 pointer-events-none opacity-50'
        }`}
      >
        <div>{day.getDate()}</div>
        {workoutsForDay.length > 0 && (
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
            {workoutsForDay.slice(0, 3).map((workout) => (
              <span
                key={workout.id}
                className={`w-1.5 h-1.5 rounded-full ${
                  workout.is_template ? 'bg-gray-400' : 'bg-red-500'
                }`}
              />
            ))}
          </div>
        )}
      </button>
    );
  };

  const renderWeeklyRow = (day: Date) => {
    const dayKey = formatDateKey(day);
    const workoutsForDay = dayKey ? workoutsByDate[dayKey] ?? [] : [];
    return (
      <div key={dayKey ?? day.toISOString()} className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-xs text-gray-500">{day.toLocaleDateString('en-US', { weekday: 'short' })}</p>
            <p className="text-lg font-semibold text-gray-900">
              {day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500">
              {workoutsForDay.length} workout{workoutsForDay.length === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              onClick={() => {
                handleSelectCalendarDay(day);
                if (workoutsForDay.length > 0) {
                  setSelectedWorkoutId(workoutsForDay[0].id);
                }
              }}
              className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 hover:border-gray-300"
            >
              Focus day
            </button>
          </div>
        </div>
        <div className="space-y-3">
          {workoutsForDay.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">
              No workouts scheduled.
            </div>
          ) : (
            workoutsForDay.map((workout) => (
              <div
                key={workout.id}
                className={`rounded-xl border p-4 transition ${
                  selectedWorkoutId === workout.id ? 'border-red-300 bg-red-50/80' : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{workout.title}</p>
                    <p className="text-xs text-gray-500">
                      {workout.program?.title ?? 'Personalized'} {workout.is_template ? '• Template' : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        handleSelectCalendarDay(day);
                        setSelectedWorkoutId(workout.id);
                      }}
                      className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-red-200 hover:text-red-600"
                    >
                      View day
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartEditingWorkout(workout)}
                      className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-700"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    {!workout.program_id && (
                      <button
                        type="button"
                        onClick={() => handleDeleteWorkout(workout.id)}
                        disabled={deletingWorkoutId === workout.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-red-200 hover:text-red-600 disabled:opacity-60"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {deletingWorkoutId === workout.id ? 'Deleting...' : 'Delete'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderAthleteCard = (athlete: CoachAthleteSummary, programTitle?: string) => {
    const isSelected = athlete.userId === selectedAthleteId;
    const progressText = `${athlete.averageProgress || 0}% avg`;
    const avatarUrl = athlete.profile?.avatar_url ?? null;
    const initials = getProfileInitials(athlete.profile);
    const programLabel = programTitle ?? (athlete.activeProgramCount > 0 ? `${athlete.activeProgramCount} active` : 'None');

    return (
      <button
        key={athlete.userId}
        onClick={() => handleSelectAthlete(athlete.userId)}
        className={`w-full text-left px-3 py-2 transition ${
          isSelected ? 'bg-red-50 ring-1 ring-red-100' : 'hover:bg-gray-50'
        }`}
      >
        <div className="grid grid-cols-[1.6fr,1fr,0.9fr,1fr,1fr] items-center gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-xs font-semibold uppercase text-gray-600">
              {avatarUrl ? (
                <img src={avatarUrl} alt={`${safeName(athlete)} avatar`} className="h-full w-full object-cover" />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">{safeName(athlete)}</p>
              {athlete.profile?.email && (
                <p className="truncate text-xs text-gray-500">{athlete.profile.email}</p>
              )}
            </div>
          </div>
          <div className="text-sm text-gray-600">{programLabel}</div>
          <div className="text-sm text-gray-600 inline-flex items-center gap-1">
            <ClipboardList className="h-4 w-4 text-gray-400" />
            {athlete.totalCheckIns}
          </div>
          <div className="text-sm">
            {athlete.pendingCheckIns > 0 ? (
              <span className="inline-flex items-center gap-1 text-yellow-700">
                <AlertCircle className="h-4 w-4" />
                {athlete.pendingCheckIns} pending
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-green-600">
                <CheckCircle className="h-4 w-4" />
                Up-to-date
              </span>
            )}
          </div>
          <div className="text-right">
            <span className="inline-flex items-center justify-end rounded-full bg-gray-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
              {progressText}
            </span>
          </div>
        </div>
      </button>
    );
  };

  const renderStats = () => (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Key Metrics</h3>
      <p className="mt-1 text-xs text-gray-500">Snapshot of current program activity.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-red-50 bg-red-50/60 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Assigned Programs</p>
            <ClipboardList className="h-5 w-5 text-red-500" />
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">{stats.totalPrograms}</p>
          <p className="text-xs text-gray-500">
            {programs.length > 0 ? 'Active training templates' : 'Add a program to get started'}
          </p>
        </div>
        <div className="rounded-2xl border border-red-50 bg-red-50/60 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Athletes</p>
            <Users className="h-5 w-5 text-red-500" />
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">{stats.totalAthletes}</p>
          <p className="text-xs text-gray-500">Across all assigned programs</p>
        </div>
        <div className="rounded-2xl border border-red-50 bg-red-50/60 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Pending Check-ins</p>
            <Target className="h-5 w-5 text-red-500" />
          </div>
          <p className={`mt-3 text-2xl font-semibold ${stats.pendingCheckIns > 0 ? 'text-yellow-600' : 'text-gray-900'}`}>
            {stats.pendingCheckIns}
          </p>
          <p className="text-xs text-gray-500">Awaiting coach review</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Unread Messages</p>
            <MessageCircle className="h-5 w-5 text-red-500" />
          </div>
          <p className={`mt-3 text-2xl font-semibold ${stats.unreadMessages > 0 ? 'text-blue-600' : 'text-gray-900'}`}>
            {stats.unreadMessages}
          </p>
          <p className="text-xs text-gray-500">Athlete inbox</p>
        </div>
      </div>
    </div>
  );

  const renderPhysicianRequestsPanel = () => {
    const filteredRequests = physicianRequests.filter((request) =>
      physicianStatusFilter === 'all' ? true : request.status === physicianStatusFilter,
    );
    const statusStyles: Record<PhysicianRequest['status'], string> = {
      pending: 'bg-yellow-50 text-yellow-800 border border-yellow-200',
      approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      slots_proposed: 'bg-blue-50 text-blue-700 border border-blue-200',
      slot_selected: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      denied: 'bg-gray-100 text-gray-700 border border-gray-200',
    };
    const statusLabel: Record<PhysicianRequest['status'], string> = {
      pending: 'Awaiting coach',
      approved: 'Approved',
      slots_proposed: 'Sent to physician',
      slot_selected: 'Scheduled',
      denied: 'Denied',
    };

    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Physician appointments</h3>
            <p className="mt-1 text-xs text-gray-500">Filter, review, and send physician emails.</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-gray-500">Status</label>
            <select
              value={physicianStatusFilter}
              onChange={(event) =>
                setPhysicianStatusFilter(event.target.value as typeof physicianStatusFilter)
              }
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-red-400 focus:ring-2 focus:ring-red-100"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="slots_proposed">Slots proposed</option>
              <option value="slot_selected">Scheduled</option>
              <option value="denied">Denied</option>
            </select>
            <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-red-600">
              {physicianRequests.filter((req) => req.status === 'pending').length} pending
            </span>
          </div>
        </div>

        {filteredRequests.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No appointment requests for this filter.</p>
        ) : (
          <div className="mt-4 max-h-96 space-y-3 overflow-y-auto pr-1">
            {filteredRequests.map((request) => (
              <div key={request.id} className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{request.athleteName}</p>
                    <p className="text-xs text-gray-500">{request.dateLabel}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusStyles[request.status]}`}>
                      {statusLabel[request.status]}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 border border-emerald-200">
                      {request.sessionType}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-sm text-gray-700">
                  {request.sessionDetails || 'No additional details provided.'}
                </p>
                {request.status === 'pending' && (
                  <>
                    <div className="mt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Select time slots</p>
                      <div className="flex flex-wrap gap-2">
                        {DEFAULT_APPOINTMENT_SLOTS.map((slot) => {
                          const selected = (physicianSlotSelections[request.id] ?? []).includes(slot);
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() =>
                                setPhysicianSlotSelections((previous) => {
                                  const current = previous[request.id] ?? [];
                                  const exists = current.includes(slot);
                                  const next = exists ? current.filter((s) => s !== slot) : [...current, slot];
                                  return { ...previous, [request.id]: next };
                                })
                              }
                              className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                                selected
                                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                  : 'border-gray-200 bg-white text-gray-700'
                              }`}
                            >
                              {slot}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => handlePhysicianDecision(request, 'approved')}
                        disabled={physicianActionLoading[request.id]}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {physicianActionLoading[request.id] ? 'Sending...' : 'Approve & email partner'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePhysicianDecision(request, 'denied')}
                        disabled={physicianActionLoading[request.id]}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:border-gray-300 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Deny & notify athlete
                      </button>
                    </div>
                    <div className="mt-3">
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 block mb-1">
                        Coach note to athlete
                      </label>
                      <textarea
                        value={physicianDecisionNotes[request.id] ?? ''}
                        onChange={(event) =>
                          setPhysicianDecisionNotes((previous) => ({ ...previous, [request.id]: event.target.value }))
                        }
                        rows={2}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                        placeholder="Explain denial or add prep instructions."
                      />
                    </div>
                  </>
                )}

                {request.status === 'slots_proposed' && (
                  <div className="mt-3 space-y-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Slots sent to physician</p>
                      <div className="flex flex-wrap gap-2">
                        {(request.proposedSlots ?? []).map((slot) => (
                          <span
                            key={slot}
                            className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-700"
                          >
                            {slot}
                          </span>
                        ))}
                        {(request.proposedSlots ?? []).length === 0 && (
                          <p className="text-xs text-gray-500">No slots recorded on this request.</p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleResendPhysicianEmail(request)}
                      disabled={physicianResendLoading[request.id]}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:border-gray-300 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {physicianResendLoading[request.id] ? 'Resending...' : 'Resend email to physician'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderCheckIns = (details: CoachAthleteDetails) => {
    const statusCounts: Record<CheckInFilterValue, number> = {
      submitted: 0,
      needs_revision: 0,
      reviewed: 0,
    };
    details.checkIns.forEach((entry) => {
      statusCounts[entry.status] = (statusCounts[entry.status] ?? 0) + 1;
    });
    const filteredCheckIns = details.checkIns.filter((checkIn) => checkIn.status === checkInStatusFilter);
    const activeFilterLabel =
      CHECKIN_FILTERS.find((filter) => filter.value === checkInStatusFilter)?.label ?? 'Filtered';

    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-gray-900">Latest Check-ins</h3>
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {filteredCheckIns.length} shown • {details.checkIns.length} total
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {CHECKIN_FILTERS.map((filter) => {
            const isActive = filter.value === checkInStatusFilter;
            const baseClass =
              'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition';
            const className = isActive
              ? `${baseClass} ${filter.activeClass}`
              : `${baseClass} border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50`;
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setCheckInStatusFilter(filter.value)}
                className={className}
                aria-pressed={isActive}
              >
                {filter.label}
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-gray-800">
                  {statusCounts[filter.value] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
        {filteredCheckIns.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">
            No {activeFilterLabel.toLowerCase()} check-ins available for this athlete yet.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {filteredCheckIns.map((checkIn) => {
              const statusStyle = CHECKIN_STATUS_STYLES[checkIn.status] ?? CHECKIN_STATUS_STYLES.submitted;
              return (
                <div key={checkIn.id} className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {checkIn.workout?.title ?? 'Workout'}
                    </p>
                    <p className="text-xs text-gray-500">{formatDateTime(checkIn.created_at)}</p>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusStyle}`}>
                    {checkIn.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {checkIn.readiness_score != null && (
                    <span className="text-xs text-gray-600">
                      Readiness: <strong className="text-gray-800">{checkIn.readiness_score}/10</strong>
                    </span>
                  )}
                  {checkIn.energy_level && (
                    <span className="text-xs text-gray-600 capitalize">
                      Energy: <strong className="text-gray-800">{checkIn.energy_level}</strong>
                    </span>
                  )}
                  {checkIn.soreness_level && (
                    <span className="text-xs text-gray-600 capitalize">
                      Soreness: <strong className="text-gray-800">{checkIn.soreness_level}</strong>
                    </span>
                  )}
                </div>
                {checkIn.notes && (
                  <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Athlete Notes</p>
                    <p className="mt-1 text-sm text-gray-700">{checkIn.notes}</p>
                  </div>
                )}
                {Array.isArray(checkIn.media) && checkIn.media.length > 0 && (
                  <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Attachments</p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      {checkIn.media.map((item) => (
                        <div key={item.id} className="w-32">
                          {item.media_type === 'video' ? (
                            <video
                              controls
                              className="h-20 w-32 rounded-lg border border-gray-200 bg-black object-cover"
                              src={item.media_url}
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setExerciseImagePreview({
                                  name: 'Check-in media',
                                  url: item.media_url,
                                })
                              }
                              className="block overflow-hidden rounded-lg border border-gray-200 bg-white"
                            >
                              <img
                                src={item.thumbnail_url ?? item.media_url}
                                alt="Check-in attachment"
                                className="h-20 w-32 object-cover"
                              />
                            </button>
                          )}
                          <a
                            href={item.media_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 block text-center text-[11px] font-semibold text-red-600 underline"
                          >
                            View
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-3">
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Coach Feedback
                  </label>
                  <textarea
                    value={checkInNotes[checkIn.id] ?? ''}
                    onChange={(event) =>
                      setCheckInNotes((prev) => ({
                        ...prev,
                        [checkIn.id]: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    rows={3}
                    placeholder="Share technical feedback, cues, or encouragement."
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleSaveCoachNotes(checkIn.id)}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 transition hover:border-gray-300 hover:bg-gray-50"
                    >
                      <ClipboardList className="h-3.5 w-3.5 text-gray-500" />
                      Save Notes
                    </button>
                    <button
                      onClick={() => handleCheckInUpdate(checkIn.id, 'reviewed')}
                      className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-green-700"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      Mark Reviewed
                    </button>
                    <button
                      onClick={() => handleCheckInUpdate(checkIn.id, 'needs_revision')}
                      className="inline-flex items-center gap-2 rounded-lg bg-yellow-500 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-yellow-600"
                    >
                      <AlertCircle className="h-3.5 w-3.5" />
                      Needs Revision
                    </button>
                  </div>
                </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderAthleteSummaryTab = () => {
    if (!selectedSummary || !selectedAthleteDetails) {
      return (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          Select an athlete to view their overview.
        </div>
      );
    }
    const recentCheckIns = selectedAthleteDetails.checkIns.slice(0, 3);
    const progressOverview = selectedAthleteDetails.progressOverview;
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Active Programs</h3>
          <div className="mt-3 space-y-2">
            {selectedSummary.programs.length === 0 ? (
              <p className="text-sm text-gray-500">No active programs assigned.</p>
            ) : (
              selectedSummary.programs.map((program) => (
                <div key={program.id} className="rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2">
                  <p className="text-sm font-semibold text-gray-900">{program.title}</p>
                  <p className="text-xs text-gray-500 capitalize">
                    {program.program_type.replace(/_/g, ' ')} • {program.level}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Highlights</h3>
          <ul className="mt-3 space-y-2 text-sm text-gray-600">
            <li className="flex items-center justify-between">
              <span>Average progress</span>
              <span className="font-semibold text-gray-900">{selectedSummary.averageProgress}%</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Pending check-ins</span>
              <span className={`font-semibold ${pendingCheckIns > 0 ? 'text-yellow-600' : 'text-gray-900'}`}>
                {pendingCheckIns}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span>Total check-ins</span>
              <span className="font-semibold text-gray-900">{selectedSummary.totalCheckIns}</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Active enrollments</span>
              <span className="font-semibold text-gray-900">{selectedSummary.enrollments.length}</span>
            </li>
          </ul>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Weekly goal</h3>
              <p className="text-xs text-gray-500">Publish each Sunday. Athletes see it immediately.</p>
            </div>
            <span className="text-xs font-semibold text-gray-500">
              Week of {formatWeekRangeLabel(coachWeekStart.toISOString().slice(0, 10))}
            </span>
          </div>
          <div className="mt-3 space-y-3">
            <textarea
              value={newWeeklyGoalText}
              onChange={(event) => setNewWeeklyGoalText(event.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-red-400 focus:ring-2 focus:ring-red-100"
              rows={3}
              placeholder="Outline this week’s focus for the athlete…"
            />
            {weeklyGoalError && <p className="text-xs text-red-600">{weeklyGoalError}</p>}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleWeeklyGoalSubmit}
                disabled={isSavingWeeklyGoal}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {isSavingWeeklyGoal ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : coachCurrentWeekGoal ? (
                  <>
                    <Send className="h-4 w-4" />
                    Update goal
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Publish goal
                  </>
                )}
              </button>
              <p className="text-xs text-gray-500">
                Each goal is versioned, so you can review past focus points anytime.
              </p>
            </div>
          </div>
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-gray-500">
              <span>History</span>
              {sortedAthleteWeeklyGoals.length > 0 && <span>{sortedAthleteWeeklyGoals.length} entries</span>}
            </div>
            {sortedAthleteWeeklyGoals.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">No weekly goals recorded yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {sortedAthleteWeeklyGoals.slice(0, 5).map((goal) => (
                  <div key={goal.id} className="rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{formatWeekRangeLabel(goal.week_start)}</p>
                        <p className="text-xs text-gray-500 line-clamp-2">{goal.goal_text}</p>
                      </div>
                      <select
                        value={goal.status}
                        onChange={(event) =>
                          handleWeeklyGoalStatusChange(goal.id, event.target.value as WeeklyGoal['status'])
                        }
                        disabled={statusUpdatingGoalId === goal.id}
                        className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700 focus:border-red-300 focus:ring-2 focus:ring-red-100"
                      >
                        {Object.entries(WEEKLY_GOAL_STATUS_META).map(([value, meta]) => (
                          <option key={value} value={value}>
                            {meta.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Progress snapshot</h3>
          {progressOverview ? (
            <>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Average readiness</p>
                  <p className="mt-1 text-xl font-semibold text-gray-900">
                    {progressOverview.averageReadiness != null ? progressOverview.averageReadiness : '—'}
                    <span className="text-sm font-medium text-gray-500"> /10</span>
                  </p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">PRs logged</p>
                  <p className="mt-1 text-xl font-semibold text-gray-900">{progressOverview.personalRecords}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Check-ins</p>
                  <p className="mt-1 text-xl font-semibold text-gray-900">{progressOverview.totalCheckIns}</p>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Recent readiness (&le; 8 entries)</span>
                  {progressOverview.lastCheckInAt && (
                    <span>Updated {formatDateTime(progressOverview.lastCheckInAt, false)}</span>
                  )}
                </div>
                {progressOverview.readinessTrend.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500">No readiness data recorded yet.</p>
                ) : (
                  <div className="mt-3 flex items-end gap-3">
                    {progressOverview.readinessTrend.map((entry) => {
                      const readinessValue = entry.readiness ?? 0;
                      const height = `${(Math.max(0, readinessValue) / 10) * 64}px`;
                      return (
                        <div key={`${entry.label}-${height}`} className="flex flex-col items-center text-xs text-gray-500">
                          <div
                            className="w-3 rounded-t-md bg-red-500"
                            style={{ height }}
                            title={entry.readiness != null ? `${entry.readiness}/10 readiness` : 'No data'}
                          />
                          <span className="mt-1 text-[11px]">{entry.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-gray-500">No progress submissions yet for this athlete.</p>
          )}
        </div>
        <div className="lg:col-span-2 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Recent Check-ins</h3>
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {recentCheckIns.length} of {selectedAthleteDetails.checkIns.length}
            </span>
          </div>
          {recentCheckIns.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">No check-ins logged yet.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {recentCheckIns.map((checkIn) => (
                <div key={checkIn.id} className="rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span className="font-semibold text-gray-800">{checkIn.workout?.title ?? 'Workout'}</span>
                    <span>{formatDateTime(checkIn.created_at)}</span>
                  </div>
                  {checkIn.notes && <p className="mt-2 text-xs text-gray-500 line-clamp-2">{checkIn.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderWorkouts = (_details: CoachAthleteDetails) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcomingWorkout = scheduledWorkouts.find((workout) => {
      const date = resolveScheduledDate(workout);
      return date && date >= today && !workout.is_template;
    });
    const sidePanelActive = Boolean(editingWorkoutId || upcomingWorkout);

    return (
      <div className="space-y-6">
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-6 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-600">
              <Calendar className="w-4 h-4" />
              {calendarView === 'monthly' ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleMonthStep(-1)}
                    className="rounded-full border border-gray-200 p-1 text-gray-500 hover:bg-gray-100"
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span>{formatDisplayDate(selectedCalendarDate, { month: 'long', year: 'numeric' })}</span>
                  <button
                    type="button"
                    onClick={() => handleMonthStep(1)}
                    className="rounded-full border border-gray-200 p-1 text-gray-500 hover:bg-gray-100"
                    aria-label="Next month"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setWeeklyStartIndex((previous) => Math.max(0, previous - 1))}
                    className="rounded-full border border-gray-200 p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:pointer-events-none"
                    aria-label="Previous day range"
                    disabled={weeklyStartIndex === 0}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span>{weeklyRangeLabel || formatDisplayDate(selectedCalendarDate, { month: 'short', day: 'numeric' })}</span>
                  <button
                    type="button"
                    onClick={() => setWeeklyStartIndex((previous) => Math.min(maxWeeklyStartIndex, previous + 1))}
                    className="rounded-full border border-gray-200 p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:pointer-events-none"
                    aria-label="Next day range"
                    disabled={weeklyStartIndex >= maxWeeklyStartIndex}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {(['monthly', 'weekly'] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setCalendarView(view)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                    calendarView === view ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {view}
                </button>
              ))}
            </div>
          </div>
          <div className="px-6 py-6 space-y-6">
            {calendarView === 'monthly' && (
              <>
                <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
                    <div key={label}>{label}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">{calendarDays.map(renderCalendarCell)}</div>
              </>
            )}
            {calendarView === 'weekly' && <div className="space-y-4">{visibleWeekDays.map(renderWeeklyRow)}</div>}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className={`space-y-6 ${sidePanelActive ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
            <div className="rounded-2xl border border-red-100 bg-gradient-to-br from-white via-white to-red-50/30 p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Selected day</p>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {formatDisplayDate(selectedCalendarDate, { weekday: 'long', month: 'short', day: 'numeric' })}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {selectedDayWorkouts.length > 0
                      ? `${selectedDayWorkouts.length} workout${selectedDayWorkouts.length === 1 ? '' : 's'} scheduled`
                      : 'No workouts scheduled for this day'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenCreateWorkout(selectedCalendarDate)}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
                  >
                    <Plus className="h-4 w-4" />
                    Add workout
                  </button>
                  
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {selectedDayWorkouts.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                    Click <span className="font-semibold">Add workout</span> to program this day.
                  </div>
                ) : (
                  selectedDayWorkouts.map((workout) => {
                    const workoutDate = resolveScheduledDate(workout);
                    const focusArea = getWorkoutFocusArea(workout);
                    const coachNotes = deserializeCoachNotes(workout.coach_notes).coachNotes;
                    return (
                      <div
                        key={workout.id}
                        className={`rounded-2xl border p-5 transition ${
                          selectedWorkoutId === workout.id ? 'border-red-300 bg-red-50/70 shadow-sm' : 'border-gray-200 bg-white'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-gray-900">{workout.title}</p>
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                                  workout.is_template ? 'bg-gray-100 text-gray-600' : 'bg-red-100 text-red-600'
                                }`}
                              >
                                {workout.is_template ? 'Template' : 'Personalized'}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-gray-500">
                              {workout.program?.title ?? 'Personal workout'}
                              {focusArea ? ` • Focus: ${focusArea}` : ''}
                            </p>
                            <p className="mt-1 text-xs text-gray-400">
                              {workoutDate ? formatDisplayDate(workoutDate, { month: 'short', day: 'numeric' }) : 'Unscheduled'}
                              {workout.duration_minutes ? ` • ${workout.duration_minutes} min` : ''}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                           
                            <button
                              type="button"
                              onClick={() => handleStartEditingWorkout(workout)}
                              className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-700"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </button>
                            {!workout.program_id && (
                              <button
                                type="button"
                                onClick={() => handleDeleteWorkout(workout.id)}
                                disabled={deletingWorkoutId === workout.id}
                                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-red-200 hover:text-red-600 disabled:opacity-60"
                              >
                                {deletingWorkoutId === workout.id ? 'Deleting…' : 'Delete'}
                              </button>
                            )}
                          </div>
                        </div>
                        {workout.description && <p className="mt-3 text-sm text-gray-700">{workout.description}</p>}
                        {coachNotes && (
                          <div className="mt-3 rounded-xl border border-red-100 bg-red-50/60 px-3 py-2 text-xs text-red-700">Coach notes: {coachNotes}</div>
                        )}
                        {renderWorkoutPlan(workout)}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {sidePanelActive && (
            <div className="space-y-6">
              {editingWorkoutId && (
                <div className="rounded-2xl border border-red-200 bg-red-50/60 p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-red-700">Edit workout</h3>
                    <button
                      type="button"
                      onClick={handleCancelEditWorkout}
                      className="text-xs font-semibold text-red-600 hover:text-red-800"
                    >
                      Close
                    </button>
                  </div>
                  {editWorkoutFormError && (
                    <div className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-2 text-xs text-red-700">
                      {editWorkoutFormError}
                    </div>
                  )}
                  <form onSubmit={handleUpdateWorkout} className="mt-4 space-y-3">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Workout Title</label>
                      <input
                        value={editWorkoutForm.title}
                        onChange={(event) =>
                          setEditWorkoutForm((prev) => ({
                            ...prev,
                            title: event.target.value,
                          }))
                        }
                        required
                        className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Scheduled Date</label>
                        <input
                          type="date"
                          value={editWorkoutForm.scheduledDate ? formatDateOnly(editWorkoutForm.scheduledDate) : ''}
                          onChange={(event) =>
                            setEditWorkoutForm((prev) => ({
                              ...prev,
                              scheduledDate: event.target.value ? parseDateValue(event.target.value) ?? prev.scheduledDate : undefined,
                            }))
                          }
                          className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Day Number</label>
                        <input
                          type="number"
                          min={1}
                          value={editWorkoutForm.dayNumber ?? ''}
                          onChange={(event) =>
                            setEditWorkoutForm((prev) => ({
                              ...prev,
                              dayNumber: event.target.value ? Number(event.target.value) : undefined,
                            }))
                          }
                          className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                          placeholder="Auto"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Duration (minutes)</label>
                        <input
                          type="number"
                          min={0}
                          value={editWorkoutForm.durationMinutes ?? ''}
                          onChange={(event) =>
                            setEditWorkoutForm((prev) => ({
                              ...prev,
                              durationMinutes: event.target.value ? Number(event.target.value) : undefined,
                            }))
                          }
                          className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Focus Area</label>
                        <input
                          value={editWorkoutForm.focusArea ?? ''}
                          onChange={(event) =>
                            setEditWorkoutForm((prev) => ({
                              ...prev,
                              focusArea: event.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                          placeholder="Strength, recovery, etc."
                        />
                      </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Attach Program</label>
                      <select
                        value={editWorkoutForm.programId ?? ''}
                        onChange={(event) =>
                            setEditWorkoutForm((prev) => ({
                              ...prev,
                              programId: event.target.value ? event.target.value : null,
                            }))
                          }
                          className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                        >
                          <option value="">Personal workout</option>
                          {selectedSummary?.programs.map((program) => (
                            <option key={program.id} value={program.id}>
                              {program.title}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white/60 px-3 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Exercises</p>
                        <p className="text-[11px] text-gray-500">Update or add movements for this workout.</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddEditExerciseDraft}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-red-200 hover:text-red-600"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add exercise
                      </button>
                    </div>
                    {editWorkoutExercises.length === 0 ? (
                      <p className="mt-3 text-xs text-gray-500">No exercises yet. Add at least one so the athlete knows what to do.</p>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {editWorkoutExercises.map((exercise, index) => (
                          <div key={exercise.id} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-gray-800">Exercise {index + 1}</p>
                            <button
                              type="button"
                              onClick={() => handleRemoveEditExerciseDraft(exercise.id)}
                              className="text-xs font-semibold uppercase tracking-wide text-red-600 hover:text-red-700"
                            >
                              Remove
                            </button>
                          </div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                            <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                              Pick saved exercise
                            </label>
                            <select
                              value={exercise.sourceExerciseId ?? ''}
                              onChange={(event) =>
                                applyTemplateToExerciseDraft(exercise.id, event.target.value, 'edit')
                              }
                              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                            >
                              <option value="">
                                {exerciseLibrary.length === 0 ? 'No saved exercises yet' : 'Select from workout library'}
                              </option>
                              {exerciseLibrary.map((libraryExercise, optionIndex) => (
                                <option key={libraryExercise.id ?? `library-${optionIndex}`} value={libraryExercise.id ?? `library-${optionIndex}`}>
                                  {libraryExercise.exercise_name ?? 'Exercise'}{' '}
                                  {libraryExercise.target_reps ? `• ${libraryExercise.target_reps}` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                            <div className="sm:col-span-2">
                              <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Exercise name</label>
                              <input
                                value={exercise.name}
                                onChange={(event) => handleEditExerciseDraftChange(exercise.id, 'name', event.target.value)}
                                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                                  placeholder="Front squat, tempo push-up..."
                                />
                              </div>
                              <div>
                                <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Target sets</label>
                                <input
                                  type="number"
                                  min={0}
                                  value={exercise.targetSets}
                                  onChange={(event) => handleEditExerciseDraftChange(exercise.id, 'targetSets', event.target.value)}
                                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                                  placeholder="4"
                                />
                              </div>
                              <div>
                                <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Target reps</label>
                                <input
                                  value={exercise.targetReps}
                                  onChange={(event) => handleEditExerciseDraftChange(exercise.id, 'targetReps', event.target.value)}
                                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                                  placeholder="8-10"
                                />
                              </div>
                              <div>
                                <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Target weight (lbs)</label>
                                <input
                                  type="number"
                                  min={0}
                                  value={exercise.targetWeight}
                                  onChange={(event) => handleEditExerciseDraftChange(exercise.id, 'targetWeight', event.target.value)}
                                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                                  placeholder="185"
                                />
                              </div>
                              <div>
                                <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Target RPE</label>
                                <input
                                  type="number"
                                  step="0.5"
                                  min={0}
                                  max={10}
                                  value={exercise.targetRpe}
                                  onChange={(event) => handleEditExerciseDraftChange(exercise.id, 'targetRpe', event.target.value)}
                                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                                  placeholder="8"
                                />
                              </div>
                              <div>
                                <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Rest (seconds)</label>
                                <input
                                  type="number"
                                  min={0}
                                  value={exercise.restSeconds}
                                  onChange={(event) => handleEditExerciseDraftChange(exercise.id, 'restSeconds', event.target.value)}
                                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                                  placeholder="90"
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Notes</label>
                                <textarea
                                  value={exercise.notes}
                                  onChange={(event) => handleEditExerciseDraftChange(exercise.id, 'notes', event.target.value)}
                                  rows={2}
                                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                                  placeholder="Tempo, cues, accessories..."
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Description</label>
                      <textarea
                        value={editWorkoutForm.description ?? ''}
                        onChange={(event) =>
                          setEditWorkoutForm((prev) => ({
                            ...prev,
                            description: event.target.value,
                          }))
                        }
                        rows={3}
                        className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Coach Notes</label>
                      <textarea
                        value={editWorkoutForm.coachNotes ?? ''}
                        onChange={(event) =>
                          setEditWorkoutForm((prev) => ({
                            ...prev,
                            coachNotes: event.target.value,
                          }))
                        }
                        rows={2}
                        className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={handleCancelEditWorkout}
                        className="inline-flex items-center rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:border-red-300 hover:bg-red-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Update Workout
                      </button>
                    </div>
                  </form>
                </div>
              )}
              {upcomingWorkout && (
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Next upcoming</h3>
                  <p className="mt-2 text-sm font-semibold text-gray-900">{upcomingWorkout.title}</p>
                  <p className="text-xs text-gray-500">
                    {formatDisplayDate(resolveScheduledDate(upcomingWorkout), { weekday: 'short', month: 'short', day: 'numeric' })}
                    {upcomingWorkout.program?.title ? ` • ${upcomingWorkout.program.title}` : ''}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    );
  };
  const renderMessaging = () => (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-gray-900">Coach Inbox</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">
            {conversationMessages.length} message{conversationMessages.length === 1 ? '' : 's'}
          </span>
          <button
            onClick={() => refreshCoachMessages()}
            className="inline-flex items-center rounded-lg border border-gray-200 bg-white p-2 text-gray-500 transition hover:border-gray-300 hover:bg-gray-50"
            title="Refresh conversation"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>
      {selectedSummary ? (
        <>
          <div className="mt-4 max-h-80 overflow-y-auto space-y-3 pr-1">
            {conversationMessages.length === 0 ? (
              <p className="text-sm text-gray-500">Start the conversation with {safeName(selectedSummary)}.</p>
            ) : (
              conversationMessages.map((message) => {
                const isCoach = message.sender_id === coachId;
                const alignment = isCoach ? 'justify-end' : 'justify-start';
                const bubbleStyle = isCoach
                  ? 'bg-red-600 text-white rounded-br-none'
                  : 'bg-gray-100 text-gray-800 rounded-bl-none';
                return (
                  <div key={message.id} className={`flex ${alignment}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm ${bubbleStyle}`}>
                      <p>{message.message}</p>
                      <div className="mt-2 flex items-center justify-between gap-3 text-[10px] uppercase tracking-wide opacity-80">
                        <span>{formatDateTime(message.created_at)}</span>
                        {!isCoach && !message.is_read && (
                          <button
                            onClick={() => markMessageRead(message.id)}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide"
                          >
                            <CheckCircle className="h-3 w-3" />
                            Mark Read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <form onSubmit={handleSubmitMessage} className="mt-4 space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Message {safeName(selectedSummary)}
            </label>
            <textarea
              value={messageBody}
              onChange={(event) => setMessageBody(event.target.value)}
              rows={3}
              required
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              placeholder="Ask about readiness, provide feedback, or outline next steps."
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSendingMessage}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Send className={`h-4 w-4 ${isSendingMessage ? 'animate-spin' : ''}`} />
                {isSendingMessage ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </form>
        </>
      ) : (
        <p className="mt-4 text-sm text-gray-500">Select an athlete to start a conversation.</p>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f4ef] px-4 py-10 text-gray-900">
        <Card className="mx-auto max-w-5xl border-gray-200 bg-white text-gray-900 shadow-sm">
          <CardContent className="px-8 py-16 text-center">
            <Loader className="mx-auto h-10 w-10 animate-spin text-red-400" />
            <p className="mt-4 text-sm text-gray-500">Preparing your coaching workspace...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderOverviewPage = () => {
    return (
      <div className="min-h-screen bg-[#f7f4ef] text-gray-900 px-4 py-8">
        <div className="mx-auto max-w-6xl space-y-6">
                    <Card className="border-gray-200 bg-white text-gray-900 shadow-sm">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                  Coach Workspace
                </Badge>
                <CardTitle className="mt-3 text-2xl">
                  Welcome back{profile?.first_name ? `, ${profile.first_name}` : ''}
                </CardTitle>
                <CardDescription className="mt-2 text-gray-500">
                  Keep the workspace focused: metrics, programs, and your athlete roster are all one glance away.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleOpenInbox}
                  aria-label="Open coach inbox"
                  className="relative"
                >
                  <MessageSquare className="h-5 w-5" />
                  {stats.unreadMessages > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
                      {stats.unreadMessages}
                    </span>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={onNavigateSettings}
                  aria-label="Account settings"
                >
                  <Settings className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
          </Card>

          {(error || pageError) && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {pageError ?? error}
            </div>
          )}

          <div className="space-y-6">
            {renderStats()}
            {renderPhysicianRequestsPanel()}
            {renderAthleteRoster()}
          </div>
        </div>
      </div>
    );
  };

  const renderInboxPage = () => (
    <div className="min-h-screen bg-[#f7f4ef] text-gray-900 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Coach Inbox</p>
            <h1 className="mt-2 text-2xl font-semibold text-gray-900">All conversations</h1>
            <p className="mt-2 text-sm text-gray-600">View every athlete message in chronological order.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refreshCoachMessages()}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-red-600' : 'text-gray-500'}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setDashboardView('overview')}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4 text-gray-500" />
              Workspace
            </button>
          </div>
        </div>

        {inboxMessages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            No messages yet. Once athletes reach out, their conversations will appear here.
          </div>
        ) : (
          <div className="space-y-3">
            {inboxMessages.map((message) => {
              const isCoach = message.sender_id === coachId;
              const partnerId = isCoach ? message.receiver_id : message.sender_id;
              const partnerName = resolveAthleteName(partnerId ?? undefined);
              const isUnread = message.receiver_id === coachId && !message.is_read;
              return (
                <div key={message.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{partnerName}</p>
                      <p className="text-xs text-gray-500">{formatDateTime(message.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isUnread && (
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-600">Unread</span>
                      )}
                      {partnerId && (
                        <button
                          type="button"
                          onClick={() => handleOpenConversation(partnerId)}
                          className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:border-red-200 hover:text-red-600"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          Open thread
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-gray-700">{message.message}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const renderAthleteDetailPage = () => {
    const detailTabs: Array<{ id: typeof activeAthleteTab; label: string }> = [
      { id: 'summary', label: 'Overview' },
      { id: 'checkins', label: 'Check-ins' },
      { id: 'programs', label: 'Programs & Workouts' },
      { id: 'messages', label: 'Messages' },
    ];

    const renderDetailContent = () => {
      if (selectedAthleteLoading || !selectedAthleteDetails) {
        return (
          <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center shadow-sm">
            <Loader className="mx-auto h-8 w-8 animate-spin text-red-600" />
            <p className="mt-3 text-sm text-gray-600">Loading athlete data...</p>
          </div>
        );
      }

      switch (activeAthleteTab) {
        case 'summary':
          return renderAthleteSummaryTab();
        case 'checkins':
          return renderCheckIns(selectedAthleteDetails);
        case 'programs':
          return (
            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Program Assignments</h3>
                <div className="mt-3 space-y-2">
                  {selectedSummary?.programs.length ? (
                    selectedSummary.programs.map((program) => (
                      <div key={program.id} className="rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2">
                        <p className="text-sm font-semibold text-gray-900">{program.title}</p>
                        <p className="text-xs text-gray-500 capitalize">
                          {program.program_type.replace(/_/g, ' ')} • {program.level}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">
                      No programs assigned. Use the workout builder below to deliver custom training.
                    </p>
                  )}
                </div>
              </div>
              {renderWorkouts(selectedAthleteDetails)}
            </div>
          );
        case 'messages':
          return renderMessaging();
        default:
          return null;
      }
    };

    const detailAvatarUrl = selectedSummary?.profile?.avatar_url ?? null;
    const detailInitials = getProfileInitials(selectedSummary?.profile);

    return (
      <div className="min-h-screen bg-[#f7f4ef] text-gray-900 px-4 py-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleBackToOverview}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to overview
            </button>
            <div className="flex-1" />
            <div className="w-full sm:w-auto">
              <div className="flex flex-wrap items-center justify-start gap-3 sm:justify-end">
                <button
                  onClick={() => refreshCoachData()}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-red-600' : 'text-gray-500'}`} />
                  Refresh Data
                </button>
              </div>
            </div>
          </div>

          {(error || pageError) && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {pageError ?? error}
            </div>
          )}

          {!selectedAthleteId || !selectedSummary ? (
            <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-10 text-center shadow-sm">
              <ClipboardList className="mx-auto h-10 w-10 text-gray-300" />
              <p className="mt-4 text-base font-semibold text-gray-900">Choose an athlete from the roster</p>
              <p className="mt-2 text-sm text-gray-500">
                Head back to the overview, pick an athlete, and we&apos;ll open their coaching workspace here.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <Card className="border-gray-200 bg-white shadow-sm">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-6">
                  <div className="flex flex-wrap items-center gap-4">
                    <Avatar className="h-16 w-16 bg-gray-100 text-gray-600">
                      {detailAvatarUrl && <AvatarImage src={detailAvatarUrl} alt={`${safeName(selectedSummary)} avatar`} />}
                      <AvatarFallback className="bg-gray-100 text-sm font-semibold text-gray-600">
                        {detailInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                        Active Athlete
                      </Badge>
                      <h2 className="mt-2 text-xl font-semibold text-gray-900">{safeName(selectedSummary)}</h2>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        {selectedSummary.profile?.email && (
                          <span className="inline-flex items-center gap-1">
                            <MessageSquare className="h-3.5 w-3.5 text-gray-400" />
                            {selectedSummary.profile.email}
                          </span>
                        )}
                        {selectedSummary.profile?.phone && (
                          <span className="inline-flex items-center gap-1">
                            <PhoneIcon />
                            {selectedSummary.profile.phone}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-gray-400" />
                          {selectedSummary.enrollments.length} enrollment{selectedSummary.enrollments.length === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 text-right">
                    <Badge variant="secondary" className="bg-red-100 text-red-600">
                      <Target className="h-3.5 w-3.5" />
                      {selectedSummary.averageProgress}% avg progress
                    </Badge>
                    <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                      <ClipboardList className="h-3.5 w-3.5" />
                      {selectedSummary.totalCheckIns} total check-ins
                    </Badge>
                    {pendingCheckIns > 0 && (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {pendingCheckIns} pending reviews
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-wrap items-center gap-2">
                {detailTabs.map((tab) => {
                  const isActive = activeAthleteTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveAthleteTab(tab.id)}
                      className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                        isActive
                          ? 'bg-red-600 text-white shadow-sm'
                          : 'border border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {renderDetailContent()}
            </div>
          )}
        </div>
      </div>
    );
  };

  const pageContent =
    dashboardView === 'athlete-detail'
      ? renderAthleteDetailPage()
      : dashboardView === 'inbox'
        ? renderInboxPage()
        : renderOverviewPage();

  return (
    <>
      {pageContent}
      {exerciseImagePreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6"
          onClick={() => setExerciseImagePreview(null)}
        >
          <div
            className="w-full max-w-3xl"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="rounded-2xl bg-white p-4 shadow-2xl">
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
              <div className="max-h-[70vh] overflow-hidden rounded-xl border border-gray-200 bg-black/5">
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
      {showWorkoutForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-8"
          onClick={handleCloseWorkoutModal}
        >
          <div
            className="w-full max-w-4xl max-h-[calc(100vh-3rem)] overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Create workout</p>
                <h3 className="text-2xl font-semibold text-gray-900">
                  {formatDisplayDate(workoutForm.scheduledDate ?? selectedCalendarDate, {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </h3>
                <p className="text-sm text-gray-500">
                  Program a session for {safeName(selectedSummary)}. It will appear instantly on their calendar.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseWorkoutModal}
                className="rounded-full border border-gray-200 p-2 text-gray-500 transition hover:border-gray-300 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
              {workoutFormError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {workoutFormError}
                </div>
              )}
              <form onSubmit={handleCreateWorkout} className="mt-6 space-y-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Workout Title</label>
                  <input
                  value={workoutForm.title}
                  onChange={(event) =>
                    setWorkoutForm((prev) => ({
                      ...prev,
                      title: event.target.value,
                    }))
                  }
                  required
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                  placeholder="Athlete day title"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Scheduled Date</label>
                  <input
                    type="date"
                    value={
                      workoutForm.scheduledDate
                        ? formatDateOnly(workoutForm.scheduledDate)
                        : formatDateOnly(selectedCalendarDate)
                    }
                    onChange={(event) =>
                      setWorkoutForm((prev) => ({
                        ...prev,
                        scheduledDate: event.target.value ? parseDateValue(event.target.value) ?? prev.scheduledDate : undefined,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Day Number</label>
                  <input
                    type="number"
                    min={1}
                    value={workoutForm.dayNumber ?? ''}
                    onChange={(event) =>
                      setWorkoutForm((prev) => ({
                        ...prev,
                        dayNumber: event.target.value ? Number(event.target.value) : undefined,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    placeholder="Auto"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Duration (minutes)</label>
                  <input
                    type="number"
                    min={0}
                    value={workoutForm.durationMinutes ?? ''}
                    onChange={(event) =>
                      setWorkoutForm((prev) => ({
                        ...prev,
                        durationMinutes: event.target.value ? Number(event.target.value) : undefined,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    placeholder="60"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Focus Area</label>
                  <input
                    value={workoutForm.focusArea ?? ''}
                    onChange={(event) =>
                      setWorkoutForm((prev) => ({
                        ...prev,
                        focusArea: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    placeholder="Strength, recovery, etc."
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Attach Program</label>
                  <select
                    value={workoutForm.programId ?? ''}
                    onChange={(event) =>
                      setWorkoutForm((prev) => ({
                        ...prev,
                        programId: event.target.value ? event.target.value : null,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                  >
                    <option value="">Personal workout</option>
                    {selectedSummary?.programs.map((program) => (
                      <option key={program.id} value={program.id}>
                        {program.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Description</label>
                <textarea
                  value={workoutForm.description ?? ''}
                  onChange={(event) =>
                    setWorkoutForm((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                  placeholder="Outline main session elements."
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Coach Notes</label>
                <textarea
                  value={workoutForm.coachNotes ?? ''}
                  onChange={(event) =>
                    setWorkoutForm((prev) => ({
                      ...prev,
                      coachNotes: event.target.value,
                    }))
                  }
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                  placeholder="Notes visible to the athlete."
                />
              </div>
              <div className="rounded-xl border border-gray-200 bg-white/60 px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Exercises</p>
                    <p className="text-[11px] text-gray-500">Outline the movements your athlete should complete.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddExerciseDraft}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-red-200 hover:text-red-600"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add exercise
                  </button>
                </div>
                {workoutExercises.length === 0 ? (
                  <p className="mt-3 text-xs text-gray-500">No exercises yet. Add at least one so the athlete knows what to do.</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {workoutExercises.map((exercise, index) => (
                      <div key={exercise.id} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-gray-800">Exercise {index + 1}</p>
                          <button
                            type="button"
                            onClick={() => handleRemoveExerciseDraft(exercise.id)}
                            className="text-xs font-semibold uppercase tracking-wide text-red-600 hover:text-red-700"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="sm:col-span-2">
                            <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                              Pick saved exercise
                            </label>
                            <select
                              value={exercise.sourceExerciseId ?? ''}
                              onChange={(event) =>
                                applyTemplateToExerciseDraft(exercise.id, event.target.value, 'create')
                              }
                              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                            >
                              <option value="">
                                {exerciseLibrary.length === 0 ? 'No saved exercises yet' : 'Select from workout library'}
                              </option>
                              {exerciseLibrary.map((libraryExercise, optionIndex) => (
                                <option key={libraryExercise.id ?? `library-${optionIndex}`} value={libraryExercise.id ?? `library-${optionIndex}`}>
                                  {libraryExercise.exercise_name ?? 'Exercise'}{' '}
                                  {libraryExercise.target_reps ? `• ${libraryExercise.target_reps}` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Exercise name</label>
                            <input
                              value={exercise.name}
                              onChange={(event) => handleExerciseDraftChange(exercise.id, 'name', event.target.value)}
                              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                              placeholder="Front squat, tempo push-up..."
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Target sets</label>
                            <input
                              type="number"
                              min={0}
                              value={exercise.targetSets}
                              onChange={(event) => handleExerciseDraftChange(exercise.id, 'targetSets', event.target.value)}
                              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                              placeholder="4"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Target reps</label>
                            <input
                              value={exercise.targetReps}
                              onChange={(event) => handleExerciseDraftChange(exercise.id, 'targetReps', event.target.value)}
                              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                              placeholder="8-10"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Target weight (Kg)</label>
                            <input
                              type="number"
                              min={0}
                              value={exercise.targetWeight}
                              onChange={(event) => handleExerciseDraftChange(exercise.id, 'targetWeight', event.target.value)}
                              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                              placeholder="185"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Target RPE</label>
                            <input
                              type="number"
                              step="0.5"
                              min={0}
                              max={10}
                              value={exercise.targetRpe}
                              onChange={(event) => handleExerciseDraftChange(exercise.id, 'targetRpe', event.target.value)}
                              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                              placeholder="8"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Rest (seconds)</label>
                            <input
                              type="number"
                              min={0}
                              value={exercise.restSeconds}
                              onChange={(event) => handleExerciseDraftChange(exercise.id, 'restSeconds', event.target.value)}
                              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                              placeholder="90"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Notes</label>
                            <textarea
                              value={exercise.notes}
                              onChange={(event) => handleExerciseDraftChange(exercise.id, 'notes', event.target.value)}
                              rows={2}
                              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                              placeholder="Tempo, cues, accessories..."
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCloseWorkoutModal}
                  className="inline-flex items-center rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
                >
                  <FilePlus className="h-4 w-4" />
                  Save Workout
                </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const PhoneIcon = () => (
  <svg className="h-3.5 w-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.86 19.86 0 0 1-3.07-8.67A2 2 0 0 1 4.18 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

export default CoachDashboard;
  const buildExercisesPayload = (
    drafts: WorkoutExerciseDraft[],
  ): {
    exercisesPayload: CoachWorkoutExerciseInput[];
    hasMissingExerciseName: boolean;
    hasInvalidExerciseNumber: boolean;
  } => {
    let hasMissingExerciseName = false;
    let hasInvalidExerciseNumber = false;

    const toNumber = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }
      const numeric = Number(trimmed);
      if (Number.isNaN(numeric)) {
        hasInvalidExerciseNumber = true;
        return null;
      }
      return numeric;
    };

    const exercisesPayload: CoachWorkoutExerciseInput[] = drafts
      .map((draft, index) => {
        const name = draft.name.trim();
        if (!name) {
          hasMissingExerciseName = true;
          return null;
        }

        return {
          name,
          order: index + 1,
          exerciseType: null,
          targetSets: toNumber(draft.targetSets),
          targetReps: draft.targetReps.trim() || null,
          targetWeight: toNumber(draft.targetWeight),
          targetRpe: toNumber(draft.targetRpe),
          restSeconds: toNumber(draft.restSeconds),
          notes: draft.notes.trim() || null,
          imageUrl: draft.imageUrl?.trim() || null,
          sourceExerciseId: draft.sourceExerciseId || null,
        };
      })
      .filter((entry): entry is CoachWorkoutExerciseInput => Boolean(entry));

    return {
      exercisesPayload,
      hasMissingExerciseName,
      hasInvalidExerciseNumber,
    };
  };
