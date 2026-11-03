#!/usr/bin/env bash
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")" && pwd)"
RUN="$RAIZ/.run"
mkdir -p "$RUN"

rodando() { [ -f "$RUN/$1.pid" ] && kill -0 "$(cat "$RUN/$1.pid")" 2>/dev/null; }

esperar_porta() {
  for _ in $(seq 1 40); do curl -s -o /dev/null "$1" && return 0; sleep 0.5; done
  echo "  ✗ $2 não respondeu. Veja: ./app logs ${3:-}"; return 1
}

start() {
  [ -f "$RAIZ/.env" ] || { echo "Falta o arquivo .env (copie de .env.example e troque as senhas)"; exit 1; }

  echo "▶ MongoDB"
  if ! saida=$(docker compose -f "$RAIZ/docker-compose.yml" up -d --wait 2>&1); then
    echo "$saida"; exit 1
  fi
  echo "  ✓ container chamados-mongo saudável (127.0.0.1:27018)"

  for dir in backend frontend; do
    [ -d "$RAIZ/$dir/node_modules" ] || { echo "▶ Instalando dependências de $dir"; (cd "$RAIZ/$dir" && npm install --silent); }
  done

  echo "▶ Admin"
  (cd "$RAIZ/backend"; node --import tsx --env-file=../.env src/scripts/seed-admin.ts)

  echo "▶ API"
  if rodando api; then echo "  • já estava rodando"; else
    (cd "$RAIZ/backend"; nohup node --import tsx --env-file=../.env src/server.ts >"$RUN/api.log" 2>&1 & echo $! >"$RUN/api.pid")
    esperar_porta http://127.0.0.1:3000/health API api && echo "  ✓ http://127.0.0.1:3000"
  fi

  echo "▶ Interface"
  if rodando front; then echo "  • já estava rodando"; else
    (cd "$RAIZ/frontend"; nohup node node_modules/vite/bin/vite.js >"$RUN/front.log" 2>&1 & echo $! >"$RUN/front.pid")
    esperar_porta http://localhost:5173 Interface front && echo "  ✓ http://localhost:5173"
  fi
}

# Config do tunel para facilitar
cloudflared_bin() {
  command -v cloudflared 2>/dev/null || { [ -x "$HOME/.local/bin/cloudflared" ] && echo "$HOME/.local/bin/cloudflared"; } || true
}

share() {
  local cf; cf=$(cloudflared_bin)
  [ -n "$cf" ] || { echo "cloudflared não encontrado. Instale e rode de novo (veja o CLAUDE.md)."; exit 1; }
  start

  echo "▶ Interface para o túnel (versão compilada)"
  (cd "$RAIZ/frontend" && npx vite build --logLevel error)
  if rodando preview; then echo "  • já estava rodando"; else
    (cd "$RAIZ/frontend"; nohup node node_modules/vite/bin/vite.js preview >"$RUN/preview.log" 2>&1 & echo $! >"$RUN/preview.pid")
    esperar_porta http://localhost:4173 Preview preview && echo "  ✓ http://localhost:4173"
  fi

  echo "▶ Túnel (Cloudflare)"
  if ! rodando tunel; then
    : >"$RUN/tunel.log"
    nohup "$cf" tunnel --no-autoupdate --url http://localhost:4173 >"$RUN/tunel.log" 2>&1 & echo $! >"$RUN/tunel.pid"
  fi
  local url=""
  for _ in $(seq 1 60); do
    url=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$RUN/tunel.log" | head -1 || true)
    [ -n "$url" ] && break
    sleep 0.5
  done
  [ -n "$url" ] || { echo "  ✗ túnel não subiu. Veja: ./app logs tunel"; exit 1; }
  echo "$url" >"$RUN/tunel.url"
  echo
  echo "  🌐 Link para os colegas: $url"
  echo "     (o link muda a cada ./app share; encerre com ./app unshare ou ./app stop)"
}

parar() {
  if rodando "$1"; then
    kill "$(cat "$RUN/$1.pid")" && echo "  ✓ $1 parado"
  else
    echo "  • $1 não estava rodando"
  fi
  rm -f "$RUN/$1.pid"
}

unshare() {
  echo "▶ Encerrando compartilhamento"
  parar tunel
  parar preview
  rm -f "$RUN/tunel.url"
}

stop() {
  unshare
  echo "▶ Parando"
  parar front
  parar api
  docker compose -f "$RAIZ/docker-compose.yml" stop >/dev/null 2>&1 && echo "  ✓ MongoDB parado (dados preservados)"
}

status() {
  local db
  db=$(docker inspect -f '{{.State.Status}}' chamados-mongo 2>/dev/null || echo "não existe")
  if [ "$db" = running ]; then
    echo "MongoDB:   rodando ($(docker inspect -f '{{.State.Health.Status}}' chamados-mongo), 127.0.0.1:27018)"
  else
    echo "MongoDB:   parado ($db)"
  fi
  rodando api && echo "API:       rodando (http://127.0.0.1:3000)" || echo "API:       parada"
  rodando front && echo "Interface: rodando (http://localhost:5173)" || echo "Interface: parada"
  rodando tunel && echo "Túnel:     $(cat "$RUN/tunel.url" 2>/dev/null || echo "subindo...")" || echo "Túnel:     desligado"
}

logs() {
  case "${1:-api}" in
    api) tail -f "$RUN/api.log" ;;
    front) tail -f "$RUN/front.log" ;;
    tunel) tail -f "$RUN/tunel.log" ;;
    db) docker compose -f "$RAIZ/docker-compose.yml" logs -f mongo ;;
    *) echo "Uso: ./app logs [api|front|tunel|db]"; exit 1 ;;
  esac
}

case "${1:-}" in
  start) start ;;
  stop) stop ;;
  restart) stop; start ;;
  status) status ;;
  share) share ;;
  unshare) unshare ;;
  logs) logs "${2:-}" ;;
  *) echo "Uso: ./app start | stop | restart | status | share | unshare | logs [api|front|tunel|db]"; exit 1 ;;
esac
