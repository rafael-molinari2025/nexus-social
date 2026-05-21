# Nexus — Rede Social

Rede social moderna inspirada no conceito do Orkut, construída com HTML/CSS/JS puro e Firebase.

## 🛠 Stack

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend / DB**: Firebase (Auth + Firestore + Storage)
- **Hospedagem**: Firebase Hosting
- **Ícones**: Tabler Icons
- **Fontes**: DM Sans + Fraunces (Google Fonts)

---

## 📁 Estrutura de arquivos

```
nexus-social/
├── index.html              ← Feed principal (página inicial)
├── 404.html                ← Página de erro personalizada
├── firebase.json           ← Configuração Firebase Hosting
├── .firebaserc             ← Projeto Firebase ativo
├── .gitignore
├── README.md
├── css/
│   └── style.css           ← Estilos globais
├── js/
│   ├── firebase-config.js  ← ⚠️ Configure aqui suas credenciais
│   └── utils.js            ← Funções utilitárias compartilhadas
└── pages/
    ├── login.html          ← Login e cadastro
    ├── perfil.html         ← Perfil de usuário
    ├── amigos.html         ← Amigos e solicitações
    ├── comunidades.html    ← Listagem e criação de comunidades
    ├── comunidade.html     ← Página individual de comunidade
    ├── recados.html        ← Mural de recados (enviar/receber)
    ├── busca.html          ← Busca de pessoas e comunidades
    └── post.html           ← Post individual com comentários
```

---

## 🚀 Como colocar no ar

### 1. Criar projeto no Firebase

1. Acesse [console.firebase.google.com](https://console.firebase.google.com)
2. Clique em **Adicionar projeto** → dê um nome (ex: `nexus-social`)
3. Desative o Google Analytics (opcional) → **Criar projeto**

### 2. Configurar autenticação

1. No painel do Firebase → **Authentication** → **Começar**
2. Aba **Sign-in method** → habilite:
   - ✅ **E-mail/senha**
   - ✅ **Google**

### 3. Criar banco de dados Firestore

1. **Firestore Database** → **Criar banco de dados**
2. Escolha **Modo de produção** → selecione a região (`southamerica-east1`)
3. Após criar, vá em **Regras** e substitua pelo conteúdo abaixo:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == uid;
    }

    match /posts/{postId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
      allow delete: if request.auth.uid == resource.data.authorId;

      match /comments/{commentId} {
        allow read: if request.auth != null;
        allow create: if request.auth != null;
        allow delete: if request.auth.uid == resource.data.authorId;
      }
    }

    match /communities/{commId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth.uid == resource.data.createdBy;
    }

    match /community_members/{docId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow delete: if request.auth.uid == resource.data.uid;
    }

    match /friendships/{docId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow delete: if request.auth.uid in resource.data.users;
    }

    match /friend_requests/{docId} {
      allow read: if request.auth != null;
      allow create: if request.auth.uid == request.resource.data.from;
      allow update: if request.auth.uid == resource.data.to;
    }

    match /scraps/{docId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow delete: if request.auth.uid == resource.data.fromUid
                    || request.auth.uid == resource.data.toUid;
    }
  }
}
```

### 4. Criar índices Firestore necessários

No Console Firebase → Firestore → **Índices** → criar os seguintes índices compostos:

| Coleção | Campo 1 | Campo 2 | Ordem |
|---|---|---|---|
| `posts` | `communityId` (Asc) | `createdAt` (Desc) | — |
| `scraps` | `toUid` (Asc) | `createdAt` (Desc) | — |
| `scraps` | `fromUid` (Asc) | `createdAt` (Desc) | — |
| `friend_requests` | `to` (Asc) | `status` (Asc) | — |
| `friend_requests` | `from` (Asc) | `to` (Asc) | — |

### 5. Obter e configurar credenciais do Firebase

1. **Configurações do projeto** (ícone de engrenagem) → **Geral**
2. Role até **Seus apps** → clique em `</>` (Web)
3. Registre o app com o nome "nexus"
4. Copie o objeto `firebaseConfig`
5. Abra `js/firebase-config.js` e substitua os valores:

```javascript
const firebaseConfig = {
  apiKey:            "AIza...",
  authDomain:        "nexus-social.firebaseapp.com",
  projectId:         "nexus-social",
  storageBucket:     "nexus-social.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc123"
};
```

6. Atualize `.firebaserc` com o ID do seu projeto:

```json
{
  "projects": {
    "default": "nexus-social"
  }
}
```

### 6. Publicar no Firebase Hosting

```bash
# Instalar Firebase CLI (apenas uma vez)
npm install -g firebase-tools

# Fazer login
firebase login

# Publicar
firebase deploy --only hosting
```

Seu site estará em: `https://SEU_PROJETO.web.app`

### 7. Adicionar domínio autorizado no Firebase

1. **Authentication** → **Settings** → **Authorized domains**
2. Adicione: `SEU_PROJETO.web.app` e `SEU_PROJETO.firebaseapp.com`

### 8. Publicar no GitHub (opcional, para versionamento)

```bash
git init
git add .
git commit -m "feat: Nexus Social — initial commit"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/nexus-social.git
git push -u origin main
```

---

## 🗃 Coleções do Firestore

| Coleção | Descrição |
|---|---|
| `users` | Perfis de usuários |
| `posts` | Posts do feed e de comunidades |
| `posts/{id}/comments` | Comentários dos posts (subcoleção) |
| `friendships` | Amizades confirmadas |
| `friend_requests` | Solicitações pendentes |
| `communities` | Comunidades criadas |
| `community_members` | Membros de comunidades |
| `scraps` | Recados enviados/recebidos |

---

## ✅ Funcionalidades implementadas

- [x] Cadastro e login (e-mail/senha + Google)
- [x] Feed de posts em tempo real
- [x] Criar, curtir e excluir posts
- [x] Comentários em posts
- [x] Perfil completo (bio, cidade, estatísticas, tabs)
- [x] Editar perfil
- [x] Solicitações de amizade (enviar, aceitar, recusar)
- [x] Lista de amigos
- [x] Sugestões de pessoas
- [x] Comunidades (criar, listar, entrar, sair)
- [x] Página individual de comunidade com feed próprio
- [x] Posts dentro de comunidades
- [x] Mural de recados (enviar, receber, histórico)
- [x] Busca de usuários por nome
- [x] Busca de comunidades por nome
- [x] Topbar global com navegação
- [x] Página 404 personalizada
- [x] Sanitização XSS em todos os inputs

## 🔮 Próximos passos sugeridos

- [ ] Upload de foto de perfil (Firebase Storage)
- [ ] Notificações em tempo real
- [ ] Chat privado
- [ ] PWA (Progressive Web App)
- [ ] Feed de comunidades na página principal
