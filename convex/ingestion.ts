import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════════
   DATA INGESTION LAYER — The Normalization Engine for Vive 4.0
   
   Takes raw JSON data from BioTimeline sources (Apple Health, Garmin,
   Whoop, Oura, manual entries) and normalizes into standardized
   health metrics. Handles:
   
   1. Unit normalization (ms, bpm, hours, %, mg/dL)
   2. Outlier detection & clamping
   3. Sensor dropout detection & interpolation
   4. Confidence scoring per data point
   5. BioVault summary sync (rolling averages → bioVault fields)
   
   The normalized data feeds directly into the AI Brain and
   SomaticMirror for real-time accuracy even when sensors drop out.
   ═══════════════════════════════════════════════════════════════════ */

/* ── Metric Type Definitions ── */
interface MetricSpec {
  unit: string;
  min: number;
  max: number;
  optimalMin: number;
  optimalMax: number;
  expectedIntervalMs: number; // expected time between readings
  staleTolerance: number;     // multiplier before "stale"
  dropoutTolerance: number;   // multiplier before "dropout"
  isHigherBetter: boolean;
}

const METRIC_SPECS: Record<string, MetricSpec> = {
  hrv:              { unit: "ms",          min: 5,    max: 250,  optimalMin: 50,  optimalMax: 100, expectedIntervalMs: 300000,   staleTolerance: 3,  dropoutTolerance: 10, isHigherBetter: true },
  heart_rate:       { unit: "bpm",         min: 30,   max: 220,  optimalMin: 55,  optimalMax: 72,  expectedIntervalMs: 60000,    staleTolerance: 5,  dropoutTolerance: 15, isHigherBetter: false },
  sleep:            { unit: "hours",       min: 0,    max: 16,   optimalMin: 7,   optimalMax: 9,   expectedIntervalMs: 86400000, staleTolerance: 1.5, dropoutTolerance: 3, isHigherBetter: true },
  sleep_score:      { unit: "score",       min: 0,    max: 100,  optimalMin: 80,  optimalMax: 100, expectedIntervalMs: 86400000, staleTolerance: 1.5, dropoutTolerance: 3, isHigherBetter: true },
  spo2:             { unit: "percent",     min: 80,   max: 100,  optimalMin: 96,  optimalMax: 100, expectedIntervalMs: 3600000,  staleTolerance: 3,  dropoutTolerance: 8, isHigherBetter: true },
  glucose:          { unit: "mg/dL",       min: 40,   max: 400,  optimalMin: 70,  optimalMax: 100, expectedIntervalMs: 300000,   staleTolerance: 3,  dropoutTolerance: 12, isHigherBetter: false },
  strain:           { unit: "score",       min: 0,    max: 21,   optimalMin: 4,   optimalMax: 14,  expectedIntervalMs: 86400000, staleTolerance: 1.5, dropoutTolerance: 3, isHigherBetter: true },
  recovery:         { unit: "percent",     min: 0,    max: 100,  optimalMin: 70,  optimalMax: 100, expectedIntervalMs: 86400000, staleTolerance: 1.5, dropoutTolerance: 3, isHigherBetter: true },
  body_battery:     { unit: "percent",     min: 0,    max: 100,  optimalMin: 60,  optimalMax: 100, expectedIntervalMs: 900000,   staleTolerance: 3,  dropoutTolerance: 8, isHigherBetter: true },
  stress:           { unit: "score",       min: 0,    max: 100,  optimalMin: 0,   optimalMax: 30,  expectedIntervalMs: 180000,   staleTolerance: 5,  dropoutTolerance: 15, isHigherBetter: false },
  respiratory_rate: { unit: "breaths/min", min: 6,    max: 40,   optimalMin: 12,  optimalMax: 16,  expectedIntervalMs: 3600000,  staleTolerance: 3,  dropoutTolerance: 8, isHigherBetter: false },
  skin_temp:        { unit: "celsius",     min: 33,   max: 40,   optimalMin: 36.2, optimalMax: 36.8, expectedIntervalMs: 3600000, staleTolerance: 3, dropoutTolerance: 8, isHigherBetter: false },
};

/* ═══════════════════════════════════════════════════════════════
   NORMALIZATION FUNCTIONS — Pure data cleaning logic
   ═══════════════════════════════════════════════════════════════ */

/** Clamp a value to the physiologically valid range */
function clampToRange(value: number, spec: MetricSpec): { value: number; wasClamped: boolean } {
  if (value < spec.min) return { value: spec.min, wasClamped: true };
  if (value > spec.max) return { value: spec.max, wasClamped: true };
  return { value, wasClamped: false };
}

