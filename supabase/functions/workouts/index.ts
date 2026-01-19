import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const buildCorsHeaders = (req: Request, options?: { methods?: string[] }) => {
  const methods = options?.methods ?? ['GET', 'POST', 'OPTIONS']
  const origin = req.headers.get('Origin') || '*'
  const requestedHeaders = req.headers.get('Access-Control-Request-Headers')
  const allowHeaders = requestedHeaders || 'authorization, x-client-info, apikey, content-type, accept, origin, referer'

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': allowHeaders,
    'Access-Control-Allow-Methods': methods.join(', '),
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  }
}

const handleOptionsRequest = (req: Request, methods?: string[]) =>
  new Response(null, {
    status: 204,
    headers: buildCorsHeaders(req, { methods }),
  })

interface WorkoutExerciseInput {
  exercise_name: string
  exercise_type?: string | null
  order_in_workout?: number | null
  target_sets?: number | null
  target_reps?: string | null
  target_weight?: number | null
  target_rpe?: number | null
  rest_seconds?: number | null
  notes?: string | null
  image_url?: string | null
  source_exercise_id?: string | null
  source_workout_exercise_id?: string | null
  sets?: Array<{
    set_number: number
    weight?: number | null
    reps?: number | null
    rpe?: number | null
    is_completed?: boolean
    notes?: string | null
  }>
}

interface CreateWorkoutPayload {
  athlete_id: string
  title: string
  description?: string | null
  program_id?: string | null
  day_number?: number | null
  duration_minutes?: number | null
  scheduled_date?: string | null
  coach_notes?: string | null
  exercises?: WorkoutExerciseInput[]
}

interface UpdateWorkoutPayload {
  workout_id: string
  updates: {
    title?: string | null
    description?: string | null
    program_id?: string | null
    day_number?: number | null
    duration_minutes?: number | null
    scheduled_date?: string | null
    coach_notes?: string | null
    is_completed?: boolean | null
    exercises?: WorkoutExerciseInput[]
  }
}

interface DeleteWorkoutPayload {
  workout_id: string
}

interface DetailWorkoutPayload {
  workout_id: string
}

interface FetchCheckInsPayload {
  user_id?: string
  user_ids?: string[]
}

interface UpdateCheckInStatusPayload {
  checkin_id: string
  status: 'submitted' | 'reviewed' | 'needs_revision'
  coach_notes?: string | null
}

type FunctionRequest =
  | { action: 'create'; payload: CreateWorkoutPayload }
  | { action: 'update'; payload: UpdateWorkoutPayload }
  | { action: 'delete'; payload: DeleteWorkoutPayload }
  | { action: 'detail'; payload: DetailWorkoutPayload }
  | { action: 'checkins'; payload: FetchCheckInsPayload }
  | { action: 'update_checkin_status'; payload: UpdateCheckInStatusPayload }

const resolveSourceExerciseId = (exercise: WorkoutExerciseInput) =>
  exercise.source_exercise_id ?? exercise.source_workout_exercise_id ?? null

const sanitizeExercise = (exercise: WorkoutExerciseInput, index: number) => ({
  workout_id: undefined as unknown as string, // Placeholder – replaced before insert
  exercise_name: exercise.exercise_name,
  exercise_type: exercise.exercise_type ?? null,
  order_in_workout: exercise.order_in_workout ?? index + 1,
  target_sets: exercise.target_sets ?? null,
  target_reps: exercise.target_reps ?? null,
  target_weight: exercise.target_weight ?? null,
  target_rpe: exercise.target_rpe ?? null,
  rest_seconds: exercise.rest_seconds ?? null,
  notes: exercise.notes ?? null,
  image_url: exercise.image_url ?? null,
  source_exercise_id: resolveSourceExerciseId(exercise),
})

