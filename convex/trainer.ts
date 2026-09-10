import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   Vive Trainer — Exercise Library & Routine Builder Backend
   ═══════════════════════════════════════════════════════════════ */

// ── Exercise Library (static, generated on-demand) ──

export interface ExerciseDefinition {
  id: string;
  name: string;
  muscleGroups: string[];
  primaryMuscle: string;
  category: "strength" | "cardio" | "mobility" | "recovery" | "plyometric";
  equipment: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  defaultSets: number;
  defaultReps: string;
  defaultRest: number; // seconds
  caloriesPer10Min: number;
  icon: string;
  tags: string[];
}

const EXERCISE_LIBRARY: ExerciseDefinition[] = [
  // ── Chest ──
  { id: "bench-press", name: "Barbell Bench Press", muscleGroups: ["chest", "triceps", "shoulders"], primaryMuscle: "chest", category: "strength", equipment: "Barbell + Bench", difficulty: "intermediate", defaultSets: 4, defaultReps: "8-10", defaultRest: 90, caloriesPer10Min: 65, icon: "🏋️", tags: ["compound", "push"] },
  { id: "incline-db-press", name: "Incline Dumbbell Press", muscleGroups: ["chest", "shoulders", "triceps"], primaryMuscle: "chest", category: "strength", equipment: "Dumbbells + Bench", difficulty: "intermediate", defaultSets: 3, defaultReps: "10-12", defaultRest: 75, caloriesPer10Min: 55, icon: "🏋️", tags: ["compound", "push", "upper-chest"] },
  { id: "push-ups", name: "Push-Ups", muscleGroups: ["chest", "triceps", "core"], primaryMuscle: "chest", category: "strength", equipment: "Bodyweight", difficulty: "beginner", defaultSets: 3, defaultReps: "15-20", defaultRest: 60, caloriesPer10Min: 50, icon: "💪", tags: ["compound", "push", "bodyweight"] },
  { id: "cable-fly", name: "Cable Fly", muscleGroups: ["chest"], primaryMuscle: "chest", category: "strength", equipment: "Cable Machine", difficulty: "intermediate", defaultSets: 3, defaultReps: "12-15", defaultRest: 60, caloriesPer10Min: 40, icon: "🔄", tags: ["isolation", "push"] },

  // ── Back ──
  { id: "deadlift", name: "Conventional Deadlift", muscleGroups: ["back", "hamstrings", "glutes", "core"], primaryMuscle: "back", category: "strength", equipment: "Barbell", difficulty: "advanced", defaultSets: 4, defaultReps: "5-6", defaultRest: 120, caloriesPer10Min: 80, icon: "🏋️", tags: ["compound", "pull", "posterior-chain"] },
  { id: "pull-ups", name: "Pull-Ups", muscleGroups: ["back", "biceps", "core"], primaryMuscle: "back", category: "strength", equipment: "Pull-Up Bar", difficulty: "intermediate", defaultSets: 4, defaultReps: "6-10", defaultRest: 90, caloriesPer10Min: 60, icon: "💪", tags: ["compound", "pull", "bodyweight"] },
  { id: "barbell-row", name: "Barbell Row", muscleGroups: ["back", "biceps", "core"], primaryMuscle: "back", category: "strength", equipment: "Barbell", difficulty: "intermediate", defaultSets: 4, defaultReps: "8-10", defaultRest: 90, caloriesPer10Min: 55, icon: "🏋️", tags: ["compound", "pull"] },
  { id: "lat-pulldown", name: "Lat Pulldown", muscleGroups: ["back", "biceps"], primaryMuscle: "back", category: "strength", equipment: "Cable Machine", difficulty: "beginner", defaultSets: 3, defaultReps: "10-12", defaultRest: 75, caloriesPer10Min: 45, icon: "🔄", tags: ["compound", "pull"] },

  // ── Shoulders ──
  { id: "ohp", name: "Overhead Press", muscleGroups: ["shoulders", "triceps", "core"], primaryMuscle: "shoulders", category: "strength", equipment: "Barbell", difficulty: "intermediate", defaultSets: 4, defaultReps: "6-8", defaultRest: 90, caloriesPer10Min: 55, icon: "🏋️", tags: ["compound", "push"] },
  { id: "lateral-raise", name: "Lateral Raise", muscleGroups: ["shoulders"], primaryMuscle: "shoulders", category: "strength", equipment: "Dumbbells", difficulty: "beginner", defaultSets: 3, defaultReps: "12-15", defaultRest: 60, caloriesPer10Min: 35, icon: "🔄", tags: ["isolation", "push"] },
  { id: "face-pull", name: "Face Pull", muscleGroups: ["shoulders", "back"], primaryMuscle: "shoulders", category: "strength", equipment: "Cable Machine", difficulty: "beginner", defaultSets: 3, defaultReps: "15-20", defaultRest: 60, caloriesPer10Min: 30, icon: "🔄", tags: ["isolation", "pull", "posture"] },

  // ── Legs ──
  { id: "squat", name: "Barbell Back Squat", muscleGroups: ["quads", "glutes", "hamstrings", "core"], primaryMuscle: "quads", category: "strength", equipment: "Barbell + Rack", difficulty: "intermediate", defaultSets: 4, defaultReps: "6-8", defaultRest: 120, caloriesPer10Min: 75, icon: "🏋️", tags: ["compound", "push", "legs"] },
  { id: "romanian-dl", name: "Romanian Deadlift", muscleGroups: ["hamstrings", "glutes", "back"], primaryMuscle: "hamstrings", category: "strength", equipment: "Barbell", difficulty: "intermediate", defaultSets: 3, defaultReps: "8-10", defaultRest: 90, caloriesPer10Min: 60, icon: "🏋️", tags: ["compound", "pull", "posterior-chain"] },
  { id: "leg-press", name: "Leg Press", muscleGroups: ["quads", "glutes"], primaryMuscle: "quads", category: "strength", equipment: "Leg Press Machine", difficulty: "beginner", defaultSets: 3, defaultReps: "10-12", defaultRest: 90, caloriesPer10Min: 55, icon: "🦵", tags: ["compound", "push", "legs"] },
  { id: "lunges", name: "Walking Lunges", muscleGroups: ["quads", "glutes", "hamstrings", "core"], primaryMuscle: "quads", category: "strength", equipment: "Dumbbells", difficulty: "beginner", defaultSets: 3, defaultReps: "12 each", defaultRest: 75, caloriesPer10Min: 50, icon: "🦵", tags: ["compound", "unilateral"] },
  { id: "calf-raise", name: "Standing Calf Raise", muscleGroups: ["calves"], primaryMuscle: "calves", category: "strength", equipment: "Machine", difficulty: "beginner", defaultSets: 4, defaultReps: "15-20", defaultRest: 45, caloriesPer10Min: 25, icon: "🦵", tags: ["isolation", "legs"] },

  // ── Arms ──
  { id: "barbell-curl", name: "Barbell Curl", muscleGroups: ["biceps"], primaryMuscle: "biceps", category: "strength", equipment: "Barbell", difficulty: "beginner", defaultSets: 3, defaultReps: "10-12", defaultRest: 60, caloriesPer10Min: 35, icon: "💪", tags: ["isolation", "pull"] },
  { id: "tricep-dip", name: "Tricep Dips", muscleGroups: ["triceps", "chest", "shoulders"], primaryMuscle: "triceps", category: "strength", equipment: "Dip Station", difficulty: "intermediate", defaultSets: 3, defaultReps: "8-12", defaultRest: 75, caloriesPer10Min: 50, icon: "💪", tags: ["compound", "push"] },
  { id: "skull-crusher", name: "Skull Crushers", muscleGroups: ["triceps"], primaryMuscle: "triceps", category: "strength", equipment: "EZ Bar + Bench", difficulty: "intermediate", defaultSets: 3, defaultReps: "10-12", defaultRest: 60, caloriesPer10Min: 35, icon: "💪", tags: ["isolation", "push"] },

  // ── Core ──
  { id: "plank", name: "Plank Hold", muscleGroups: ["core"], primaryMuscle: "core", category: "strength", equipment: "Bodyweight", difficulty: "beginner", defaultSets: 3, defaultReps: "45-60s", defaultRest: 45, caloriesPer10Min: 30, icon: "🧘", tags: ["isometric", "core", "bodyweight"] },
  { id: "hanging-leg-raise", name: "Hanging Leg Raise", muscleGroups: ["core", "hip-flexors"], primaryMuscle: "core", category: "strength", equipment: "Pull-Up Bar", difficulty: "intermediate", defaultSets: 3, defaultReps: "10-15", defaultRest: 60, caloriesPer10Min: 40, icon: "🧘", tags: ["core", "bodyweight"] },

  // ── Cardio ──
  { id: "running", name: "Steady-State Run", muscleGroups: ["quads", "hamstrings", "calves", "core"], primaryMuscle: "quads", category: "cardio", equipment: "None", difficulty: "beginner", defaultSets: 1, defaultReps: "20-30 min", defaultRest: 0, caloriesPer10Min: 100, icon: "🏃", tags: ["cardio", "endurance"] },
  { id: "hiit-sprints", name: "HIIT Sprints", muscleGroups: ["quads", "hamstrings", "calves", "core"], primaryMuscle: "quads", category: "plyometric", equipment: "None", difficulty: "advanced", defaultSets: 8, defaultReps: "30s on / 60s off", defaultRest: 60, caloriesPer10Min: 140, icon: "⚡", tags: ["cardio", "hiit", "fat-burn"] },
  { id: "rowing", name: "Rowing Machine", muscleGroups: ["back", "quads", "core", "biceps"], primaryMuscle: "back", category: "cardio", equipment: "Rowing Machine", difficulty: "beginner", defaultSets: 1, defaultReps: "15-20 min", defaultRest: 0, caloriesPer10Min: 90, icon: "🚣", tags: ["cardio", "full-body"] },

  // ── Mobility / Recovery ──
  { id: "foam-roll", name: "Foam Rolling", muscleGroups: ["back", "quads", "hamstrings", "calves", "glutes"], primaryMuscle: "back", category: "recovery", equipment: "Foam Roller", difficulty: "beginner", defaultSets: 1, defaultReps: "10 min", defaultRest: 0, caloriesPer10Min: 15, icon: "🧘", tags: ["recovery", "mobility"] },
  { id: "yoga-flow", name: "Yoga Flow", muscleGroups: ["core", "hamstrings", "shoulders", "back", "hip-flexors"], primaryMuscle: "core", category: "mobility", equipment: "Mat", difficulty: "beginner", defaultSets: 1, defaultReps: "20 min", defaultRest: 0, caloriesPer10Min: 25, icon: "🧘", tags: ["mobility", "flexibility", "recovery"] },
  { id: "hip-opener", name: "Hip Opener Stretch", muscleGroups: ["hip-flexors", "glutes", "hamstrings"], primaryMuscle: "hip-flexors", category: "mobility", equipment: "None", difficulty: "beginner", defaultSets: 1, defaultReps: "5 min each side", defaultRest: 0, caloriesPer10Min: 15, icon: "🧘", tags: ["mobility", "flexibility"] },
  { id: "band-pull-apart", name: "Band Pull-Aparts", muscleGroups: ["shoulders", "back"], primaryMuscle: "shoulders", category: "mobility", equipment: "Resistance Band", difficulty: "beginner", defaultSets: 3, defaultReps: "15-20", defaultRest: 30, caloriesPer10Min: 20, icon: "🔄", tags: ["mobility", "posture", "warm-up"] },
  { id: "cat-cow", name: "Cat-Cow Stretch", muscleGroups: ["back", "core"], primaryMuscle: "back", category: "mobility", equipment: "Mat", difficulty: "beginner", defaultSets: 1, defaultReps: "10 reps", defaultRest: 0, caloriesPer10Min: 10, icon: "🧘", tags: ["mobility", "spine", "warm-up"] },
  { id: "light-walk", name: "Light Walk", muscleGroups: ["quads", "calves", "hamstrings"], primaryMuscle: "quads", category: "recovery", equipment: "None", difficulty: "beginner", defaultSets: 1, defaultReps: "20-30 min", defaultRest: 0, caloriesPer10Min: 35, icon: "🚶", tags: ["recovery", "active-recovery", "low-impact"] },
];

