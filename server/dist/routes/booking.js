"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookingRouter = void 0;
const express_1 = require("express");
const supabaseClient_1 = require("../supabaseClient");
const gerarProtocolo_1 = require("../utils/gerarProtocolo");
const notificacao_1 = require("../utils/notificacao");
const sanitizar_1 = require("../utils/sanitizar");
exports.bookingRouter = (0, express_1.Router)();
/**
 * POST /api/booking
 *
 * Cria um novo agendamento.
 * Body: { nichoId, prestadorId, servicoId, clienteNome, clienteTelefone, dataHora }
 */
exports.bookingRouter.post("/booking", async (req, res) => {
    try {
        const rawBody = req.body;
        // Sanitizar inputs
        const nichoId = (0, sanitizar_1.sanitizarId)(rawBody.nichoId);
        const prestadorId = (0, sanitizar_1.sanitizarId)(rawBody.prestadorId);
        const servicoId = (0, sanitizar_1.sanitizarId)(rawBody.servicoId);
        const clienteNome = (0, sanitizar_1.sanitizar)(rawBody.clienteNome || "");
        const clienteTelefone = (rawBody.clienteTelefone || "").replace(/\D/g, "");
        const dataHora = rawBody.dataHora;
        // Validar campos obrigatórios
        if (!nichoId || !prestadorId || !servicoId || !clienteNome || !clienteTelefone || !dataHora) {
            res.status(400).json({
                erro: "Campos obrigatórios: nichoId, prestadorId, servicoId, clienteNome, clienteTelefone, dataHora",
            });
            return;
        }
        // Validar formato do telefone
        if (!(0, sanitizar_1.validarTelefone)(clienteTelefone)) {
            res.status(400).json({
                erro: "Formato de telefone inválido. Use apenas números com DDD + DDI (ex: 5511999999999).",
            });
            return;
        }
        // Validar data
        const dataHoraObj = (0, sanitizar_1.validarDataHora)(dataHora);
        if (!dataHoraObj) {
            res.status(400).json({ erro: "Formato de data/hora inválido. Use ISO 8601." });
            return;
        }
        if (dataHoraObj <= new Date()) {
            res.status(400).json({ erro: "A data/hora deve ser no futuro." });
            return;
        }
        // Buscar nicho, prestador e serviço em paralelo
        const [nichoRes, prestadorRes, servicoRes] = await Promise.all([
            supabaseClient_1.supabase.from("nichos").select("*").eq("id", nichoId).single(),
            supabaseClient_1.supabase.from("prestadores").select("*").eq("id", prestadorId).single(),
            supabaseClient_1.supabase.from("servicos").select("*").eq("id", servicoId).single(),
        ]);
        if (!nichoRes.data) {
            res.status(404).json({ erro: "Nicho não encontrado." });
            return;
        }
        if (!prestadorRes.data) {
            res.status(404).json({ erro: "Prestador não encontrado." });
            return;
        }
        if (!servicoRes.data) {
            res.status(404).json({ erro: "Serviço não encontrado." });
            return;
        }
        const nicho = nichoRes.data;
        const prestador = prestadorRes.data;
        const servico = servicoRes.data;
        if (!nicho.ativo) {
            res.status(400).json({ erro: "Este nicho não está ativo no momento." });
            return;
        }
        if (!prestador.ativo) {
            res.status(400).json({ erro: "Este prestador não está ativo no momento." });
            return;
        }
        if (!servico.ativo) {
            res.status(400).json({ erro: "Este serviço não está disponível no momento." });
            return;
        }
        // Verificar conflitos de horário
        const fimSlot = new Date(dataHoraObj.getTime() + servico.duracao_minutos * 60 * 1000);
        const { data: conflitos } = await supabaseClient_1.supabase
            .from("agendamentos")
            .select("id")
            .eq("prestador_id", prestadorId)
            .eq("status", "confirmado")
            .gte("data_hora", dataHoraObj.toISOString())
            .lt("data_hora", fimSlot.toISOString());
        if (conflitos && conflitos.length > 0) {
            res.status(409).json({
                erro: "Este horário não está mais disponível. Por favor, escolha outro.",
            });
            return;
        }
        // Criar agendamento
        const protocolo = (0, gerarProtocolo_1.gerarProtocolo)();
        const { data: agendamento, error: insertErr } = await supabaseClient_1.supabase
            .from("agendamentos")
            .insert({
            nicho_id: nichoId,
            prestador_id: prestadorId,
            servico_id: servicoId,
            cliente_nome: clienteNome,
            cliente_telefone: clienteTelefone,
            data_hora: dataHoraObj.toISOString(),
            status: "confirmado",
            protocolo,
        })
            .select()
            .single();
        if (insertErr) {
            console.error("Erro ao inserir agendamento:", insertErr);
            res.status(500).json({ erro: "Erro ao criar agendamento." });
            return;
        }
        // Formatar data para mensagem
        const dataFormatada = dataHoraObj.toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
        const mensagemConfirmacao = nicho.texto_confirmacao
            .replace("{protocolo}", protocolo)
            .replace("{dataHora}", dataFormatada);
        // Notificação WhatsApp (fire-and-forget)
        (0, notificacao_1.notificarConfirmacao)({
            telefone: clienteTelefone,
            protocolo,
            servico: servico.nome,
            prestador: prestador.nome,
            nicho: nicho.nome_publico,
            dataFormatada,
        }).catch(() => { });
        res.status(201).json({
            sucesso: true,
            agendamento: {
                id: agendamento.id,
                nichoId,
                prestadorId,
                servicoId,
                clienteNome,
                clienteTelefone,
                dataHora: agendamento.data_hora,
                status: agendamento.status,
                protocolo,
            },
            protocolo,
            mensagemConfirmacao,
            detalhes: {
                servico: servico.nome,
                prestador: prestador.nome,
                nicho: nicho.nome_publico,
            },
        });
    }
    catch (erro) {
        console.error("Erro ao criar agendamento:", erro);
        res.status(500).json({ erro: "Erro interno ao criar agendamento." });
    }
});
/**
 * POST /api/booking/cancel
 *
 * Cancela um agendamento existente.
 * Body: { protocolo, clienteTelefone }
 */
