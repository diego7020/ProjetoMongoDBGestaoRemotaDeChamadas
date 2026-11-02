// Testes de integração do CRUD de chamados e das regras por papel.
// Uso: npm test  (precisa do Mongo do docker rodando). Cria dados marcados e apaga no final.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../config/db.js";
import { createApp } from "../app.js";
import { gerarToken } from "../auth/jwt.js";
import { UserModel, type Papel } from "../models/User.js";
import { TicketModel } from "../models/Ticket.js";

const tag = `teste-${Date.now()}`;
let server: Server;
let base: string;
const tokens: Record<string, string> = {};
const ids: Record<string, string> = {};

async function api(quem: string | null, metodo: string, caminho: string, corpo?: unknown) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (quem) headers.Authorization = `Bearer ${tokens[quem]}`;
  const res = await fetch(base + caminho, { method: metodo, headers, body: corpo ? JSON.stringify(corpo) : undefined });
  const texto = await res.text();
  return { status: res.status, body: texto ? JSON.parse(texto) : null };
}

async function criarUsuario(nome: string, papel: Papel) {
  const u = await UserModel.create({ nome, email: `${nome}.${tag}@exemplo.com`, senhaHash: "x", papel });
  ids[nome] = u.id;
  tokens[nome] = gerarToken(u.id);
}

before(async () => {
  await connectDB();
  await criarUsuario("ana", "usuario");
  await criarUsuario("bruno", "usuario");
  await criarUsuario("tecnico", "tecnico");
  await criarUsuario("tecnico2", "tecnico");
  await criarUsuario("admin", "admin");
  server = createApp().listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server.close();
  const usuarios = await UserModel.find({ email: mongoose.trusted({ $regex: `\\.${tag}@exemplo\\.com$` }) });
  const uids = usuarios.map((u) => u._id);
  await TicketModel.deleteMany({ solicitante: mongoose.trusted({ $in: uids }) });
  await UserModel.deleteMany({ _id: mongoose.trusted({ $in: uids }) });
  await disconnectDB();
});

describe("autenticação", () => {
  test("sem token → 401", async () => {
    assert.equal((await api(null, "GET", "/tickets")).status, 401);
  });
});

describe("criar", () => {
  test("usuario cria chamado; solicitante vem do token, não do corpo", async () => {
    const r = await api("ana", "POST", "/tickets", { titulo: "PC não liga", descricao: "Tela preta" });
    assert.equal(r.status, 201);
    assert.equal(r.body.solicitante._id, ids.ana);
    assert.equal(r.body.status, "aberto");
    ids.chamadoAna = r.body._id;
  });

  test("tentar forjar solicitante/status no corpo → 400", async () => {
    const r = await api("ana", "POST", "/tickets", { titulo: "abc", descricao: "x", solicitante: ids.bruno, status: "fechado" });
    assert.equal(r.status, 400);
  });

  test("injeção NoSQL no corpo → 400", async () => {
    const r = await api("ana", "POST", "/tickets", { titulo: { $gt: "" }, descricao: "x" });
    assert.equal(r.status, 400);
  });

  test("bruno cria o dele", async () => {
    const r = await api("bruno", "POST", "/tickets", { titulo: "Sem internet", descricao: "Wi-fi caiu", prioridade: "alta" });
    assert.equal(r.status, 201);
    ids.chamadoBruno = r.body._id;
  });
});

describe("ler", () => {
  test("usuario lista só os próprios", async () => {
    const r = await api("ana", "GET", "/tickets");
    assert.equal(r.status, 200);
    assert.ok(r.body.itens.every((t: { solicitante: { _id: string } }) => t.solicitante._id === ids.ana));
  });

  test("usuario não vê chamado de outro (404, não revela que existe)", async () => {
    assert.equal((await api("ana", "GET", `/tickets/${ids.chamadoBruno}`)).status, 404);
  });

  test("tecnico vê chamado de qualquer um", async () => {
    assert.equal((await api("tecnico", "GET", `/tickets/${ids.chamadoBruno}`)).status, 200);
  });

  test("id inválido → 404", async () => {
    assert.equal((await api("admin", "GET", "/tickets/nao-e-id")).status, 404);
  });

  test("filtro com valor inválido → 400", async () => {
    assert.equal((await api("admin", "GET", "/tickets?status=xyz")).status, 400);
  });

  test("dados do solicitante não expõem senhaHash", async () => {
    const r = await api("tecnico", "GET", `/tickets/${ids.chamadoAna}`);
    assert.equal(r.body.solicitante.senhaHash, undefined);
  });
});

