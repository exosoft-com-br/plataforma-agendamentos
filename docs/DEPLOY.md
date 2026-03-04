# 🚀 Deploy — Plataforma de Agendamentos

## Arquitetura

```
[GitHub Pages]          [Render]               [Supabase]
 Frontend SPA  ──────>  Express.js API  ──────>  PostgreSQL
 docs/index.html        server/                  (RLS ativo)
```

---

## 1. Deploy do Backend no Render

### Passo a Passo

1. Acesse [render.com](https://render.com) e faça login com sua conta GitHub
2. Clique em **"New +"** → **"Web Service"**
3. Conecte o repositório `exosoft-com-br/plataforma-agendamentos`
4. Configure:

| Campo | Valor |
|-------|-------|
| **Name** | `plataforma-agendamentos-api` |
| **Region** | Oregon (US West) |
| **Branch** | `master` |
| **Root Directory** | `server` |
| **Runtime** | Node |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Plan** | Free |

5. Em **"Environment"** → **"Environment Variables"**, adicione:

| Variável | Valor | Secret? |
|----------|-------|:-------:|
| `SUPABASE_URL` | `https://bhargdkruycbrcanfvuz.supabase.co` | Não |
| `SUPABASE_SERVICE_ROLE_KEY` | `(sua service_role key)` | **Sim** ✅ |
| `SUPABASE_ANON_KEY` | `(sua anon key)` | Não |
| `ALLOWED_ORIGINS` | `https://exosoft-com-br.github.io` | Não |
| `NODE_ENV` | `production` | Não |

6. Clique **"Create Web Service"**

### Após o Deploy
- A URL será algo como: `https://plataforma-agendamentos-api.onrender.com`
- Teste: `https://SUA-URL.onrender.com/api/nicho?nichoId=barbearia`

> ⚠️ **Nota**: No plano Free do Render, o serviço "adormece" após 15min de inatividade. A primeira requisição pode demorar ~30s.

---

## 2. Frontend no GitHub Pages

O frontend já está publicado em:
**https://exosoft-com-br.github.io/plataforma-agendamentos/**

### Configurar URL da API

Na primeira vez que acessar, o frontend tentará conectar a `http://localhost:3000`. Como não vai encontrar, mostrará um campo para configurar a URL:

1. Cole a URL do Render (ex: `https://plataforma-agendamentos-api.onrender.com`)
2. Clique **"Salvar e Reconectar"**
3. A URL fica salva no localStorage do navegador

### Para alterar o nicho padrão
No console do navegador:
```js
localStorage.setItem('nichoId', 'clinica');
location.reload();
```

---

## 3. Verificação Pós-Deploy

### Testar endpoints
```bash
# Config do nicho
curl https://SUA-URL.onrender.com/api/nicho?nichoId=barbearia

# Horários disponíveis
curl "https://SUA-URL.onrender.com/api/availability?prestadorId=barbeiro-pedro&servicoId=corte-simples&data=2025-03-05"

# Criar agendamento
curl -X POST https://SUA-URL.onrender.com/api/booking \
  -H "Content-Type: application/json" \
  -d '{"nichoId":"barbearia","prestadorId":"barbeiro-pedro","servicoId":"corte-simples","clienteNome":"Teste","clienteTelefone":"5511999998888","dataHora":"2025-03-05T10:00:00"}'
```

### Verificar segurança
```bash
# Headers de segurança
curl -I https://SUA-URL.onrender.com/api/nicho?nichoId=barbearia

# CORS bloqueado (deve retornar erro)
curl -H "Origin: https://site-malicioso.com" https://SUA-URL.onrender.com/api/nicho?nichoId=barbearia

# Rate limiting (headers X-RateLimit-*)
curl -v https://SUA-URL.onrender.com/api/nicho?nichoId=barbearia 2>&1 | grep -i ratelimit
```

---

## 4. Troubleshooting

| Problema | Solução |
|----------|---------|
| Frontend não conecta à API | Verifique a URL no localStorage. Abra DevTools → Console → `localStorage.getItem('apiUrl')` |
| CORS bloqueado | Adicione a origem em `ALLOWED_ORIGINS` no Render |
| 429 Too Many Requests | Rate limiting ativo. Aguarde 15min |
| Erro ao criar agendamento | Verifique se `SUPABASE_SERVICE_ROLE_KEY` está configurada no Render |
| Serviço dormindo | Normal no plano Free. Primeira requisição demora ~30s |