const buildExerciseInsert = async (
  client: ReturnType<typeof createClient>,
  exercise: WorkoutExerciseInput,
  index: number,
  workoutId: string,
) => {
  const baseExercise = sanitizeExercise(exercise, index)
  const sourceExerciseId = resolveSourceExerciseId(exercise)

  let templateExercise:
    | {
        exercise_name: string | null
        exercise_type: string | null
        target_sets: number | null
        target_reps: string | null
        target_weight: number | null
        target_rpe: number | null
        rest_seconds: number | null
        notes: string | null
        image_url: string | null
      }
    | null = null

  if (sourceExerciseId) {
    const { data: template, error: templateError } = await client
      .from('exercises')
      .select(
        'exercise_name, exercise_type, target_sets, target_reps, target_weight, target_rpe, rest_seconds, notes, image_url',
      )
      .eq('id', sourceExerciseId)
      .single()

    if (templateError) {
      console.error('Error fetching source workout exercise', templateError)
    } else {
      templateExercise = template
    }
  }

  return {
    workout_id: workoutId,
    exercise_name: baseExercise.exercise_name ?? templateExercise?.exercise_name ?? '',
    exercise_type: baseExercise.exercise_type ?? templateExercise?.exercise_type ?? null,
    order_in_workout: baseExercise.order_in_workout ?? index + 1,
    target_sets: baseExercise.target_sets ?? templateExercise?.target_sets ?? null,
    target_reps: baseExercise.target_reps ?? templateExercise?.target_reps ?? null,
    target_weight: baseExercise.target_weight ?? templateExercise?.target_weight ?? null,
    target_rpe: baseExercise.target_rpe ?? templateExercise?.target_rpe ?? null,
    rest_seconds: baseExercise.rest_seconds ?? templateExercise?.rest_seconds ?? null,
    notes: baseExercise.notes ?? templateExercise?.notes ?? null,
    image_url: baseExercise.image_url ?? templateExercise?.image_url ?? null,
  }
}

