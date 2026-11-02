// Única porta de entrada para a API. Toda requisição leva o token (Zero Trust:
// o frontend não "decide" nada sozinho — quem autoriza é sempre o backend).
const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3000";
const CHAVE_TOKEN = "token";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public campos: Record<string, string[]> = {},
  ) {
    super(message);
  }
}

// Token fica no sessionStorage: some ao fechar a aba e expira em 15 min no backend.
// (Guardar só em memória seria ainda mais seguro, mas perderia o login a cada F5.)
export function getToken(): string | null {
  return sessionStorage.getItem(CHAVE_TOKEN);
}
export function setToken(token: string | null) {
  if (token) sessionStorage.setItem(CHAVE_TOKEN, token);
  else sessionStorage.removeItem(CHAVE_TOKEN);
}

// Chamado quando a API responde 401 (token expirado, usuário desativado...): volta para o login.
let aoDeslogar: () => void = () => {};
export function onNaoAutenticado(fn: () => void) {
  aoDeslogar = fn;
}

export async function api<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (corpo !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(API_URL + caminho, {
      method: metodo,
      headers,
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    });
  } catch {
    throw new ApiError(0, "Não foi possível conectar à API. Ela está rodando?");
  }

  if (res.status === 204) return undefined as T;
  const dados = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401 && caminho !== "/auth/login") {
      setToken(null);
      aoDeslogar();
    }
    throw new ApiError(res.status, dados.erro ?? `Erro ${res.status}`, dados.detalhes?.fieldErrors ?? {});
  }
  return dados as T;
}

// Monta "?a=1&b=2" ignorando valores vazios
export function query(params: Record<string, string | number | boolean | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function mensagemErro(e: unknown): string {
  if (e instanceof ApiError) {
    const campos = Object.entries(e.campos).map(([c, msgs]) => `${c}: ${msgs.join(", ")}`);
    return campos.length ? `${e.message} (${campos.join("; ")})` : e.message;
  }
  return "Erro inesperado";
}
