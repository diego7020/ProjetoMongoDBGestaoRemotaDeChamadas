import { useEffect, useState, type FormEvent } from "react";
import { api, mensagemErro } from "../api";
import {
  PRIORIDADES,
  ROTULO_PRIORIDADE,
  ROTULO_STATUS,
  STATUS,
  type Chamado,
  type Prioridade,
  type Status,
  type Usuario,
} from "../types";
import { dataHora } from "../util";

interface Props {
  id: string;
  usuario: Usuario;
  aoMudar: () => void;
  aoExcluir: () => void;
  aoFechar: () => void;
}

// Mostra só as ações que o papel pode fazer (as mesmas regras da API).
// Isso é só para a tela ficar limpa: se alguém burlar o frontend, a API recusa do mesmo jeito.
export function ChamadoDetalhe({ id, usuario, aoMudar, aoExcluir, aoFechar }: Props) {
  const [chamado, setChamado] = useState<Chamado | null>(null);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [tecnicos, setTecnicos] = useState<Usuario[]>([]);

  const papel = usuario.papel;
  const ehDono = chamado?.solicitante?._id === usuario._id;

  useEffect(() => {
    api<Chamado>("GET", `/tickets/${id}`).then(setChamado, (e) => setErro(mensagemErro(e)));
    // Só admin pode listar usuários (para escolher o responsável)
    if (papel === "admin") {
      api<Usuario[]>("GET", "/users").then((us) => setTecnicos(us.filter((u) => u.ativo && u.papel !== "usuario")));
    }
  }, [id, papel]);

  async function alterar(corpo: Record<string, unknown>, mensagem = "Chamado atualizado") {
    setErro("");
    setOk("");
    try {
      setChamado(await api<Chamado>("PATCH", `/tickets/${id}`, corpo));
      setOk(mensagem);
      aoMudar();
    } catch (e) {
      setErro(mensagemErro(e));
    }
  }

  async function excluir() {
    if (!confirm("Excluir este chamado definitivamente?")) return;
    try {
      await api("DELETE", `/tickets/${id}`);
      aoExcluir();
    } catch (e) {
      setErro(mensagemErro(e));
    }
  }

  if (!chamado) return <div className="card">{erro ? <p className="erro">{erro}</p> : "Carregando..."}</div>;

  const travado = chamado.arquivado;
  const podeEditarTexto = !travado && (papel === "admin" || (ehDono && chamado.status === "aberto"));
  const podeArquivar = !travado && (papel === "admin" || ehDono);
  const souResponsavel = chamado.tecnicoResponsavel?._id === usuario._id;

  return (
    <div className="card detalhe">
      <div className="barra">
        <h3>{chamado.titulo}</h3>
        <button onClick={aoFechar} title="Fechar">
          ✕
        </button>
      </div>

      <div className="etiquetas">
        <span className={`etiqueta status-${chamado.status}`}>{ROTULO_STATUS[chamado.status]}</span>
        <span className={`etiqueta prio-${chamado.prioridade}`}>{ROTULO_PRIORIDADE[chamado.prioridade]}</span>
        {chamado.arquivado && <span className="etiqueta arquivado">Arquivado</span>}
      </div>

      <dl>
        <dt>Solicitante</dt>
        <dd>{chamado.solicitante ? `${chamado.solicitante.nome} (${chamado.solicitante.email})` : "—"}</dd>
        <dt>Responsável</dt>
        <dd>{chamado.tecnicoResponsavel?.nome ?? "Ninguém ainda"}</dd>
        <dt>Aberto em</dt>
        <dd>{dataHora(chamado.criadoEm)}</dd>
        {chamado.fechadoEm && (
          <>
            <dt>Fechado em</dt>
            <dd>{dataHora(chamado.fechadoEm)}</dd>
          </>
        )}
      </dl>

      {podeEditarTexto ? (
        <EditarTexto chamado={chamado} podePrioridade={papel === "usuario"} aoSalvar={(c) => alterar(c)} />
      ) : (
        <p className="descricao">{chamado.descricao}</p>
      )}

      {/* Técnico e admin: atendimento */}
      {papel !== "usuario" && !travado && (
        <div className="bloco">
          <h4>Atendimento</h4>
          <div className="linha">
            <label>
              Status
              <select value={chamado.status} onChange={(e) => alterar({ status: e.target.value as Status })}>
                {STATUS.map((s) => (
                  <option key={s} value={s}>
                    {ROTULO_STATUS[s]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Prioridade
              <select value={chamado.prioridade} onChange={(e) => alterar({ prioridade: e.target.value as Prioridade })}>
                {PRIORIDADES.map((p) => (
                  <option key={p} value={p}>
                    {ROTULO_PRIORIDADE[p]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {papel === "admin" ? (
            <label>
              Responsável
              <select
                value={chamado.tecnicoResponsavel?._id ?? ""}
                onChange={(e) => alterar({ tecnicoResponsavel: e.target.value || null })}
              >
                <option value="">Ninguém</option>
                {tecnicos.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="acoes">
              {!chamado.tecnicoResponsavel && (
                <button onClick={() => alterar({ tecnicoResponsavel: usuario._id }, "Você assumiu o chamado")}>Assumir chamado</button>
              )}
              {souResponsavel && (
                <button onClick={() => alterar({ tecnicoResponsavel: null }, "Você saiu do chamado")}>Deixar de ser responsável</button>
              )}
            </div>
          )}
        </div>
      )}

      {ok && <p className="ok">{ok}</p>}
      {erro && <p className="erro">{erro}</p>}

      {(podeArquivar || papel === "admin") && (
      <div className="acoes perigo">
        {podeArquivar && (
          <button
            onClick={() => {
              const aviso = chamado.status === "aberto" || chamado.status === "em_andamento" ? " Ele será fechado." : "";
              if (confirm(`Arquivar este chamado?${aviso}`)) void alterar({ arquivado: true }, "Chamado arquivado");
            }}
          >
            Arquivar
          </button>
        )}
        {papel === "admin" && travado && <button onClick={() => alterar({ arquivado: false }, "Chamado desarquivado")}>Desarquivar</button>}
        {papel === "admin" && (
          <button className="vermelho" onClick={excluir}>
            Excluir
          </button>
        )}
      </div>
      )}
    </div>
  );
}

function EditarTexto({
  chamado,
  podePrioridade,
  aoSalvar,
}: {
  chamado: Chamado;
  podePrioridade: boolean;
  aoSalvar: (c: Record<string, unknown>) => void;
}) {
  const [titulo, setTitulo] = useState(chamado.titulo);
  const [descricao, setDescricao] = useState(chamado.descricao);
  const [prioridade, setPrioridade] = useState(chamado.prioridade);

  // Manda só o que mudou
  function salvar(e: FormEvent) {
    e.preventDefault();
    const corpo: Record<string, unknown> = {};
    if (titulo !== chamado.titulo) corpo.titulo = titulo;
    if (descricao !== chamado.descricao) corpo.descricao = descricao;
    if (podePrioridade && prioridade !== chamado.prioridade) corpo.prioridade = prioridade;
    if (Object.keys(corpo).length) aoSalvar(corpo);
  }

  return (
    <form className="bloco" onSubmit={salvar}>
      <label>
        Título
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} required minLength={3} maxLength={120} />
      </label>
      <label>
        Descrição
        <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} required maxLength={5000} rows={5} />
      </label>
      {podePrioridade && (
        <label>
          Prioridade
          <select value={prioridade} onChange={(e) => setPrioridade(e.target.value as Prioridade)}>
            {PRIORIDADES.map((p) => (
              <option key={p} value={p}>
                {ROTULO_PRIORIDADE[p]}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="acoes">
        <button className="primario">Salvar alterações</button>
      </div>
    </form>
  );
}
