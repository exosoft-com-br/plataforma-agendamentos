# Configuração PIX — agendei.io

## Modos de operação

O sistema suporta dois modos de pagamento PIX:

| Modo | Confirmação | Requisito |
|------|-------------|-----------|
| **Banco Inter** | Automática (webhook) | Conta PJ Inter + credenciais API |
| **Qualquer banco** | Manual pelo painel | Apenas a chave PIX |

---

## Modo 1 — Banco Inter (confirmação automática)

### Pré-requisitos
- Conta **PJ (Empresas)** no Banco Inter — gratuita para MEI/ME
- Acesso ao portal de desenvolvedores (requer login com conta empresarial)

### Passo a passo

#### 1. Criar conta PJ no Inter
- Acesse inter.co e abra uma conta Empresas (MEI/ME/LTDA)
- Após aprovação, acesse o portal de desenvolvedores com as credenciais PJ

#### 2. Criar uma Aplicação
1. No portal de desenvolvedores → **"Minhas Aplicações" → "Nova Aplicação"**
2. Dê um nome (ex: `agendei-pix`)
3. Ambiente: **Produção**
4. Escopos obrigatórios:
   - ✅ `cob.write` — criar cobranças PIX
   - ✅ `cob.read` — verificar status de pagamento
5. Clique em **Criar**

#### 3. Gerar o Certificado mTLS
1. Na tela da aplicação → **"Gerar Certificado"**
2. Baixe os dois arquivos:
   - `Inter API_Certificado.crt` — certificado público
   - `Inter API_Chave.key` — chave privada
3. ⚠️ Guarde a chave privada com segurança — o Inter não a exibe novamente

#### 4. Copiar as Credenciais
- **Client ID** — código UUID visível na tela da aplicação
- **Client Secret** — clique em "Exibir" e copie

#### 5. Configurar no Painel Admin
1. Edite o negócio no painel admin
2. Ative **"Exigir pagamento ao agendar"**
3. Selecione **"Banco Inter"**
4. Preencha os campos:
   - **Chave PIX** — chave cadastrada na conta Inter (CPF, CNPJ, e-mail, etc.)
   - **Client ID** — copiado do portal
   - **Client Secret** — copiado do portal
   - **Certificado (.crt)** — abra o arquivo `.crt` no Bloco de Notas e cole o conteúdo completo (incluindo as linhas `-----BEGIN CERTIFICATE-----` e `-----END CERTIFICATE-----`)
   - **Chave Privada (.key)** — abra o arquivo `.key` no Bloco de Notas e cole o conteúdo completo (incluindo as linhas `-----BEGIN PRIVATE KEY-----` e `-----END PRIVATE KEY-----`)
5. Clique em **💾 Salvar**

#### 6. Configurar o Webhook
No portal de desenvolvedores → **"Webhooks"**:
1. Cadastre a URL:
   ```
   https://agendei-io-api.onrender.com/api/pagamento/webhook/inter
   ```
2. Evento: **PIX recebido**
3. Salve

> Com o webhook ativo, o agendamento é confirmado automaticamente assim que o cliente paga — sem ação manual.

#### Verificação
Após salvar no painel admin, o card do negócio exibirá:
> ✅ API do Inter configurada — confirmação automática ativa

---

## Modo 2 — Qualquer banco (confirmação manual)

### Quando usar
- Conta PF (pessoa física) em qualquer banco
- Conta PJ sem acesso à API
- Bancos que não oferecem API PIX (Nubank, C6, Bradesco, etc.)

### Passo a passo

1. Edite o negócio no painel admin
2. Ative **"Exigir pagamento ao agendar"**
3. Selecione **"Qualquer banco"**
4. Preencha apenas a **Chave PIX** (CPF, CNPJ, e-mail, telefone ou chave aleatória)
5. Clique em **💾 Salvar**

### Como funciona
- O sistema gera o QR Code automaticamente com a chave PIX informada
- O cliente paga pelo app do banco dele normalmente
- Após 8 segundos, aparece o botão **"Já Paguei"** para o cliente confirmar
- Os pagamentos pendentes aparecem no **painel do negócio** (`/painel.html`)
- O responsável confirma ou cancela cada agendamento manualmente

---

## Endpoints da API de pagamento

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/pagamento/webhook/inter` | Recebe notificação do Inter (confirmação automática) |
| `GET`  | `/api/pagamento/verificar/:id` | Frontend consulta status do pagamento |
| `POST` | `/api/pagamento/confirmar/:id` | Cliente clica "Já Paguei" (modo manual) |
| `PUT`  | `/api/pagamento/admin/:id` | Admin confirma ou cancela pelo painel |
| `GET`  | `/api/pagamento/pendentes` | Lista pagamentos pendentes do admin |

---

## Observações

- A taxa por agendamento é configurável por negócio (valor editável no painel admin)
- O valor cobrado fica registrado como snapshot no agendamento (`taxa_cobrada`)
- O QR Code expira em 30 minutos — após isso, o cliente precisa fazer um novo agendamento
- No modo Inter, o sistema também faz polling a cada 3 segundos como backup do webhook
