import { criarProvedorWhatsApp, WhatsAppProvider } from "./whatsappAdapter";
import { baileysManager } from "./baileysManager";

// ─── Envio unificado (Baileys > Evolution API fallback) ───────────────────────

async function enviar(telefone: string, texto: string, negocioId?: string, instancia?: string): Promise<void> {
  // 1. Tenta via Baileys (número do próprio negócio)
  const baileysStatus = negocioId ? baileysManager.getStatus(negocioId) : "desconectado";
  if (negocioId && baileysStatus === "conectado") {
    console.log(`[notificacao] Enviando via Baileys para ${telefone} (negocio: ${negocioId})`);
    await baileysManager.sendText(negocioId, telefone, texto);
    return;
  }

  // 2. Fallback: Evolution API global
  const apiUrl = process.env.WHATSAPP_API_URL;
  const apiToken = process.env.WHATSAPP_API_TOKEN;
  const providerType = process.env.WHATSAPP_PROVIDER || "evolution";
  const instanceName = instancia || process.env.WHATSAPP_INSTANCE_NAME || "default";

  console.log(`[notificacao] Baileys ${baileysStatus} para negocio ${negocioId ?? "N/A"} — tentando Evolution API (instância: ${instanceName}, url: ${apiUrl ?? "NÃO CONFIGURADO"})`);

  if (!apiUrl || !apiToken) {
    console.warn(`[notificacao] Evolution API não configurada — mensagem para ${telefone} não enviada`);
    return;
  }

  const provedor: WhatsAppProvider = criarProvedorWhatsApp(providerType, apiUrl, apiToken, instanceName);
  await provedor.sendMessage(telefone, texto);
}

// ─── Confirmação para o cliente ───────────────────────────────────────────────

export async function notificarConfirmacao(params: {
  telefone: string;
  protocolo: string;
  servico: string;
  prestador: string;
  nicho: string;
  dataFormatada: string;
  negocioId?: string;
  instancia?: string;
}): Promise<void> {
  const mensagem =
    `✅ *Agendamento Confirmado!*\n\n` +
    `📋 Protocolo: *${params.protocolo}*\n` +
    `🏢 ${params.nicho}\n` +
    `👤 Profissional: ${params.prestador}\n` +
    `✂️ Serviço: ${params.servico}\n` +
    `📅 ${params.dataFormatada}\n\n` +
    `Para cancelar, envie: *cancelar ${params.protocolo}*`;

  try {
    await enviar(params.telefone, mensagem, params.negocioId, params.instancia);
  } catch (e) {
    console.error("[notificacao] Falha na confirmação:", e);
  }
}

// ─── Novo agendamento para o prestador ───────────────────────────────────────

export async function notificarPrestadorNovoAgendamento(params: {
  telefonePrestador: string;
  protocolo: string;
  clienteNome: string;
  servico: string;
  dataFormatada: string;
  negocioId?: string;
  instancia?: string;
}): Promise<void> {
  if (!params.telefonePrestador) return;

  const mensagem =
    `📅 *Novo Agendamento Recebido!*\n\n` +
    `👤 Cliente: *${params.clienteNome}*\n` +
    `✂️ Serviço: ${params.servico}\n` +
    `📅 Data/Hora: *${params.dataFormatada}*\n` +
    `📋 Protocolo: ${params.protocolo}`;

  try {
    await enviar(params.telefonePrestador, mensagem, params.negocioId, params.instancia);
  } catch (e) {
    console.error("[notificacao] Falha na notificação ao prestador:", e);
  }
}

// ─── Lembrete 24h para o cliente ──────────────────────────────────────────────

export async function notificarLembreteCliente(params: {
  telefone: string;
  protocolo: string;
  servico: string;
  prestador: string;
  nicho: string;
  dataFormatada: string;
  negocioId?: string;
  instancia?: string;
}): Promise<void> {
  const mensagem =
    `⏰ *Lembrete de Agendamento*\n\n` +
    `Olá! Seu agendamento é *amanhã*:\n\n` +
    `🏢 ${params.nicho}\n` +
    `👤 Profissional: ${params.prestador}\n` +
    `✂️ Serviço: ${params.servico}\n` +
    `📅 ${params.dataFormatada}\n\n` +
    `📋 Protocolo: ${params.protocolo}\n\n` +
    `Para cancelar, envie: *cancelar ${params.protocolo}*`;

  try {
    await enviar(params.telefone, mensagem, params.negocioId, params.instancia);
  } catch (e) {
    console.error("[notificacao] Falha no lembrete ao cliente:", e);
  }
}

// ─── Lembrete 24h para o prestador ───────────────────────────────────────────

export async function notificarLembretePrestador(params: {
  telefonePrestador: string;
  clienteNome: string;
  servico: string;
  dataFormatada: string;
  protocolo: string;
  negocioId?: string;
  instancia?: string;
}): Promise<void> {
  if (!params.telefonePrestador) return;

  const mensagem =
    `⏰ *Lembrete de Agendamento*\n\n` +
    `Você tem um agendamento *amanhã*:\n\n` +
    `👤 Cliente: *${params.clienteNome}*\n` +
    `✂️ Serviço: ${params.servico}\n` +
    `📅 *${params.dataFormatada}*\n` +
    `📋 Protocolo: ${params.protocolo}`;

  try {
    await enviar(params.telefonePrestador, mensagem, params.negocioId, params.instancia);
  } catch (e) {
    console.error("[notificacao] Falha no lembrete ao prestador:", e);
  }
}

// ─── Cancelamento para o cliente ──────────────────────────────────────────────

export async function notificarCancelamento(params: {
  telefone: string;
  protocolo: string;
  negocioId?: string;
  instancia?: string;
}): Promise<void> {
  const mensagem =
    `❌ *Agendamento Cancelado*\n\n` +
    `📋 Protocolo: *${params.protocolo}*\n\n` +
    `Seu agendamento foi cancelado com sucesso.`;

  try {
    await enviar(params.telefone, mensagem, params.negocioId, params.instancia);
  } catch (e) {
    console.error("[notificacao] Falha no cancelamento:", e);
  }
}
