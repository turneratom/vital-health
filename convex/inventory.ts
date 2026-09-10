import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   LONGEVITY INVENTORY ENGINE
   
   Tracks supplement bottles, peptide vials, and wellness compounds.
   Calculates "Supply Remaining" based on daily protocol consumption.
   Surfaces low-supply alerts 3 days before depletion.
   ═══════════════════════════════════════════════════════════════ */

// ── Get all inventory items for a session ──
export const getInventory = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("inventory")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    return items.sort((a, b) => {
      // Critical items first (low supply), then by name
      const aDays = a.dailyUsageUnits > 0 ? a.currentQuantity / a.dailyUsageUnits : 999;
      const bDays = b.dailyUsageUnits > 0 ? b.currentQuantity / b.dailyUsageUnits : 999;
      return aDays - bDays;
    });
  },
});

// ── Get low-supply items (≤3 days remaining) ──
export const getLowSupplyAlerts = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("inventory")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const alerts: Array<{
      item: typeof items[0];
      daysRemaining: number;
      severity: "critical" | "warning" | "info";
      message: string;
    }> = [];

    for (const item of items) {
      if (item.dailyUsageUnits <= 0 || item.status === "depleted") continue;
      const daysRemaining = Math.floor(item.currentQuantity / item.dailyUsageUnits);
      
      if (daysRemaining <= 0) {
        alerts.push({
          item,
          daysRemaining: 0,
          severity: "critical",
          message: `${item.name} is depleted — protocol disruption imminent`,
        });
      } else if (daysRemaining <= 3) {
        alerts.push({
          item,
          daysRemaining,
          severity: "critical",
          message: `${item.name} runs out in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} — reorder now`,
        });
      } else if (daysRemaining <= 7) {
        alerts.push({
          item,
          daysRemaining,
          severity: "warning",
          message: `${item.name} has ~${daysRemaining} days remaining`,
        });
      } else if (daysRemaining <= 14) {
        alerts.push({
          item,
          daysRemaining,
          severity: "info",
          message: `${item.name} supply: ${daysRemaining} days`,
        });
      }
    }

    return alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);
  },
});

// ── Add a new inventory item (manual or from scan) ──
export const addInventoryItem = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Check for existing item with same name
    const existing = await ctx.db
      .query("inventory")
      .withIndex("by_sessionId_and_name", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("name", args.name)
      )
      .first();

    if (existing) {
      // Merge: add quantity to existing
      await ctx.db.patch(existing._id, {
        currentQuantity: existing.currentQuantity + args.currentQuantity,
        totalQuantity: existing.totalQuantity + args.totalQuantity,
        status: "active",
        updatedAt: now,
        ...(args.expiresAt ? { expiresAt: args.expiresAt } : {}),
        ...(args.brand ? { brand: args.brand } : {}),
        ...(args.reorderUrl ? { reorderUrl: args.reorderUrl } : {}),
      });
      return existing._id;
    }

    return await ctx.db.insert("inventory", {
      sessionId: args.sessionId,
      name: args.name,
      category: args.category,
      icon: args.icon,
      totalQuantity: args.totalQuantity,
      currentQuantity: args.currentQuantity,
      unit: args.unit,
      dailyUsageUnits: args.dailyUsageUnits,
      dosagePerUnit: args.dosagePerUnit,
      brand: args.brand,
      linkedProtocolId: args.linkedProtocolId,
      linkedSupplementId: args.linkedSupplementId,
      expiresAt: args.expiresAt,
      reorderUrl: args.reorderUrl,
      notes: args.notes,
      scanData: args.scanData,
      status: "active",
      lastDecrementedAt: now,
      addedAt: now,
      updatedAt: now,
    });
  },
});

// ── Update inventory item ──
export const updateInventoryItem = mutation({
  args: {
    id: v.id("inventory"),
    currentQuantity: v.optional(v.number()),
    dailyUsageUnits: v.optional(v.number()),
    reorderUrl: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const clean = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(id, { ...clean, updatedAt: Date.now() });
    return id;
  },
});

// ── Decrement supply when protocol is completed ──
export const decrementSupply = mutation({
  args: {
    sessionId: v.string(),
    supplementId: v.string(),
    supplementName: v.string(),
    units: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const decrementBy = args.units ?? 1;

    // Try to find by linked supplement ID first
    let item = await ctx.db
      .query("inventory")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect()
      .then((items) =>
        items.find(
          (i) =>
            i.status === "active" &&
            (i.linkedSupplementId === args.supplementId ||
              i.name.toLowerCase() === args.supplementName.toLowerCase() ||
              args.supplementName.toLowerCase().includes(i.name.toLowerCase()) ||
              i.name.toLowerCase().includes(args.supplementName.toLowerCase()))
        )
      );

    if (!item) return { decremented: false, reason: "no_matching_item" };

    const newQty = Math.max(0, item.currentQuantity - decrementBy);
    const status = newQty <= 0 ? "depleted" : "active";

    await ctx.db.patch(item._id, {
      currentQuantity: newQty,
      status,
      lastDecrementedAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Check if low supply alert needed
    const daysRemaining = item.dailyUsageUnits > 0 ? Math.floor(newQty / item.dailyUsageUnits) : 999;

    return {
      decremented: true,
      newQuantity: newQty,
      daysRemaining,
      needsReorder: daysRemaining <= 3,
      status,
    };
  },
});

// ── Batch decrement for daily protocol completion ──
export const decrementDailyProtocol = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("inventory")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const activeItems = items.filter((i) => i.status === "active" && i.dailyUsageUnits > 0);
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const results: Array<{ name: string; newQty: number; daysRemaining: number }> = [];

    for (const item of activeItems) {
      // Only decrement once per day
      if (item.lastDecrementedAt && now - item.lastDecrementedAt < oneDayMs * 0.9) {
        continue;
      }

      const newQty = Math.max(0, item.currentQuantity - item.dailyUsageUnits);
      const status = newQty <= 0 ? "depleted" : "active";
      const daysRemaining = item.dailyUsageUnits > 0 ? Math.floor(newQty / item.dailyUsageUnits) : 999;

      await ctx.db.patch(item._id, {
        currentQuantity: newQty,
        status,
        lastDecrementedAt: now,
        updatedAt: now,
      });

      results.push({ name: item.name, newQty, daysRemaining });
    }

    return { decremented: results.length, items: results };
  },
});

