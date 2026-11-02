// Testes da auditoria. Uso: npm test
// Obs.: os logs gerados aqui NÃO são apagados no final — a aplicação não tem permissão para isso
// (é justamente o que um dos testes verifica). Eles ficam identificados pelo email "...@teste.local".
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../config/db.js";
import { createApp } from "../app.js";
import { gerarToken } from "../auth/jwt.js";
import { hashSenha } from "../auth/password.js";
import { UserModel, type Papel } from "../models/User.js";
import { TicketModel } from "../models/Ticket.js";
import { AuditLogModel } from "../models/AuditLog.js";

const tag = `audit-${Date.now()}`;
const SENHA = "SenhaForte123";
let server: Server;
let base: string;
const tokens: Record<string, string> = {};
const ids: Record<string, string> = {};
const email = (nome: string) => `${nome}.${tag}@teste.local`;

async function api(quem: string | null, metodo: string, caminho: string, corpo?: unknown) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (quem) headers.Authorization = `Bearer ${tokens[quem]}`;
  const res = await fetch(base + caminho, { method: metodo, headers, body: corpo ? JSON.stringify(corpo) : undefined });
  const texto = await res.text();
  return { status: res.status, body: texto ? JSON.parse(texto) : null, texto };
}

async function criarUsuario(nome: string, papel: Papel) {
  const u = await UserModel.create({ nome, email: email(nome), senhaHash: await hashSenha(SENHA), papel });
  ids[nome] = u.id;
  tokens[nome] = gerarToken(u.id);
}

// Último log que bate com o filtro (consulta direto no banco)
function ultimoLog(filtro: Record<string, unknown>) {
  return AuditLogModel.findOne(filtro).sort({ criadoEm: -1 }).lean();
}

before(async () => {
  await connectDB();
  await criarUsuario("ana", "usuario");
  await criarUsuario("bruno", "usuario");
  await criarUsuario("admin", "admin");
  server = createApp().listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server.close();
  const uids = Object.values(ids).filter((id) => mongoose.isValidObjectId(id) && id.length === 24);
  await TicketModel.deleteMany({ solicitante: mongoose.trusted({ $in: uids }) });
  await UserModel.deleteMany({ email: mongoose.trusted({ $regex: `\\.${tag}@teste\\.local$` }) });
  await disconnectDB();
});

describe("login", () => {
  test("login com sucesso gera auth.login com o ator", async () => {
    const r = await api(null, "POST", "/auth/login", { email: email("ana"), senha: SENHA });
    assert.equal(r.status, 200);
    const log = await ultimoLog({ acao: "auth.login", "ator.id": ids.ana });
    assert.ok(log);
    assert.equal(log.resultado, "sucesso");
    assert.equal(log.ator?.email, email("ana"));
    assert.ok(log.ip);
  });

  test("senha errada gera auth.login_falhou com motivo, sem guardar a senha", async () => {
    await api(null, "POST", "/auth/login", { email: email("ana"), senha: "SenhaErrada999" });
    const log = await ultimoLog({ acao: "auth.login_falhou", "alvo.id": ids.ana });
    assert.ok(log);
    assert.equal(log.ator, null);
    assert.equal((log.detalhes as Record<string, unknown>).motivo, "senha_incorreta");
    assert.ok(!JSON.stringify(log).includes("SenhaErrada999"), "senha não pode aparecer no log");
  });

  test("email inexistente também é registrado", async () => {
    const inexistente = email("fantasma");
    await api(null, "POST", "/auth/login", { email: inexistente, senha: "x" });
    const log = await ultimoLog({ acao: "auth.login_falhou", "detalhes.email": inexistente });
    assert.equal((log?.detalhes as Record<string, unknown>).motivo, "usuario_inexistente");
  });
});

