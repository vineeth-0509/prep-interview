import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGO_URI: z.string().min(1, "MONGO_URI is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  FRONTEND_ORIGIN: z.string().url(),
  OPENAI_API_KEY: z.string().min(1).optional(), // only required once the pipeline steps land
  SEARCH_API_KEY: z.string().min(1).optional(),
  // CLI/test-fixture-only escape hatch for the private/loopback URL block in
  // §11 — never read by the deployed web app's user-facing crawl path.
  ALLOW_LOCAL_FETCH: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    // Fail fast and loud at boot rather than surfacing a confusing runtime
    // error the first time a misconfigured var is actually read.
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}

export const env = loadEnv();
