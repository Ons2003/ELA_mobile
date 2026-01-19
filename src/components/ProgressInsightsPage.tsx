import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Activity, Award, TrendingUp, Loader, Flame, Zap, AlertTriangle } from 'lucide-react';
import {
  getCurrentUser,
  getWorkoutCheckIns,
  fetchCoachCheckIns,
  type WorkoutCheckIn,
  getWeeklyGoalsForUser,
  type WeeklyGoal,
} from '../lib/supabase';

interface ProgressInsightsPageProps {
  onNavigateBack: () => void;
  athleteIdOverride?: string | null;
  athleteNameOverride?: string | null;
}

interface ReadinessPoint {
  label: string;
  readiness: number | null;
  energy?: string | null;
  soreness?: string | null;
}

const getEnergyScore = (energy?: string | null) => {
  if (!energy) return 0;
  if (energy === 'low') return 3;
  if (energy === 'medium') return 6;
  return 9;
};

const getSorenessScore = (value?: string | null) => {
  if (!value) return 0;
  if (value === 'low') return 3;
  if (value === 'medium') return 6;
  return 9;
};

const WEEKLY_GOAL_STATUS_META: Record<
  WeeklyGoal['status'],
  { label: string; badge: string }
> = {
  pending: { label: 'In progress', badge: 'bg-yellow-100 text-yellow-800' },
  achieved: { label: 'Achieved', badge: 'bg-emerald-100 text-emerald-800' },
  partial: { label: 'Somewhat achieved', badge: 'bg-blue-100 text-blue-800' },
  not_achieved: { label: 'Not achieved', badge: 'bg-red-100 text-red-800' },
};