/** Detect outliers using IQR method against recent readings */
function isOutlier(value: number, recentValues: number[]): boolean {
  if (recentValues.length < 5) return false;
  const sorted = [...recentValues].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lowerFence = q1 - 2.5 * iqr;
  const upperFence = q3 + 2.5 * iqr;
  return value < lowerFence || value > upperFence;
}

/** Compute confidence score (0-100) for a data point */
function computeConfidence(
  value: number,
  spec: MetricSpec,
  source: string,
  wasClamped: boolean,
  isOutlierFlag: boolean,
  timeSinceLastMs: number | null,
): number {
  let confidence = 100;

  // Source reliability
  const sourceWeights: Record<string, number> = {
    apple_health: 0.95, garmin: 0.93, whoop: 0.95, oura: 0.94,
    fitbit: 0.88, manual: 0.70, interpolated: 0.50, derived: 0.60,
  };
  confidence *= (sourceWeights[source] ?? 0.75);

  // Clamping penalty
  if (wasClamped) confidence *= 0.6;

  // Outlier penalty
  if (isOutlierFlag) confidence *= 0.7;

  // Staleness penalty
  if (timeSinceLastMs != null && spec.expectedIntervalMs > 0) {
    const ratio = timeSinceLastMs / spec.expectedIntervalMs;
    if (ratio > spec.dropoutTolerance) confidence *= 0.3;
    else if (ratio > spec.staleTolerance) confidence *= 0.6;
  }

  return Math.round(Math.max(0, Math.min(100, confidence)));
}

/** Interpolate a missing value using EWMA (exponentially weighted moving average) */
function interpolateEWMA(recentValues: number[], alpha: number = 0.3): number {
  if (recentValues.length === 0) return 0;
  if (recentValues.length === 1) return recentValues[0];
  let ewma = recentValues[0];
  for (let i = 1; i < recentValues.length; i++) {
    ewma = alpha * recentValues[i] + (1 - alpha) * ewma;
  }
  return Math.round(ewma * 100) / 100;
}

/** Linear interpolation between two known points */
function interpolateLinear(
  t: number,
  t1: number, v1: number,
  t2: number, v2: number,
): number {
  if (t2 === t1) return v1;
  const ratio = (t - t1) / (t2 - t1);
  return Math.round((v1 + ratio * (v2 - v1)) * 100) / 100;
}

/* ═══════════════════════════════════════════════════════════════
   SENSOR STATUS MANAGEMENT
   ═══════════════════════════════════════════════════════════════ */

/** Determine sensor status based on time since last reading */
function classifySensorStatus(
  timeSinceLastMs: number | null,
  spec: MetricSpec,
  consecutiveDropouts: number,
): "active" | "stale" | "dropout" | "never_connected" {
  if (timeSinceLastMs == null) return "never_connected";
  const ratio = timeSinceLastMs / spec.expectedIntervalMs;
  if (ratio <= spec.staleTolerance) return "active";
  if (ratio <= spec.dropoutTolerance) return "stale";
  return "dropout";
}

/* ═══════════════════════════════════════════════════════════════
   MUTATIONS — Write normalized data to DB
   ═══════════════════════════════════════════════════════════════ */

