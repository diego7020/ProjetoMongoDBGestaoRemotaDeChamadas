import { Router, type Request } from "express";
import { z } from "zod";
import { isValidObjectId, type QueryFilter } from "mongoose";
import { PRIORIDADES, STATUS, TicketModel, type Ticket, type TicketDocument } from "../models/Ticket.js";
import { UserModel } from "../models/User.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { diferencas, registrar } from "../audit/registrar.js";

// - usuario: cria; vê e edita só os PRÓPRIOS (título/descrição/prioridade, enquanto "aberto"); pode arquivar os próprios
// - tecnico: vê todos; muda status/prioridade e assume chamados (atribui a si mesmo)
// - admin:   tudo, inclusive atribuir a qualquer técnico, desarquivar e EXCLUIR
export const ticketsRouter = Router();
ticketsRouter.use(authenticate);

const POPULAR = [
  { path: "solicitante", select: "nome email" },
  { path: "tecnicoResponsavel", select: "nome email" },
];

const objectId = z.string().refine(isValidObjectId, "id inválido");

const criarSchema = z
  .object({
    titulo: z.string().trim().min(3).max(120),
    descricao: z.string().trim().min(1).max(5000),
    prioridade: z.enum(PRIORIDADES).optional(),
  })
  .strict();

// Cada papel tem o SEU schema: campos fora dele são recusados (.strict), não ignorados.
const editarUsuarioSchema = z
  .object({
    titulo: z.string().trim().min(3).max(120).optional(),
    descricao: z.string().trim().min(1).max(5000).optional(),
    prioridade: z.enum(PRIORIDADES).optional(),
    arquivado: z.literal(true).optional(),
  })
  .strict();

const editarTecnicoSchema = z
  .object({
    status: z.enum(STATUS).optional(),
    prioridade: z.enum(PRIORIDADES).optional(),
    tecnicoResponsavel: objectId.nullable().optional(),
  })
  .strict();

const editarAdminSchema = editarTecnicoSchema
  .extend({
    titulo: z.string().trim().min(3).max(120).optional(),
    descricao: z.string().trim().min(1).max(5000).optional(),
    arquivado: z.boolean().optional(),
  })
  .strict();

