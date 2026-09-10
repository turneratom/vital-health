import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Better Auth tables (user, session, account, verification) are managed
  // automatically by the @convex-dev/better-auth component.

  // Application tables
  commitments: defineTable({
    sessionId: v.string(),
    committedAt: v.number(),
    durationDays: v.number(),
    foodPlan: v.string(),
    activityPlan: v.string(),
    recoveryPlan: v.string(),
  })
    .index("by_sessionId", ["sessionId"]),

  presence: defineTable({
    sessionId: v.string(),
    x: v.number(),
    y: v.number(),
    ghostMode: v.boolean(),
    color: v.string(),
    lastSeen: v.number(),
    activeProtocol: v.optional(v.string()),
    activeCategory: v.optional(v.string()),
    focusMode: v.optional(v.boolean()),
    heartRate: v.optional(v.number()),
    hrv: v.optional(v.number()),
    isDeepWork: v.optional(v.boolean()),
    auraState: v.optional(v.string()),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_lastSeen", ["lastSeen"]),

  foodLogs: defineTable({
    sessionId: v.string(),
    name: v.string(),
    calories: v.number(),
    protein: v.number(),
    carbs: v.number(),
    fat: v.number(),
    fiber: v.optional(v.number()),
    fuelScore: v.optional(v.number()),
    longevityScore: v.optional(v.number()),
    molecularInsight: v.optional(v.string()),
    microTotals: v.optional(v.string()),
    /** pending | analyzed | manual — pending means text/photo stored, macros not claimed */
    analysisStatus: v.optional(v.string()),
    notes: v.optional(v.string()),
    photoStorageId: v.optional(v.string()),
    source: v.string(),
    loggedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_loggedAt", ["loggedAt"]),

  activityLogs: defineTable({
    sessionId: v.string(),
    name: v.string(),
    duration: v.number(),
    calories: v.number(),
    distance: v.optional(v.number()),
    type: v.string(),
    source: v.string(),
    loggedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_loggedAt", ["loggedAt"]),

  peers: defineTable({
    name: v.string(),
    avatar: v.string(),
    handle: v.string(),
    recovery: v.number(),
    strain: v.number(),
    hrv: v.number(),
    tier: v.string(),
    status: v.string(),
    lastActive: v.string(),
    nudgedAt: v.optional(v.number()),
  }),

  leaderboardUsers: defineTable({
    name: v.string(),
    handle: v.string(),
    avatar: v.string(),
    adherence: v.number(),
    recovery: v.number(),
    strain: v.number(),
    hrv: v.number(),
    tier: v.string(),
    isCurrentUser: v.boolean(),
    lastUpdated: v.number(),
  })
    .index("by_adherence", ["adherence"]),

  eliteScores: defineTable({
    sessionId: v.string(),
    score: v.number(),
    fuelingPoints: v.number(),
    movementPoints: v.number(),
    hrvPoints: v.number(),
    basePoints: v.number(),
    fuelingCount24h: v.number(),
    movementLogged: v.boolean(),
    currentHrv: v.number(),
    hrvAvg7d: v.number(),
    calculatedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_calculatedAt", ["calculatedAt"]),

  // ── Biological Vault — expanded with sleep, HRV, caffeine, IGF-1, fasting glucose ──
  bioVault: defineTable({
    sessionId: v.string(),
    vitaminD: v.optional(v.number()),
    testosteroneFree: v.optional(v.number()),
    testosteroneTotal: v.optional(v.number()),
    ferritin: v.optional(v.number()),
    crp: v.optional(v.number()),
    hba1c: v.optional(v.number()),
    igf1: v.optional(v.number()),
    fastingGlucose: v.optional(v.number()),
    mthfrVariant: v.boolean(),
    apoe4: v.boolean(),
    caffeineSensitivity: v.boolean(),
    preferredProteins: v.string(),
    dietaryRestrictions: v.string(),
    sleepScore: v.optional(v.number()),
    sleepHours: v.optional(v.number()),
    sleepDeepPct: v.optional(v.number()),
    sleepRemPct: v.optional(v.number()),
    sleepLatencyMin: v.optional(v.number()),
    sleepEfficiency: v.optional(v.number()),
    hrvCurrent: v.optional(v.number()),
    hrvAvg7d: v.optional(v.number()),
    hrvTrend: v.optional(v.string()),
    hrvBaseline: v.optional(v.number()),
    caffeineTodayMg: v.optional(v.number()),
    caffeineLastIntakeAt: v.optional(v.number()),
    caffeineDailyLimitMg: v.optional(v.number()),
    bioStatus: v.optional(v.string()),
    bioStatusUpdatedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"]),

  sleepLogs: defineTable({
    sessionId: v.string(),
    date: v.string(),
    sleepScore: v.number(),
    totalHours: v.number(),
    deepHours: v.number(),
    remHours: v.number(),
    lightHours: v.number(),
    awakeHours: v.number(),
    efficiency: v.number(),
    latencyMin: v.number(),
    heartRateAvg: v.optional(v.number()),
    heartRateMin: v.optional(v.number()),
    respiratoryRate: v.optional(v.number()),
    source: v.string(),
    bedtimeAt: v.number(),
    wakeAt: v.number(),
    loggedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_date", ["date"])
    .index("by_sessionId_and_date", ["sessionId", "date"]),

  hrvReadings: defineTable({
    sessionId: v.string(),
    value: v.number(),
    context: v.string(),
    heartRate: v.optional(v.number()),
    source: v.string(),
    measuredAt: v.number(),
    loggedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_measuredAt", ["measuredAt"])
    .index("by_sessionId_and_measuredAt", ["sessionId", "measuredAt"]),

  caffeineLogs: defineTable({
    sessionId: v.string(),
    source: v.string(),
    amountMg: v.number(),
    name: v.optional(v.string()),
    halfLifeHours: v.optional(v.number()),
    consumedAt: v.number(),
    loggedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_consumedAt", ["consumedAt"])
    .index("by_sessionId_and_consumedAt", ["sessionId", "consumedAt"]),

  protocolLogs: defineTable({
    sessionId: v.string(),
    protocolId: v.string(),
    protocolName: v.string(),
    category: v.string(),
    loggedAt: v.number(),
    status: v.optional(v.string()),
    pivotedFrom: v.optional(v.string()),
    rescheduledTo: v.optional(v.string()),
    type: v.optional(v.string()),
    message: v.optional(v.string()),
    timestamp: v.optional(v.number()),
    systemId: v.optional(v.string()),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_loggedAt", ["loggedAt"])
    .index("by_sessionId_and_loggedAt", ["sessionId", "loggedAt"])
    .index("by_timestamp", ["timestamp"]),

  journalEvents: defineTable({
    sessionId: v.string(),
    eventType: v.string(),
    eventKey: v.string(),
    value: v.string(),
    numericValue: v.optional(v.number()),
    loggedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_loggedAt", ["loggedAt"])
    .index("by_sessionId_and_loggedAt", ["sessionId", "loggedAt"]),

  integrationConnections: defineTable({
    sessionId: v.string(),
    provider: v.string(),
    connected: v.boolean(),
    lastSynced: v.optional(v.number()),
    biometricPoints: v.optional(v.number()),
    syncStatus: v.string(),
    connectedAt: v.optional(v.number()),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_sessionId_and_provider", ["sessionId", "provider"]),

  userPreferences: defineTable({
    sessionId: v.string(),
    userStyle: v.string(),
    membershipTier: v.optional(v.string()),
    missionProfile: v.optional(v.string()),
    squadId: v.optional(v.id("squads")),
    displayName: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_squadId", ["squadId"]),

  userVitals: defineTable({
    sessionId: v.string(),
    age: v.number(),
    gender: v.string(),
    weight: v.number(),
    goalWeight: v.optional(v.number()),
    unit: v.string(),
    updatedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"]),

  workoutLogs: defineTable({
    sessionId: v.string(),
    workoutName: v.string(),
    muscleGroups: v.array(v.string()),
    duration: v.number(),
    intensity: v.string(),
    loggedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_loggedAt", ["loggedAt"])
    .index("by_sessionId_and_loggedAt", ["sessionId", "loggedAt"]),

  plannedProtocols: defineTable({
    sessionId: v.string(),
    dateKey: v.string(),
    type: v.string(),
    name: v.string(),
    time: v.string(),
    category: v.optional(v.string()),
    calories: v.optional(v.number()),
    protein: v.optional(v.number()),
    carbs: v.optional(v.number()),
    fat: v.optional(v.number()),
    duration: v.optional(v.number()),
    activityType: v.optional(v.string()),
    protocolId: v.optional(v.string()),
    items: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
    status: v.optional(v.string()),
    pivotedFrom: v.optional(v.string()),
    originalDateKey: v.optional(v.string()),
    rescheduledTo: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_dateKey", ["dateKey"])
    .index("by_sessionId_and_dateKey", ["sessionId", "dateKey"]),

  dailyIntake: defineTable({
    sessionId: v.string(),
    dateKey: v.string(),
    protocol: v.string(),
    answer: v.string(),
    summary: v.string(),
    updatedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_sessionId_and_dateKey", ["sessionId", "dateKey"]),

  analyticsEvents: defineTable({
    sessionId: v.string(),
    eventType: v.string(),
    eventKey: v.string(),
    metadata: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_eventType", ["eventType"])
    .index("by_sessionId_and_eventType", ["sessionId", "eventType"]),

  voiceJournalEntries: defineTable({
    sessionId: v.string(),
    category: v.string(),
    summary: v.string(),
    originalText: v.string(),
    confidence: v.number(),
    loggedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_sessionId_and_loggedAt", ["sessionId", "loggedAt"]),

  devicePermissions: defineTable({
    sessionId: v.string(),
    provider: v.string(),
    permission: v.string(),
    enabled: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_sessionId_and_provider", ["sessionId", "provider"]),

  protocols: defineTable({
    sessionId: v.string(),
    name: v.string(),
    category: v.string(),
    icon: v.string(),
    description: v.string(),
    timeOfDay: v.string(),
    isActive: v.boolean(),
    sortOrder: v.number(),
    source: v.string(),
    frictionLevel: v.optional(v.number()),
    frequency: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_sessionId_and_category", ["sessionId", "category"]),

  protocolCompletions: defineTable({
    sessionId: v.string(),
    dateKey: v.string(),
    protocolItemId: v.string(),
    completed: v.boolean(),
    completedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_sessionId_and_dateKey", ["sessionId", "dateKey"]),

  dailyDirectives: defineTable({
    sessionId: v.string(),
    dateKey: v.string(),
    directives: v.string(),
    sleepHours: v.optional(v.number()),
    sleepScore: v.optional(v.number()),
    recovery: v.optional(v.number()),
    hrv: v.optional(v.number()),
    generatedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_sessionId_and_dateKey", ["sessionId", "dateKey"]),

  vaultFiles: defineTable({
    sessionId: v.string(),
    fileName: v.string(),
    fileType: v.string(),
    category: v.string(),
    fileSize: v.number(),
    storageId: v.optional(v.string()),
    encryptionStatus: v.string(),
    uploadedAt: v.number(),
    notes: v.optional(v.string()),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_category", ["category"]),

  daily_completions: defineTable({
    sessionId: v.string(),
    dateKey: v.string(),
    protocolId: v.string(),
    protocolName: v.string(),
    category: v.string(),
    completed: v.boolean(),
    completedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_sessionId_and_dateKey", ["sessionId", "dateKey"])
    .index("by_sessionId_and_protocolId", ["sessionId", "protocolId"]),

  adherenceScores: defineTable({
    sessionId: v.string(),
    dateKey: v.string(),
    totalProtocols: v.number(),
    completedProtocols: v.number(),
    adherencePercent: v.number(),
    updatedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_sessionId_and_dateKey", ["sessionId", "dateKey"]),

  protocolSessions: defineTable({
    sessionId: v.string(),
    protocolType: v.string(),
    protocolName: v.string(),
    status: v.string(),
    durationSeconds: v.number(),
    elapsedSeconds: v.number(),
    breathPhase: v.optional(v.string()),
    breathCycle: v.optional(v.number()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_status", ["status"]),

  inductionProfiles: defineTable({
    sessionId: v.string(),
    northStar: v.string(),
    sleepGoalHours: v.number(),
    primarySupplements: v.array(v.string()),
    targetWeight: v.optional(v.number()),
    weightUnit: v.string(),
    accessCode: v.optional(v.string()),
    completedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"]),

  squadMissions: defineTable({
    title: v.string(),
    description: v.string(),
    icon: v.string(),
    type: v.string(),
    durationMinutes: v.number(),
    maxParticipants: v.number(),
    createdBy: v.string(),
    status: v.string(),
    startedAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_createdBy", ["createdBy"]),

  missionParticipants: defineTable({
    missionId: v.id("squadMissions"),
    sessionId: v.string(),
    joinedAt: v.number(),
    displayName: v.string(),
    color: v.string(),
  })
    .index("by_missionId", ["missionId"])
    .index("by_sessionId", ["sessionId"])
    .index("by_missionId_and_sessionId", ["missionId", "sessionId"]),

  labResults: defineTable({
    sessionId: v.string(),
    marker: v.string(),
    value: v.number(),
    unit: v.string(),
    source: v.string(),
    notes: v.optional(v.string()),
    testedAt: v.number(),
    loggedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_sessionId_and_marker", ["sessionId", "marker"])
    .index("by_testedAt", ["testedAt"]),

  habitVerifications: defineTable({
    sessionId: v.string(),
    protocolId: v.string(),
    protocolName: v.string(),
    category: v.string(),
    verificationType: v.string(),
    photoStorageId: v.optional(v.string()),
    message: v.string(),
    verifiedAt: v.number(),
    dateKey: v.string(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_dateKey", ["dateKey"])
    .index("by_sessionId_and_dateKey", ["sessionId", "dateKey"]),

  squadPings: defineTable({
    fromSessionId: v.string(),
    toSessionId: v.optional(v.string()),
    pingType: v.string(),
    message: v.string(),
    emoji: v.string(),
    sentAt: v.number(),
    expiresAt: v.number(),
    dismissed: v.boolean(),
  })
    .index("by_toSessionId", ["toSessionId"])
    .index("by_sentAt", ["sentAt"]),

  syncJobs: defineTable({
    sessionId: v.string(),
    provider: v.string(),
    dataType: v.string(),
    status: v.string(),
    recordsProcessed: v.number(),
    recordsFailed: v.number(),
    errorMessage: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    metadata: v.optional(v.string()),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_sessionId_and_provider", ["sessionId", "provider"])
    .index("by_status", ["status"]),

  weeklyBadges: defineTable({
    sessionId: v.string(),
    weekKey: v.string(),
    badge: v.string(),
    avgScore: v.number(),
    daysAboveRedline: v.number(),
    totalDays: v.number(),
    squadReadiness: v.number(),
    awardedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_weekKey", ["weekKey"])
    .index("by_sessionId_and_weekKey", ["sessionId", "weekKey"]),

  recoveryObjectives: defineTable({
    sessionId: v.string(),
    weekKey: v.string(),
    objective: v.string(),
    category: v.string(),
    status: v.string(),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_sessionId_and_weekKey", ["sessionId", "weekKey"])
    .index("by_status", ["status"]),

  squads: defineTable({
    name: v.string(),
    licenseTier: v.string(),
    leadUserId: v.string(),
    maxSeats: v.number(),
    inviteCode: v.string(),
    createdAt: v.number(),
  })
    .index("by_leadUserId", ["leadUserId"])
    .index("by_inviteCode", ["inviteCode"]),

  squadAlerts: defineTable({
    sessionId: v.string(),
    peerName: v.string(),
    peerAvatar: v.string(),
    metric: v.string(),
    currentValue: v.number(),
    baselineValue: v.number(),
    thresholdPercent: v.number(),
    direction: v.string(),
    severity: v.string(),
    status: v.string(),
    triggeredAt: v.number(),
    resolvedAt: v.optional(v.number()),
    notifiedSquad: v.boolean(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_status", ["status"])
    .index("by_triggeredAt", ["triggeredAt"]),

  squadReadinessState: defineTable({
    calculatedAt: v.number(),
    totalPeers: v.number(),
    belowThresholdCount: v.number(),
    belowThresholdPercent: v.number(),
    averageReadiness: v.number(),
    isRedlinePulse: v.boolean(),
    recommendedMode: v.string(),
    peerBreakdown: v.string(),
    triggeredBy: v.optional(v.string()),
  })
    .index("by_calculatedAt", ["calculatedAt"]),

  squadModeVotes: defineTable({
    sessionId: v.string(),
    vote: v.string(),
    votedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_votedAt", ["votedAt"]),

  streakData: defineTable({
    sessionId: v.string(),
    currentStreak: v.number(),
    longestStreak: v.number(),
    lastCompletedDate: v.string(),
    eliteBadgeUnlocked: v.boolean(),
    eliteBadgeUnlockedAt: v.optional(v.number()),
    totalQualifiedDays: v.number(),
    calculatedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"]),

  physicalBaseline: defineTable({
    sessionId: v.string(),
    sex: v.string(),
    dateOfBirth: v.string(),
    heightCm: v.number(),
    weightKg: v.number(),
    computedBaselines: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"]),

  normalizedMetrics: defineTable({
    sessionId: v.string(),
    metricType: v.string(),
    value: v.number(),
    unit: v.string(),
    confidence: v.number(),
    source: v.string(),
    isInterpolated: v.boolean(),
    interpolationMethod: v.optional(v.string()),
    rawValue: v.optional(v.number()),
    sensorStatus: v.optional(v.string()),
    measuredAt: v.number(),
    normalizedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_sessionId_and_type", ["sessionId", "metricType"])
    .index("by_sessionId_type_measured", ["sessionId", "metricType", "measuredAt"])
    .index("by_normalizedAt", ["normalizedAt"]),

  sensorStatus: defineTable({
    sessionId: v.string(),
    sensorType: v.string(),
    provider: v.string(),
    status: v.string(),
    lastDataAt: v.optional(v.number()),
    dropoutStartedAt: v.optional(v.number()),
    dropoutDurationMs: v.optional(v.number()),
    consecutiveDropouts: v.number(),
    avgReadingIntervalMs: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_sessionId_and_sensor", ["sessionId", "sensorType"])
    .index("by_status", ["status"]),

  ingestionJobs: defineTable({
    sessionId: v.string(),
    jobType: v.string(),
    status: v.string(),
    metricsProcessed: v.number(),
    metricsInterpolated: v.number(),
    sensorsChecked: v.number(),
    dropoutsDetected: v.number(),
    errorMessage: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_status", ["status"]),

  sharedReports: defineTable({
    sessionId: v.string(),
    token: v.string(),
    label: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
    accessCount: v.number(),
    revoked: v.boolean(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_token", ["token"]),

  // ══════════════════════════════════════════════════════════════
  // PROTOCOL DRIFT — Historical drift events + active micro-interventions
  // ══════════════════════════════════════════════════════════════

  driftHistory: defineTable({
    sessionId: v.string(),
    metric: v.string(),
    currentValue: v.number(),
    baselineValue: v.number(),
    deviationPct: v.number(),
    severity: v.string(),
    triggerRule: v.string(),
    interventionGenerated: v.boolean(),
    detectedAt: v.number(),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_detectedAt", ["detectedAt"])
    .index("by_sessionId_and_metric", ["sessionId", "metric"]),

  activeInterventions: defineTable({
    sessionId: v.string(),
    driftMetric: v.string(),
    interventionType: v.string(),
    title: v.string(),
    subtitle: v.string(),
    description: v.string(),
    icon: v.string(),
    durationMinutes: v.number(),
    priority: v.string(),
    accentColor: v.string(),
    status: v.string(),
    deviationPct: v.number(),
    currentValue: v.number(),
    baselineValue: v.number(),
    createdAt: v.number(),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    dismissedAt: v.optional(v.number()),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_status", ["status"])
    .index("by_sessionId_and_status", ["sessionId", "status"]),

  // ── Vive Age History — daily snapshots of biological age prediction ──
  viveAgeHistory: defineTable({
    sessionId: v.string(),
    dateKey: v.string(),
    viveAge: v.number(),
    chronoAge: v.number(),
    delta: v.number(),
    confidence: v.number(),
    hrvAdj: v.number(),
    biomarkerAdj: v.number(),
    sleepAdj: v.number(),
    adherenceAdj: v.number(),
    fitnessAdj: v.number(),
    calculatedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_sessionId_and_dateKey", ["sessionId", "dateKey"])
    .index("by_calculatedAt", ["calculatedAt"]),

  // ══════════════════════════════════════════════════════════════
  // SUBSTANCE INTEGRITY — Peptide/HRT/Wellness Protocol Tracking
  // ══════════════════════════════════════════════════════════════

  substanceLogs: defineTable({
    sessionId: v.string(),
    substanceName: v.string(),
    category: v.string(),
    dosageMg: v.number(),
    dosageUnit: v.string(),
    route: v.string(),
    injectionSite: v.optional(v.string()),
    cycleId: v.optional(v.string()),
    notes: v.optional(v.string()),
    loggedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_loggedAt", ["loggedAt"])
    .index("by_sessionId_and_substance", ["sessionId", "substanceName"])
    .index("by_sessionId_and_loggedAt", ["sessionId", "loggedAt"]),

  substanceCycles: defineTable({
    sessionId: v.string(),
    substanceName: v.string(),
    category: v.string(),
    icon: v.string(),
    color: v.string(),
    dosageMg: v.number(),
    dosageUnit: v.string(),
    route: v.string(),
    frequency: v.string(),
    onDays: v.number(),
    offDays: v.number(),
    totalCycleWeeks: v.optional(v.number()),
    startedAt: v.number(),
    pausedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    status: v.string(),
    currentCycleDay: v.number(),
    isOnPhase: v.boolean(),
    lastDoseAt: v.optional(v.number()),
    totalDosesLogged: v.number(),
    monitoredBiomarkers: v.array(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_status", ["status"])
    .index("by_sessionId_and_status", ["sessionId", "status"]),

  substancePulseAlerts: defineTable({
    sessionId: v.string(),
    cycleId: v.optional(v.string()),
    alertType: v.string(),
    severity: v.string(),
    title: v.string(),
    message: v.string(),
    icon: v.string(),
    accentColor: v.string(),
    substanceName: v.optional(v.string()),
    biomarker: v.optional(v.string()),
    biomarkerValue: v.optional(v.number()),
    biomarkerReference: v.optional(v.string()),
    actionLabel: v.optional(v.string()),
    actionType: v.optional(v.string()),
    status: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    dismissedAt: v.optional(v.number()),
    actedAt: v.optional(v.number()),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_status", ["status"])
    .index("by_sessionId_and_status", ["sessionId", "status"])
    .index("by_createdAt", ["createdAt"]),

  // ══════════════════════════════════════════════════════════════
  // SOMATIC FEEDBACK — Subjective Feeling Logs + Voice Memos
  // ══════════════════════════════════════════════════════════════

  somaticFeedback: defineTable({
    sessionId: v.string(),
    channel: v.string(),                           // "core_temp" | "neural_drive" | "gut_status" | "joint_mobility" | "mental_clarity" | "energy_flux"
    value: v.number(),                             // 0-100 slider value
    label: v.string(),                             // human-readable label e.g. "Warm / Elevated"
    source: v.string(),                            // "slider" | "voice" | "auto"
    voiceMemoId: v.optional(v.string()),           // links to somaticVoiceMemos._id
    protocolContext: v.optional(v.string()),        // active substance/protocol at time of log
    substanceCycleId: v.optional(v.string()),      // links to substanceCycles._id if relevant
    aiCorrelation: v.optional(v.string()),         // AI Brain's interpretation (JSON string)
    loggedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_loggedAt", ["loggedAt"])
    .index("by_sessionId_and_channel", ["sessionId", "channel"])
    .index("by_sessionId_and_loggedAt", ["sessionId", "loggedAt"]),

  bioIdentityState: defineTable({
    sessionId: v.string(),
    overallScore: v.number(),
    overallThermal: v.string(),
    systemScores: v.string(),
    dataCompleteness: v.number(),
    updatedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"]),

  objectives: defineTable({
    sessionId: v.string(),
    title: v.string(),
    category: v.string(),
    targetValue: v.number(),
    targetUnit: v.string(),
    currentValue: v.number(),
    bioVaultKey: v.optional(v.string()),
    targetDate: v.number(),
    status: v.string(),
    probability: v.optional(v.number()),
    probabilityReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_status", ["status"]),

  objectiveMilestones: defineTable({
    sessionId: v.string(),
    objectiveId: v.id("objectives"),
    checkpoint: v.number(),
    title: v.string(),
    reachedAt: v.optional(v.number()),
    status: v.string(),
  })
    .index("by_objectiveId", ["objectiveId"])
    .index("by_sessionId", ["sessionId"]),

  bodyMapEntries: defineTable({
    sessionId: v.string(),
    region: v.string(),
    severity: v.number(),
    description: v.string(),
    source: v.string(),
    voiceMemoId: v.optional(v.string()),
    loggedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_loggedAt", ["loggedAt"])
    .index("by_sessionId_and_loggedAt", ["sessionId", "loggedAt"]),

  inventory: defineTable({
    sessionId: v.string(),
    name: v.string(),
    category: v.string(),
    icon: v.string(),
    totalQuantity: v.number(),
    currentQuantity: v.number(),
    unit: v.string(),
    dailyUsageUnits: v.number(),
    dosagePerUnit: v.optional(v.string()),
    brand: v.optional(v.string()),
    linkedProtocolId: v.optional(v.string()),
    linkedSupplementId: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    reorderUrl: v.optional(v.string()),
    notes: v.optional(v.string()),
    scanData: v.optional(v.string()),
    status: v.string(),
    lastDecrementedAt: v.optional(v.number()),
    addedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_sessionId_and_name", ["sessionId", "name"])
    .index("by_status", ["status"]),

  // ══════════════════════════════════════════════════════════════
  // DRIFT EVENTS — 3-consecutive-day ≥15% deviation flags
  // ══════════════════════════════════════════════════════════════

  driftEvents: defineTable({
    sessionId: v.string(),
    metric: v.string(),
    consecutiveDays: v.number(),
    avgDeviation: v.number(),
    dailySnapshots: v.string(),
    severity: v.string(),
    status: v.string(),
    recalibratedAt: v.optional(v.number()),
    recalibrationSummary: v.optional(v.string()),
    flaggedAt: v.number(),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_status", ["status"])
    .index("by_sessionId_and_status", ["sessionId", "status"])
    .index("by_flaggedAt", ["flaggedAt"]),

  coherencePulses: defineTable({
    sessionId: v.string(),
    actionKey: v.string(),
    pulseType: v.string(),
    intensity: v.string(),
    label: v.string(),
    icon: v.string(),
    source: v.string(),
    loggedAt: v.number(),
    decayAt: v.number(),
  })
    .index("by_sessionId_and_loggedAt", ["sessionId", "loggedAt"]),

  recoveryProtocolSessions: defineTable({
    sessionId: v.string(),
    peakScore: v.number(),
    currentScore: v.number(),
    scoreDropPct: v.number(),
    actions: v.string(),
    completedActionIds: v.string(),
    status: v.string(),
    triggeredAt: v.number(),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_status", ["status"])
    .index("by_sessionId_and_status", ["sessionId", "status"]),

  longevityScoreHistory: defineTable({
    sessionId: v.string(),
    score: v.number(),
    calculatedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_sessionId_and_calculatedAt", ["sessionId", "calculatedAt"]),

  // Auth userId ↔ twin sessionId ownership (guest → user:<id> migrate)
  sessionBindings: defineTable({
    userId: v.string(),
    sessionId: v.string(),
    guestSessionId: v.optional(v.string()),
    migratedCount: v.optional(v.number()),
    boundAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_sessionId", ["sessionId"]),

  somaticVoiceMemos: defineTable({
    sessionId: v.string(),
    durationSeconds: v.number(),
    transcript: v.optional(v.string()),            // speech-to-text result
    extractedChannels: v.optional(v.string()),     // JSON: parsed somatic channels from voice
    confidence: v.number(),                        // 0-1 transcription confidence
    storageId: v.optional(v.string()),             // Convex file storage ID for audio
    loggedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_loggedAt", ["loggedAt"])
    .index("by_sessionId_and_loggedAt", ["sessionId", "loggedAt"]),
});
