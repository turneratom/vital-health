/**
 * Better Auth Setup for Convex (Local Install)
 * Uses local schema for admin plugin support
 * @see https://convex-better-auth.netlify.app/features/local-install
 */
import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { admin, apiKey } from "better-auth/plugins";
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { betterAuth } from "better-auth";
import authSchema from "./betterAuth/schema";

const siteUrl = process.env.SITE_URL || "";

// Create the Better Auth component client with LOCAL schema
// This enables admin plugin and other plugins that require schema changes
export const authComponent = createClient<DataModel, typeof authSchema>(
  components.betterAuth,
  {
    local: {
      schema: authSchema,
    },
  }
);

// Static trusted origins for CORS
const staticOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:8081", // Expo Metro dev server
];

/**
 * Get trusted origins array for Better Auth CORS
 * Includes: static origins, SITE_URL, and Modal preview URLs (*.w.modal.host)
 */
function getTrustedOrigins(request: Request): string[] {
  const origins = [...staticOrigins];
  if (siteUrl) origins.push(siteUrl);

  // Helper to check and add dynamic preview URLs (Modal and Shipper)
  const addDynamicOrigin = (url: string | null) => {
    if (!url) return;

    // Check for Modal preview URLs or Shipper deployed URLs
    const isDynamicUrl = url.includes(".w.modal.host") || url.includes(".shipper.now");
    if (!isDynamicUrl) return;

    try {
      const parsed = new URL(url);
      origins.push(parsed.origin);
    } catch {
      // If it's just an origin without path, add directly
      if (url.startsWith("http")) {
        origins.push(url.split("/").slice(0, 3).join("/"));
      }
    }
  };

  // Check origin header
  addDynamicOrigin(request.headers.get("origin"));

  // Check referer header (fallback for some auth flows)
  addDynamicOrigin(request.headers.get("referer"));

  // For callback URL validation, also check URL params and common body patterns
  try {
    const url = new URL(request.url);
    addDynamicOrigin(url.searchParams.get("callbackURL"));
    addDynamicOrigin(url.searchParams.get("callback"));
    addDynamicOrigin(url.searchParams.get("redirectTo"));
  } catch {}

  return [...new Set(origins)]; // Deduplicate
}

/**
 * Create Better Auth instance.
 * Returns a configured betterAuth instance for use with Convex.
 * Compatible with @convex-dev/better-auth@0.9.x
 */
export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: getTrustedOrigins,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    // User configuration with admin plugin fields
    user: {
      additionalFields: {
        name: {
          type: "string",
          required: false,
        },
        // Admin plugin required fields
        role: {
          type: "string",
          required: false,
          defaultValue: "user",
        },
        banned: {
          type: "boolean",
          required: false,
          defaultValue: false,
        },
        banReason: {
          type: "string",
          required: false,
        },
        banExpires: {
          type: "number",
          required: false,
        },
      },
    },
    plugins: [
      crossDomain({ siteUrl }),
      convex(),
      admin({
        adminRoles: ["admin", "service-admin"],
      }),
      apiKey({
        // Enable session creation for API key requests
        // This allows API keys to authenticate admin operations
        enableSessionForAPIKeys: true,
      }),
    ],
  });
};

// ============================================================================
// USER TYPE - Define explicit type for Better Auth user
// ============================================================================

/**
 * Better Auth user type with admin plugin fields.
 * This provides type safety for user queries.
 */
interface BetterAuthUser {
  _id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  emailVerified?: boolean;
  createdAt: number;
  updatedAt: number;
  // Admin plugin fields
  role?: string;
  banned?: boolean;
  banReason?: string;
  banExpires?: number;
}

// ============================================================================
// USER QUERIES - For settings panel and general use
// ============================================================================

/**
 * Get the current authenticated user
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) return null;

    return {
      id: user._id,
      _id: user._id, // Alias for compatibility - use either id or _id
      email: user.email,
      name: user.name ?? null,
      image: user.image ?? null,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  },
});

/**
 * Get user by email address
 *
 * This is the recommended way to look up other users.
 * Email lookups use an index and avoid ID format issues.
 */
export const getUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "email", value: email }],
    }) as BetterAuthUser | null;
    if (!user) return null;

    return {
      id: user._id,
      email: user.email,
      name: user.name ?? null,
      image: user.image ?? null,
      createdAt: user.createdAt,
    };
  },
});

/**
 * List all users (for admin dashboard)
 *
 * Uses the Better Auth component's findMany to query users.
 */
export const listAllUsers = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 100 }) => {
    // Use the component's findMany to query users
    const result = await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: "user",
      sortBy: {
        field: "createdAt",
        direction: "desc",
      },
      paginationOpts: { numItems: limit, cursor: null },
    });

    return result.page.map((user: any) => ({
      id: user._id,
      email: user.email,
      name: user.name ?? null,
      image: user.image ?? null,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      role: user.role ?? "user",
      banned: user.banned ?? false,
    }));
  },
});

// ============================================================================
// ADMIN MUTATIONS - For user management via deploy key
// ============================================================================

/**
 * Delete a user and all their associated data (sessions, accounts)
 * This mutation is called via deploy key from Shipper's admin dashboard.
 * It properly cleans up all Better Auth related data for the user.
 */
export const deleteUser = mutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    // Delete all sessions for this user
    const sessions = await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: "session",
      where: [{ field: "userId", value: userId }],
      paginationOpts: { numItems: 100, cursor: null },
    });

    for (const session of sessions.page) {
      await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
        input: {
          model: "session",
          where: [{ field: "_id", value: session._id }],
        },
      });
    }

    // Delete all accounts for this user
    const accounts = await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: "account",
      where: [{ field: "userId", value: userId }],
      paginationOpts: { numItems: 100, cursor: null },
    });

    for (const account of accounts.page) {
      await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
        input: {
          model: "account",
          where: [{ field: "_id", value: account._id }],
        },
      });
    }

    // Delete the user
    await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
      input: {
        model: "user",
        where: [{ field: "_id", value: userId }],
      },
    });

    return { success: true };
  },
});
