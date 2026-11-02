import { useCallback, useEffect, useState } from "react";
import { api, mensagemErro, query } from "../api";
import { ROTULO_PAPEL, type LogAuditoria, type Pagina } from "../types";
import { Paginacao } from "../components/Paginacao";
import { dataHora } from "../util";

const ACOES = [
  "auth.login",
  "auth.login_falhou",
  "auth.login_bloqueado",
  "acesso.negado",
  "user.criar",
  "user.atualizar",
  "ticket.criar",
  "ticket.atualizar",
  "ticket.arquivar",
  "ticket.desarquivar",
  "ticket.excluir",
];

// Tela só do admin, somente leitura.
export function Auditoria() {
  const [filtros, setFiltros] = useState({ acao: "", resultado: "" });
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<Pagina<LogAuditoria> | null>(null);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setErro("");
    try {
      setDados(await api<Pagina<LogAuditoria>>("GET", `/audit${query({ ...filtros, pagina, limite: 25 })}`));
    } catch (e) {
      setErro(mensagemErro(e));
    }
  }, [filtros, pagina]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <section className="card">
      <div className="barra">
        <h2>Auditoria</h2>
        <button onClick={() => void carregar()}>Atualizar</button>
      </div>
      <div className="filtros">
        <select
          value={filtros.acao}
          onChange={(e) => {
            setFiltros({ ...filtros, acao: e.target.value });
            setPagina(1);
          }}
        >
          <option value="">Todas as ações</option>
          {ACOES.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          value={filtros.resultado}
          onChange={(e) => {
            setFiltros({ ...filtros, resultado: e.target.value });
            setPagina(1);
          }}
        >
          <option value="">Todos os resultados</option>
          <option value="sucesso">Sucesso</option>
          <option value="falha">Falha</option>
          <option value="negado">Negado</option>
        </select>
      </div>
      {erro && <p className="erro">{erro}</p>}
      <table className="auditoria">
        <thead>
          <tr>
            <th>Quando</th>
            <th>Quem</th>
            <th>Ação</th>
            <th>Resultado</th>
            <th>Alvo</th>
            <th>IP</th>
            <th>Detalhes</th>
          </tr>
        </thead>
        <tbody>
          {dados?.itens.map((l) => (
            <tr key={l._id}>
              <td>{dataHora(l.criadoEm)}</td>
              <td>{l.ator ? `${l.ator.email} (${ROTULO_PAPEL[l.ator.papel]})` : <em>anônimo</em>}</td>
              <td>
                <code>{l.acao}</code>
              </td>
              <td>
                <span className={`etiqueta res-${l.resultado}`}>{l.resultado}</span>
              </td>
              <td>{l.alvo ? `${l.alvo.tipo} …${l.alvo.id.slice(-6)}` : "—"}</td>
              <td>{l.ip ?? "—"}</td>
              <td>{l.detalhes ? <pre>{JSON.stringify(l.detalhes, null, 1)}</pre> : "—"}</td>
            </tr>
          ))}
          {dados && dados.itens.length === 0 && (
            <tr>
              <td colSpan={7} className="vazio">
                Nenhum registro.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {dados && <Paginacao pagina={dados.pagina} limite={dados.limite} total={dados.total} aoMudar={setPagina} />}
    </section>
  );
}
