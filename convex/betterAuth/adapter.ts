/**
 * Better Auth Adapter Functions
 * @see https://convex-better-auth.netlify.app/features/local-install
 */
import { createApi } from "@convex-dev/better-auth";
import schema from "./schema";
import { createAuth } from "../auth";

export const {
  create,
  findOne,
  findMany,
  updateOne,
  updateMany,
  deleteOne,
  deleteMany,
} = createApi(schema, createAuth);
