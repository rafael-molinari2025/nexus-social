# Nexus — Rede Social

Rede social moderna inspirada no conceito do Orkut, construída com HTML/CSS/JS puro e Firebase.

## 🛠 Stack

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend / DB**: Firebase (Auth + Firestore + Storage)
- **Hospedagem**: GitHub Pages
- **Ícones**: Tabler Icons
- **Fontes**: DM Sans + Fraunces (Google Fonts)

---

## 📁 Estrutura de arquivos

```
nexus/
├── index.html              ← Feed principal (página inicial)
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
    └── recados.html        ← Mural de recados (enviar/receber)
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
2. Escolha **Modo de produção** → selecione a região mais próxima (`us-east1` ou `southamerica-east1`)
3. Após criar, vá em **Regras** e substitua pelo conteúdo abaixo:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Usuários: leitura pública, escrita apenas pelo próprio usuário
    match /users/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == uid;
    }

    // Posts: leitura pública, escrita autenticada; exclusão apenas pelo autor
    match /posts/{postId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
      allow delete: if request.auth.uid == resource.data.authorId;
    }

    // Comunidades: leitura pública, criação autenticada
    match /communities/{commId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth.uid == resource.data.createdBy;
    }

    // Membros de comunidades
    match /community_members/{docId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow delete: if request.auth.uid == resource.data.uid;
    }

    // Amizades
    match /friendships/{docId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow delete: if request.auth.uid in resource.data.users;
    }

    // Solicitações de amizade
    match /friend_requests/{docId} {
      allow read: if request.auth != null;
      allow create: if request.auth.uid == request.resource.data.from;
      allow update: if request.auth.uid == resource.data.to;
    }

    // Recados
    match /scraps/{docId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow delete: if request.auth.uid == resource.data.fromUid
                    || request.auth.uid == resource.data.toUid;
    }
  }
}
```

### 4. Obter credenciais do Firebase

1. **Configurações do projeto** (ícone de engrenagem) → **Geral**
2. Role até **Seus apps** → clique em `</>` (Web)
3. Registre o app com o nome "nexus"
4. Copie o objeto `firebaseConfig`

### 5. Configurar o arquivo de credenciais

Abra `js/firebase-config.js` e substitua os valores:

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

### 6. Publicar no GitHub Pages

```bash
# 1. Crie um repositório no GitHub (ex: nexus-social)
# 2. Faça upload de todos os arquivos
git init
git add .
git commit -m "Initial commit - Nexus Social"
git remote add origin https://github.com/SEU_USUARIO/nexus-social.git
git push -u origin main

# 3. No GitHub → Settings → Pages
#    Source: Deploy from branch → main → / (root) → Save
```

Seu site estará em: `https://SEU_USUARIO.github.io/nexus-social`

### 7. Adicionar domínio autorizado no Firebase

1. **Authentication** → **Settings** → **Authorized domains**
2. Adicione: `SEU_USUARIO.github.io`

---

## 🗃 Coleções do Firestore

| Coleção | Descrição |
|---|---|
| `users` | Perfis de usuários |
| `posts` | Posts do feed |
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
- [x] Perfil completo (bio, cidade, estatísticas, tabs)
- [x] Editar perfil
- [x] Solicitações de amizade (enviar, aceitar, recusar)
- [x] Lista de amigos
- [x] Sugestões de pessoas
- [x] Comunidades (criar, listar, entrar)
- [x] Mural de recados (enviar, receber, histórico)
- [x] Busca de usuários
- [x] Topbar global com navegação

## 🔮 Próximos passos sugeridos

- [ ] Comentários em posts
- [ ] Upload de foto de perfil (Firebase Storage)
- [ ] Notificações em tempo real
- [ ] Feed de comunidades
- [ ] Chat privado
- [ ] Busca de comunidades
- [ ] PWA (Progressive Web App)
