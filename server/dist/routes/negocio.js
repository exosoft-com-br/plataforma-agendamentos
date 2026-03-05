"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.negocioRouter = void 0;
const express_1 = require("express");
const supabaseClient_1 = require("../supabaseClient");
const sanitizar_1 = require("../utils/sanitizar");
exports.negocioRouter = (0, express_1.Router)();
// ============================================================
// Validar cor hex
// ============================================================
function isCorHex(cor) {
    return /^#[0-9a-fA-F]{6}$/.test(cor);
}
/**
 * POST /api/negocios
 * Cadastra um novo negócio para o dono.
 */
exports.negocioRouter.post("/negocios", async (req, res) => {
    try {
        const ownerId = (0, sanitizar_1.sanitizarId)(req.body.ownerId);
        const nichoId = (0, sanitizar_1.sanitizarId)(req.body.nichoId);
        const nomeFantasia = (0, sanitizar_1.sanitizar)(req.body.nomeFantasia || "");
        const descricao = (0, sanitizar_1.sanitizar)(req.body.descricao || "");
        const telefoneComercial = (req.body.telefoneComercial || "").replace(/\D/g, "");
        const endereco = (0, sanitizar_1.sanitizar)(req.body.endereco || "");
        const bairro = (0, sanitizar_1.sanitizar)(req.body.bairro || "");
        const cidade = (0, sanitizar_1.sanitizar)(req.body.cidade || "");
        const estado = (0, sanitizar_1.sanitizar)(req.body.estado || "SP");
        const cnpjCpf = (req.body.cnpjCpf || "").replace(/\D/g, "");
        if (!ownerId || !nichoId || !nomeFantasia) {
            res.status(400).json({ erro: "Campos obrigatórios: ownerId, nichoId, nomeFantasia" });
            return;
        }
        // Verificar se o nicho existe
        const { data: nicho } = await supabaseClient_1.supabase
            .from("nichos")
            .select("id")
            .eq("id", nichoId)
            .single();
        if (!nicho) {
            // Criar nicho automaticamente se não existir
            const slug = nichoId.toLowerCase().replace(/[^a-z0-9-]/g, "-");
            await supabaseClient_1.supabase.from("nichos").insert({
                id: nichoId,
                nome_publico: nomeFantasia,
                tipo_cliente: "cliente",
                saudacao_inicial: `Olá! Bem-vindo(a) ao ${nomeFantasia}! Como posso ajudar?`,
                texto_confirmacao: "Agendamento confirmado! Protocolo: {protocolo}. Data: {dataHora}.",
                owner_id: ownerId,
                slug,
            });
        }
        const { data, error } = await supabaseClient_1.supabase
            .from("negocios")
            .insert({
            owner_id: ownerId,
            nicho_id: nichoId,
            nome_fantasia: nomeFantasia,
            descricao,
            telefone_comercial: telefoneComercial || null,
            endereco: endereco || null,
            bairro: bairro || null,
            cidade: cidade || null,
            estado,
            cnpj_cpf: cnpjCpf || null,
        })
            .select()
            .single();
        if (error) {
            if (error.code === "23505") {
                res.status(409).json({ erro: "Você já possui um negócio cadastrado neste nicho." });
                return;
            }
            console.error("Erro ao criar negócio:", error);
            res.status(500).json({ erro: "Erro ao criar negócio." });
            return;
        }
        // Criar personalização padrão automaticamente
        await supabaseClient_1.supabase.from("personalizacoes").insert({
            negocio_id: data.id,
        });
        res.status(201).json({
            sucesso: true,
            negocio: {
                id: data.id,
                ownerId: data.owner_id,
                nichoId: data.nicho_id,
                nomeFantasia: data.nome_fantasia,
                descricao: data.descricao,
                telefoneComercial: data.telefone_comercial,
                endereco: data.endereco,
                bairro: data.bairro,
                cidade: data.cidade,
                estado: data.estado,
            },
        });
    }
    catch (erro) {
        console.error("Erro ao criar negócio:", erro);
        res.status(500).json({ erro: "Erro interno." });
    }
});
/**
 * GET /api/negocios/:ownerId
 * Lista os negócios de um dono.
 */
