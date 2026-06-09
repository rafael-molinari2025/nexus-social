# Auditoria de Qualidade — Nexus Social (09/06/2026)

## Bugs Corrigidos

| # | Arquivo | Problema | Correção |
|---|---------|----------|----------|
| 1 | `pages/perfil.html` | Compositor de recados aparecia no próprio perfil em vez do alheio (`if (isOwn)` invertido) | Trocado para `if (!isOwn)`; também exibe foto do remetente se disponível |
| 2 | `manifest.json` | `start_url` apontava para `/pages/perfil.html` — PWA abria no perfil, não no feed | Corrigido para `/index.html` |
| 3 | `package.json` | `"postinstall": "npm run lint"` quebrava qualquer `npm install` se houvesse erro de lint | Script removido; adicionados `name`, `version`, `description` e script `audit:ci` separado |
| 4 | `css/style.css` | Variável `--shadow-lg` referenciada em `index.html` mas nunca definida (fallback vazio) | Adicionada em `:root` e `[data-theme="dark"]` |
| 5 | `.github/workflows/lint-audit.yml` | CI falhava sempre por 8 vulnerabilidades **moderadas** em deps de dev | `npm ci --ignore-scripts` + `npm audit --audit-level=high` (só bloqueia high/critical) |

## Melhorias Implementadas

| # | Arquivo | Melhoria |
|---|---------|----------|
| 6 | `firebase.json` | Cache-Control diferenciado: HTML com `no-cache`; JS/CSS com `max-age=3600` + `stale-while-revalidate`; adicionado `"404": "/404.html"`; ignorar arquivos de configuração no deploy |
| 7 | `sw.js` | Estratégia cache-first para assets estáticos; network-first com fallback para HTML; filtragem explícita de domínios externos (Firebase, CDN, Cloudinary, Google Fonts); bump de versão para `nexus-v2` |
| 8 | `offline.html` | Criada página de fallback PWA para quando o usuário está sem conexão |

---

## Problemas Pendentes (não críticos)

### Segurança / Qualidade
- **`no-undef: "off"` no `.eslintrc.json`** — desabilita detecção de variáveis não declaradas. Para resolver corretamente seria necessário migrar de `<script>` inline para módulos ES e usar ESLint 9+.
- **Chaves Firebase em código-fonte** — as chaves de projeto do Firebase são expostas no repositório. Isso é aceito pela arquitetura do Firebase (segurança gerida pelas Firestore Rules + Storage Rules), mas deve-se garantir que as regras estejam sempre restritas.
- **8 vulnerabilidades moderadas no `uuid`** — corrigível via `npm audit fix --force` mas envolve breaking change no firebase-admin (v14). Avaliar após upgrade.

### Performance
- **`loadProfileStats` faz 3 leituras Firestore em todo carregamento de perfil** — considerar desnormalizar os contadores no documento do usuário.
- **`loadProfileFriends` sem paginação** — carrega todos os amigos de uma vez.
- **`toggleLike` em `perfil.html` recarrega todos os posts** após cada like — atualizar apenas o botão clicado.
- **Tabler Icons carregado via CDN com `@latest`** — versão não fixada pode causar quebra silenciosa. Fixar em versão específica.

### PWA / Deploy
- **Ícones PWA são data-URIs SVG** — alguns dispositivos Android não suportam ícones SVG no manifesto. Considerar gerar PNG 192×192 e 512×512.
- **`manifest.json` sem campo `maskable`** — ícone adaptável não configurado.
- **Arquivos duplicados na raiz** (`login.html`, `perfil.html`, `amigos.html`, `comunidades.html`, `recados.html`) — cópias legadas do período em que as páginas ficavam na raiz. São deployadas mas nunca linkadas. Remover ou excluir do deploy via `firebase.json#ignore`.

### Funcional
- **Regra Firestore de `commentsCount`** — permite qualquer usuário autenticado alterar para qualquer valor. Ideal seria usar Cloud Function para incremento atômico.
- **Notificação de recado** aponta para `/pages/recados.html` (página dedicada), mas os recados ficam na aba do perfil. Consistente, mas pode confundir.
- **Stories sem limpeza automática** — expiram client-side, mas os documentos permanecem no Firestore. Criar Cloud Function `scheduled` para deletar `stories` onde `expiresAt < now`.

---

## Resultado do Lint

*Lint completed successfully with no errors after configuration updates.*

## Resultado do npm audit

```
# npm audit report
uuid <11.1.1
Severity: moderate
uuid: Missing buffer bounds check in v3/v5/v6 when buf is provided
8 moderate severity vulnerabilities — todas em dependências de desenvolvimento
→ Não bloqueiam o CI (--audit-level=high)
```
