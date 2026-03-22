/**
 * pagamento.ts
 * Rotas de pagamento PIX (Banco Inter / C6).
 *
 * POST /api/pagamento/verificar/:txid  — polling de status de pagamento
 * POST /api/pagamento/webhook/inter    — webhook do Banco Inter (confirmação instantânea)
 */

import { Router, Request, Response } from "express";
import { supabase } from "../supabaseClient";
import { verificarPagamentoPix, InterCredentials } from "../utils/pixInter";
import { notificarConfirmacao, notificarPrestadorNovoAgendamento } from "../utils/notificacao";
import { baileysManager } from "../utils/baileysManager";

export const pagamentoRouter = Router();

/** Monta credenciais Inter a partir do negócio */
function montarCredenciais(negocio: any): InterCredentials | null {
  if (
    !negocio.pix_client_id ||
    !negocio.pix_client_secret ||
    !negocio.pix_chave_pix ||
    !negocio.pix_cert_pem ||
    !negocio.pix_key_pem
  ) return null;

  return {
    clientId: negocio.pix_client_id,
    clientSecret: negocio.pix_client_secret,
    chavePix: negocio.pix_chave_pix,
    certPem: negocio.pix_cert_pem,
    keyPem: negocio.pix_key_pem,
    sandbox: process.env.PIX_SANDBOX === "true",
  };
}

/** Envia notificações e registra cliente após confirmação de pagamento */
async function confirmarPagamentoAgendamento(agendamentoId: string): Promise<void> {
  const { data: ag } = await supabase
    .from("agendamentos")
    .select(`
      *,
      nichos (nome_publico, texto_confirmacao),
      prestadores (nome, whatsapp_numero),
      servicos (nome)
    `)
    .eq("id", agendamentoId)
    .single();

  if (!ag) return;

  // Marcar como pago
  await supabase
    .from("agendamentos")
    .update({ pagamento_status: "pago" })
    .eq("id", agendamentoId);

  // Buscar negócio para WhatsApp
  const { data: negocioRow } = await supabase
    .from("negocios")
    .select("id, whatsapp_instancia, whatsapp_status")
    .eq("nicho_id", ag.nicho_id)
    .limit(1)
    .single();

  const negocioId = negocioRow?.id;
  const instancia = negocioRow?.whatsapp_status === "conectado"
    ? (negocioRow.whatsapp_instancia ?? undefined)
    : undefined;

  const nicho     = (ag.nichos as any)?.nome_publico ?? ag.nicho_id;
  const prestador = ag.prestadores as any;
  const servico   = (ag.servicos as any)?.nome ?? "";

  const dataFormatada = new Date(ag.data_hora).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const textoConfirmacao = ((ag.nichos as any)?.texto_confirmacao || "")
    .replace("{protocolo}", ag.protocolo)
    .replace("{dataHora}", dataFormatada);

  // Notificar cliente
  await notificarConfirmacao({
    telefone: ag.cliente_telefone,
    protocolo: ag.protocolo,
    servico,
    prestador: prestador?.nome ?? "",
    nicho,
    dataFormatada,
    negocioId,
    instancia,
  }).catch(() => {});

  // Notificar prestador
  if (prestador?.whatsapp_numero) {
    await notificarPrestadorNovoAgendamento({
      telefonePrestador: prestador.whatsapp_numero,
      protocolo: ag.protocolo,
      clienteNome: ag.cliente_nome,
      servico,
      dataFormatada,
      negocioId,
      instancia,
    }).catch(() => {});
  }

  // Registrar cliente
  if (negocioId) {
    try {
      await supabase.rpc("registrar_cliente_agendamento", {
        p_negocio_id: negocioId,
        p_nome: ag.cliente_nome,
        p_telefone: ag.cliente_telefone,
        p_data_hora: ag.data_hora,
      });
    } catch { /* ignora */ }
  }
}

// ============================================================
// GET /api/pagamento/verificar/:txid
// Polling de status — chamado pelo frontend a cada 3s
// ============================================================
pagamentoRouter.get("/pagamento/verificar/:txid", async (req: Request, res: Response) => {
  const txid = req.params.txid;
  if (!txid) { res.status(400).json({ erro: "txid obrigatório." }); return; }

  try {
    // Buscar agendamento pelo txid
    const { data: ag } = await supabase
      .from("agendamentos")
      .select("id, pagamento_status, pagamento_expira_em, nicho_id, protocolo, mensagem_confirmacao")
      .eq("pagamento_txid", txid)
      .single();

    if (!ag) { res.status(404).json({ erro: "Cobrança não encontrada." }); return; }

    // Se já pago no banco
    if (ag.pagamento_status === "pago") {
      res.json({ pago: true, status: "CONCLUIDA" });
      return;
    }

    // Verificar se expirou
    if (ag.pagamento_expira_em && new Date(ag.pagamento_expira_em) < new Date()) {
      res.json({ pago: false, expirado: true, status: "EXPIRADA" });
      return;
    }

    // Buscar credenciais do negócio
    const { data: negocio } = await supabase
      .from("negocios")
      .select("pix_banco, pix_client_id, pix_client_secret, pix_chave_pix, pix_cert_pem, pix_key_pem")
      .eq("nicho_id", ag.nicho_id)
      .limit(1)
      .single();

    if (!negocio || negocio.pix_banco !== "inter") {
      res.json({ pago: false, status: "ATIVA" });
      return;
    }

    const creds = montarCredenciais(negocio);
    if (!creds) { res.json({ pago: false, status: "ATIVA" }); return; }

    // Consultar Inter
    const { pago, status } = await verificarPagamentoPix(creds, txid);

    if (pago) {
      // Processar confirmação (async, sem bloquear resposta)
      confirmarPagamentoAgendamento(ag.id).catch(() => {});
    }

    res.json({ pago, status });
  } catch (e: any) {
    console.error("[pagamento] Erro ao verificar PIX:", e?.message);
    res.json({ pago: false, status: "ERRO" });
  }
});

// ============================================================
// POST /api/pagamento/webhook/inter
// Webhook do Banco Inter — confirma pagamento instantaneamente
// Inter envia: { pix: [{ txid, valor, horario, ... }] }
// ============================================================
pagamentoRouter.post("/pagamento/webhook/inter", async (req: Request, res: Response) => {
  try {
    // Inter envia array de pagamentos no campo "pix"
    const pixList: any[] = req.body?.pix || [];

    for (const p of pixList) {
      const txid = p.txid;
      if (!txid) continue;

      // Buscar agendamento
      const { data: ag } = await supabase
        .from("agendamentos")
        .select("id, pagamento_status")
        .eq("pagamento_txid", txid)
        .single();

      if (!ag || ag.pagamento_status === "pago") continue;

      await confirmarPagamentoAgendamento(ag.id).catch(() => {});
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("[pagamento] Erro no webhook Inter:", e);
    res.status(500).json({ erro: "Erro interno." });
  }
});
