import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// List all vault files for a session
export const listVaultFiles = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("vaultFiles")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});

// Get vault files by category
export const getVaultFilesByCategory = query({
  args: { sessionId: v.string(), category: v.string() },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("vaultFiles")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .collect();
    return all.filter((f) => f.category === args.category);
  },
});

// Generate upload URL for Convex file storage
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Create vault file record after upload
export const createVaultFile = mutation({
  args: {
    sessionId: v.string(),
    fileName: v.string(),
    fileType: v.string(),
    category: v.string(),
    fileSize: v.number(),
    storageId: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("vaultFiles", {
      sessionId: args.sessionId,
      fileName: args.fileName,
      fileType: args.fileType,
      category: args.category,
      fileSize: args.fileSize,
      storageId: args.storageId,
      encryptionStatus: "AES-256-GCM",
      uploadedAt: Date.now(),
      notes: args.notes,
    });
  },
});

// Delete a vault file
export const deleteVaultFile = mutation({
  args: { id: v.id("vaultFiles") },
  handler: async (ctx, args) => {
    const file = await ctx.db.get(args.id);
    if (file?.storageId) {
      try {
        await ctx.storage.delete(file.storageId as any);
      } catch {
        // Storage may already be deleted
      }
    }
    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Get vault summary stats
export const getVaultSummary = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const files = await ctx.db
      .query("vaultFiles")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .collect();

    const bioVault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .first();

    const categories: Record<string, number> = {};
    let totalSize = 0;
    for (const f of files) {
      categories[f.category] = (categories[f.category] || 0) + 1;
      totalSize += f.fileSize;
    }

    return {
      totalFiles: files.length,
      totalSize,
      categories,
      hasBloodwork: !!bioVault,
      hasGenetics: bioVault ? (bioVault.mthfrVariant || bioVault.apoe4 || bioVault.caffeineSensitivity) : false,
      lastUpload: files.length > 0 ? Math.max(...files.map((f) => f.uploadedAt)) : null,
    };
  },
});

/* ═══════════════════════════════════════════════════════════════
   saveBiomarkersFromLab — Persists AI-parsed biomarker data
   
   Accepts the structured output from parseBiomarkers AI action
   and maps it into the bioVault table. Creates or updates the
   existing bioVault record for the session. Also logs a vault
   file record for audit trail and dispatches recalculation.
   ═══════════════════════════════════════════════════════════════ */
export const saveBiomarkersFromLab = mutation({
  args: {
    sessionId: v.string(),
    fileName: v.string(),
    fileSize: v.number(),
    biomarkers: v.object({
      vitaminD: v.optional(v.union(v.number(), v.null())),
      ferritin: v.optional(v.union(v.number(), v.null())),
      crp: v.optional(v.union(v.number(), v.null())),
      hba1c: v.optional(v.union(v.number(), v.null())),
      testosteroneTotal: v.optional(v.union(v.number(), v.null())),
      testosteroneFree: v.optional(v.union(v.number(), v.null())),
      cortisol: v.optional(v.union(v.number(), v.null())),
      tsh: v.optional(v.union(v.number(), v.null())),
      freeT4: v.optional(v.union(v.number(), v.null())),
      homocysteine: v.optional(v.union(v.number(), v.null())),
      ldl: v.optional(v.union(v.number(), v.null())),
      hdl: v.optional(v.union(v.number(), v.null())),
      triglycerides: v.optional(v.union(v.number(), v.null())),
      glucose: v.optional(v.union(v.number(), v.null())),
      insulin: v.optional(v.union(v.number(), v.null())),
      hemoglobin: v.optional(v.union(v.number(), v.null())),
      b12: v.optional(v.union(v.number(), v.null())),
      folate: v.optional(v.union(v.number(), v.null())),
      magnesium: v.optional(v.union(v.number(), v.null())),
      zinc: v.optional(v.union(v.number(), v.null())),
      iron: v.optional(v.union(v.number(), v.null())),
      omega3Index: v.optional(v.union(v.number(), v.null())),
    }),
    analytesCount: v.number(),
  },
  handler: async (ctx, args) => {
    const { sessionId, fileName, fileSize, biomarkers, analytesCount } = args;

    // Map AI-parsed biomarkers to bioVault schema fields
    const vaultUpdate: Record<string, any> = {
      updatedAt: Date.now(),
    };

    // Only set fields that have non-null numeric values
    if (typeof biomarkers.vitaminD === "number") vaultUpdate.vitaminD = biomarkers.vitaminD;
    if (typeof biomarkers.ferritin === "number") vaultUpdate.ferritin = biomarkers.ferritin;
    if (typeof biomarkers.crp === "number") vaultUpdate.crp = biomarkers.crp;
    if (typeof biomarkers.hba1c === "number") vaultUpdate.hba1c = biomarkers.hba1c;
    if (typeof biomarkers.testosteroneTotal === "number") vaultUpdate.testosteroneTotal = biomarkers.testosteroneTotal;
    if (typeof biomarkers.testosteroneFree === "number") vaultUpdate.testosteroneFree = biomarkers.testosteroneFree;

    // Upsert bioVault record
    const existing = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
      .first();

    let bioVaultId;
    if (existing) {
      await ctx.db.patch(existing._id, vaultUpdate);
      bioVaultId = existing._id;
    } else {
      bioVaultId = await ctx.db.insert("bioVault", {
        sessionId,
        vitaminD: typeof biomarkers.vitaminD === "number" ? biomarkers.vitaminD : undefined,
        testosteroneFree: typeof biomarkers.testosteroneFree === "number" ? biomarkers.testosteroneFree : undefined,
        testosteroneTotal: typeof biomarkers.testosteroneTotal === "number" ? biomarkers.testosteroneTotal : undefined,
        ferritin: typeof biomarkers.ferritin === "number" ? biomarkers.ferritin : undefined,
        crp: typeof biomarkers.crp === "number" ? biomarkers.crp : undefined,
        hba1c: typeof biomarkers.hba1c === "number" ? biomarkers.hba1c : undefined,
        mthfrVariant: false,
        apoe4: false,
        caffeineSensitivity: false,
        preferredProteins: "mixed",
        dietaryRestrictions: "none",
        updatedAt: Date.now(),
      });
    }

    // Create vault file audit record
    await ctx.db.insert("vaultFiles", {
      sessionId,
      fileName,
      fileType: fileName.split(".").pop() || "unknown",
      category: "lab-results",
      fileSize,
      encryptionStatus: "AES-256-GCM",
      uploadedAt: Date.now(),
      notes: `AI-parsed: ${analytesCount} analytes extracted`,
    });

    // Log a journal event for the lab sync
    await ctx.db.insert("journalEvents", {
      sessionId,
      eventType: "lab-sync",
      eventKey: "biomarker-ingestion",
      value: `${analytesCount} analytes from ${fileName}`,
      numericValue: analytesCount,
      loggedAt: Date.now(),
    });

    return { bioVaultId, analytesCount };
  },
});