exports.negocioRouter.get("/negocios/:ownerId", async (req, res) => {
    try {
        const ownerId = (0, sanitizar_1.sanitizarId)(req.params.ownerId);
        if (!ownerId) {
            res.status(400).json({ erro: "ownerId inválido." });
            return;
        }
        const { data, error } = await supabaseClient_1.supabase
            .from("negocios")
            .select(`
        *,
        personalizacoes (*),
        nichos (nome_publico, saudacao_inicial, termos)
      `)
            .eq("owner_id", ownerId)
            .order("criado_em", { ascending: false });
        if (error) {
            console.error("Erro ao listar negócios:", error);
            res.status(500).json({ erro: "Erro ao listar negócios." });
            return;
        }
        const negocios = (data || []).map((n) => ({
            id: n.id,
            nichoId: n.nicho_id,
            nomeFantasia: n.nome_fantasia,
            descricao: n.descricao,
            telefoneComercial: n.telefone_comercial,
            endereco: n.endereco,
            bairro: n.bairro,
            cidade: n.cidade,
            estado: n.estado,
            ativo: n.ativo,
            nicho: n.nichos ? {
                nomePublico: n.nichos.nome_publico,
                saudacaoInicial: n.nichos.saudacao_inicial,
                termos: n.nichos.termos,
            } : null,
            personalizacao: n.personalizacoes ? {
                logoUrl: n.personalizacoes.logo_url,
                corPrimaria: n.personalizacoes.cor_primaria,
                corSecundaria: n.personalizacoes.cor_secundaria,
                corTexto: n.personalizacoes.cor_texto,
                corFundo: n.personalizacoes.cor_fundo,
                corBotao: n.personalizacoes.cor_botao,
                corBotaoTexto: n.personalizacoes.cor_botao_texto,
                fonteTitulo: n.personalizacoes.fonte_titulo,
                fonteCorpo: n.personalizacoes.fonte_corpo,
                bannerUrl: n.personalizacoes.banner_url,
            } : null,
            criadoEm: n.criado_em,
        }));
        res.json({ negocios });
    }
    catch (erro) {
        console.error("Erro ao listar negócios:", erro);
        res.status(500).json({ erro: "Erro interno." });
    }
});
/**
 * PUT /api/negocios/:negocioId
 * Atualiza dados do negócio.
 */
exports.negocioRouter.put("/negocios/:negocioId", async (req, res) => {
    try {
        const negocioId = (0, sanitizar_1.sanitizarId)(req.params.negocioId);
        if (!negocioId) {
            res.status(400).json({ erro: "negocioId inválido." });
            return;
        }
        const updates = {};
        const fields = [
            { key: "nomeFantasia", column: "nome_fantasia", sanitize: sanitizar_1.sanitizar },
            { key: "descricao", column: "descricao", sanitize: sanitizar_1.sanitizar },
            { key: "endereco", column: "endereco", sanitize: sanitizar_1.sanitizar },
            { key: "bairro", column: "bairro", sanitize: sanitizar_1.sanitizar },
            { key: "cidade", column: "cidade", sanitize: sanitizar_1.sanitizar },
            { key: "estado", column: "estado", sanitize: sanitizar_1.sanitizar },
        ];
        for (const f of fields) {
            if (req.body[f.key] !== undefined) {
                updates[f.column] = f.sanitize(req.body[f.key]);
            }
        }
        if (req.body.telefoneComercial !== undefined) {
            updates.telefone_comercial = req.body.telefoneComercial.replace(/\D/g, "");
        }
        if (req.body.cnpjCpf !== undefined) {
            updates.cnpj_cpf = req.body.cnpjCpf.replace(/\D/g, "");
        }
        if (req.body.ativo !== undefined) {
            updates.ativo = Boolean(req.body.ativo);
        }
        if (Object.keys(updates).length === 0) {
            res.status(400).json({ erro: "Nenhum campo para atualizar." });
            return;
        }
        const { data, error } = await supabaseClient_1.supabase
            .from("negocios")
            .update(updates)
            .eq("id", negocioId)
            .select()
            .single();
        if (error) {
            console.error("Erro ao atualizar negócio:", error);
            res.status(500).json({ erro: "Erro ao atualizar negócio." });
            return;
        }
        res.json({ sucesso: true, negocio: data });
    }
    catch (erro) {
        console.error("Erro ao atualizar negócio:", erro);
        res.status(500).json({ erro: "Erro interno." });
    }
});
/**
 * DELETE /api/negocios/:negocioId
 * Exclui um negócio (e suas personalizações em cascata).
 * Acesso: apenas admin (verificado pelo frontend via JWT role).
 */