const listarSchema = z
  .object({
    status: z.enum(STATUS).optional(),
    prioridade: z.enum(PRIORIDADES).optional(),
    arquivados: z.enum(["true", "false"]).default("false"),
    atribuidosAMim: z.enum(["true", "false"]).default("false"),
    pagina: z.coerce.number().int().min(1).default(1),
    limite: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

async function buscarVisivel(req: Request): Promise<TicketDocument> {
  const id = req.params.id;
  if (typeof id !== "string" || !isValidObjectId(id)) throw new HttpError(404, "Chamado não encontrado");
  const ticket = await TicketModel.findById(id);
  if (!ticket) throw new HttpError(404, "Chamado não encontrado");
  if (req.user!.papel === "usuario" && !ticket.solicitante.equals(req.user!._id)) {
    // Para o cliente é 404, mas no log fica registrado que alguém tentou acessar chamado alheio.
    await registrar(req, {
      acao: "acesso.negado",
      resultado: "negado",
      alvo: { tipo: "ticket", id: ticket._id },
      detalhes: { metodo: req.method, rota: req.originalUrl, motivo: "chamado_de_outro_usuario" },
    });
    throw new HttpError(404, "Chamado não encontrado");
  }
  return ticket;
}

function arquivar(ticket: TicketDocument, req: Request) {
  if (ticket.status === "aberto" || ticket.status === "em_andamento") ticket.status = "fechado";
  ticket.arquivado = true;
  ticket.arquivadoEm = new Date();
  ticket.arquivadoPor = req.user!._id;
}

ticketsRouter.post("/", async (req, res) => {
  const dados = criarSchema.parse(req.body);
  const ticket = await TicketModel.create({ ...dados, solicitante: req.user!._id });
  await registrar(req, {
    acao: "ticket.criar",
    resultado: "sucesso",
    alvo: { tipo: "ticket", id: ticket._id },
    detalhes: { titulo: ticket.titulo, prioridade: ticket.prioridade },
  });
  res.status(201).json(await ticket.populate(POPULAR));
});

ticketsRouter.get("/", async (req, res) => {
  const q = listarSchema.parse(req.query);
  const user = req.user!;

  const filtro: QueryFilter<Ticket> = { arquivado: q.arquivados === "true" };
  if (q.status) filtro.status = q.status;
  if (q.prioridade) filtro.prioridade = q.prioridade;
  if (user.papel === "usuario") filtro.solicitante = user._id; // usuário só enxerga os próprios
  if (q.atribuidosAMim === "true") filtro.tecnicoResponsavel = user._id;

  const [itens, total] = await Promise.all([
    TicketModel.find(filtro)
      .sort({ criadoEm: -1 })
      .skip((q.pagina - 1) * q.limite)
      .limit(q.limite)
      .populate(POPULAR),
    TicketModel.countDocuments(filtro),
  ]);
  res.json({ itens, total, pagina: q.pagina, limite: q.limite });
});

ticketsRouter.get("/:id", async (req, res) => {
  const ticket = await buscarVisivel(req);
  res.json(await ticket.populate(POPULAR));
});

ticketsRouter.patch("/:id", async (req, res) => {
  const ticket = await buscarVisivel(req);
  const user = req.user!;
  const antes = ticket.toObject();

  if (user.papel === "usuario") {
    const { arquivado, ...dados } = editarUsuarioSchema.parse(req.body);
    if (ticket.arquivado) throw new HttpError(409, "Chamado arquivado não pode ser alterado");
    if (Object.keys(dados).length > 0 && ticket.status !== "aberto") {
      throw new HttpError(409, "Só é possível editar chamados com status 'aberto'");
    }
    ticket.set(dados);
    if (arquivado) arquivar(ticket, req);
  } else {
    const schema = user.papel === "admin" ? editarAdminSchema : editarTecnicoSchema;
    const { tecnicoResponsavel, arquivado, ...dados } = schema.parse(req.body) as z.infer<typeof editarAdminSchema>;

    if (ticket.arquivado) {
      if (arquivado !== false) throw new HttpError(409, "Chamado arquivado não pode ser alterado");
      ticket.arquivado = false;
      ticket.arquivadoEm = null;
      ticket.arquivadoPor = null;
    }

    if (tecnicoResponsavel !== undefined) {
      if (tecnicoResponsavel !== null) {
        if (user.papel === "tecnico" && tecnicoResponsavel !== user.id) {
          throw new HttpError(403, "Técnico só pode atribuir o chamado a si mesmo");
        }
        const responsavel = await UserModel.findById(tecnicoResponsavel);
        if (!responsavel || !responsavel.ativo || responsavel.papel === "usuario") {
          throw new HttpError(400, "Responsável deve ser um técnico ou admin ativo");
        }
      }
      if (
        user.papel === "tecnico" &&
        tecnicoResponsavel === null &&
        ticket.tecnicoResponsavel &&
        !ticket.tecnicoResponsavel.equals(user._id)
      ) {
        throw new HttpError(403, "Chamado atribuído a outro técnico");
      }
      ticket.set("tecnicoResponsavel", tecnicoResponsavel);
    }

    ticket.set(dados);
    if (dados.status === "em_andamento" && !ticket.tecnicoResponsavel) ticket.tecnicoResponsavel = user._id;
    if (arquivado === true) arquivar(ticket, req);
  }

  await ticket.save();

  const mudancas: Record<string, unknown> = diferencas(antes, ticket.toObject(), [
    "titulo",
    "status",
    "prioridade",
    "tecnicoResponsavel",
    "arquivado",
  ]);
  if (antes.descricao !== ticket.descricao) mudancas.descricao = "alterada"; // texto longo: só registra que mudou
  const acao =
    !antes.arquivado && ticket.arquivado ? "ticket.arquivar" : antes.arquivado && !ticket.arquivado ? "ticket.desarquivar" : "ticket.atualizar";
  await registrar(req, { acao, resultado: "sucesso", alvo: { tipo: "ticket", id: ticket._id }, detalhes: mudancas });

  res.json(await ticket.populate(POPULAR));
});

ticketsRouter.delete("/:id", requireRole("admin"), async (req, res) => {
  const ticket = await buscarVisivel(req);
  await ticket.deleteOne();
  await registrar(req, {
    acao: "ticket.excluir",
    resultado: "sucesso",
    alvo: { tipo: "ticket", id: ticket._id },
    detalhes: { titulo: ticket.titulo, status: ticket.status, solicitante: ticket.solicitante },
  });
  res.status(204).end();
});
