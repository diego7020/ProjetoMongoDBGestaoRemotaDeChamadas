import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, mensagemErro, query } from "../api";
import {
  PRIORIDADES,
  ROTULO_PRIORIDADE,
  ROTULO_STATUS,
  STATUS,
  type Chamado,
  type Pagina,
  type Prioridade,
  type Usuario,
} from "../types";
import { ChamadoDetalhe } from "../components/ChamadoDetalhe";
import { Paginacao } from "../components/Paginacao";
import { dataHora } from "../util";

export function Chamados({ usuario }: { usuario: Usuario }) {
  const [filtros, setFiltros] = useState({ status: "", prioridade: "", arquivados: false, atribuidosAMim: false });
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<Pagina<Chamado> | null>(null);
  const [erro, setErro] = useState("");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  const carregar = useCallback(async () => {
    setErro("");
    try {
      const q = query({
        status: filtros.status,
        prioridade: filtros.prioridade,
        arquivados: filtros.arquivados || undefined,
        atribuidosAMim: filtros.atribuidosAMim || undefined,
        pagina,
        limite: 15,
      });
      setDados(await api<Pagina<Chamado>>("GET", `/tickets${q}`));
    } catch (e) {
      setErro(mensagemErro(e));
    }
  }, [filtros, pagina]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function mudarFiltro(novo: Partial<typeof filtros>) {
    setFiltros((f) => ({ ...f, ...novo }));
    setPagina(1);
  }

  return (
    <div className="chamados">
      <section className="lista">
        <div className="barra">
          <h2>{usuario.papel === "usuario" ? "Meus chamados" : "Chamados"}</h2>
          <button className="primario" onClick={() => setCriando(true)}>
            + Novo chamado
          </button>
        </div>

        <div className="filtros">
          <select value={filtros.status} onChange={(e) => mudarFiltro({ status: e.target.value })}>
            <option value="">Todos os status</option>
            {STATUS.map((s) => (
              <option key={s} value={s}>
                {ROTULO_STATUS[s]}
              </option>
            ))}
          </select>
          <select value={filtros.prioridade} onChange={(e) => mudarFiltro({ prioridade: e.target.value })}>
            <option value="">Todas as prioridades</option>
            {PRIORIDADES.map((p) => (
              <option key={p} value={p}>
                {ROTULO_PRIORIDADE[p]}
              </option>
            ))}
          </select>
          <label className="check">
            <input type="checkbox" checked={filtros.arquivados} onChange={(e) => mudarFiltro({ arquivados: e.target.checked })} />
            Arquivados
          </label>
          {usuario.papel !== "usuario" && (
            <label className="check">
              <input
                type="checkbox"
                checked={filtros.atribuidosAMim}
                onChange={(e) => mudarFiltro({ atribuidosAMim: e.target.checked })}
              />
              Atribuídos a mim
            </label>
          )}
        </div>

        {erro && <p className="erro">{erro}</p>}

        <table>
          <thead>
            <tr>
              <th>Título</th>
              <th>Status</th>
              <th>Prioridade</th>
              {usuario.papel !== "usuario" && <th>Solicitante</th>}
              <th>Responsável</th>
              <th>Aberto em</th>
            </tr>
          </thead>
          <tbody>
            {dados?.itens.map((c) => (
              <tr key={c._id} className={c._id === selecionado ? "selecionado" : ""} onClick={() => setSelecionado(c._id)}>
                <td>{c.titulo}</td>
                <td>
                  <span className={`etiqueta status-${c.status}`}>{ROTULO_STATUS[c.status]}</span>
                </td>
                <td>
                  <span className={`etiqueta prio-${c.prioridade}`}>{ROTULO_PRIORIDADE[c.prioridade]}</span>
                </td>
                {usuario.papel !== "usuario" && <td>{c.solicitante?.nome ?? "—"}</td>}
                <td>{c.tecnicoResponsavel?.nome ?? "—"}</td>
                <td>{dataHora(c.criadoEm)}</td>
              </tr>
            ))}
            {dados && dados.itens.length === 0 && (
              <tr>
                <td colSpan={6} className="vazio">
                  Nenhum chamado encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {dados && <Paginacao pagina={dados.pagina} limite={dados.limite} total={dados.total} aoMudar={setPagina} />}
      </section>

      <aside className="painel">
        {criando ? (
          <NovoChamado
            aoCancelar={() => setCriando(false)}
            aoCriar={(c) => {
              setCriando(false);
              setSelecionado(c._id);
              void carregar();
            }}
          />
        ) : selecionado ? (
          <ChamadoDetalhe
            key={selecionado}
            id={selecionado}
            usuario={usuario}
            aoMudar={() => void carregar()}
            aoExcluir={() => {
              setSelecionado(null);
              void carregar();
            }}
            aoFechar={() => setSelecionado(null)}
          />
        ) : (
          <p className="vazio">Selecione um chamado para ver os detalhes.</p>
        )}
      </aside>
    </div>
  );
}

function NovoChamado({ aoCriar, aoCancelar }: { aoCriar: (c: Chamado) => void; aoCancelar: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState<Prioridade>("media");
  const [erro, setErro] = useState("");

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    try {
      aoCriar(await api<Chamado>("POST", "/tickets", { titulo, descricao, prioridade }));
    } catch (e) {
      setErro(mensagemErro(e));
    }
  }

  return (
    <form className="card" onSubmit={salvar}>
      <h3>Novo chamado</h3>
      <label>
        Título
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} required minLength={3} maxLength={120} />
      </label>
      <label>
        Descrição
        <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} required maxLength={5000} rows={5} />
      </label>
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
      {erro && <p className="erro">{erro}</p>}
      <div className="acoes">
        <button type="button" onClick={aoCancelar}>
          Cancelar
        </button>
        <button className="primario">Abrir chamado</button>
      </div>
    </form>
  );
}
