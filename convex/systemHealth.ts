import { query } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════════
   SYSTEM HEALTH — Account-level diagnostics & data integrity report
   
   Aggregates all user data sources into a single "System Health"
   report showing:
   • Data completeness across all modules
   • Sensor connectivity status
   • Storage usage & encryption status
   • Protocol adherence trends
   • Biomarker coverage & freshness
   • Overall account health grade (A–F)
   ═══════════════════════════════════════════════════════════════════ */

export const getSystemHealthReport = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cutoff7d = now - 7 * 24 * 60 * 60 * 1000;
    const cutoff30d = now - 30 * 24 * 60 * 60 * 1000;
    const cutoff90d = now - 90 * 24 * 60 * 60 * 1000;

    // ── 1. Bio-Vault data completeness ──
    const vault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    const biomarkerFields = [
      "vitaminD", "testosteroneTotal", "testosteroneFree",
      "ferritin", "crp", "hba1c",
    ];
    const geneticFields = ["mthfrVariant", "apoe4", "caffeineSensitivity"];
    const biometricFields = [
      "sleepScore", "sleepHours", "hrvCurrent", "hrvAvg7d",
    ];

    let biomarkersFilled = 0;
    let geneticsFilled = 0;
    let biometricsFilled = 0;

    if (vault) {
      for (const f of biomarkerFields) {
        if ((vault as any)[f] != null) biomarkersFilled++;
      }
      for (const f of geneticFields) {
        if ((vault as any)[f] === true) geneticsFilled++;
      }
      for (const f of biometricFields) {
        if ((vault as any)[f] != null) biometricsFilled++;
      }
    }

    const biomarkerCoverage = Math.round((biomarkersFilled / biomarkerFields.length) * 100);
    const geneticCoverage = Math.round((geneticsFilled / geneticFields.length) * 100);
    const biometricCoverage = Math.round((biometricsFilled / biometricFields.length) * 100);

    // ── 2. Sleep data freshness ──
    const sleepLogs = await ctx.db
      .query("sleepLogs")
      .withIndex("by_sessionId_and_date", (q: any) =>
        q.eq("sessionId", args.sessionId)
      )
      .collect();
    const recentSleep = sleepLogs.filter((s) => s.loggedAt >= cutoff7d);
    const sleepStreak = recentSleep.length;
    const lastSleepLog = sleepLogs.length > 0
      ? Math.max(...sleepLogs.map((s) => s.loggedAt))
      : null;

    // ── 3. HRV data freshness ──
    const hrvReadings = await ctx.db
      .query("hrvReadings")
      .withIndex("by_sessionId_and_measuredAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("measuredAt", cutoff30d)
      )
      .collect();
    const recentHrv = hrvReadings.filter((r) => r.measuredAt >= cutoff7d);
    const lastHrvReading = hrvReadings.length > 0
      ? Math.max(...hrvReadings.map((r) => r.measuredAt))
      : null;

    // ── 4. Protocol adherence ──
    const adherenceRecords = await ctx.db
      .query("adherenceScores")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const recentAdherence = adherenceRecords.filter((a) => a.updatedAt >= cutoff7d);
    const avgAdherence = recentAdherence.length > 0
      ? Math.round(recentAdherence.reduce((s, a) => s + a.adherencePercent, 0) / recentAdherence.length)
      : null;

    const protocolLogs = await ctx.db
      .query("protocolLogs")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", cutoff30d)
      )
      .collect();
    const totalProtocolsLogged = protocolLogs.length;

    // ── 5. Vault files / storage ──
    const vaultFiles = await ctx.db
      .query("vaultFiles")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const totalFiles = vaultFiles.length;
    const totalStorageBytes = vaultFiles.reduce((s, f) => s + (f.fileSize || 0), 0);
    const encryptedFiles = vaultFiles.filter((f) => f.encryptionStatus === "AES-256-GCM").length;

    // ── 6. Food logs ──
    const foodLogsAll = await ctx.db
      .query("foodLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const foodLogs = foodLogsAll.filter((l) => l.loggedAt >= cutoff7d);

    // ── 7. Activity logs ──
    const activityLogsAll = await ctx.db
      .query("activityLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const activityLogs = activityLogsAll.filter((l) => l.loggedAt >= cutoff7d);

    // ── 8. Lab results ──
    const labResults = await ctx.db
      .query("labResults")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const lastLabUpload = labResults.length > 0
      ? Math.max(...labResults.map((l) => l.loggedAt))
      : null;

    // ── 9. Compute data modules status ──
    const modules = [
      {
        id: "sleep",
        label: "Sleep Tracking",
        icon: "🌙",
        status: recentSleep.length >= 5 ? "active" : recentSleep.length > 0 ? "partial" : "inactive",
        detail: recentSleep.length > 0 ? `${recentSleep.length}/7 nights logged` : "No sleep data this week",
        lastSync: lastSleepLog,
        coverage: Math.round((recentSleep.length / 7) * 100),
      },
      {
        id: "hrv",
        label: "HRV Monitoring",
        icon: "💓",
        status: recentHrv.length >= 3 ? "active" : recentHrv.length > 0 ? "partial" : "inactive",
        detail: recentHrv.length > 0 ? `${recentHrv.length} readings this week` : "No HRV data this week",
        lastSync: lastHrvReading,
        coverage: Math.min(100, Math.round((recentHrv.length / 7) * 100)),
      },
      {
        id: "nutrition",
        label: "Nutrition Logging",
        icon: "🍽️",
        status: foodLogs.length >= 14 ? "active" : foodLogs.length > 0 ? "partial" : "inactive",
        detail: foodLogs.length > 0 ? `${foodLogs.length} meals logged this week` : "No meals logged this week",
        lastSync: foodLogs.length > 0 ? Math.max(...foodLogs.map((f) => f.loggedAt)) : null,
        coverage: Math.min(100, Math.round((foodLogs.length / 21) * 100)),
      },
      {
        id: "activity",
        label: "Activity Tracking",
        icon: "🏃",
        status: activityLogs.length >= 3 ? "active" : activityLogs.length > 0 ? "partial" : "inactive",
        detail: activityLogs.length > 0 ? `${activityLogs.length} sessions this week` : "No activity logged this week",
        lastSync: activityLogs.length > 0 ? Math.max(...activityLogs.map((a) => a.loggedAt)) : null,
        coverage: Math.min(100, Math.round((activityLogs.length / 5) * 100)),
      },
      {
        id: "bloodwork",
        label: "Blood Panels",
        icon: "🩸",
        status: biomarkerCoverage >= 80 ? "active" : biomarkerCoverage > 0 ? "partial" : "inactive",
        detail: biomarkerCoverage > 0 ? `${biomarkersFilled}/${biomarkerFields.length} markers tracked` : "No blood work uploaded",
        lastSync: lastLabUpload,
        coverage: biomarkerCoverage,
      },
      {
        id: "genetics",
        label: "Genetic Profile",
        icon: "🧬",
        status: geneticCoverage > 0 ? "active" : "inactive",
        detail: geneticCoverage > 0 ? `${geneticsFilled} variant${geneticsFilled !== 1 ? "s" : ""} detected` : "No genetic data uploaded",
        lastSync: vault?.updatedAt ?? null,
        coverage: geneticCoverage,
      },
      {
        id: "protocols",
        label: "Protocol Adherence",
        icon: "📋",
        status: avgAdherence != null && avgAdherence >= 70 ? "active" : avgAdherence != null ? "partial" : "inactive",
        detail: avgAdherence != null ? `${avgAdherence}% adherence this week` : "No protocol data",
        lastSync: recentAdherence.length > 0 ? Math.max(...recentAdherence.map((a) => a.updatedAt)) : null,
        coverage: avgAdherence ?? 0,
      },
    ];

    // ── 10. Overall account health grade ──
    const activeModules = modules.filter((m) => m.status === "active").length;
    const partialModules = modules.filter((m) => m.status === "partial").length;
    const totalModules = modules.length;
    const healthScore = Math.round(
      ((activeModules * 100 + partialModules * 50) / (totalModules * 100)) * 100
    );

    let grade: string;
    let gradeColor: string;
    if (healthScore >= 85) { grade = "A"; gradeColor = "#00FFCC"; }
    else if (healthScore >= 70) { grade = "B"; gradeColor = "#00DC82"; }
    else if (healthScore >= 50) { grade = "C"; gradeColor = "#F59E0B"; }
    else if (healthScore >= 30) { grade = "D"; gradeColor = "#E8976C"; }
    else { grade = "F"; gradeColor = "#FF6B6B"; }

    // ── 11. Data freshness assessment ──
    const allSyncTimes = modules
      .map((m) => m.lastSync)
      .filter((t): t is number => t !== null);
    const oldestSync = allSyncTimes.length > 0 ? Math.min(...allSyncTimes) : null;
    const newestSync = allSyncTimes.length > 0 ? Math.max(...allSyncTimes) : null;

    return {
      grade,
      gradeColor,
      healthScore,
      modules,
      summary: {
        activeModules,
        partialModules,
        inactiveModules: totalModules - activeModules - partialModules,
        totalModules,
      },
      biomarkers: {
        coverage: biomarkerCoverage,
        filled: biomarkersFilled,
        total: biomarkerFields.length,
      },
      genetics: {
        coverage: geneticCoverage,
        filled: geneticsFilled,
        total: geneticFields.length,
      },
      biometrics: {
        coverage: biometricCoverage,
        filled: biometricsFilled,
        total: biometricFields.length,
      },
      storage: {
        totalFiles,
        totalBytes: totalStorageBytes,
        encryptedFiles,
        encryptionRate: totalFiles > 0 ? Math.round((encryptedFiles / totalFiles) * 100) : 100,
      },
      adherence: {
        avg7d: avgAdherence,
        totalProtocolsLogged,
      },
      freshness: {
        oldestSync,
        newestSync,
        sleepStreak,
      },
      generatedAt: now,
    };
  },
});
