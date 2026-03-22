/**
 * pagamento.ts
 * Rotas de pagamento PIX — fluxo simplificado.
 *
 * O PIX é gerado localmente (sem API de banco).
 * A confirmação é feita pelo cliente ("Já Paguei") ou manualmente pelo admin.
 *
 * POST /api/pagamento/confirmar/:agendamentoId  — cliente confirma que pagou
 * GET  /api/pagamento/status/:agendamentoId     — verifica status do pagamento
 * PUT  /api/pagamento/admin/:agendamentoId      — admin marca como pago/cancelado
 */

import { Router, Request, Response } from "express";
import { supabase } from "../supabaseClient";
import { autenticar } from "../middleware/auth";
import { notificarConfirmacao, notificarPrestadorNovoAgendamento } from "../utils/notificacao";

export const pagamentoRouter = Router();

/** Envia notificações WhatsApp e registra cliente após confirmação de pagamento */
async function processarPagamentoConfirmado(agendamentoId: string): Promise<void> {
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
// POST /api/pagamento/confirmar/:agendamentoId
// Cliente clica "Já Paguei" → confirma o pagamento
// ============================================================
pagamentoRouter.post("/pagamento/confirmar/:agendamentoId", async (req: Request, res: Response) => {
  const { agendamentoId } = req.params;

  try {
    const { data: ag } = await supabase
      .from("agendamentos")
      .select("id, pagamento_status, pagamento_expira_em, protocolo")
      .eq("id", agendamentoId)
      .single();

    if (!ag) {
      res.status(404).json({ erro: "Agendamento não encontrado." });
      return;
    }
    if (ag.pagamento_status === "pago") {
      res.json({ sucesso: true, mensagem: "Pagamento já confirmado." });
      return;
    }
    if (ag.pagamento_expira_em && new Date(ag.pagamento_expira_em) < new Date()) {
      res.status(400).json({ erro: "O PIX expirou. Faça um novo agendamento." });
      return;
    }

    // Confirmar pagamento e disparar notificações
    processarPagamentoConfirmado(agendamentoId).catch(() => {});

    res.json({
      sucesso: true,
      mensagem: "Pagamento confirmado! Você receberá uma confirmação via WhatsApp.",
      protocolo: ag.protocolo,
    });
  } catch (e) {
    console.error("[pagamento] Erro ao confirmar:", e);
    res.status(500).json({ erro: "Erro interno." });
  }
});

// ============================================================
// GET /api/pagamento/status/:agendamentoId
// Verifica status do pagamento
// ============================================================
pagamentoRouter.get("/pagamento/status/:agendamentoId", async (req: Request, res: Response) => {
  const { agendamentoId } = req.params;

  try {
    const { data: ag } = await supabase
      .from("agendamentos")
      .select("pagamento_status, pagamento_expira_em, protocolo, taxa_cobrada")
      .eq("id", agendamentoId)
      .single();

    if (!ag) { res.status(404).json({ erro: "Não encontrado." }); return; }

    const expirado = ag.pagamento_expira_em
      ? new Date(ag.pagamento_expira_em) < new Date()
      : false;

    res.json({
      status: ag.pagamento_status,
      pago: ag.pagamento_status === "pago",
      expirado,
      protocolo: ag.protocolo,
      taxaCobrada: ag.taxa_cobrada ? Number(ag.taxa_cobrada) : 0,
    });
  } catch (e) {
    res.status(500).json({ erro: "Erro interno." });
  }
});

// ============================================================
// PUT /api/pagamento/admin/:agendamentoId
// Admin confirma ou cancela pagamento manualmente (painel.html)
// ============================================================
pagamentoRouter.put("/pagamento/admin/:agendamentoId", autenticar, async (req: Request, res: Response) => {
  const { agendamentoId } = req.params;
  const { acao } = req.body; // 'pago' | 'cancelar'

  if (!["pago", "cancelar"].includes(acao)) {
    res.status(400).json({ erro: "acao deve ser 'pago' ou 'cancelar'." });
    return;
  }

  try {
    if (acao === "pago") {
      processarPagamentoConfirmado(agendamentoId).catch(() => {});
      res.json({ sucesso: true, mensagem: "Pagamento confirmado." });
    } else {
      await supabase
        .from("agendamentos")
        .update({ status: "cancelado", atualizado_em: new Date().toISOString() })
        .eq("id", agendamentoId);
      res.json({ sucesso: true, mensagem: "Agendamento cancelado." });
    }
  } catch (e) {
    res.status(500).json({ erro: "Erro interno." });
  }
});

// ============================================================
// POST /api/pagamento/webhook/inter  (mantido para compatibilidade futura)
// ============================================================
pagamentoRouter.post("/pagamento/webhook/inter", async (_req: Request, res: Response) => {
  res.status(200).json({ ok: true });
});

// ============================================================
// GET /api/pagamento/pendentes  — lista agendamentos com pagamento pendente (admin)
// ============================================================
pagamentoRouter.get("/pagamento/pendentes", autenticar, async (req: Request, res: Response) => {
  try {
    const ownerId = req.auth!.ownerId;

    // Busca nicho_ids dos negócios do admin
    const { data: negocios } = await supabase
      .from("negocios")
      .select("nicho_id, nome_fantasia")
      .eq("owner_id", ownerId);

    if (!negocios?.length) { res.json({ agendamentos: [] }); return; }

    const nichoIds = negocios.map((n: any) => n.nicho_id);

    const { data } = await supabase
      .from("agendamentos")
      .select("id, protocolo, cliente_nome, cliente_telefone, data_hora, taxa_cobrada, pagamento_status, pagamento_expira_em, nicho_id")
      .in("nicho_id", nichoIds)
      .eq("pagamento_status", "pendente")
      .eq("status", "confirmado")
      .order("criado_em", { ascending: false });

    res.json({ agendamentos: data || [] });
  } catch (e) {
    res.status(500).json({ erro: "Erro interno." });
  }
});
