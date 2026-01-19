import type { WorkoutWithRelations } from './supabase';

const FOCUS_AREA_PREFIX = 'Focus Area:';

export const serializeCoachNotes = (
  focusArea: string | null | undefined,
  coachNotes: string | null | undefined,
): string | null => {
  const trimmedFocus = focusArea?.trim() ?? '';
  const trimmedNotes = coachNotes?.trim() ?? '';

  const segments: string[] = [];

  if (trimmedFocus) {
    segments.push(`${FOCUS_AREA_PREFIX} ${trimmedFocus}`);
  }

  if (trimmedNotes) {
    segments.push(trimmedNotes);
  }

  const combined = segments.join('\n\n').trim();
  return combined.length > 0 ? combined : null;
};

export const deserializeCoachNotes = (
  rawNotes: string | null | undefined,
): { focusArea: string; coachNotes: string } => {
  if (!rawNotes) {
    return { focusArea: '', coachNotes: '' };
  }

  const normalised = rawNotes.replace(/\r\n/g, '\n');
  const lines = normalised.split('\n');

  if (lines.length === 0) {
    return { focusArea: '', coachNotes: '' };
  }

  const [firstLine, ...rest] = lines;
  if (firstLine.startsWith(FOCUS_AREA_PREFIX)) {
    const focusArea = firstLine.slice(FOCUS_AREA_PREFIX.length).trim();
    const remaining = rest.join('\n').trim();
    return { focusArea, coachNotes: remaining };
  }

  return { focusArea: '', coachNotes: rawNotes };
};

export const getWorkoutFocusArea = (workout?: WorkoutWithRelations | null): string | null => {
  if (!workout) {
    return null;
  }

  if (workout.focus_area) {
    return workout.focus_area;
  }

  const { focusArea } = deserializeCoachNotes(workout.coach_notes);
  return focusArea || null;
};

