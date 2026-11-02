import { useState, type FormEvent } from "react";
import { api, mensagemErro, setToken } from "../api";
import type { Usuario } from "../types";

interface Props {
  aviso: string;
  aoEntrar: (u: Usuario) => void;
}

export function Login({ aviso, aoEntrar }: Props) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      const r = await api<{ token: string; usuario: Usuario }>("POST", "/auth/login", { email, senha });
      setToken(r.token);
      aoEntrar(r.usuario);
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setSenha(""); // não deixa a senha parada no estado
      setEnviando(false);
    }
  }

  return (
    <div className="login">
      <form className="card" onSubmit={entrar}>
        <h1>Gestão de Chamados</h1>
        {aviso && <p className="aviso">{aviso}</p>}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus autoComplete="username" />
        </label>
        <label>
          Senha
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required autoComplete="current-password" />
        </label>
        {erro && <p className="erro">{erro}</p>}
        <button className="primario" disabled={enviando}>
          {enviando ? "Entrando..." : "Entrar"}
        </button>
        <small className="dica">Contas são criadas pelo administrador.</small>
      </form>
    </div>
  );
}