// ── Delete inventory item ──
export const deleteInventoryItem = mutation({
  args: { id: v.id("inventory") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return args.id;
  },
});

// ── Quick-Reorder: simulate checkout for a low-stock supplement ──
export const quickReorder = mutation({
  args: {
    id: v.id("inventory"),
    reorderQuantity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Item not found");

    const qty = args.reorderQuantity ?? item.totalQuantity;
    const now = Date.now();

    // Simulate checkout: mark as "reorder_pending" and log the event
    await ctx.db.patch(args.id, {
      status: "reorder_pending",
      updatedAt: now,
      notes: `Reorder placed: ${qty} ${item.unit} on ${new Date(now).toLocaleDateString()}. ${item.notes || ""}`.trim(),
    });

    return {
      success: true,
      itemName: item.name,
      quantity: qty,
      unit: item.unit,
      reorderUrl: item.reorderUrl || null,
      estimatedDelivery: "2-3 business days",
    };
  },
});

// ── Confirm reorder arrival: restock the item ──
export const confirmReorderArrival = mutation({
  args: {
    id: v.id("inventory"),
    receivedQuantity: v.number(),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Item not found");

    await ctx.db.patch(args.id, {
      currentQuantity: item.currentQuantity + args.receivedQuantity,
      totalQuantity: item.totalQuantity + args.receivedQuantity,
      status: "active",
      updatedAt: Date.now(),
    });

    return { newQuantity: item.currentQuantity + args.receivedQuantity };
  },
});

// ── System-level alerts for Dashboard integration ──
export const getSystemAlerts = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("inventory")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const alerts: Array<{
      id: string;
      itemName: string;
      icon: string;
      category: string;
      daysRemaining: number;
      currentQuantity: number;
      unit: string;
      severity: "critical" | "warning" | "info";
      message: string;
      reorderUrl: string | null;
      status: string;
    }> = [];

    for (const item of items) {
      if (item.dailyUsageUnits <= 0) continue;
      if (item.status === "depleted" || item.status === "reorder_pending") {
        alerts.push({
          id: item._id,
          itemName: item.name,
          icon: item.icon,
          category: item.category,
          daysRemaining: 0,
          currentQuantity: item.currentQuantity,
          unit: item.unit,
          severity: "critical",
          message: item.status === "reorder_pending"
            ? `${item.name} — reorder in transit`
            : `${item.name} is depleted`,
          reorderUrl: item.reorderUrl || null,
          status: item.status,
        });
        continue;
      }
      if (item.status !== "active") continue;

      const daysRemaining = Math.floor(item.currentQuantity / item.dailyUsageUnits);

      if (daysRemaining <= 3) {
        alerts.push({
          id: item._id,
          itemName: item.name,
          icon: item.icon,
          category: item.category,
          daysRemaining,
          currentQuantity: item.currentQuantity,
          unit: item.unit,
          severity: "critical",
          message: daysRemaining <= 0
            ? `${item.name} is empty — reorder now`
            : `${item.name} runs out in ${daysRemaining}d`,
          reorderUrl: item.reorderUrl || null,
          status: item.status,
        });
      } else if (daysRemaining <= 7) {
        alerts.push({
          id: item._id,
          itemName: item.name,
          icon: item.icon,
          category: item.category,
          daysRemaining,
          currentQuantity: item.currentQuantity,
          unit: item.unit,
          severity: "warning",
          message: `${item.name} — ${daysRemaining} days left`,
          reorderUrl: item.reorderUrl || null,
          status: item.status,
        });
      }
    }

    return {
      alerts: alerts.sort((a, b) => a.daysRemaining - b.daysRemaining),
      hasCritical: alerts.some((a) => a.severity === "critical"),
      hasWarning: alerts.some((a) => a.severity === "warning"),
      totalAlerts: alerts.length,
    };
  },
});

// ── Refill / restock an item ──
export const refillItem = mutation({
  args: {
    id: v.id("inventory"),
    addQuantity: v.number(),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Item not found");

    const newQty = item.currentQuantity + args.addQuantity;
    await ctx.db.patch(args.id, {
      currentQuantity: newQty,
      totalQuantity: item.totalQuantity + args.addQuantity,
      status: "active",
      updatedAt: Date.now(),
    });

    return { newQuantity: newQty };
  },
});
