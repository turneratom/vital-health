import { query } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   BIO-DASHBOARD ENGINE
   
   Powers the three-ring Home screen:
   1. Protocol Adherence — % of daily protocols completed
   2. System Resilience — composite from HRV, sleep, recovery
   3. Inventory Coverage — % of supplements with ≥7 days supply
   
   Also computes the dynamic "Quick Action" based on the most
   critical need across all subsystems.
   ═══════════════════════════════════════════════════════════════ */

export const getDashboardRings = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayCutoff = todayStart.getTime();

    /* ── 1. PROTOCOL ADHERENCE ── */
    const protocolLogs = await ctx.db
      .query("protocolLogs")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", todayCutoff)
      )
      .collect();

    const dailyCompletions = await ctx.db
      .query("daily_completions")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("dateKey", new Date().toISOString().slice(0, 10))
      )
      .collect();

    const journalEvents = await ctx.db
      .query("journalEvents")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", todayCutoff)
      )
      .collect();

    const foodLogs = await ctx.db
      .query("foodLogs")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .collect();
    const todayFood = foodLogs.filter((l: any) => l.loggedAt >= todayCutoff);

    const activityLogs = await ctx.db
      .query("activityLogs")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .collect();
    const todayActivity = activityLogs.filter((l: any) => l.loggedAt >= todayCutoff);

    const supplementEvents = journalEvents.filter(
      (e: any) =>
        e.eventType === "supplement_log" ||
        e.eventType === "meds" ||
        e.eventType === "supplements" ||
        e.eventKey?.includes("supplement") ||
        e.eventKey?.includes("protocol")
    ).length;

    const completedProtocols = protocolLogs.length + dailyCompletions.filter((c: any) => c.completed).length;
    const totalProtocolTarget = 12; // baseline daily target
    const protocolsDone = completedProtocols + supplementEvents + Math.min(todayFood.length, 3) + Math.min(todayActivity.length, 2);
    const adherencePercent = Math.min(100, Math.round((protocolsDone / totalProtocolTarget) * 100));

    /* ── 2. SYSTEM RESILIENCE (HRV + Sleep + Recovery) ── */
    const hrvReadings = await ctx.db
      .query("hrvReadings")
      .withIndex("by_sessionId_and_measuredAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("measuredAt", now - 7 * dayMs)
      )
      .collect();

    const latestHrv = hrvReadings.length > 0
      ? hrvReadings.sort((a: any, b: any) => b.measuredAt - a.measuredAt)[0].value
      : 0;
    const avgHrv7d = hrvReadings.length > 0
      ? hrvReadings.reduce((s: number, r: any) => s + r.value, 0) / hrvReadings.length
      : 0;

    const sleepLogs = await ctx.db
      .query("sleepLogs")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .collect();
    const recentSleep = sleepLogs
      .filter((s: any) => now - s.loggedAt < 3 * dayMs)
      .sort((a: any, b: any) => b.loggedAt - a.loggedAt);
    const latestSleep = recentSleep[0];

    const workoutLogs = await ctx.db
      .query("workoutLogs")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", now - 3 * dayMs)
      )
      .collect();
    const lastWorkoutTime = workoutLogs.length > 0
      ? Math.max(...workoutLogs.map((w: any) => w.loggedAt))
      : 0;
    const hoursSinceWorkout = lastWorkoutTime > 0 ? (now - lastWorkoutTime) / (1000 * 60 * 60) : 48;

    // HRV score (0-100)
    const hrvScore = latestHrv > 0 ? Math.min(100, Math.round((latestHrv / 80) * 100)) : 50;
    // Sleep score (0-100)
    const sleepScore = latestSleep ? latestSleep.sleepScore : 50;
    // Recovery score based on workout timing
    const recoveryScore = hoursSinceWorkout > 24 ? 85 : hoursSinceWorkout > 12 ? 70 : 55;

    const resiliencePercent = Math.round(hrvScore * 0.4 + sleepScore * 0.35 + recoveryScore * 0.25);
    const resilienceStatus = resiliencePercent >= 80 ? "optimal"
      : resiliencePercent >= 60 ? "nominal"
      : resiliencePercent >= 40 ? "stressed"
      : "critical";

    /* ── 3. INVENTORY COVERAGE ── */
    const inventoryItems = await ctx.db
      .query("inventory")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .collect();

    const activeItems = inventoryItems.filter((i: any) => i.status === "active" && i.dailyUsageUnits > 0);
    const coveredItems = activeItems.filter((i: any) => {
      const daysRemaining = Math.floor(i.currentQuantity / i.dailyUsageUnits);
      return daysRemaining >= 7;
    });
    const inventoryCoveragePercent = activeItems.length > 0
      ? Math.round((coveredItems.length / activeItems.length) * 100)
      : 100; // no items = fully covered

    // Low supply items for quick action
    const lowSupplyItems = activeItems
      .map((i: any) => ({
        id: i._id,
        name: i.name,
        icon: i.icon,
        daysRemaining: Math.floor(i.currentQuantity / i.dailyUsageUnits),
        reorderUrl: i.reorderUrl,
      }))
      .filter((i: any) => i.daysRemaining <= 7)
      .sort((a: any, b: any) => a.daysRemaining - b.daysRemaining);

    /* ── 4. SOMATIC SIGNALS for Quick Action ── */
    const recentSomatic = await ctx.db
      .query("bodyMapEntries")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(10);
    const last24hSomatic = recentSomatic.filter((c: any) => now - c.loggedAt < dayMs);
    const highTensionRegion = last24hSomatic.find((c) => (c.severity || 0) >= 6);

    /* ── 5. DRIFT EVENTS for Quick Action ── */
    const activeDrifts = await ctx.db
      .query("driftEvents")
      .withIndex("by_sessionId_and_status", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("status", "active")
      )
      .collect();

    /* ── 6. COMPUTE QUICK ACTION ── */
    type QuickAction = {
      type: string;
      label: string;
      sublabel: string;
      icon: string;
      accentColor: string;
      priority: number;
      metadata?: Record<string, any>;
    };

    const actions: QuickAction[] = [];

    // Critical drift → Recalibrate
    if (activeDrifts.length > 0) {
      const topDrift = activeDrifts[0];
      actions.push({
        type: "recalibrate",
        label: "Recalibrate Protocol",
        sublabel: `${topDrift.metric} drifting ${Math.round(topDrift.avgDeviation)}%`,
        icon: "⚡",
        accentColor: "#FF6B6B",
        priority: 100,
        metadata: { driftId: topDrift._id, metric: topDrift.metric },
      });
    }

    // Low inventory → Order
    if (lowSupplyItems.length > 0) {
      const topItem = lowSupplyItems[0];
      actions.push({
        type: "order",
        label: `Order ${topItem.name}`,
        sublabel: topItem.daysRemaining <= 0 ? "Depleted — reorder now" : `${topItem.daysRemaining}d supply left`,
        icon: "📦",
        accentColor: "#E8976C",
        priority: topItem.daysRemaining <= 0 ? 95 : 70,
        metadata: { itemId: topItem.id, name: topItem.name, reorderUrl: topItem.reorderUrl },
      });
    }

    // High tension → Log in body map
    if (highTensionRegion) {
      const region = highTensionRegion.region || "body";
      actions.push({
        type: "log_tension",
        label: `Log ${region.charAt(0).toUpperCase() + region.slice(1)} Tension`,
        sublabel: "Track somatic pattern for AI correlation",
        icon: "🫁",
        accentColor: "#3B82F6",
        priority: 60,
        metadata: { region },
      });
    }

    // Low adherence → Complete protocol
    if (adherencePercent < 50) {
      actions.push({
        type: "complete_protocol",
        label: "Complete Daily Protocol",
        sublabel: `${protocolsDone}/${totalProtocolTarget} done today`,
        icon: "✅",
        accentColor: "#00FFCC",
        priority: 55,
      });
    }

    // Low resilience → Recovery
    if (resiliencePercent < 50) {
      actions.push({
        type: "recovery",
        label: "Start Recovery Protocol",
        sublabel: `System resilience at ${resiliencePercent}%`,
        icon: "🧘",
        accentColor: "#00DC82",
        priority: 50,
      });
    }

    // Default: Log check-in
    actions.push({
      type: "check_in",
      label: "Quick Check-In",
      sublabel: "Log how you feel right now",
      icon: "💬",
      accentColor: "#60A5FA",
      priority: 10,
    });

    actions.sort((a, b) => b.priority - a.priority);

    return {
      adherence: {
        percent: adherencePercent,
        completed: protocolsDone,
        total: totalProtocolTarget,
      },
      resilience: {
        percent: resiliencePercent,
        status: resilienceStatus,
        hrv: latestHrv,
        hrvAvg7d: Math.round(avgHrv7d),
        sleepScore: latestSleep?.sleepScore ?? 0,
        sleepHours: latestSleep?.totalHours ?? 0,
        recoveryScore,
      },
      inventory: {
        percent: inventoryCoveragePercent,
        totalTracked: activeItems.length,
        covered: coveredItems.length,
        lowSupply: lowSupplyItems.slice(0, 3),
      },
      quickAction: actions[0],
      allActions: actions.slice(0, 4),
      activeDriftCount: activeDrifts.length,
      somaticSignals: last24hSomatic.length,
      timestamp: now,
    };
  },
});