/** Ingest a single raw metric, normalize it, and store */
export const ingestMetric = mutation({
  args: {
    sessionId: v.string(),
    metricType: v.string(),
    rawValue: v.number(),
    source: v.string(),
    measuredAt: v.number(),
  },
  handler: async (ctx, args) => {
    const spec = METRIC_SPECS[args.metricType];
    if (!spec) throw new Error(`Unknown metric type: ${args.metricType}`);
    const now = Date.now();

    // 1. Fetch recent readings for outlier detection
    const recentReadings = await ctx.db
      .query("normalizedMetrics")
      .withIndex("by_sessionId_type_measured", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("metricType", args.metricType)
      )
      .order("desc")
      .take(20);

    const recentValues = recentReadings.map((r) => r.value);

    // 2. Clamp to physiological range
    const { value: clampedValue, wasClamped } = clampToRange(args.rawValue, spec);

    // 3. Outlier detection
    const outlierFlag = isOutlier(clampedValue, recentValues);

    // 4. Compute time since last reading
    const lastReading = recentReadings[0];
    const timeSinceLastMs = lastReading ? args.measuredAt - lastReading.measuredAt : null;

    // 5. Compute confidence
    const confidence = computeConfidence(
      clampedValue, spec, args.source, wasClamped, outlierFlag, timeSinceLastMs
    );

    // 6. Determine sensor status
    const sensorState = classifySensorStatus(timeSinceLastMs, spec, 0);

    // 7. Store normalized metric
    const metricId = await ctx.db.insert("normalizedMetrics", {
      sessionId: args.sessionId,
      metricType: args.metricType,
      value: outlierFlag ? interpolateEWMA(recentValues) : clampedValue,
      unit: spec.unit,
      confidence,
      source: outlierFlag ? "derived" : args.source,
      isInterpolated: outlierFlag,
      interpolationMethod: outlierFlag ? "ewma" : undefined,
      rawValue: args.rawValue,
      sensorStatus: sensorState,
      measuredAt: args.measuredAt,
      normalizedAt: now,
    });

    // 8. Update sensor status
    const existingSensor = await ctx.db
      .query("sensorStatus")
      .withIndex("by_sessionId_and_sensor", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("sensorType", args.metricType)
      )
      .first();

    if (existingSensor) {
      await ctx.db.patch(existingSensor._id, {
        status: sensorState === "active" ? "active" : sensorState === "stale" ? "stale" : existingSensor.status,
        lastDataAt: args.measuredAt,
        consecutiveDropouts: sensorState === "active" ? 0 : existingSensor.consecutiveDropouts,
        dropoutStartedAt: sensorState === "dropout" ? (existingSensor.dropoutStartedAt ?? now) : undefined,
        dropoutDurationMs: sensorState === "dropout" && existingSensor.dropoutStartedAt
          ? now - existingSensor.dropoutStartedAt : undefined,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("sensorStatus", {
        sessionId: args.sessionId,
        sensorType: args.metricType,
        provider: args.source,
        status: "active",
        lastDataAt: args.measuredAt,
        consecutiveDropouts: 0,
        avgReadingIntervalMs: spec.expectedIntervalMs,
        updatedAt: now,
      });
    }

    return { metricId, confidence, sensorStatus: sensorState, wasOutlier: outlierFlag, wasClamped };
  },
});

/** Batch ingest multiple metrics at once (e.g., from a HealthKit sync) */
export const batchIngest = mutation({
  args: {
    sessionId: v.string(),
    metrics: v.array(v.object({
      metricType: v.string(),
      rawValue: v.number(),
      source: v.string(),
      measuredAt: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let processed = 0;
    let interpolated = 0;
    let errors = 0;

    for (const metric of args.metrics) {
      const spec = METRIC_SPECS[metric.metricType];
      if (!spec) { errors++; continue; }

      const { value: clampedValue, wasClamped } = clampToRange(metric.rawValue, spec);

      // Simplified batch path — skip outlier detection for speed
      const confidence = computeConfidence(clampedValue, spec, metric.source, wasClamped, false, null);

      await ctx.db.insert("normalizedMetrics", {
        sessionId: args.sessionId,
        metricType: metric.metricType,
        value: clampedValue,
        unit: spec.unit,
        confidence,
        source: metric.source,
        isInterpolated: false,
        rawValue: metric.rawValue,
        sensorStatus: "active",
        measuredAt: metric.measuredAt,
        normalizedAt: now,
      });
      processed++;
    }

    // Log ingestion job
    await ctx.db.insert("ingestionJobs", {
      sessionId: args.sessionId,
      jobType: "incremental",
      status: "completed",
      metricsProcessed: processed,
      metricsInterpolated: interpolated,
      sensorsChecked: 0,
      dropoutsDetected: errors,
      startedAt: now,
      completedAt: Date.now(),
    });

    return { processed, interpolated, errors };
  },
});

/** Check all sensors for a session and interpolate gaps */
export const runSensorCheck = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    let sensorsChecked = 0;
    let dropoutsDetected = 0;
    let metricsInterpolated = 0;

    for (const [metricType, spec] of Object.entries(METRIC_SPECS)) {
      sensorsChecked++;

      // Get latest reading for this metric
      const latest = await ctx.db
        .query("normalizedMetrics")
        .withIndex("by_sessionId_type_measured", (q: any) =>
          q.eq("sessionId", args.sessionId).eq("metricType", metricType)
        )
        .order("desc")
        .first();

      const timeSinceLastMs = latest ? now - latest.measuredAt : null;
      const status = classifySensorStatus(timeSinceLastMs, spec, 0);

      // Update sensor status record
      const existingSensor = await ctx.db
        .query("sensorStatus")
        .withIndex("by_sessionId_and_sensor", (q: any) =>
          q.eq("sessionId", args.sessionId).eq("sensorType", metricType)
        )
        .first();

      if (existingSensor) {
        const newDropouts = status === "dropout"
          ? existingSensor.consecutiveDropouts + 1
          : status === "active" ? 0 : existingSensor.consecutiveDropouts;

        await ctx.db.patch(existingSensor._id, {
          status: status === "never_connected" ? existingSensor.status : status,
          consecutiveDropouts: newDropouts,
          dropoutStartedAt: status === "dropout" ? (existingSensor.dropoutStartedAt ?? now) : undefined,
          dropoutDurationMs: status === "dropout" && existingSensor.dropoutStartedAt
            ? now - existingSensor.dropoutStartedAt : undefined,
          updatedAt: now,
        });

        if (status === "dropout") dropoutsDetected++;
      }

      // Interpolate if sensor is stale or dropout and we have history
      if ((status === "stale" || status === "dropout") && latest) {
        const recentReadings = await ctx.db
          .query("normalizedMetrics")
          .withIndex("by_sessionId_type_measured", (q: any) =>
            q.eq("sessionId", args.sessionId).eq("metricType", metricType)
          )
          .order("desc")
          .take(10);

        if (recentReadings.length >= 2) {
          const recentValues = recentReadings.map((r) => r.value).reverse();
          const interpolatedValue = interpolateEWMA(recentValues, 0.3);
          const method = status === "dropout" ? "ewma" : "last_known";

          await ctx.db.insert("normalizedMetrics", {
            sessionId: args.sessionId,
            metricType,
            value: method === "last_known" ? latest.value : interpolatedValue,
            unit: spec.unit,
            confidence: status === "dropout" ? 25 : 45,
            source: "interpolated",
            isInterpolated: true,
            interpolationMethod: method,
            rawValue: latest.value,
            sensorStatus: status,
            measuredAt: now,
            normalizedAt: now,
          });
          metricsInterpolated++;
        }
      }
    }

    // Log the sensor check job
    await ctx.db.insert("ingestionJobs", {
      sessionId: args.sessionId,
      jobType: "sensor_check",
      status: "completed",
      metricsProcessed: 0,
      metricsInterpolated,
      sensorsChecked,
      dropoutsDetected,
      startedAt: now,
      completedAt: Date.now(),
    });

    return { sensorsChecked, dropoutsDetected, metricsInterpolated };
  },
});

/** Sync normalized metrics → bioVault summary fields */
export const syncBioVaultSummary = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const day7ago = now - 7 * 86400000;
    const day30ago = now - 30 * 86400000;

    // Helper: get latest normalized value for a metric type
    async function getLatest(metricType: string): Promise<number | undefined> {
      const reading = await ctx.db
        .query("normalizedMetrics")
        .withIndex("by_sessionId_type_measured", (q: any) =>
          q.eq("sessionId", args.sessionId).eq("metricType", metricType)
        )
        .order("desc")
        .first();
      return reading?.value;
    }

    // Helper: compute rolling average
    async function getAvg(metricType: string, sincMs: number): Promise<number | undefined> {
      const readings = await ctx.db
        .query("normalizedMetrics")
        .withIndex("by_sessionId_type_measured", (q: any) =>
          q.eq("sessionId", args.sessionId).eq("metricType", metricType)
        )
        .order("desc")
        .take(100);
      const filtered = readings.filter((r) => r.measuredAt >= sincMs && r.confidence >= 30);
      if (filtered.length === 0) return undefined;
      return Math.round((filtered.reduce((s, r) => s + r.value, 0) / filtered.length) * 10) / 10;
    }

    // Helper: compute trend direction
    async function getTrend(metricType: string): Promise<string | undefined> {
      const readings = await ctx.db
        .query("normalizedMetrics")
        .withIndex("by_sessionId_type_measured", (q: any) =>
          q.eq("sessionId", args.sessionId).eq("metricType", metricType)
        )
        .order("desc")
        .take(14);
      if (readings.length < 3) return undefined;
      const vals = readings.map((r) => r.value).reverse();
      const firstHalf = vals.slice(0, Math.floor(vals.length / 2));
      const secondHalf = vals.slice(Math.floor(vals.length / 2));
      const avgFirst = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;
      const diff = ((avgSecond - avgFirst) / avgFirst) * 100;
      if (diff > 5) return "up";
      if (diff < -5) return "down";
      return "flat";
    }

    // Gather all normalized summaries
    const hrvCurrent = await getLatest("hrv");
    const hrvAvg7d = await getAvg("hrv", day7ago);
    const hrvTrend = await getTrend("hrv");
    const hrvBaseline = await getAvg("hrv", day30ago);

    const sleepScore = await getLatest("sleep_score");
    const sleepHours = await getLatest("sleep");

    // Determine bio status
    let bioStatus: string = "optimal";
    if (sleepHours != null && sleepHours < 6) bioStatus = "sleep-deprived";
    else if (hrvCurrent != null && hrvAvg7d != null && hrvCurrent < hrvAvg7d * 0.8) bioStatus = "strained";
    else if (hrvCurrent != null && hrvAvg7d != null && hrvCurrent > hrvAvg7d * 1.1) bioStatus = "recovered";

    // Upsert bioVault
    const existing = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .first();

    const updates: Record<string, any> = {
      updatedAt: now,
      bioStatusUpdatedAt: now,
    };
    if (hrvCurrent !== undefined) updates.hrvCurrent = hrvCurrent;
    if (hrvAvg7d !== undefined) updates.hrvAvg7d = hrvAvg7d;
    if (hrvTrend !== undefined) updates.hrvTrend = hrvTrend;
    if (hrvBaseline !== undefined) updates.hrvBaseline = hrvBaseline;
    if (sleepScore !== undefined) updates.sleepScore = sleepScore;
    if (sleepHours !== undefined) updates.sleepHours = sleepHours;
    if (bioStatus) updates.bioStatus = bioStatus;

    if (existing) {
      await ctx.db.patch(existing._id, updates);
    }

    return { synced: true, bioStatus, hrvCurrent, hrvAvg7d, sleepScore };
  },
});