exports.negocioRouter.delete("/negocios/:negocioId", async (req, res) => {
    try {
        const negocioId = (0, sanitizar_1.sanitizarId)(req.params.negocioId);
        if (!negocioId) {
            res.status(400).json({ erro: "negocioId inválido." });
            return;
        }
        // Excluir personalizacoes vinculadas
        await supabaseClient_1.supabase.from("personalizacoes").delete().eq("negocio_id", negocioId);
        // Excluir integracoes vinculadas
        await supabaseClient_1.supabase.from("integracoes_email").delete().eq("negocio_id", negocioId);
        // Excluir o negócio
        const { error } = await supabaseClient_1.supabase
            .from("negocios")
            .delete()
            .eq("id", negocioId);
        if (error) {
            console.error("Erro ao excluir negócio:", error);
            res.status(500).json({ erro: "Erro ao excluir negócio." });
            return;
        }
        res.json({ sucesso: true, mensagem: "Negócio excluído com sucesso." });
    }
    catch (erro) {
        console.error("Erro ao excluir negócio:", erro);
        res.status(500).json({ erro: "Erro interno." });
    }
});
/**
 * PUT /api/negocios/:negocioId/personalizacao
 * Atualiza cores, logo, fontes do negócio.
 */
exports.negocioRouter.put("/negocios/:negocioId/personalizacao", async (req, res) => {
    try {
        const negocioId = (0, sanitizar_1.sanitizarId)(req.params.negocioId);
        if (!negocioId) {
            res.status(400).json({ erro: "negocioId inválido." });
            return;
        }
        const updates = {};
        // Campos de cor (validar hex)
        const corFields = [
            { key: "corPrimaria", column: "cor_primaria" },
            { key: "corSecundaria", column: "cor_secundaria" },
            { key: "corTexto", column: "cor_texto" },
            { key: "corFundo", column: "cor_fundo" },
            { key: "corBotao", column: "cor_botao" },
            { key: "corBotaoTexto", column: "cor_botao_texto" },
        ];
        for (const f of corFields) {
            if (req.body[f.key]) {
                const cor = req.body[f.key].trim();
                if (!isCorHex(cor)) {
                    res.status(400).json({ erro: `Cor inválida para ${f.key}. Use formato hex (#RRGGBB).` });
                    return;
                }
                updates[f.column] = cor;
            }
        }
        // URLs (sanitizar)
        if (req.body.logoUrl !== undefined)
            updates.logo_url = (0, sanitizar_1.sanitizar)(req.body.logoUrl);
        if (req.body.faviconUrl !== undefined)
            updates.favicon_url = (0, sanitizar_1.sanitizar)(req.body.faviconUrl);
        if (req.body.bannerUrl !== undefined)
            updates.banner_url = (0, sanitizar_1.sanitizar)(req.body.bannerUrl);
        // Fontes (sanitizar)
        if (req.body.fonteTitulo)
            updates.fonte_titulo = (0, sanitizar_1.sanitizar)(req.body.fonteTitulo);
        if (req.body.fonteCorpo)
            updates.fonte_corpo = (0, sanitizar_1.sanitizar)(req.body.fonteCorpo);
        if (Object.keys(updates).length === 0) {
            res.status(400).json({ erro: "Nenhum campo para atualizar." });
            return;
        }
        // Upsert: atualizar se existe, criar se não
        const { data: existing } = await supabaseClient_1.supabase
            .from("personalizacoes")
            .select("id")
            .eq("negocio_id", negocioId)
            .single();
        let result;
        if (existing) {
            result = await supabaseClient_1.supabase
                .from("personalizacoes")
                .update(updates)
                .eq("negocio_id", negocioId)
                .select()
                .single();
        }
        else {
            result = await supabaseClient_1.supabase
                .from("personalizacoes")
                .insert({ negocio_id: negocioId, ...updates })
                .select()
                .single();
        }
        if (result.error) {
            console.error("Erro ao atualizar personalização:", result.error);
            res.status(500).json({ erro: "Erro ao atualizar personalização." });
            return;
        }
        const p = result.data;
        res.json({
            sucesso: true,
            personalizacao: {
                logoUrl: p.logo_url,
                faviconUrl: p.favicon_url,
                corPrimaria: p.cor_primaria,
                corSecundaria: p.cor_secundaria,
                corTexto: p.cor_texto,
                corFundo: p.cor_fundo,
                corBotao: p.cor_botao,
                corBotaoTexto: p.cor_botao_texto,
                fonteTitulo: p.fonte_titulo,
                fonteCorpo: p.fonte_corpo,
                bannerUrl: p.banner_url,
            },
        });
    }
    catch (erro) {
        console.error("Erro ao atualizar personalização:", erro);
        res.status(500).json({ erro: "Erro interno." });
    }
});
/**
 * GET /api/negocios/:negocioId/personalizacao
 * Retorna as personalizações visuais do negócio (público — usado pelo frontend de agendamento).
 */
