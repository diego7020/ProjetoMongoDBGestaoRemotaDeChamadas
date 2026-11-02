import { randomBytes } from "node:crypto";
import { z } from "zod";
import { connectDB, disconnectDB } from "../config/db.js";
import { UserModel } from "../models/User.js";
import { AuditLogModel } from "../models/AuditLog.js";
import { hashSenha, senhaSchema } from "../auth/password.js";

const envSchema = z.object({
  ADMIN_EMAIL: z.string().trim().toLowerCase().pipe(z.email()),
  ADMIN_NOME: z.string().trim().min(2).default("Administrador"),
  ADMIN_SENHA: z.union([z.literal(""), senhaSchema]).optional(),
});

const env = envSchema.safeParse(process.env);
if (!env.success) {
  console.error("  ✗ Configuração do admin inválida no .env:", z.flattenError(env.error).fieldErrors);
  process.exit(1);
}
const { ADMIN_EMAIL, ADMIN_NOME, ADMIN_SENHA } = env.data;

await connectDB();
try {
  const existente = await UserModel.findOne({ papel: "admin", ativo: true });
  if (existente) {
    console.log(`  • admin já existe (${existente.email})`);
  } else {
    const gerada = !ADMIN_SENHA;
    const senha = ADMIN_SENHA || randomBytes(18).toString("base64url") + "aA1";

    let user = await UserModel.findOne({ email: ADMIN_EMAIL });
    if (user) {
      user.papel = "admin";
      user.ativo = true;
      user.senhaHash = await hashSenha(senha);
      await user.save();
    } else {
      user = await UserModel.create({ nome: ADMIN_NOME, email: ADMIN_EMAIL, senhaHash: await hashSenha(senha), papel: "admin" });
    }

    await AuditLogModel.create({
      ator: null,
      acao: "user.criar",
      resultado: "sucesso",
      alvo: { tipo: "user", id: user._id },
      ip: null,
      detalhes: { email: user.email, papel: "admin", origem: "seed-admin" },
    });

    console.log(`  ✓ admin criado: ${user.email}`);
    if (gerada) {
      console.log(`  ! senha gerada (anote agora, não será mostrada de novo): ${senha}`);
      console.log(`    (para escolher a senha, defina ADMIN_SENHA no .env antes do primeiro start)`);
    } else {
      console.log(`  ✓ senha: a definida em ADMIN_SENHA no .env`);
    }
  }
} finally {
  await disconnectDB();
}
