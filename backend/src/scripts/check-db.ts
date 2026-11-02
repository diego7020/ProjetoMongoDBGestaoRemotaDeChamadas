import { connectDB, disconnectDB } from "../config/db.js";
import { UserModel } from "../models/User.js";
import { TicketModel } from "../models/Ticket.js";

const tag = `check-${Date.now()}`;
let falhas = 0;

function ok(cond: boolean, msg: string) {
  console.log(`${cond ? "OK  " : "FALHA"} ${msg}`);
  if (!cond) falhas++;
}

await connectDB();
try {
  await UserModel.syncIndexes();
  await TicketModel.syncIndexes();
  ok(true, "conectou com o usuário da aplicação e criou os índices");

  const user = await UserModel.create({ nome: "Teste", email: `${tag}@Exemplo.com`, senhaHash: "hash-falso" });
  ok(user.papel === "usuario", "papel padrão é 'usuario' (menor privilégio)");
  ok(user.email === `${tag}@exemplo.com`, "email normalizado para minúsculas");

  const lido = await UserModel.findById(user._id);
  ok(lido?.senhaHash === undefined, "senhaHash não volta nas consultas");
  const comHash = await UserModel.findById(user._id).select("+senhaHash");
  ok(!("senhaHash" in (comHash?.toJSON() ?? {})), "senhaHash não aparece no JSON");

  const dup = await UserModel.create({ nome: "Dup", email: `${tag}@exemplo.com`, senhaHash: "x" }).catch((e) => e);
  ok(dup?.code === 11000, "email duplicado é recusado");

  const invalido = await UserModel.create({ nome: "X", email: "nao-e-email", senhaHash: "x", papel: "root" as never }).catch((e) => e);
  ok(invalido?.name === "ValidationError", "papel/email inválidos são recusados");

  const injetado = await UserModel.findOne({ email: { $ne: null } as never }).catch((e) => e);
  ok(injetado === null || injetado?.name === "CastError", "filtro com operador injetado é bloqueado (sanitizeFilter)");

  const t = await TicketModel.create({ titulo: "Impressora", descricao: "Não imprime", solicitante: user._id });
  ok(t.status === "aberto" && t.prioridade === "media", "chamado nasce 'aberto' com prioridade 'media'");

  t.status = "fechado";
  await t.save();
  ok(t.fechadoEm instanceof Date, "fechar o chamado preenche fechadoEm");

  const statusRuim = await TicketModel.create({ titulo: "abc", descricao: "x", status: "xyz" as never, solicitante: user._id }).catch((e) => e);
  ok(statusRuim?.name === "ValidationError", "status inválido é recusado");

  await TicketModel.deleteMany({ solicitante: user._id });
  await UserModel.deleteMany({ email: `${tag}@exemplo.com` });
} finally {
  await disconnectDB();
}

console.log(falhas ? `\n${falhas} verificação(ões) falharam` : "\nTudo certo");
process.exit(falhas ? 1 : 0);