exports.negocioRouter.get("/negocios/:negocioId/personalizacao", async (req, res) => {
    try {
        const negocioId = (0, sanitizar_1.sanitizarId)(req.params.negocioId);
        if (!negocioId) {
            res.status(400).json({ erro: "negocioId inválido." });
            return;
        }
        const { data, error } = await supabaseClient_1.supabase
            .from("personalizacoes")
            .select("*")
            .eq("negocio_id", negocioId)
            .single();
        if (error || !data) {
            // Retornar valores padrão se não existe personalização
            res.json({
                corPrimaria: "#667eea",
                corSecundaria: "#764ba2",
                corTexto: "#ffffff",
                corFundo: "#f5f5f5",
                corBotao: "#667eea",
                corBotaoTexto: "#ffffff",
                fonteTitulo: "Segoe UI",
                fonteCorpo: "Segoe UI",
                logoUrl: null,
                bannerUrl: null,
            });
            return;
        }
        res.json({
            logoUrl: data.logo_url,
            faviconUrl: data.favicon_url,
            corPrimaria: data.cor_primaria,
            corSecundaria: data.cor_secundaria,
            corTexto: data.cor_texto,
            corFundo: data.cor_fundo,
            corBotao: data.cor_botao,
            corBotaoTexto: data.cor_botao_texto,
            fonteTitulo: data.fonte_titulo,
            fonteCorpo: data.fonte_corpo,
            bannerUrl: data.banner_url,
        });
    }
    catch (erro) {
        console.error("Erro ao buscar personalização:", erro);
        res.status(500).json({ erro: "Erro interno." });
    }
});
/**
 * GET /api/personalizacao/nicho/:nichoId
 * Rota pública — busca personalização pelo nichoId (usado pelo frontend de agendamento).
 * Encontra o negócio ativo daquele nicho e retorna suas cores/logo/fontes.
 */
exports.negocioRouter.get("/personalizacao/nicho/:nichoId", async (req, res) => {
    try {
        const nichoId = (0, sanitizar_1.sanitizarId)(req.params.nichoId);
        if (!nichoId) {
            res.status(400).json({ erro: "nichoId inválido." });
            return;
        }
        // Buscar negócio ativo deste nicho
        const { data: negocio } = await supabaseClient_1.supabase
            .from("negocios")
            .select("id, nome_fantasia")
            .eq("nicho_id", nichoId)
            .eq("ativo", true)
            .limit(1)
            .single();
        if (!negocio) {
            // Sem negócio cadastrado — retornar defaults
            res.json({
                corPrimaria: "#667eea",
                corSecundaria: "#764ba2",
                corTexto: "#ffffff",
                corFundo: "#f5f5f5",
                corBotao: "#667eea",
                corBotaoTexto: "#ffffff",
                fonteTitulo: "Segoe UI",
                fonteCorpo: "Segoe UI",
                logoUrl: null,
                bannerUrl: null,
                nomeNegocio: null,
            });
            return;
        }
        const { data: p } = await supabaseClient_1.supabase
            .from("personalizacoes")
            .select("*")
            .eq("negocio_id", negocio.id)
            .single();
        if (!p) {
            res.json({
                corPrimaria: "#667eea",
                corSecundaria: "#764ba2",
                corTexto: "#ffffff",
                corFundo: "#f5f5f5",
                corBotao: "#667eea",
                corBotaoTexto: "#ffffff",
                fonteTitulo: "Segoe UI",
                fonteCorpo: "Segoe UI",
                logoUrl: null,
                bannerUrl: null,
                nomeNegocio: negocio.nome_fantasia,
            });
            return;
        }
        res.json({
            corPrimaria: p.cor_primaria,
            corSecundaria: p.cor_secundaria,
            corTexto: p.cor_texto,
            corFundo: p.cor_fundo,
            corBotao: p.cor_botao,
            corBotaoTexto: p.cor_botao_texto,
            fonteTitulo: p.fonte_titulo,
            fonteCorpo: p.fonte_corpo,
            logoUrl: p.logo_url,
            faviconUrl: p.favicon_url,
            bannerUrl: p.banner_url,
            nomeNegocio: negocio.nome_fantasia,
        });
    }
    catch (erro) {
        console.error("Erro ao buscar personalização por nicho:", erro);
        res.status(500).json({ erro: "Erro interno." });
    }
});
//# sourceMappingURL=negocio.js.map