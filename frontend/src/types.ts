// Espelho dos tipos que a API devolve.
export const PAPEIS = ["usuario", "tecnico", "admin"] as const;
export type Papel = (typeof PAPEIS)[number];

export const STATUS = ["aberto", "em_andamento", "resolvido", "fechado"] as const;
export type Status = (typeof STATUS)[number];

export const PRIORIDADES = ["baixa", "media", "alta", "critica"] as const;
export type Prioridade = (typeof PRIORIDADES)[number];

export const ROTULO_STATUS: Record<Status, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  resolvido: "Resolvido",
  fechado: "Fechado",
};

export const ROTULO_PRIORIDADE: Record<Prioridade, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

export const ROTULO_PAPEL: Record<Papel, string> = {
  usuario: "Usuário",
  tecnico: "Técnico",
  admin: "Admin",
};

export interface Usuario {
  _id: string;
  nome: string;
  email: string;
  papel: Papel;
  ativo: boolean;
  criadoEm: string;
}

export interface Pessoa {
  _id: string;
  nome: string;
  email: string;
}

export interface Chamado {
  _id: string;
  titulo: string;
  descricao: string;
  status: Status;
  prioridade: Prioridade;
  solicitante: Pessoa;
  tecnicoResponsavel: Pessoa | null;
  fechadoEm: string | null;
  arquivado: boolean;
  arquivadoEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface LogAuditoria {
  _id: string;
  ator: { id: string; email: string; papel: Papel } | null;
  acao: string;
  resultado: "sucesso" | "falha" | "negado";
  alvo: { tipo: "ticket" | "user"; id: string } | null;
  ip: string | null;
  detalhes: Record<string, unknown> | null;
  criadoEm: string;
}

export interface Pagina<T> {
  itens: T[];
  total: number;
  pagina: number;
  limite: number;
}
