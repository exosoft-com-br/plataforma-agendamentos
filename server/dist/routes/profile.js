"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.profileRouter = void 0;
const express_1 = require("express");
const supabaseClient_1 = require("../supabaseClient");
const sanitizar_1 = require("../utils/sanitizar");
exports.profileRouter = (0, express_1.Router)();
/**
 * GET /api/profile/:userId
 * Retorna o perfil do dono de negócio.
 */
exports.profileRouter.get("/profile/:userId", async (req, res) => {
    try {
        const userId = (0, sanitizar_1.sanitizarId)(req.params.userId);
        if (!userId) {
            res.status(400).json({ erro: "userId inválido." });
            return;
        }
        const { data, error } = await supabaseClient_1.supabase
            .from("usuarios")
            .select("*")
            .eq("id", userId)
            .single();
        if (error || !data) {
            res.status(404).json({ erro: "Perfil não encontrado." });
            return;
        }
        res.json({
            id: data.id,
            email: data.email,
            nomeCompleto: data.nome,
            telefone: null,
            avatarUrl: data.avatar_url,
            role: data.role,
            criadoEm: data.criado_em,
        });
    }
    catch (erro) {
        console.error("Erro ao buscar perfil:", erro);
        res.status(500).json({ erro: "Erro interno." });
    }
});
/**
 * PUT /api/profile/:userId
 * Atualiza dados do perfil.
 */
exports.profileRouter.put("/profile/:userId", async (req, res) => {
    try {
        const userId = (0, sanitizar_1.sanitizarId)(req.params.userId);
        if (!userId) {
            res.status(400).json({ erro: "userId inválido." });
            return;
        }
        const nomeCompleto = (0, sanitizar_1.sanitizar)(req.body.nomeCompleto || "");
        const telefone = (req.body.telefone || "").replace(/\D/g, "");
        const avatarUrl = (0, sanitizar_1.sanitizar)(req.body.avatarUrl || "");
        const updates = {};
        if (nomeCompleto)
            updates.nome = nomeCompleto;
        if (avatarUrl)
            updates.avatar_url = avatarUrl;
        if (Object.keys(updates).length === 0) {
            res.status(400).json({ erro: "Nenhum campo para atualizar." });
            return;
        }
        const { data, error } = await supabaseClient_1.supabase
            .from("usuarios")
            .update(updates)
            .eq("id", userId)
            .select()
            .single();
        if (error) {
            console.error("Erro ao atualizar perfil:", error);
            res.status(500).json({ erro: "Erro ao atualizar perfil." });
            return;
        }
        res.json({
            sucesso: true,
            perfil: {
                id: data.id,
                email: data.email,
                nomeCompleto: data.nome,
                avatarUrl: data.avatar_url,
            },
        });
    }
    catch (erro) {
        console.error("Erro ao atualizar perfil:", erro);
        res.status(500).json({ erro: "Erro interno." });
    }
});
//# sourceMappingURL=profile.js.map