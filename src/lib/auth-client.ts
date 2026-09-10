/**
 * Better Auth Client for React
 * @see https://convex-better-auth.netlify.app/
 */
import { createAuthClient } from "better-auth/react";
import {
  convexClient,
  crossDomainClient,
} from "@convex-dev/better-auth/client/plugins";
import { unbindTwinSessionToGuest } from "@/lib/twinSession";

/**
 * Better Auth client instance
 * Use this for all authentication operations
 */
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_CONVEX_SITE_URL,
  plugins: [convexClient(), crossDomainClient()],
});

// Re-export hooks for convenience
export const { useSession, signIn, signUp, signOut } = authClient;

/**
 * Error code type from Better Auth
 * Use authClient.$ERROR_CODES for the full list of error codes
 */
export type AuthErrorCode = keyof typeof authClient.$ERROR_CODES;

/**
 * Authentication error type with typed error codes
 */
export interface AuthError {
  message: string;
  code?: AuthErrorCode | string;
}

/**
 * Map of error codes to user-friendly messages
 * Extend this object to add custom translations
 */
export const errorMessages: Partial<Record<AuthErrorCode | string, string>> = {
  USER_NOT_FOUND: "No account found with this email",
  INVALID_PASSWORD: "Invalid password",
  USER_ALREADY_EXISTS: "An account with this email already exists",
  INVALID_EMAIL: "Please enter a valid email address",
  PASSWORD_TOO_SHORT: "Password must be at least 8 characters",
  PASSWORD_TOO_LONG: "Password is too long",
  INVALID_EMAIL_OR_PASSWORD: "Invalid email or password",
  EMAIL_NOT_VERIFIED: "Please verify your email before signing in",
  TOO_MANY_REQUESTS: "Too many attempts. Please try again later",
};

/**
 * Get a user-friendly error message from an error code
 */
export function getErrorMessage(code: string | undefined): string {
  if (!code) return "An unexpected error occurred";
  return errorMessages[code] ?? code.replace(/_/g, " ").toLowerCase();
}

/**
 * Parse error from Better Auth response
 */
export function parseAuthError(error: unknown): AuthError {
  if (error && typeof error === "object") {
    const err = error as { code?: string; message?: string };
    return {
      message: err.message ?? getErrorMessage(err.code),
      code: err.code,
    };
  }

  if (error instanceof Error) {
    return { message: error.message };
  }

  return { message: "An unexpected error occurred" };
}

// ============================================================================
// SIGN IN / SIGN UP HELPERS
// ============================================================================

export interface SignInResult {
  success: boolean;
  error?: AuthError;
}

/**
 * Sign in with email and password
 * Returns { success, error } instead of throwing
 * Uses current origin for callback to avoid localhost redirects
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<SignInResult> {
  const { error } = await authClient.signIn.email({
    email,
    password,
    callbackURL: typeof window !== "undefined" ? window.location.origin : "/",
  });

  if (error) {
    return {
      success: false,
      error: {
        message: getErrorMessage(error.code),
        code: error.code,
      },
    };
  }

  return { success: true };
}

/**
 * Sign up with email and password
 * Returns { success, error } instead of throwing
 * Uses current origin for callback to avoid localhost redirects
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  name?: string
): Promise<SignInResult> {
  const { error } = await authClient.signUp.email({
    email,
    password,
    name: name ?? "",
    callbackURL: typeof window !== "undefined" ? window.location.origin : "/",
  });

  if (error) {
    return {
      success: false,
      error: {
        message: getErrorMessage(error.code),
        code: error.code,
      },
    };
  }

  return { success: true };
}

/**
 * Sign out the current user
 */
export async function signOutUser(): Promise<SignInResult> {
  const { error } = await authClient.signOut();

  if (error) {
    return {
      success: false,
      error: parseAuthError(error),
    };
  }

  unbindTwinSessionToGuest();
  return { success: true };
}
