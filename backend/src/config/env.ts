import { z } from "zod";

const envSchema = z.object({
  MONGODB_URI: z.string().startsWith("mongodb"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET deve ter pelo menos 32 caracteres"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("127.0.0.1"),
  TRUST_PROXY: z
    .string()
    .default("loopback")
    .transform((v) => (/^\d+$/.test(v) ? Number(v) : v)),
  CORS_ORIGIN: z.url().default("http://localhost:5173"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Variáveis de ambiente inválidas:", z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
