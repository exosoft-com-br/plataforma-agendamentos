"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.gerarEventoICal = gerarEventoICal;
exports.gerarCancelamentoICal = gerarCancelamentoICal;
exports.sincronizarCalendario = sincronizarCalendario;
const supabaseClient_1 = require("../supabaseClient");
/**
 * Gera um evento iCal (RFC 5545) para um agendamento.
 * Pode ser usado como anexo .ics em emails ou para sincronizar calendários.
 */
function gerarEventoICal(params) {
    const { protocolo, servicoNome, prestadorNome, negocioNome, clienteNome, clienteTelefone, dataHoraInicio, duracaoMinutos, endereco, } = params;
    const dataFim = new Date(dataHoraInicio.getTime() + duracaoMinutos * 60 * 1000);
    const formatICalDate = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const uid = `${protocolo}@plataforma-agendamentos`;
    const now = formatICalDate(new Date());
    const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Plataforma Agendamentos//BR",
        "CALSCALE:GREGORIAN",
        "METHOD:REQUEST",
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${now}`,
        `DTSTART:${formatICalDate(dataHoraInicio)}`,
        `DTEND:${formatICalDate(dataFim)}`,
        `SUMMARY:${servicoNome} - ${clienteNome}`,
        `DESCRIPTION:Agendamento ${protocolo}\\nServiço: ${servicoNome}\\nProfissional: ${prestadorNome}\\nCliente: ${clienteNome}\\nTelefone: ${clienteTelefone}`,
        `ORGANIZER;CN=${negocioNome}:MAILTO:noreply@agendamentos.app`,
        endereco ? `LOCATION:${endereco}` : "",
        "STATUS:CONFIRMED",
        `BEGIN:VALARM`,
        `TRIGGER:-PT1H`,
        `ACTION:DISPLAY`,
        `DESCRIPTION:Lembrete: ${servicoNome} em 1 hora`,
        `END:VALARM`,
        "END:VEVENT",
        "END:VCALENDAR",
    ];
    return lines.filter(Boolean).join("\r\n");
}
/**
 * Gera evento iCal de cancelamento.
 */
function gerarCancelamentoICal(params) {
    const { protocolo, servicoNome, clienteNome, dataHoraInicio, duracaoMinutos } = params;
    const dataFim = new Date(dataHoraInicio.getTime() + duracaoMinutos * 60 * 1000);
    const formatICalDate = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const uid = `${protocolo}@plataforma-agendamentos`;
    const now = formatICalDate(new Date());
    return [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Plataforma Agendamentos//BR",
        "METHOD:CANCEL",
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${now}`,
        `DTSTART:${formatICalDate(dataHoraInicio)}`,
        `DTEND:${formatICalDate(dataFim)}`,
        `SUMMARY:[CANCELADO] ${servicoNome} - ${clienteNome}`,
        "STATUS:CANCELLED",
        "SEQUENCE:1",
        "END:VEVENT",
        "END:VCALENDAR",
    ].join("\r\n");
}
/**
 * Busca integrações de email ativas para um prestador e envia notificação.
 * Na versão atual, gera o .ics — o envio real depende de um provedor SMTP configurado.
 */
async function sincronizarCalendario(params) {
    try {
        // Buscar integrações ativas do prestador
        const { data: integracoes } = await supabaseClient_1.supabase
            .from("integracoes_email")
            .select("*")
            .eq("prestador_id", params.prestadorId)
            .eq("status", "ativo");
        if (!integracoes || integracoes.length === 0)
            return;
        for (const integ of integracoes) {
            // Verificar se deve enviar este tipo de notificação
            if (params.tipo === "confirmacao" && !integ.enviar_confirmacao)
                continue;
            if (params.tipo === "cancelamento" && !integ.enviar_cancelamento)
                continue;
            let icsContent;
            if (params.tipo === "cancelamento") {
                icsContent = gerarCancelamentoICal({
                    protocolo: params.protocolo,
                    servicoNome: params.servicoNome,
                    clienteNome: params.clienteNome,
                    dataHoraInicio: params.dataHoraInicio,
                    duracaoMinutos: params.duracaoMinutos,
                });
            }
            else {
                icsContent = gerarEventoICal({
                    protocolo: params.protocolo,
                    servicoNome: params.servicoNome,
                    prestadorNome: params.prestadorNome,
                    negocioNome: params.negocioNome,
                    clienteNome: params.clienteNome,
                    clienteTelefone: params.clienteTelefone,
                    dataHoraInicio: params.dataHoraInicio,
                    duracaoMinutos: params.duracaoMinutos,
                    endereco: params.endereco,
                });
            }
            // Envio SMTP (quando configurado)
            if (process.env.SMTP_HOST) {
                await enviarEmailComICS({
                    para: integ.email_calendario,
                    assunto: params.tipo === "confirmacao"
                        ? `Novo agendamento: ${params.servicoNome} - ${params.clienteNome}`
                        : `Cancelamento: ${params.servicoNome} - ${params.clienteNome}`,
                    corpo: params.tipo === "confirmacao"
                        ? `Novo agendamento ${params.protocolo} agendado com ${params.prestadorNome}.`
                        : `O agendamento ${params.protocolo} foi cancelado.`,
                    icsContent,
                    protocolo: params.protocolo,
                });
            }
            // Atualizar último sync
            await supabaseClient_1.supabase
                .from("integracoes_email")
                .update({ ultimo_sync: new Date().toISOString() })
                .eq("id", integ.id);
        }
    }
    catch (erro) {
        console.error("Erro ao sincronizar calendário:", erro);
    }
}
/**
 * Envia email com anexo .ics via SMTP.
 * Requer: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS no .env
 */
async function enviarEmailComICS(params) {
    try {
        // Usar nodemailer se disponível (dependência opcional)
        const nodemailer = await Promise.resolve().then(() => __importStar(require("nodemailer"))).catch(() => null);
        if (!nodemailer) {
            console.warn("⚠️ nodemailer não instalado. Email não enviado.");
            return;
        }
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: (process.env.SMTP_PORT || "587") === "465",
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
        await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: params.para,
            subject: params.assunto,
            text: params.corpo,
            icalEvent: {
                method: "REQUEST",
                content: params.icsContent,
            },
        });
        console.log(`📧 Email enviado para ${params.para} (${params.protocolo})`);
    }
    catch (erro) {
        console.error(`Erro ao enviar email para ${params.para}:`, erro);
    }
}
//# sourceMappingURL=calendario.js.map