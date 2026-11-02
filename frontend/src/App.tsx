import { useEffect, useState } from "react";
import { api, getToken, onNaoAutenticado, setToken } from "./api";
import { ROTULO_PAPEL, type Usuario } from "./types";
import { Login } from "./pages/Login";
import { Chamados } from "./pages/Chamados";
import { Usuarios } from "./pages/Usuarios";
import { Auditoria } from "./pages/Auditoria";

type Aba = "chamados" | "usuarios" | "auditoria";

export function App() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [aba, setAba] = useState<Aba>("chamados");
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    // Se a API responder 401 em qualquer tela (token expirou, conta desativada), volta pro login.
    onNaoAutenticado(() => {
      setUsuario(null);
      setAviso("Sua sessão expirou ou foi encerrada. Entre novamente.");
    });
    // Ao abrir a página com token salvo, confirma com a API quem é o usuário (não confia no que está salvo).
    if (getToken()) {
      api<Usuario>("GET", "/auth/me")
        .then(setUsuario)
        .catch(() => setToken(null))
        .finally(() => setCarregando(false));
    } else {
      setCarregando(false);
    }
  }, []);

  function sair() {
    setToken(null);
    setUsuario(null);
    setAba("chamados");
    setAviso("");
  }

  if (carregando) return <p className="centro">Carregando...</p>;

  if (!usuario) {
    return (
      <Login
        aviso={aviso}
        aoEntrar={(u) => {
          setUsuario(u);
          setAviso("");
        }}
      />
    );
  }

  const ehAdmin = usuario.papel === "admin";

  return (
    <div className="app">
      <header className="topo">
        <strong>Gestão de Chamados</strong>
        <nav>
          <button className={aba === "chamados" ? "ativa" : ""} onClick={() => setAba("chamados")}>
            Chamados
          </button>
          {/* Esconder o menu é só conforto visual: quem bloqueia de verdade é a API (403). */}
          {ehAdmin && (
            <>
              <button className={aba === "usuarios" ? "ativa" : ""} onClick={() => setAba("usuarios")}>
                Usuários
              </button>
              <button className={aba === "auditoria" ? "ativa" : ""} onClick={() => setAba("auditoria")}>
                Auditoria
              </button>
            </>
          )}
        </nav>
        <div className="quem">
          <span>
            {usuario.nome} <small className={`papel papel-${usuario.papel}`}>{ROTULO_PAPEL[usuario.papel]}</small>
          </span>
          <button onClick={sair}>Sair</button>
        </div>
      </header>

      <main>
        {aba === "chamados" && <Chamados usuario={usuario} />}
        {aba === "usuarios" && ehAdmin && <Usuarios usuario={usuario} />}
        {aba === "auditoria" && ehAdmin && <Auditoria />}
      </main>
    </div>
  );
}