describe("editar", () => {
  test("usuario edita título do próprio chamado aberto", async () => {
    const r = await api("ana", "PATCH", `/tickets/${ids.chamadoAna}`, { titulo: "PC não liga de jeito nenhum" });
    assert.equal(r.status, 200);
    assert.equal(r.body.titulo, "PC não liga de jeito nenhum");
  });

  test("usuario não pode mudar status → 400", async () => {
    assert.equal((await api("ana", "PATCH", `/tickets/${ids.chamadoAna}`, { status: "resolvido" })).status, 400);
  });

  test("usuario não edita chamado de outro → 404", async () => {
    assert.equal((await api("ana", "PATCH", `/tickets/${ids.chamadoBruno}`, { titulo: "hackeado" })).status, 404);
  });

  test("tecnico não pode atribuir chamado a outro técnico → 403", async () => {
    const r = await api("tecnico", "PATCH", `/tickets/${ids.chamadoAna}`, { tecnicoResponsavel: ids.tecnico2 });
    assert.equal(r.status, 403);
  });

  test("tecnico coloca em andamento e assume automaticamente", async () => {
    const r = await api("tecnico", "PATCH", `/tickets/${ids.chamadoAna}`, { status: "em_andamento" });
    assert.equal(r.status, 200);
    assert.equal(r.body.tecnicoResponsavel._id, ids.tecnico);
  });

  test("outro técnico não pode tirar o chamado de quem assumiu → 403", async () => {
    const r = await api("tecnico2", "PATCH", `/tickets/${ids.chamadoAna}`, { tecnicoResponsavel: null });
    assert.equal(r.status, 403);
  });

  test("tecnico não edita título → 400", async () => {
    assert.equal((await api("tecnico", "PATCH", `/tickets/${ids.chamadoAna}`, { titulo: "outro" })).status, 400);
  });

  test("usuario não edita chamado que já está em andamento → 409", async () => {
    assert.equal((await api("ana", "PATCH", `/tickets/${ids.chamadoAna}`, { descricao: "mudei" })).status, 409);
  });

  test("admin não pode atribuir a um usuario comum → 400", async () => {
    const r = await api("admin", "PATCH", `/tickets/${ids.chamadoBruno}`, { tecnicoResponsavel: ids.ana });
    assert.equal(r.status, 400);
  });

  test("fechar preenche fechadoEm", async () => {
    const r = await api("tecnico", "PATCH", `/tickets/${ids.chamadoAna}`, { status: "fechado" });
    assert.equal(r.status, 200);
    assert.ok(r.body.fechadoEm);
  });
});

describe("arquivar", () => {
  test("usuario arquiva o próprio chamado aberto → vira fechado e some da lista", async () => {
    const r = await api("bruno", "PATCH", `/tickets/${ids.chamadoBruno}`, { arquivado: true });
    assert.equal(r.status, 200);
    assert.equal(r.body.arquivado, true);
    assert.equal(r.body.status, "fechado");
    assert.equal(r.body.arquivadoPor, ids.bruno);
    const lista = await api("bruno", "GET", "/tickets");
    assert.ok(!lista.body.itens.some((t: { _id: string }) => t._id === ids.chamadoBruno));
    const arquivados = await api("bruno", "GET", "/tickets?arquivados=true");
    assert.ok(arquivados.body.itens.some((t: { _id: string }) => t._id === ids.chamadoBruno));
  });

  test("usuario não pode desarquivar → 400", async () => {
    assert.equal((await api("bruno", "PATCH", `/tickets/${ids.chamadoBruno}`, { arquivado: false })).status, 400);
  });

  test("chamado arquivado fica travado para técnico → 409", async () => {
    assert.equal((await api("tecnico", "PATCH", `/tickets/${ids.chamadoBruno}`, { status: "aberto" })).status, 409);
  });

  test("admin desarquiva", async () => {
    const r = await api("admin", "PATCH", `/tickets/${ids.chamadoBruno}`, { arquivado: false });
    assert.equal(r.status, 200);
    assert.equal(r.body.arquivado, false);
  });
});

describe("excluir", () => {
  test("usuario não exclui nem o próprio → 403", async () => {
    assert.equal((await api("ana", "DELETE", `/tickets/${ids.chamadoAna}`)).status, 403);
  });

  test("tecnico não exclui → 403", async () => {
    assert.equal((await api("tecnico", "DELETE", `/tickets/${ids.chamadoAna}`)).status, 403);
  });

  test("admin exclui → 204 e depois 404", async () => {
    assert.equal((await api("admin", "DELETE", `/tickets/${ids.chamadoAna}`)).status, 204);
    assert.equal((await api("admin", "GET", `/tickets/${ids.chamadoAna}`)).status, 404);
  });
});

describe("conta desativada", () => {
  test("token ainda válido, mas usuário desativado → 401", async () => {
    await UserModel.updateOne({ _id: ids.bruno }, { ativo: false });
    assert.equal((await api("bruno", "GET", "/tickets")).status, 401);
  });
});
