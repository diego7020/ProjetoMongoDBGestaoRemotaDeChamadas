import { randomBytes } from "node:crypto";
import { connectDB, disconnectDB } from "../config/db.js";
import { UserModel } from "../models/User.js";
import { hashSenha } from "../auth/password.js";

const [email, nome] = process.argv.slice(2);
if (!email || !nome) {
  console.error('Uso: npm run create-admin -- <email> "<nome>"');
  process.exit(1);
}

const senha = randomBytes(18).toString("base64url") + "aA1";

await connectDB();
try {
  await UserModel.create({ nome, email, senhaHash: await hashSenha(senha), papel: "admin" });
  console.log(`Admin criado: ${email.toLowerCase()}`);
  console.log(`Senha (anote agora, não será mostrada de novo): ${senha}`);
} catch (e) {
  const msg = (e as { code?: number }).code === 11000 ? "Já existe usuário com esse email" : String(e);
  console.error(`Erro: ${msg}`);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
