# Gestão Remota de Chamados

CRUD de chamados de suporte com **MongoDB**, API em **Node/TypeScript (Express + Mongoose)** e interface em **React**, seguindo os princípios de **Zero Trust**: *nunca confiar, sempre verificar*.

## Arquitetura

```
Navegador ──HTTPS──▶ Cloudflare ──túnel criptografado──▶ Vite (127.0.0.1:4173)
                                                            │ /api
                                                            ▼
                                                     API Express (127.0.0.1:3000)
                                                            │ usuário com permissão mínima
                                                            ▼
                                                     MongoDB/Docker (127.0.0.1:27018, --auth)
```

Nenhum serviço escuta fora de `127.0.0.1`. Só o front passa pelo túnel; a API e o banco não ficam expostos.

## Como rodar

Requisitos: Docker, Node 24 e, para compartilhar, `cloudflared`.

```bash
cp .env.example .env      # preencha senhas e um JWT_SECRET com 32+ caracteres
chmod 600 .env
./app start               # sobe Mongo + API + front → http://localhost:5173
./app share               # opcional: gera um link público https://*.trycloudflare.com
./app status | logs | stop
```

Na primeira execução é criado um admin com `ADMIN_EMAIL`/`ADMIN_SENHA` do `.env`. Se `ADMIN_SENHA` estiver vazia, uma senha aleatória é exibida uma única vez.

Testes de integração: `cd backend && npm test`.

## Papéis

| Papel | Pode |
|---|---|
| `usuario` | Criar chamados; ver, editar (enquanto abertos) e arquivar **apenas os próprios** |
| `tecnico` | Ver todos; mudar status/prioridade; assumir chamados |
| `admin` | Tudo + atribuir técnicos, excluir, gerenciar usuários e ver a auditoria |

Contas são criadas só pelo admin (não há cadastro público).

## Zero Trust

| Princípio | Como foi atendido |
|---|---|
| **Autenticação em toda requisição** | JWT HS256 com expiração de 15 min. A cada requisição o usuário é relido do banco, então desativar uma conta ou mudar o papel vale na hora |
| **Menor privilégio** | Regras por papel validadas na API (esconder botões no front é só UX). Chamado de outro usuário retorna 404, sem revelar que existe |
| **Senhas** | bcrypt (custo 12), política de senha forte, hash nunca retornado pela API |
| **Banco protegido** | MongoDB com `--auth`. A app usa uma role própria: CRUD só em `users`/`tickets` e só leitura/inserção em `auditlogs`. Root apenas na inicialização |
| **Segredos fora do código** | `.env` fora do git (permissão 600), validado com zod ao subir. Sem senhas padrão no código |
| **Validação de entrada** | zod `.strict()` em todos os corpos (campo extra → 400) + `sanitizeFilter` do Mongoose contra NoSQL injection |
| **Auditoria** | Logins, falhas, acessos negados e toda alteração (com quem, quando, IP e o que mudou). Logs são *append-only*: nem a própria app consegue alterá-los ou apagá-los |
| **Força bruta** | Login limitado a 5 falhas / 15 min por IP; limite global de 300 req / 15 min; mesma mensagem e mesmo tempo de resposta para usuário inexistente ou senha errada |
| **Cabeçalhos/CORS** | `helmet`, CORS restrito à origem do front, limite de tamanho do corpo, erros sem stack ou mensagem do banco |
| **Comunicação criptografada** | Ver abaixo |

### HTTPS / TLS

- **Neste projeto:** o acesso externo (`./app share`) usa HTTPS. O TLS termina no Cloudflare e de lá até a máquina o tráfego segue por um túnel criptografado. Internamente, front, API e banco conversam apenas via `127.0.0.1`.
- **Em produção:** certificado válido (ex.: Let's Encrypt) em um proxy reverso (Nginx/Caddy) ou no próprio Cloudflare, com HSTS e redirecionamento de HTTP→HTTPS. MongoDB com TLS habilitado (`--tlsMode requireTLS`) caso fique em outro servidor, e acesso ao banco restrito por rede privada/firewall.

## Estrutura

```
app                  script para iniciar/parar/compartilhar
docker-compose.yml   MongoDB (+ docker/mongo-init: usuário e role da app)
backend/             API: config, models, routes, middleware, audit, tests
frontend/            React + Vite: Login, Chamados, Usuários, Auditoria
```