exports.bookingRouter.post("/booking/cancel", async (req, res) => {
    try {
        const protocolo = (0, sanitizar_1.sanitizar)(req.body.protocolo || "");
        const clienteTelefone = (req.body.clienteTelefone || "").replace(/\D/g, "");
        if (!protocolo || !clienteTelefone) {
            res.status(400).json({ erro: "Campos obrigatórios: protocolo e clienteTelefone" });
            return;
        }
        if (!(0, sanitizar_1.validarTelefone)(clienteTelefone)) {
            res.status(400).json({ erro: "Formato de telefone inválido." });
            return;
        }
        // Buscar agendamento
        const { data: agendamento, error: findErr } = await supabaseClient_1.supabase
            .from("agendamentos")
            .select("*")
            .eq("protocolo", protocolo)
            .single();
        if (findErr || !agendamento) {
            res.status(404).json({ erro: "Agendamento não encontrado com este protocolo." });
            return;
        }
        if (agendamento.cliente_telefone !== clienteTelefone) {
            res.status(403).json({ erro: "Telefone não confere com o cadastrado no agendamento." });
            return;
        }
        if (agendamento.status === "cancelado") {
            res.status(400).json({ erro: "Este agendamento já foi cancelado anteriormente." });
            return;
        }
        // Cancelar
        const { error: updateErr } = await supabaseClient_1.supabase
            .from("agendamentos")
            .update({ status: "cancelado", atualizado_em: new Date().toISOString() })
            .eq("id", agendamento.id);
        if (updateErr) {
            console.error("Erro ao cancelar:", updateErr);
            res.status(500).json({ erro: "Erro ao cancelar agendamento." });
            return;
        }
        // Notificação WhatsApp (fire-and-forget)
        (0, notificacao_1.notificarCancelamento)({ telefone: clienteTelefone, protocolo }).catch(() => { });
        res.json({
            sucesso: true,
            mensagem: `Agendamento ${protocolo} cancelado com sucesso.`,
        });
    }
    catch (erro) {
        console.error("Erro ao cancelar agendamento:", erro);
        res.status(500).json({ erro: "Erro interno ao cancelar agendamento." });
    }
});
//# sourceMappingURL=booking.js.map