const allowedMethods = ['POST', 'OPTIONS']

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req, { methods: allowedMethods })

  if (req.method === 'OPTIONS') {
    return handleOptionsRequest(req, allowedMethods)
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Authorization required')

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !user) throw new Error('Invalid authorization')

    const { data: profile } = await supabaseClient
      .from('profiles')npm install lucide-react@latest
      .select('role')
      .eq('id', user.id)
      .single()

    const userRole = profile?.role ?? 'user'
    const isCoachOrAdmin = userRole === 'coach' || userRole === 'admin'

    const request = await req.json() as FunctionRequest

    if (request.action === 'detail') {
      const { workout_id } = request.payload
      if (!workout_id) {
        throw new Error('workout_id is required for detail fetch')
      }

      const { data: workout, error: workoutError } = await supabaseClient
        .from('workouts')
        .select(`
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
        `)
        .eq('id', workout_id)
        .single()

      if (workoutError) throw workoutError

      if (userRole === 'user' && workout?.user_id && workout.user_id !== user.id) {
        throw new Error('You are not allowed to view this workout.')
      }

      return new Response(
        JSON.stringify(workout),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (request.action === 'checkins') {
      const payload = request.payload
      const ids = payload.user_ids?.filter(Boolean) ?? []
      const singleId = payload.user_id ?? null

      if (!singleId && ids.length === 0) {
        throw new Error('user_id or user_ids is required for fetch')
      }

      const requestedIds = ids.length > 0 ? ids : singleId ? [singleId] : [user.id]
      const isSelfRequest = requestedIds.every((id) => id === user.id)

      if (!isSelfRequest && !isCoachOrAdmin) {
        throw new Error('Coach or admin access required to view other athletes.')
      }

      let query = supabaseClient
        .from('workout_checkins')
        .select(`
          *,
          media:workout_checkin_media (*),
          workout:workouts (*)
        `)
        .order('created_at', { ascending: false })

      if (ids.length > 0) {
        query = query.in('user_id', ids)
      } else if (singleId) {
        query = query.eq('user_id', singleId)
      }

      const { data: checkins, error: checkinsError } = await query

      if (checkinsError) throw checkinsError

      return new Response(
        JSON.stringify(checkins ?? []),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (request.action === 'update_checkin_status') {
      const { checkin_id, status, coach_notes } = request.payload
      if (!checkin_id) {
        throw new Error('checkin_id is required for status updates')
      }

      if (!isCoachOrAdmin) {
        throw new Error('Coach or admin role required to change check-in status.')
      }

      const allowedStatuses: UpdateCheckInStatusPayload['status'][] = ['submitted', 'reviewed', 'needs_revision']
      if (!allowedStatuses.includes(status)) {
        throw new Error('Invalid status value')
      }

      const revisionTimestamp = status === 'needs_revision' ? new Date().toISOString() : null

      const updates: Record<string, any> = {
        status,
        coach_notes: coach_notes ?? null,
      }

      if (status === 'needs_revision') {
        updates.revision_requested_at = revisionTimestamp
      } else if (status === 'submitted' || status === 'reviewed') {
        updates.revision_requested_at = null
      }

      const { data: updatedCheckin, error: updateStatusError } = await supabaseClient
        .from('workout_checkins')
        .update(updates)
        .eq('id', checkin_id)
        .select(`
          *,
          media:workout_checkin_media (*),
          workout:workouts (*),
          profile:profiles (*)
        `)
        .single()

      if (updateStatusError) throw updateStatusError

      if (status === 'needs_revision' && updatedCheckin?.user_id) {
        await supabaseClient
          .from('notifications')
          .insert({
            user_id: updatedCheckin.user_id,
            title: 'Check-in needs revision',
            message: `Please revise your check-in for ${updatedCheckin.workout?.title ?? 'your workout'} within 24 hours.`,
            type: 'coach_feedback',
            action_url: 'dashboard',
          })
      }

      return new Response(
        JSON.stringify(updatedCheckin),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (request.action === 'create') {
      const payload = request.payload
      if (!payload.athlete_id) {
        throw new Error('athlete_id is required')
      }

      if (userRole === 'user' && payload.athlete_id !== user.id) {
        throw new Error('You can only create workouts for your own account.')
      }

      const isProgramWorkout = Boolean(payload.program_id)

      const performInsert = async (dayNumber: number | null | undefined) =>
        supabaseClient
          .from('workouts')
          .insert({
            user_id: payload.athlete_id,
            title: payload.title,
            description: payload.description ?? null,
            program_id: payload.program_id ?? null,
            day_number: dayNumber,
            duration_minutes: payload.duration_minutes ?? null,
            scheduled_date: payload.scheduled_date ?? null,
            coach_notes: payload.coach_notes ?? null,
            is_completed: false,
          })
          .select()
          .single()

      const primaryDayNumber =
        payload.day_number === undefined ? (isProgramWorkout ? 1 : null) : payload.day_number

      let { data: workout, error: workoutError } = await performInsert(primaryDayNumber)

      if (workoutError && !isProgramWorkout && workoutError.code === '23502') {
        const retry = await performInsert(1)
        workout = retry.data
        workoutError = retry.error
      }

      if (workoutError) throw workoutError

      if (payload.scheduled_date && workout?.scheduled_date !== payload.scheduled_date) {
        const { data: patchedWorkout, error: patchError } = await supabaseClient
          .from('workouts')
          .update({ scheduled_date: payload.scheduled_date })
          .eq('id', workout.id)
          .select()
          .single()

        if (patchError) throw patchError
        workout = patchedWorkout
      }

      if (payload.exercises && payload.exercises.length > 0) {
        for (const [index, exercise] of payload.exercises.entries()) {
          const insertExercise = await buildExerciseInsert(supabaseClient, exercise, index, workout.id)
          const { data: workoutExercise, error: exerciseError } = await supabaseClient
            .from('workout_exercises')
            .insert(insertExercise)
            .select()
            .single()

          if (exerciseError) throw exerciseError

          if (exercise.sets && exercise.sets.length > 0) {
            const sets = exercise.sets.map((set) => ({
              workout_exercise_id: workoutExercise.id,
              set_number: set.set_number,
              weight: set.weight ?? null,
              reps: set.reps ?? null,
              rpe: set.rpe ?? null,
              is_completed: set.is_completed ?? false,
              notes: set.notes ?? null,
            }))

            const { error: setsError } = await supabaseClient
              .from('exercise_sets')
              .insert(sets)

            if (setsError) throw setsError
          }
        }
      }

      const { data: completeWorkout, error: fetchError } = await supabaseClient
        .from('workouts')
        .select(`
          *,
          workout_exercises (
            *,
            exercise_sets (*)
          )
        `)
        .eq('id', workout.id)
        .single()

      if (fetchError) throw fetchError

      return new Response(
        JSON.stringify(completeWorkout),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (request.action === 'update') {
      const { workout_id, updates } = request.payload
      if (!workout_id) {
        throw new Error('workout_id is required for update')
      }

      const { data: workoutOwner } = await supabaseClient
        .from('workouts')
        .select('user_id')
        .eq('id', workout_id)
        .single()

      if (userRole === 'user' && workoutOwner?.user_id && workoutOwner.user_id !== user.id) {
        throw new Error('You can only update your own workouts.')
      }

      const exerciseUpdates = updates.exercises
      const updateFields = { ...updates }
      delete (updateFields as any).exercises

      const allowedKeys: (keyof UpdateWorkoutPayload['updates'])[] = [
        'title',
        'description',
        'program_id',
        'day_number',
        'duration_minutes',
        'scheduled_date',
        'coach_notes',
        'is_completed',
      ]

      const sanitizedUpdates = Object.fromEntries(
        Object.entries(updateFields ?? {}).filter(
          ([key, value]) => allowedKeys.includes(key as keyof UpdateWorkoutPayload['updates']) && value !== undefined,
        ),
      )

      const hasExerciseUpdates = Array.isArray(exerciseUpdates)
      const hasFieldUpdates = Object.keys(sanitizedUpdates).length > 0

      if (!hasFieldUpdates && !hasExerciseUpdates) {
        return new Response(
          JSON.stringify({ message: 'No updates applied' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      if (hasFieldUpdates) {
        const { error: updateError } = await supabaseClient
          .from('workouts')
          .update(sanitizedUpdates)
          .eq('id', workout_id)

        if (updateError) throw updateError
      }

      if (exerciseUpdates) {
        const { data: existingExercises, error: existingExercisesError } = await supabaseClient
          .from('workout_exercises')
          .select('id')
          .eq('workout_id', workout_id)

        if (existingExercisesError) throw existingExercisesError

        const existingIds = existingExercises?.map((exercise) => exercise.id) ?? []
        if (existingIds.length > 0) {
          const { error: deleteSetsError } = await supabaseClient
            .from('exercise_sets')
            .delete()
            .in('workout_exercise_id', existingIds)

          if (deleteSetsError) throw deleteSetsError

          const { error: deleteExercisesError } = await supabaseClient
            .from('workout_exercises')
            .delete()
            .eq('workout_id', workout_id)

          if (deleteExercisesError) throw deleteExercisesError
        }

        if (exerciseUpdates.length > 0) {
          const sanitizedExercises = await Promise.all(
            exerciseUpdates.map((exercise, index) => buildExerciseInsert(supabaseClient, exercise, index, workout_id)),
          )

          const { error: insertExercisesError } = await supabaseClient
            .from('workout_exercises')
            .insert(sanitizedExercises)

          if (insertExercisesError) throw insertExercisesError
        }
      }

      const { data: refreshedWorkout, error: fetchUpdatedError } = await supabaseClient
        .from('workouts')
        .select(`
          *,
          workout_exercises (
            *,
            exercise_sets (*)
          )
        `)
        .eq('id', workout_id)
        .single()

      if (fetchUpdatedError) throw fetchUpdatedError

      return new Response(
        JSON.stringify(refreshedWorkout),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (request.action === 'delete') {
      const { workout_id } = request.payload
      if (!workout_id) {
        throw new Error('workout_id is required for deletion')
      }

      const { data: workoutOwner } = await supabaseClient
        .from('workouts')
        .select('user_id')
        .eq('id', workout_id)
        .single()

      if (userRole === 'user' && workoutOwner?.user_id && workoutOwner.user_id !== user.id) {
        throw new Error('You can only delete your own workouts.')
      }

      const { error: deleteError } = await supabaseClient
        .from('workouts')
        .delete()
        .eq('id', workout_id)

      if (deleteError) throw deleteError

      return new Response(
        JSON.stringify({ message: 'Workout deleted successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Unsupported action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