// ── Preset Routine Templates ──

interface RoutineTemplate {
  id: string;
  name: string;
  description: string;
  category: "strength" | "cardio" | "mobility" | "recovery" | "hybrid";
  targetMuscles: string[];
  exerciseIds: string[];
  estimatedDuration: number; // minutes
  estimatedCalories: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  icon: string;
  recoveryThreshold: number; // min EliteScore to recommend this
}

const ROUTINE_TEMPLATES: RoutineTemplate[] = [
  {
    id: "push-day", name: "Push Day", description: "Chest, shoulders, and triceps compound focus",
    category: "strength", targetMuscles: ["chest", "shoulders", "triceps"],
    exerciseIds: ["bench-press", "incline-db-press", "ohp", "lateral-raise", "tricep-dip", "skull-crusher"],
    estimatedDuration: 55, estimatedCalories: 420, difficulty: "intermediate", icon: "🔥", recoveryThreshold: 55,
  },
  {
    id: "pull-day", name: "Pull Day", description: "Back and biceps with heavy compounds",
    category: "strength", targetMuscles: ["back", "biceps"],
    exerciseIds: ["deadlift", "pull-ups", "barbell-row", "lat-pulldown", "barbell-curl", "face-pull"],
    estimatedDuration: 55, estimatedCalories: 450, difficulty: "intermediate", icon: "🔥", recoveryThreshold: 55,
  },
  {
    id: "leg-day", name: "Leg Day", description: "Quads, hamstrings, and glutes power session",
    category: "strength", targetMuscles: ["quads", "hamstrings", "glutes", "calves"],
    exerciseIds: ["squat", "romanian-dl", "leg-press", "lunges", "calf-raise"],
    estimatedDuration: 50, estimatedCalories: 480, difficulty: "intermediate", icon: "🦵", recoveryThreshold: 60,
  },
  {
    id: "upper-body", name: "Upper Body", description: "Full upper body push-pull balance",
    category: "strength", targetMuscles: ["chest", "back", "shoulders", "biceps", "triceps"],
    exerciseIds: ["bench-press", "barbell-row", "ohp", "pull-ups", "lateral-raise", "barbell-curl"],
    estimatedDuration: 50, estimatedCalories: 400, difficulty: "intermediate", icon: "💪", recoveryThreshold: 55,
  },
  {
    id: "full-body", name: "Full Body", description: "Hit every major group in one session",
    category: "hybrid", targetMuscles: ["chest", "back", "quads", "shoulders", "core"],
    exerciseIds: ["squat", "bench-press", "barbell-row", "ohp", "lunges", "plank"],
    estimatedDuration: 60, estimatedCalories: 500, difficulty: "intermediate", icon: "⚡", recoveryThreshold: 60,
  },
  {
    id: "hiit-burn", name: "HIIT Burn", description: "High-intensity interval cardio blast",
    category: "cardio", targetMuscles: ["quads", "hamstrings", "core", "calves"],
    exerciseIds: ["hiit-sprints", "push-ups", "lunges", "plank", "hanging-leg-raise"],
    estimatedDuration: 30, estimatedCalories: 380, difficulty: "advanced", icon: "⚡", recoveryThreshold: 65,
  },
  {
    id: "active-recovery", name: "Active Recovery", description: "Low-intensity movement to promote healing",
    category: "recovery", targetMuscles: ["back", "hamstrings", "hip-flexors", "shoulders", "core"],
    exerciseIds: ["foam-roll", "yoga-flow", "light-walk", "cat-cow", "band-pull-apart"],
    estimatedDuration: 35, estimatedCalories: 120, difficulty: "beginner", icon: "🧘", recoveryThreshold: 0,
  },
  {
    id: "mobility-flow", name: "Mobility Flow", description: "Joint health and flexibility restoration",
    category: "mobility", targetMuscles: ["hip-flexors", "shoulders", "back", "hamstrings", "core"],
    exerciseIds: ["yoga-flow", "hip-opener", "cat-cow", "band-pull-apart", "foam-roll"],
    estimatedDuration: 30, estimatedCalories: 90, difficulty: "beginner", icon: "🧘", recoveryThreshold: 0,
  },
  {
    id: "cardio-endurance", name: "Cardio Endurance", description: "Steady-state aerobic conditioning",
    category: "cardio", targetMuscles: ["quads", "hamstrings", "calves", "core", "back"],
    exerciseIds: ["running", "rowing", "plank"],
    estimatedDuration: 40, estimatedCalories: 350, difficulty: "beginner", icon: "🏃", recoveryThreshold: 45,
  },
];

