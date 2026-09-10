/**
 * Better Auth Provider Configuration
 * @see https://convex-better-auth.netlify.app/
 */
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