describe("chamados", () => {
  test("criar gera ticket.criar", async () => {
    const r = await api("ana", "POST", "/tickets", { titulo: "Mouse quebrado", descricao: "Não clica" });
    ids.chamado = r.body._id;
    const log = await ultimoLog({ acao: "ticket.criar", "alvo.id": ids.chamado });
    assert.equal(log?.ator?.email, email("ana"));
  });

  test("editar registra só o que mudou (de → para)", async () => {
    await api("admin", "PATCH", `/tickets/${ids.chamado}`, { status: "em_andamento", prioridade: "alta" });
    const log = await ultimoLog({ acao: "ticket.atualizar", "alvo.id": ids.chamado });
    const d = log?.detalhes as Record<string, { de: unknown; para: unknown }>;
    assert.deepEqual(d.status, { de: "aberto", para: "em_andamento" });
    assert.deepEqual(d.prioridade, { de: "media", para: "alta" });
    assert.ok(d.tecnicoResponsavel, "assumir automaticamente também aparece");
    assert.equal(d.titulo, undefined, "campo que não mudou não aparece");
  });

  test("usuario tentando ver chamado de outro gera acesso.negado", async () => {
    const r = await api("bruno", "GET", `/tickets/${ids.chamado}`);
    assert.equal(r.status, 404);
    const log = await ultimoLog({ acao: "acesso.negado", "ator.id": ids.bruno, "alvo.id": ids.chamado });
    assert.equal(log?.resultado, "negado");
  });

  test("arquivar gera ticket.arquivar e excluir gera ticket.excluir com resumo", async () => {
    await api("admin", "PATCH", `/tickets/${ids.chamado}`, { arquivado: true });
    assert.ok(await ultimoLog({ acao: "ticket.arquivar", "alvo.id": ids.chamado }));
    await api("admin", "PATCH", `/tickets/${ids.chamado}`, { arquivado: false });
    assert.ok(await ultimoLog({ acao: "ticket.desarquivar", "alvo.id": ids.chamado }));
    await api("admin", "DELETE", `/tickets/${ids.chamado}`);
    const log = await ultimoLog({ acao: "ticket.excluir", "alvo.id": ids.chamado });
    assert.equal((log?.detalhes as Record<string, unknown>).titulo, "Mouse quebrado");
  });
});

describe("usuários e acessos negados", () => {
  test("admin muda papel: registra de → para; troca de senha não guarda o valor", async () => {
    await api("admin", "PATCH", `/users/${ids.bruno}`, { papel: "tecnico", senha: "OutraSenha456" });
    const log = await ultimoLog({ acao: "user.atualizar", "alvo.id": ids.bruno });
    const d = log?.detalhes as Record<string, unknown>;
    assert.deepEqual(d.papel, { de: "usuario", para: "tecnico" });
    assert.equal(d.senha, "alterada");
    assert.ok(!JSON.stringify(log).includes("OutraSenha456"));
  });

  test("requisição sem token gera acesso.negado (401)", async () => {
    await api(null, "GET", "/tickets?marcador=" + tag).catch(() => null);
    const log = await ultimoLog({ acao: "acesso.negado", "detalhes.status": 401 });
    assert.ok(log);
    assert.equal(log.ator, null);
  });

  test("usuario comum em /users gera acesso.negado (403)", async () => {
    await api("ana", "GET", "/users");
    const log = await ultimoLog({ acao: "acesso.negado", "ator.id": ids.ana, "detalhes.status": 403 });
    assert.ok(log);
  });
});

describe("consulta e imutabilidade", () => {
  test("só admin consulta /audit", async () => {
    assert.equal((await api("ana", "GET", "/audit")).status, 403);
    assert.equal((await api(null, "GET", "/audit")).status, 401);
  });

  test("admin filtra por ator e por período", async () => {
    const r = await api("admin", "GET", `/audit?atorId=${ids.ana}&de=${new Date(Date.now() - 60_000).toISOString()}`);
    assert.equal(r.status, 200);
    assert.ok(r.body.total > 0);
    assert.ok(r.body.itens.every((l: { ator: { id: string } }) => l.ator.id === ids.ana));
  });

  test("filtro inválido → 400", async () => {
    assert.equal((await api("admin", "GET", "/audit?acao=$where")).status, 400);
  });

  test("não existe rota para alterar/apagar log", async () => {
    assert.equal((await api("admin", "DELETE", "/audit")).status, 404);
  });

  test("nem a própria aplicação consegue alterar ou apagar logs no banco", async () => {
    const filtro = { acao: "auth.login", "ator.id": ids.ana };
    await assert.rejects(AuditLogModel.updateMany(filtro, { acao: "adulterado" }), { codeName: "Unauthorized" });
    await assert.rejects(AuditLogModel.deleteMany(filtro), { codeName: "Unauthorized" });
    assert.ok(await ultimoLog(filtro), "log continua lá");
  });
});