// ── Query: Get full exercise library ──
export const getExerciseLibrary = query({
  args: {},
  handler: async () => {
    return EXERCISE_LIBRARY;
  },
});

// ── Query: Get routine templates ──
export const getRoutineTemplates = query({
  args: {},
  handler: async () => {
    return ROUTINE_TEMPLATES;
  },
});

// ── Query: Get smart recommendations based on EliteScore + recent workouts ──
export const getSmartRecommendations = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    // Get EliteScore
    const eliteScore = await ctx.db
      .query("eliteScores")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    const score = eliteScore?.score ?? 50;
    const recovery = eliteScore ? Math.round((eliteScore.hrvPoints + 20) / 40 * 100) : 50;

    // Get recent workouts (last 72h) to avoid overtraining muscle groups
    const cutoff72h = Date.now() - 72 * 60 * 60 * 1000;
    const recentWorkouts = await ctx.db
      .query("workoutLogs")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", cutoff72h)
      )
      .collect();

    // Build fatigue map: which muscles were recently trained
    const fatigueMap: Record<string, { lastTrained: number; intensity: string }> = {};
    for (const w of recentWorkouts) {
      for (const mg of w.muscleGroups) {
        const existing = fatigueMap[mg];
        if (!existing || w.loggedAt > existing.lastTrained) {
          fatigueMap[mg] = { lastTrained: w.loggedAt, intensity: w.intensity };
        }
      }
    }

    // Determine recommendation tier
    let tier: "recovery" | "light" | "moderate" | "intense";
    if (score < 35) tier = "recovery";
    else if (score < 50) tier = "light";
    else if (score < 70) tier = "moderate";
    else tier = "intense";

    // Filter and rank routines
    const ranked = ROUTINE_TEMPLATES
      .map((routine) => {
        let suitability = 100;

        // Penalize if score is below routine threshold
        if (score < routine.recoveryThreshold) {
          suitability -= (routine.recoveryThreshold - score) * 2;
        }

        // Penalize if target muscles are fatigued
        const now = Date.now();
        for (const muscle of routine.targetMuscles) {
          const fatigue = fatigueMap[muscle];
          if (fatigue) {
            const hoursSince = (now - fatigue.lastTrained) / (1000 * 60 * 60);
            if (hoursSince < 24) suitability -= 30;
            else if (hoursSince < 48) suitability -= 15;
            else if (hoursSince < 72) suitability -= 5;
          }
        }

        // Boost recovery/mobility when score is low
        if (tier === "recovery" && (routine.category === "recovery" || routine.category === "mobility")) {
          suitability += 40;
        }
        if (tier === "light" && routine.category === "mobility") {
          suitability += 20;
        }

        // Boost strength when score is high
        if (tier === "intense" && routine.category === "strength") {
          suitability += 15;
        }

        return { ...routine, suitability: Math.max(0, Math.min(100, suitability)) };
      })
      .sort((a, b) => b.suitability - a.suitability);

    // Build advisory message
    let advisory: string;
    let advisoryIcon: string;
    if (tier === "recovery") {
      advisory = "Your recovery signals are low. Active Recovery or Mobility Flow will help your body rebuild without adding strain.";
      advisoryIcon = "🧘";
    } else if (tier === "light") {
      advisory = "Recovery is moderate. Consider lighter sessions or mobility work today. Save heavy compounds for when your score climbs above 55.";
      advisoryIcon = "⚠️";
    } else if (tier === "moderate") {
      advisory = "You are in a solid training window. Moderate intensity is ideal — push yourself but respect your recovery signals.";
      advisoryIcon = "✅";
    } else {
      advisory = "Elite recovery detected. This is your green-light window for heavy compounds and high-intensity work. Make it count.";
      advisoryIcon = "🔥";
    }

    return {
      tier,
      score,
      recovery,
      advisory,
      advisoryIcon,
      recommended: ranked.slice(0, 3),
      allRoutines: ranked,
      fatigueMap,
      recentWorkoutCount: recentWorkouts.length,
    };
  },
});