/* ═══════════════════════════════════════════════════════════════
   QUERIES — Read normalized data for AI Brain & SomaticMirror
   ═══════════════════════════════════════════════════════════════ */

/** Get the latest normalized value for each metric type */
export const getLatestMetrics = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const results: Record<string, {
      value: number; unit: string; confidence: number;
      source: string; isInterpolated: boolean;
      sensorStatus: string | undefined; measuredAt: number;
    }> = {};

    for (const metricType of Object.keys(METRIC_SPECS)) {
      const latest = await ctx.db
        .query("normalizedMetrics")
        .withIndex("by_sessionId_type_measured", (q: any) =>
          q.eq("sessionId", args.sessionId).eq("metricType", metricType)
        )
        .order("desc")
        .first();

      if (latest) {
        results[metricType] = {
          value: latest.value,
          unit: latest.unit,
          confidence: latest.confidence,
          source: latest.source,
          isInterpolated: latest.isInterpolated,
          sensorStatus: latest.sensorStatus,
          measuredAt: latest.measuredAt,
        };
      }
    }
    return results;
  },
});

/** Get metric history for trend analysis (used by AI Brain) */
export const getMetricHistory = query({
  args: {
    sessionId: v.string(),
    metricType: v.string(),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const lookbackMs = (args.days ?? 7) * 86400000;
    const cutoff = Date.now() - lookbackMs;

    const readings = await ctx.db
      .query("normalizedMetrics")
      .withIndex("by_sessionId_type_measured", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("metricType", args.metricType)
      )
      .order("desc")
      .take(200);

    return readings
      .filter((r) => r.measuredAt >= cutoff)
      .reverse()
      .map((r) => ({
        value: r.value,
        confidence: r.confidence,
        isInterpolated: r.isInterpolated,
        source: r.source,
        measuredAt: r.measuredAt,
      }));
  },
});

