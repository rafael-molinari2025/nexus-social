# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Lint JS
npm run lint

# Lint CSS
npm run lint:css

# Auditoria de segurança (relatório completo)
npm run audit

# Deploy (hosting + regras + índices Firestore)
firebase deploy --only hosting,firestore:rules,firestore:indexes

# Deploy só do hosting
firebase deploy --only hosting
```

> **`npm install` não executa lint** — o `postinstall` foi removido intencionalmente.  
> `npm audit` retorna 8 vulnerabilidades moderadas em deps de dev (uuid em firebase-admin); o CI só bloqueia em high/critical via `npm run audit:ci`.

---

## Arquitetura

Projeto **vanilla HTML/CSS/JS** sem bundler, framework ou build step. Cada página é um arquivo HTML independente que carrega os scripts via `<script>` tags no final do body.

### Dois arquivos de núcleo compartilhados

Todo o projeto depende de dois arquivos incluídos em **todas** as páginas, nessa ordem:

1. **`js/firebase-config.js`** — inicializa o Firebase compat SDK e expõe os globais `auth`, `db`, `googleProvider` e `storage` (com try/catch, pois o Storage SDK não é carregado em todas as páginas).

2. **`js/utils.js`** — todas as funções utilitárias compartilhadas. Contém:
   - `requireAuth(callback)` — guard de autenticação; redireciona para login se não autenticado
   - `redirectIfLoggedIn()` — usado na página de login para redirecionar quem já está logado
   - `renderTopbar(userData, activePage)` — renderiza a topbar + bottom nav mobile em todas as páginas
   - `sanitize(str)` — escapa HTML; **obrigatório** em qualquer string de usuário inserida via `innerHTML`
   - `uploadToCloudinary(file, options?)` — único ponto de upload de imagens; chama `compressImage` automaticamente antes de enviar (desativável com `{ compress: false }`)
   - `avatarHTML(user, size?)` — gera `<div class="avatar avatar-{size}">` com foto ou iniciais coloridas; `user` precisa ter `uid`, `displayName` e opcionalmente `photoURL`
   - `getAvatarColor(uid)` → `{ bg, color }` — cor determinística baseada no uid
   - `getInitials(name)` — duas iniciais em maiúscula
   - `getUserData(uid)` / `updateUserData(uid, data)` — leitura e escrita com merge no doc de usuário
   - `createNotification(toUid, type, data)` — cria notificação no Firestore e envia push via Vercel
   - `notifIcon(type)` → `{ icon, bg, color }` — ícone Tabler para cada tipo de notificação
   - `showToast(msg)`, `timeAgo(ts)`, `openLightbox(srcs, startIdx?)`, `updateOnlineStatus(uid)`, `isOnline(user)`
   - `initTheme()` / `toggleTheme()` — lê `localStorage['nexus-theme']` (`'light'`/`'dark'`/`'auto'`) e aplica `data-theme` no `<html>`

### Estrutura de paths

As páginas em `pages/` usam caminhos relativos `../css/` e `../js/`. Para navegação entre páginas, `utils.js` expõe:

```js
const _isInPages = location.pathname.includes('/pages/');
const ROOT  = _isInPages ? '../' : './';   // link para index.html
const PAGES = _isInPages ? '' : 'pages/';  // prefixo para páginas em pages/
```

Use `ROOT` e `PAGES` ao construir hrefs dinâmicos (ex: `${PAGES}perfil.html?uid=...`).

### Firebase SDK

O projeto usa o **Firebase compat SDK v9** (não os módulos ES). A API é:
```js
db.collection('posts').add({...})
db.collection('users').doc(uid).get()
firebase.firestore.FieldValue.serverTimestamp()
firebase.firestore.FieldValue.arrayUnion(value)
auth.onAuthStateChanged(...)
```

Não usar `import { getFirestore } from 'firebase/firestore'`.

### Autenticação em cada página

Toda página protegida começa com:
```js
requireAuth(async user => {
  currentUser = user;
  const userData = await getUserData(user.uid) || { uid: user.uid, displayName: user.displayName };
  renderTopbar(userData, 'nomeDaPagina');
  // lógica da página...
});
```

A página de login usa `redirectIfLoggedIn()` em vez de `requireAuth`.

### APIs externas (Vercel)

O diretório `api/` contém serverless functions deployadas no **Vercel** (`nexus-social-fawn.vercel.app`), **não** no Firebase Hosting — o `firebase.json` exclui `api/**` do deploy. Funções:

- **`api/token.js`** — gera tokens RTC para o Agora.io usando `agora-token`. Aceita `?channel=<id>` e retorna `{ token, expireAt }`.
- **`api/notify.js`** — envia push notifications via Firebase Admin SDK. Chamado internamente por `sendPushToUser()` em `utils.js`; requer `Authorization: Bearer <idToken>` e body `{ toUid, title, body, url, tag }`.
- **`api/moderate.js`** — modera texto de posts via Claude Haiku antes da publicação. Recebe `POST { text }` e retorna `{ decision, reason, categories[] }`. Decisions: `allow` / `flag` / `block`. Fail-open: se a IA falhar, retorna `allow` para não bloquear o usuário.
- **`api/scan.js`** — varredura em background de posts das últimas 48h sem `modStatus`. Roda via cron Vercel a cada 6 horas (`vercel.json`). Pode ser disparado manualmente via `POST` com header `x-scan-secret`. Posts sem texto (só imagem/vídeo) são aprovados automaticamente sem chamar a IA.

### Variáveis de ambiente no Vercel

| Variável | Usada em | Descrição |
|----------|----------|-----------|
| `AGORA_CERT` | `api/token.js` | Certificate do Agora.io para geração de tokens RTC |
| `ANTHROPIC_API_KEY` | `api/moderate.js`, `api/scan.js` | Chave da API Anthropic (Claude Haiku) |
| `FIREBASE_SERVICE_ACCOUNT` | `api/notify.js`, `api/scan.js` | JSON string da conta de serviço Firebase Admin |
| `SCAN_SECRET` | `api/scan.js` | String aleatória para trigger manual do scan via POST |

### Live streaming (Agora.io)

`pages/live.html` usa o **Agora Web SDK v4** (`AgoraRTC_N-4.22.1.js`, carregado via CDN no HTML). Padrão:
- `mode: 'live'`, `codec: 'vp8'`; token obtido em `nexus-social-fawn.vercel.app/api/token?channel=<liveId>`
- Host: captura câmera com `getUserMedia`, exibe preview local, publica tracks **clonados** via `createCustomVideoTrack({ mediaStreamTrack: track.clone() })` — o clone evita que o Agora consuma as tracks do preview local
- Viewer: recebe evento `user-published` e faz subscribe nas tracks de vídeo/áudio

---

## Firestore — coleções e campos-chave

| Coleção | Campos relevantes |
|---------|-----------------|
| `users/{uid}` | `displayName`, `displayName_lower`, `username`, `photoURL`, `coverURL`, `bio`, `city`, `gender`, `birthdate`, `website`, `lastSeen`, `blocked[]`, `isAdmin` (bool), `isVerified` (bool), `fcmToken`, `status: {emoji, text}` |
| `posts/{id}` | `text`, `imageURL`, `videoURL`, `authorId`, `authorName`, `authorPhoto`, `likes[]`, `bookmarks[]`, `reactions{}`, `commentsCount`, `hashtags[]`, `privacy` (`public`/`friends`/`private`), `poll{}`, `isPinned`, `isArchived`, `modStatus`, `modReason`, `modCategories`, `modAt`, `createdAt` |
| `posts/{id}/comments/{id}` | `text`, `authorId`, `authorName`, `authorPhoto`, `createdAt` |
| `friendships/{id}` | `users: [uid1, uid2]` |
| `friend_requests/{id}` | `from`, `to`, `status: 'pending'/'accepted'/'rejected'` |
| `communities/{id}` | `name`, `description`, `category`, `createdBy`, `membersCount` |
| `community_members/{id}` | `uid`, `communityId`, `joinedAt` |
| `conversations/{id}` | `participants: [uid1, uid2]`, `lastMessage`, `lastMessageAt`, `unread: {uid: count}`, `lastReadAt: {uid: Timestamp}` — diretas. Grupos: `type: 'group'`, `name`, `emoji`, `admins[]` |
| `conversations/{id}/messages/{id}` | `senderId`, `text`, `imageURL`, `reactions{}`, `createdAt` |
| `notifications/{uid}/items/{id}` | `type`, `message`, `link`, `fromUid`, `fromName`, `read`, `createdAt` |
| `stories/{id}` | `uid`, `type` (`text`/`image`), `text`, `imageURL`, `bgColor`, `displayName`, `photoURL`, `views[]`, `expiresAt`, `createdAt` |
| `scraps/{id}` | `fromUid`, `fromName`, `fromPhoto`, `toUid`, `toName`, `text`, `createdAt` |
| `photos/{id}` | `uid`, `imageURL`, `createdAt` |
| `events/{id}` | `title`, `description`, `date`, `time`, `location`, `coverURL`, `privacy`, `createdBy`, `createdByName`, `attendees[]`, `interested[]`, `createdAt` |
| `lives/{id}` | `hostUid`, `hostName`, `hostPhoto`, `title`, `status` (`live`/`ended`), `viewerCount`, `createdAt` |
| `lives/{id}/messages/{id}` | `senderUid`, `senderName`, `senderPhoto`, `text`, `createdAt` |
| `audio_rooms/{roomId}` | `hostUid`, `hostName`, `title`, `emoji`, `status` (`live`/`ended`), `participantCount`, `createdAt` |
| `audio_rooms/{roomId}/participants/{uid}` | `uid`, `displayName`, `photoURL`, `role` (`host`/`speaker`/`listener`), `muted`, `handRaised` |
| `reports/{id}` | `postId`, `reason`, `reportedBy`, `status` (`pending`/`resolved`/`dismissed`), `createdAt` |
| `notes/{uid}` | `text` (max 60), `uid`, `displayName`, `photoURL`, `expiresAt` (24h), `createdAt` — um doc por usuário |
| `testimonials/{uid}/items/{id}` | `fromUid`, `fromName`, `fromPhoto`, `text`, `status` (`pending`/`approved`), `createdAt` |
| `highlights/{uid}/items/{id}` | `storyId`, `imageURL`, `text`, `type`, `createdAt` |
| `profile_views/{uid}/visitors/{visitorUid}` | `displayName`, `photoURL`, `viewedAt` |
| `questions/{uid}/items/{id}` | `text`, `answer`, `status` (`pending`/`answered`), `anonymous`, `fromUid`, `likes[]`, `createdAt` |
| `bookmark_collections/{uid}/colls/{collId}` | `name`, `postIds[]`, `createdAt` |

### Tipos de notificação válidos

Definidos em `notifIcon()` em `utils.js`: `friend_request`, `friend_accept`, `post_like`, `post_comment`, `scrap`, `community_join`, `mention`, `poll_vote`, `repost`.

### `displayName_lower` — busca por prefixo

`amigos.html` usa query Firestore de range para busca ao vivo:
```js
db.collection('users')
  .where('displayName_lower', '>=', qLower)
  .where('displayName_lower', '<=', qLower + '')
  .limit(15).get()
```
Ao criar ou atualizar usuários, sempre salvar `displayName_lower = displayName.toLowerCase()`.

### Índices compostos necessários

Gerenciados em `firestore.indexes.json` (fonte de verdade). Deployar com `firebase deploy --only firestore:indexes`.

| Coleção | Campos |
|---------|--------|
| `posts` | `authorId` ASC + `createdAt` DESC |
| `posts` | `communityId` ASC + `createdAt` DESC |
| `posts` | `privacy` ASC + `createdAt` DESC |
| `posts` | `modStatus` ASC + `createdAt` DESC |
| `posts` | `modStatus` ASC + `modAt` ASC |
| `posts` | `likes` ARRAY_CONTAINS + `createdAt` DESC |
| `posts` | `hashtags` ARRAY_CONTAINS + `createdAt` DESC |
| `posts` | `authorId` ASC + `isArchived` ASC + `createdAt` DESC *(3 campos)* |
| `scraps` | `toUid` ASC + `createdAt` DESC |
| `friend_requests` | `to` ASC + `status` ASC |
| `friend_requests` | `from` ASC + `status` ASC |
| `friend_requests` | `from` ASC + `to` ASC + `status` ASC *(3 campos)* |
| `events` | `privacy` ASC + `date` ASC |
| `events` | `privacy` ASC + `date` DESC |
| `events` | `createdBy` ASC + `date` DESC |
| `conversations` | `participants` ARRAY_CONTAINS + `lastMessageAt` DESC |
| `community_members` | `communityId` ASC + `joinedAt` ASC |
| `audio_rooms` | `status` ASC + `createdAt` DESC |
| `notifications/items` | `status` ASC + `createdAt` DESC |

---

## Design system

Tokens CSS definidos em `css/style.css` em `:root` e `[data-theme="dark"]`.

- **Cor principal:** `--purple-600: #534AB7`
- **Sombras:** `--shadow-sm`, `--shadow-md`, `--shadow-lg`
- **Raios:** `--radius-sm` (8px) → `--radius-lg` (16px) → `--radius-xl` (24px)
- **Tipografia:** `--font-sans: 'DM Sans'`, `--font-display: 'Fraunces'`
- **Tema:** `document.documentElement.setAttribute('data-theme', 'dark'|'light')` — nunca usar `class`

### Regras para dark/light mode

Nunca usar cores de fundo hardcoded como `#FEF9C3`, `#FEE2E2`, `#D1FAE5` (pastéis claros) sem um `[data-theme="dark"]` override correspondente — essas cores são invisíveis no modo escuro. Use `rgba()` semitransparentes nos overrides:

```css
/* light: pastel claro */
.badge-approved { background: #D1FAE5; color: #065F46; }
/* dark: versão semitransparente */
[data-theme="dark"] .badge-approved { background: rgba(34,197,94,0.15); color: #86EFAC; }
```

### FOUC prevention (flash de tema)

Toda nova página HTML deve incluir este script em `<head>` **antes do primeiro `<link rel="stylesheet">`**, para que o tema seja aplicado antes de qualquer render:

```html
<script>!function(){var t=localStorage.getItem("nexus-theme");if(t&&"auto"!==t)document.documentElement.setAttribute("data-theme",t);else window.matchMedia("(prefers-color-scheme: dark)").matches&&document.documentElement.setAttribute("data-theme","dark")}();</script>
```

---

## Regras de segurança

`firestore.rules` está deployado. Pontos não-óbvios:

- `commentsCount` só pode variar ±1 por operação (regra explícita).
- Mensagens só podem ser lidas/criadas por participantes da conversa — usa `get()` na regra para verificar `participants`.
- Stories permitem que qualquer autenticado adicione seu UID ao array `views`.
- `reports` tem `allow read: if false` (clientes) — apenas admin com `isAdmin == true` pode ler/atualizar.
- `users/{uid}` permite `list` para qualquer autenticado — necessário para buscas.
- `users/{uid}.isAdmin` e `isVerified` **não podem ser escritos pelo próprio usuário** — bloqueados na regra de self-update. Admin pode conceder/revogar `isVerified` em qualquer conta (somente esse campo).
- `posts/{id}.modStatus/modReason/modCategories/modAt` só podem ser escritos por admin.

---

## Imagens

Todos os uploads vão para o **Cloudinary** via `uploadToCloudinary(file, options?)` em `utils.js`:
- Cloud: `dyoi5mrdc`, preset: `nexus_uploads`
- Compressão automática antes do upload (max 1280×1280, quality 0.82) — desativável com `{ compress: false }`
- Limite: 8MB para posts/capas, 5MB para avatares (validado no cliente antes do upload)
- O Firebase Storage existe no projeto mas **não é usado ativamente**

---

## Ícones

O projeto usa **Tabler Icons** hospedados **localmente** (sem CDN):
- CSS: `css/tabler-icons.min.css` → referencia fontes em `fonts/tabler-icons.woff2` (447 KB)
- Páginas em `pages/` incluem `../css/tabler-icons.min.css`; `index.html` inclui `css/tabler-icons.min.css`
- **Não** usar o link CDN `cdn.jsdelivr.net/npm/@tabler/icons-webfont` — foi removido intencionalmente para eliminar dependência externa que causava ícones vazios em conexões lentas

Para elementos de UI críticos (botões de ação, navegação), preferir texto/Unicode como fallback caso o ícone seja decorativo. Nunca colocar **só** um `<i class="ti ti-*">` em botões que o usuário precisa identificar sem a fonte carregada.

---

## Campos importantes não óbvios

- `users/{uid}.status` — objeto `{ emoji: string, text: string }` para status do perfil. Ao exibir `status.emoji`, validar com `/\p{Emoji}/u` (pode conter lixo de versões antigas).
- `users/{uid}.blocked` — array de UIDs bloqueados pelo usuário; verificar antes de exibir conteúdo sensível.
- `users/{uid}.isAdmin` / `isVerified` — campos protegidos; nunca escrever diretamente do cliente em contexto de usuário comum.
- `posts/{id}.privacy` — campo ausente em posts antigos; **sempre** usar `resource.data.get('privacy', 'public')` nas regras Firestore, nunca comparar `resource.data.privacy == 'public'` diretamente (causa falha em queries de lista).
- `posts/{id}.isArchived` — posts arquivados pelo autor; a query em `arquivo.html` requer o índice de 3 campos `authorId + isArchived + createdAt DESC`.
- `posts/{id}.modStatus` — valores possíveis: `approved` / `flagged` / `removed` / `pending` (ausente em posts antigos = não moderado). Escrito por `api/moderate.js` (inline ao publicar) e `api/scan.js` (background). O campo `modSource` indica a origem: `'scan'` para o cron, ausente para moderação inline. Apenas admins podem alterar esses campos pelo cliente (regra Firestore).
- `conversations/{id}.lastMessageAt` — campo de ordenação de conversas (índice composto em `firestore.indexes.json`).
- `conversations/{id}.type` — `'group'` para grupos; ausente/undefined para conversas diretas. Grupos têm `name`, `emoji` e `admins[]` adicionais.
- `conversations/{id}.lastReadAt: { [uid]: Timestamp }` — rastreia quando cada participante leu; usado para double-check azul em mensagens.

---

## Domínio

O site está deployado em `nexus.primetitec.com.br` (CNAME → `rede-social-acf40.web.app`). O `authDomain` em `js/firebase-config.js` permanece `rede-social-acf40.firebaseapp.com` — isso é correto e não deve ser alterado.

---

## PWA

- Service Worker: `sw.js` (versão atual: `nexus-v5`) — **network-first** para todos os assets e HTML; cache usado só como fallback offline. Ao mudar assets estáticos significativos, incrementar `CACHE_NAME` para invalidar clientes.
- Manifest: `manifest.json` — `start_url: /index.html`, tema `#534AB7`
- O SW é registrado em `js/utils.js` via `navigator.serviceWorker.register('/sw.js')` ao carregar qualquer página
- `firebase.json` tem header `no-cache, no-store` específico para `/sw.js` (antes de qualquer regra `*.js`) para garantir que o browser sempre busque o SW atualizado
