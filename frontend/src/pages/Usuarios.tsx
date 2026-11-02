import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, mensagemErro } from "../api";
import { PAPEIS, ROTULO_PAPEL, type Papel, type Usuario } from "../types";
import { dataHora } from "../util";

// Tela só do admin (a API também bloqueia /users para os outros papéis).
export function Usuarios({ usuario }: { usuario: Usuario }) {
  const [lista, setLista] = useState<Usuario[]>([]);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");

  const carregar = useCallback(async () => {
    try {
      setLista(await api<Usuario[]>("GET", "/users"));
    } catch (e) {
      setErro(mensagemErro(e));
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function alterar(u: Usuario, corpo: Record<string, unknown>, mensagem: string) {
    setErro("");
    setOk("");
    try {
      await api("PATCH", `/users/${u._id}`, corpo);
      setOk(mensagem);
      void carregar();
    } catch (e) {
      setErro(mensagemErro(e));
    }
  }

  function trocarSenha(u: Usuario) {
    const senha = prompt(`Nova senha para ${u.nome} (mín. 10 caracteres, com maiúscula, minúscula e número):`);
    if (senha) void alterar(u, { senha }, `Senha de ${u.nome} alterada`);
  }

  return (
    <div className="usuarios">
      <NovoUsuario
        aoCriar={(u) => {
          setOk(`Usuário ${u.nome} criado`);
          void carregar();
        }}
      />

      <section className="card">
        <h2>Usuários</h2>
        {ok && <p className="ok">{ok}</p>}
        {erro && <p className="erro">{erro}</p>}
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Email</th>
              <th>Papel</th>
              <th>Situação</th>
              <th>Criado em</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lista.map((u) => {
              const souEu = u._id === usuario._id;
              return (
                <tr key={u._id} className={u.ativo ? "" : "inativo"}>
                  <td>
                    {u.nome} {souEu && <small>(você)</small>}
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      value={u.papel}
                      disabled={souEu}
                      onChange={(e) => alterar(u, { papel: e.target.value }, `Papel de ${u.nome} alterado`)}
                    >
                      {PAPEIS.map((p) => (
                        <option key={p} value={p}>
                          {ROTULO_PAPEL[p]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{u.ativo ? "Ativo" : "Desativado"}</td>
                  <td>{dataHora(u.criadoEm)}</td>
                  <td>
                    <div className="acoes inicio">
                      <button onClick={() => trocarSenha(u)}>Trocar senha</button>
                      {!souEu && (
                        <button onClick={() => alterar(u, { ativo: !u.ativo }, `${u.nome} ${u.ativo ? "desativado" : "reativado"}`)}>
                          {u.ativo ? "Desativar" : "Reativar"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function NovoUsuario({ aoCriar }: { aoCriar: (u: Usuario) => void }) {
  const vazio = { nome: "", email: "", senha: "", papel: "usuario" as Papel };
  const [form, setForm] = useState(vazio);
  const [erro, setErro] = useState("");

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    try {
      aoCriar(await api<Usuario>("POST", "/users", form));
      setForm(vazio);
    } catch (e) {
      setErro(mensagemErro(e));
    }
  }

  return (
    <form className="card" onSubmit={salvar}>
      <h3>Novo usuário</h3>
      <div className="linha">
        <label>
          Nome
          <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required minLength={2} />
        </label>
        <label>
          Email
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </label>
        <label>
          Senha inicial
          <input
            type="password"
            value={form.senha}
            onChange={(e) => setForm({ ...form, senha: e.target.value })}
            required
            minLength={10}
            autoComplete="new-password"
          />
        </label>
        <label>
          Papel
          <select value={form.papel} onChange={(e) => setForm({ ...form, papel: e.target.value as Papel })}>
            {PAPEIS.map((p) => (
              <option key={p} value={p}>
                {ROTULO_PAPEL[p]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <small className="dica">Senha: mínimo 10 caracteres, com letra maiúscula, minúscula e número.</small>
      {erro && <p className="erro">{erro}</p>}
      <div className="acoes">
        <button className="primario">Criar usuário</button>
      </div>
    </form>
  );
}
