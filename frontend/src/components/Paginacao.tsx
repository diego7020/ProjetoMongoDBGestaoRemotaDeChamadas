interface Props {
  pagina: number;
  limite: number;
  total: number;
  aoMudar: (p: number) => void;
}

export function Paginacao({ pagina, limite, total, aoMudar }: Props) {
  const totalPaginas = Math.max(1, Math.ceil(total / limite));
  return (
    <div className="paginacao">
      <button disabled={pagina <= 1} onClick={() => aoMudar(pagina - 1)}>
        ‹ Anterior
      </button>
      <span>
        Página {pagina} de {totalPaginas} · {total} registro(s)
      </span>
      <button disabled={pagina >= totalPaginas} onClick={() => aoMudar(pagina + 1)}>
        Próxima ›
      </button>
    </div>
  );
}