// ── Query: Get exercises by muscle group ──
export const getExercisesByMuscle = query({
  args: { muscleGroup: v.string() },
  handler: async (_ctx, args) => {
    return EXERCISE_LIBRARY.filter((e) =>
      e.muscleGroups.includes(args.muscleGroup)
    );
  },
});

// ── Mutation: Log a completed routine as a workout ──
export const logRoutineAsWorkout = mutation({
  args: {
    sessionId: v.string(),
    routineName: v.string(),
    muscleGroups: v.array(v.string()),
    duration: v.number(),
    intensity: v.string(),
    exerciseIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Log to workoutLogs
    const workoutId = await ctx.db.insert("workoutLogs", {
      sessionId: args.sessionId,
      workoutName: args.routineName,
      muscleGroups: args.muscleGroups,
      duration: args.duration,
      intensity: args.intensity,
      loggedAt: Date.now(),
    });

    // Also log as activity
    const totalCalories = args.exerciseIds.reduce((sum, eid) => {
      const ex = EXERCISE_LIBRARY.find((e) => e.id === eid);
      return sum + (ex ? Math.round(ex.caloriesPer10Min * (args.duration / args.exerciseIds.length) / 10) : 30);
    }, 0);

    await ctx.db.insert("activityLogs", {
      sessionId: args.sessionId,
      name: args.routineName,
      duration: args.duration,
      calories: totalCalories,
      type: "workout",
      source: "vive-trainer",
      loggedAt: Date.now(),
    });

    return { workoutId, totalCalories };
  },
});