const formatWeekRange = (weekStart: string) => {
  const start = new Date(weekStart);
  if (Number.isNaN(start.getTime())) {
    return 'Week';
  }
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })}`;
};

const ProgressInsightsPage = ({ onNavigateBack, athleteIdOverride, athleteNameOverride }: ProgressInsightsPageProps) => {
  const [loading, setLoading] = useState(true);
  const [checkIns, setCheckIns] = useState<WorkoutCheckIn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [weeklyGoals, setWeeklyGoals] = useState<WeeklyGoal[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        setError('You need to be logged in to view your progress insights.');
        return;
      }

      const targetUserId = athleteIdOverride ?? currentUser.id;
      const [checkInsData, weeklyGoalsData] = await Promise.all([
        athleteIdOverride
          ? fetchCoachCheckIns([athleteIdOverride])
          : getWorkoutCheckIns(targetUserId),
        getWeeklyGoalsForUser(targetUserId),
      ]);

      const normalizedCheckIns = athleteIdOverride
        ? (checkInsData ?? []).filter((checkIn) => checkIn.user_id === athleteIdOverride)
        : checkInsData ?? [];

      setCheckIns(normalizedCheckIns);
      setWeeklyGoals(weeklyGoalsData ?? []);
    } catch (err) {
      console.error('Error loading progress insights:', err);
      setError('Unable to load progress insights right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [athleteIdOverride]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const readinessTrend: ReadinessPoint[] = useMemo(() => {
    return checkIns
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 12)
      .reverse()
      .map((checkIn) => ({
        label: new Date(checkIn.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        readiness: checkIn.readiness_score ?? null,
        energy: checkIn.energy_level,
        soreness: checkIn.soreness_level,
      }));
  }, [checkIns]);

  const recentPRs = useMemo(
    () =>
      checkIns
        .filter((checkIn) => checkIn.achieved_pr)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5),
    [checkIns],
  );

  const averageReadiness = useMemo(() => {
    const valid = checkIns.map((checkIn) => checkIn.readiness_score).filter((value): value is number => typeof value === 'number');
    if (valid.length === 0) return null;
    return valid.reduce((sum, value) => sum + value, 0) / valid.length;
  }, [checkIns]);

  const trainingVolume = useMemo(() => {
    const grouped = new Map<string, number>();
    checkIns.forEach((checkIn) => {
      const key = new Date(checkIn.created_at).toISOString().slice(0, 10);
      const readiness = checkIn.readiness_score ?? 0;
      grouped.set(key, (grouped.get(key) ?? 0) + readiness);
    });
    return Array.from(grouped.entries())
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .slice(-10);
  }, [checkIns]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center pb-24 lg:pb-0">
        <Loader className="w-8 h-8 text-red-600 animate-spin" />
        <p className="mt-3 text-sm text-gray-500">Loading your progress insights…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 pb-24 lg:pb-0">
        <div className="max-w-md bg-white border border-red-200 rounded-2xl shadow-sm px-6 py-8 text-center">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            <Loader className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 lg:pb-0">
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
          <div>
            <button
              type="button"
              onClick={onNavigateBack}
              className="inline-flex items-center gap-2 text-sm font-semibold text-red-600 hover:text-red-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to dashboard
            </button>
            <h1 className="mt-3 text-2xl font-bold text-gray-900">
              {athleteNameOverride ? `${athleteNameOverride}'s progress` : 'Progress insights'}
            </h1>
            <p className="text-sm text-gray-500">
              {athleteNameOverride
                ? 'Coach view · Review this athlete’s readiness, PRs, and check-in history.'
                : 'Visualize your readiness, energy, and personal records to stay aligned with your coach.'}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        <section className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Average readiness</p>
                <h2 className="text-3xl font-bold text-gray-900">
                  {averageReadiness ? averageReadiness.toFixed(1) : '—'}
                  <span className="text-sm font-medium text-gray-400"> /10</span>
                </h2>
              </div>
              <Activity className="w-10 h-10 text-red-500" />
            </div>
            <p className="mt-3 text-sm text-gray-500">
              Based on your submitted check-ins. A steady score above 7 indicates you’re recovering well.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Personal records logged</p>
                <h2 className="text-3xl font-bold text-gray-900">{recentPRs.length}</h2>
              </div>
              <Award className="w-10 h-10 text-yellow-500" />
            </div>
            <p className="mt-3 text-sm text-gray-500">
              Your most recent wins are captured below. Keep your coach posted to celebrate milestones together.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Check-ins submitted</p>
                <h2 className="text-3xl font-bold text-gray-900">{checkIns.length}</h2>
              </div>
              <TrendingUp className="w-10 h-10 text-green-500" />
            </div>
            <p className="mt-3 text-sm text-gray-500">
              Each check-in feeds your progress analytics and keeps your coach in sync with your training.
            </p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Readiness trend</h3>
                <p className="text-xs text-gray-500">Latest check-ins</p>
              </div>
            </div>
            {readinessTrend.length > 0 ? (
              <div className="grid grid-cols-12 gap-3">
                {readinessTrend.map((entry) => (
                  <div key={entry.label} className="flex flex-col">
                    <div className="flex-1 flex items-end">
                      <div
                        className="w-full rounded-t-md bg-red-500"
                        style={{ height: entry.readiness ? `${(entry.readiness / 10) * 160 + 8}px` : '12px' }}
                        title={entry.readiness ? `${entry.readiness}/10 readiness` : 'No data'}
                      />
                    </div>
                    <span className="mt-2 text-[11px] text-gray-500 text-center">{entry.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-gray-500">
                <Activity className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                Submit a check-in to start tracking readiness over time.
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent personal records</h3>
            {recentPRs.length > 0 ? (
              <div className="space-y-3">
                {recentPRs.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-sm font-semibold text-gray-900">{entry.pr_exercise ?? 'Personal record'}</p>
                    <p className="text-xs text-gray-500">
                      {entry.pr_value != null ? `${entry.pr_value} ${entry.pr_unit ?? ''}` : ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(entry.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-gray-500">
                <Award className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                Log a check-in with “New PR” to see it appear here.
              </div>
            )}
          </div>
        </section>

        {weeklyGoalsSorted.length > 0 && (
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Weekly goals history</h3>
                <p className="text-xs text-gray-500">
                  Track how each week’s focus wrapped up.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {Object.entries(weeklyGoalStatusCounts).map(([status, count]) => (
                  <span
                    key={status}
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                      WEEKLY_GOAL_STATUS_META[status as WeeklyGoal['status']].badge
                    }`}
                  >
                    {count} {WEEKLY_GOAL_STATUS_META[status as WeeklyGoal['status']].label}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {weeklyGoalsSorted.slice(0, 6).map((goal) => (
                <div key={goal.id} className="rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{formatWeekRange(goal.week_start)}</p>
                      <p className="text-xs text-gray-500 line-clamp-2">{goal.goal_text}</p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                        WEEKLY_GOAL_STATUS_META[goal.status].badge
                      }`}
                    >
                      {WEEKLY_GOAL_STATUS_META[goal.status].label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Energy vs. soreness</h3>
            </div>
            {readinessTrend.length > 0 ? (
              <div className="space-y-3">
                {readinessTrend.map((entry, index) => (
                  <div key={`energy-${entry.label}-${index}`} className="flex items-center gap-3">
                    <div className="w-20 text-[11px] text-gray-500">{entry.label}</div>
                    <div className="flex-1">
                      <div className="h-2 w-full rounded-full bg-gray-100">
                        <div
                          className="h-2 rounded-full bg-orange-400"
                          style={{ width: `${getEnergyScore(entry.energy)}0%` }}
                        />
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-100 mt-1">
                        <div
                          className="h-2 rounded-full bg-purple-400"
                          style={{ width: `${getSorenessScore(entry.soreness)}0%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between text-[11px] text-gray-400">
                  <span className="inline-flex items-center gap-1"><Flame className="w-3 h-3 text-orange-400" /> Energy</span>
                  <span className="inline-flex items-center gap-1"><Zap className="w-3 h-3 text-purple-400" /> Soreness</span>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-gray-500">
                Track at least one check-in to populate this comparison.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Readiness-weighted volume</h3>
            </div>
            {trainingVolume.length > 0 ? (
              <div className="space-y-2">
                {trainingVolume.map(([date, score], index) => (
                  <div key={`${date}-${index}`} className="flex items-center gap-3">
                    <div className="w-20 text-[11px] text-gray-500">
                      {new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </div>
                    <div className="flex-1 h-2 rounded-full bg-gray-100">
                      <div className="h-2 rounded-full bg-red-500" style={{ width: `${Math.min(score * 10, 100)}%` }} />
                    </div>
                    <div className="w-10 text-xs text-gray-400 text-right">{score.toFixed(1)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-gray-500">
                Submit more check-ins to chart training volume.
              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  );
};

export default ProgressInsightsPage;
