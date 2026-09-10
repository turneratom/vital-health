/**
 * Static Auth Export for Schema Generation
 * Run: npx @better-auth/cli generate -y
 * @see https://convex-better-auth.netlify.app/features/local-install
 */
import { createAuth } from "../auth";
import { getStaticAuth } from "@convex-dev/better-auth";

export const auth = getStaticAuth(createAuth);
