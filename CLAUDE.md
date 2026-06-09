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

# Deploy (hosting + regras Firestore)
firebase deploy --only hosting,firestore:rules

# Deploy só do hosting
firebase deploy --only hosting
```

> **`npm install` não executa lint** — o `postinstall` foi removido intencionalmente.  
> `npm audit` retorna 8 vulnerabilidades moderadas em deps de dev (uuid em firebase-admin); o CI só bloqueia em high/critical.

---

## Arquitetura

Projeto **vanilla HTML/CSS/JS** sem bundler, framework ou build step. Cada página é um arquivo HTML independente que carrega os scripts via `<script>` tags no final do body.

### Dois arquivos de núcleo compartilhados

Todo o projeto depende de dois arquivos incluídos em **todas** as páginas, nessa ordem:

1. **`js/firebase-config.js`** — inicializa o Firebase compat SDK e expõe os globais `auth`, `db`, `googleProvider` e `storage` (com try/catch, pois o Storage SDK não é carregado em todas as páginas).

2. **`js/utils.js`** — todas as funções utilitárias compartilhadas. Contém:
   - `requireAuth(callback)` — guard de autenticação; redireciona para login se não autenticado
   - `renderTopbar(userData, activePage)` — renderiza a topbar + bottom nav mobile em todas as páginas
   - `sanitize(str)` — escapa HTML; **obrigatório** em qualquer string de usuário inserida via `innerHTML`
   - `uploadToCloudinary(file)` — único ponto de upload de imagens (não usa Firebase Storage)
   - `createNotification(toUid, type, data)` — cria notificação no Firestore
   - `showToast(msg)`, `timeAgo(ts)`, `getAvatarColor(uid)`, `openLightbox(srcs)`, `updateOnlineStatus(uid)`

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

---

## Firestore — coleções e campos-chave

| Coleção | Campos relevantes |
|---------|-----------------|
| `users/{uid}` | `displayName`, `displayName_lower`, `username`, `photoURL`, `coverURL`, `bio`, `city`, `gender`, `birthdate`, `website`, `lastSeen` |
| `posts/{id}` | `text`, `imageURL`, `authorId`, `authorName`, `authorPhoto`, `likes[]`, `bookmarks[]`, `reactions{}`, `commentsCount`, `hashtags[]`, `privacy` (`public`/`friends`/`private`), `createdAt` |
| `posts/{id}/comments/{id}` | `text`, `authorId`, `authorName`, `authorPhoto`, `createdAt` |
| `friendships/{id}` | `users: [uid1, uid2]` |
| `friend_requests/{id}` | `from`, `to`, `status: 'pending'/'accepted'/'rejected'` |
| `communities/{id}` | `name`, `description`, `category`, `createdBy`, `membersCount` |
| `community_members/{id}` | `uid`, `communityId`, `joinedAt` |
| `conversations/{id}` | `participants: [uid1, uid2]`, `lastMessage`, `lastAt`, `unread: {uid: count}` |
| `conversations/{id}/messages/{id}` | `senderId`, `text`, `imageURL`, `createdAt` |
| `notifications/{uid}/items/{id}` | `type`, `message`, `link`, `fromUid`, `fromName`, `read`, `createdAt` |
| `stories/{id}` | `uid`, `type` (`text`/`image`), `text`, `imageURL`, `bgColor`, `displayName`, `photoURL`, `views[]`, `expiresAt`, `createdAt` |
| `scraps/{id}` | `fromUid`, `fromName`, `fromPhoto`, `toUid`, `toName`, `text`, `createdAt` |
| `photos/{id}` | `uid`, `imageURL`, `createdAt` |
| `reports/{id}` | `postId`, `reason`, `reportedBy`, `createdAt` |

### Índices compostos necessários

Criar no Firebase Console → Firestore → Índices se não existirem:

| Coleção | Campo 1 | Campo 2 |
|---------|---------|---------|
| `posts` | `communityId` ASC | `createdAt` DESC |
| `scraps` | `toUid` ASC | `createdAt` DESC |
| `friend_requests` | `to` ASC | `status` ASC |

---

## Design system

Tokens CSS definidos em `css/style.css` em `:root` e `[data-theme="dark"]`.

- **Cor principal:** `--purple-600: #534AB7`
- **Sombras:** `--shadow-sm`, `--shadow-md`, `--shadow-lg`
- **Raios:** `--radius-sm` (8px) → `--radius-lg` (16px) → `--radius-xl` (24px)
- **Tipografia:** `--font-sans: 'DM Sans'`, `--font-display: 'Fraunces'`
- **Tema:** `document.documentElement.setAttribute('data-theme', 'dark'|'light')` — nunca usar `class`

---

## Regras de segurança

`firestore.rules` está deployado. Pontos não-óbvios:

- `commentsCount` só pode variar ±1 por operação (regra explícita).
- Mensagens só podem ser lidas/criadas por participantes da conversa — usa `get()` na regra para verificar `participants`.
- Stories permitem que qualquer autenticado adicione seu UID ao array `views`.
- `reports` tem `allow read: if false` — nenhum cliente pode ler denúncias.

---

## Imagens

Todos os uploads vão para o **Cloudinary** via `uploadToCloudinary(file)` em `utils.js`:
- Cloud: `dyoi5mrdc`, preset: `nexus_uploads`
- Limite: 8MB para posts/capas, 5MB para avatares (validado no cliente antes do upload)
- O Firebase Storage existe no projeto mas **não é usado ativamente** (regras deployadas mas serviço não ativado no console)

---

## PWA

- Service Worker: `sw.js` (versão `nexus-v2`) — cache-first para assets, network-first para HTML, fallback em `offline.html`
- Manifest: `manifest.json` — `start_url: /index.html`, tema `#534AB7`
- O SW é registrado em `js/utils.js` via `navigator.serviceWorker.register('/sw.js')` ao carregar qualquer página