/** Get all sensor statuses for a session (SomaticMirror uses this) */
export const getSensorStatuses = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sensorStatus")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});

/** Get data quality summary — overall confidence across all sensors */
export const getDataQualitySummary = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const sensors = await ctx.db
      .query("sensorStatus")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .collect();

    const activeSensors = sensors.filter((s) => s.status === "active").length;
    const staleSensors = sensors.filter((s) => s.status === "stale").length;
    const dropoutSensors = sensors.filter((s) => s.status === "dropout").length;
    const totalSensors = sensors.length;

    // Get recent metrics for average confidence
    const recentMetrics = await ctx.db
      .query("normalizedMetrics")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(50);

    const avgConfidence = recentMetrics.length > 0
      ? Math.round(recentMetrics.reduce((s, m) => s + m.confidence, 0) / recentMetrics.length)
      : 0;

    const interpolatedPct = recentMetrics.length > 0
      ? Math.round((recentMetrics.filter((m) => m.isInterpolated).length / recentMetrics.length) * 100)
      : 0;

    return {
      totalSensors,
      activeSensors,
      staleSensors,
      dropoutSensors,
      avgConfidence,
      interpolatedPct,
      overallHealth: dropoutSensors === 0 && staleSensors <= 1 ? "healthy"
        : dropoutSensors <= 1 ? "degraded" : "impaired",
    };
  },
});

/** Get recent ingestion job history */
export const getIngestionHistory = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("ingestionJobs")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(10);
  },
});
