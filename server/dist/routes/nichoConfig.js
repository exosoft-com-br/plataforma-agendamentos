"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nichoConfigRouter = void 0;
const express_1 = require("express");
const supabaseClient_1 = require("../supabaseClient");
const sanitizar_1 = require("../utils/sanitizar");
exports.nichoConfigRouter = (0, express_1.Router)();
/**
 * GET /api/nicho?nichoId=barbearia
 *
 * Retorna configuração completa do nicho + prestadores + serviços.
 */
exports.nichoConfigRouter.get("/nicho", async (req, res) => {
    try {
        const nichoId = (0, sanitizar_1.sanitizarId)(req.query.nichoId || "");
        if (!nichoId) {
            res.status(400).json({ erro: "Parâmetro obrigatório: nichoId" });
            return;
        }
        // 1. Buscar nicho
        const { data: nicho, error: nichoErr } = await supabaseClient_1.supabase
            .from("nichos")
            .select("*")
            .eq("id", nichoId)
            .single();
        if (nichoErr || !nicho) {
            res.status(404).json({ erro: "Nicho não encontrado." });
            return;
        }
        // 2. Buscar prestadores do nicho
        const { data: prestadoresRaw } = await supabaseClient_1.supabase
            .from("prestadores")
            .select("*")
            .eq("nicho_id", nichoId)
            .eq("ativo", true);
        // 3. Buscar serviços do nicho
        const { data: servicosRaw } = await supabaseClient_1.supabase
            .from("servicos")
            .select("*")
            .eq("nicho_id", nichoId)
            .eq("ativo", true);
        // Mapear para formato camelCase (compatível com Typebot)
        const nichoFormatado = {
            id: nicho.id,
            nomePublico: nicho.nome_publico,
            tipoCliente: nicho.tipo_cliente,
            saudacaoInicial: nicho.saudacao_inicial,
            textoConfirmacao: nicho.texto_confirmacao,
            termos: nicho.termos,
            ativo: nicho.ativo,
        };
        const prestadores = (prestadoresRaw || []).map((p) => ({
            id: p.id,
            nichoId: p.nicho_id,
            nome: p.nome,
            categoria: p.categoria,
            horarioAtendimento: {
                inicio: p.horario_inicio,
                fim: p.horario_fim,
                diasSemana: p.dias_semana,
            },
            ativo: p.ativo,
        }));
        const servicos = (servicosRaw || []).map((s) => ({
            id: s.id,
            nichoId: s.nicho_id,
            prestadorId: s.prestador_id,
            nome: s.nome,
            duracaoMinutos: s.duracao_minutos,
            preco: s.preco ? Number(s.preco) : null,
            ativo: s.ativo,
        }));
        res.json({ nicho: nichoFormatado, prestadores, servicos });
    }
    catch (erro) {
        console.error("Erro ao buscar config do nicho:", erro);
        res.status(500).json({ erro: "Erro interno ao buscar configuração do nicho." });
    }
});
//# sourceMappingURL=nichoConfig.js.map