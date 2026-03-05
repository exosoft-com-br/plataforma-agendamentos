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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const supabaseClient_1 = require("../supabaseClient");
const sanitizar_1 = require("../utils/sanitizar");
const auth_1 = require("../middleware/auth");
exports.authRouter = (0, express_1.Router)();
// ============================================================
// Helpers
// ============================================================
async function criarOuAtualizarUsuarioOAuth(email, nome, provedor, provedorId, avatarUrl) {
    // Verificar se já existe por provedor+id
    const { data: existente } = await supabaseClient_1.supabase
        .from("usuarios")
        .select("*")
        .eq("provedor", provedor)
        .eq("provedor_id", provedorId)
        .single();
    if (existente) {
        await supabaseClient_1.supabase
            .from("usuarios")
            .update({ nome, avatar_url: avatarUrl || existente.avatar_url })
            .eq("id", existente.id);
        return { usuario: { ...existente, nome, avatar_url: avatarUrl }, isNew: false };
    }
    // Verificar se existe pelo email
    const { data: porEmail } = await supabaseClient_1.supabase
        .from("usuarios")
        .select("*")
        .eq("email", email)
        .single();
    if (porEmail) {
        await supabaseClient_1.supabase
            .from("usuarios")
            .update({ provedor, provedor_id: provedorId, avatar_url: avatarUrl || porEmail.avatar_url })
            .eq("id", porEmail.id);
        return { usuario: { ...porEmail, provedor, provedor_id: provedorId }, isNew: false };
    }
    // Primeiro usuário = admin automático
    const { data: admins } = await supabaseClient_1.supabase
        .from("usuarios")
        .select("id")
        .eq("role", "admin")
        .limit(1);
    const isFirstUser = !admins || admins.length === 0;
    const role = isFirstUser ? "admin" : "usuario";
    const { data, error } = await supabaseClient_1.supabase
        .from("usuarios")
        .insert({
        email,
        senha_hash: "",
        nome,
        role,
        owner_id: null,
        provedor,
        provedor_id: provedorId,
        avatar_url: avatarUrl,
    })
        .select("*")
        .single();
    if (error)
        throw error;
    if (role === "admin") {
        await supabaseClient_1.supabase.from("usuarios").update({ owner_id: data.id }).eq("id", data.id);
        data.owner_id = data.id;
    }
    return { usuario: data, isNew: true };
}
function gerarResposta(user) {
    const ownerId = user.role === "admin" ? user.id : (user.owner_id || user.id);
    const token = (0, auth_1.gerarToken)({
        userId: user.id,
        email: user.email,
        role: user.role,
        ownerId,
    });
    return {
        sucesso: true,
        token,
        usuario: {
            id: user.id,
            email: user.email,
            nome: user.nome,
            role: user.role,
            ownerId,
            avatarUrl: user.avatar_url || null,
            provedor: user.provedor || "email",
        },
    };
}
// ============================================================
// POST /api/auth/register (email + senha)
// ============================================================
exports.authRouter.post("/auth/register", async (req, res) => {
    try {
        const email = (req.body.email || "").trim().toLowerCase();
        const senha = req.body.senha || "";
        const nome = (0, sanitizar_1.sanitizar)(req.body.nome || "");
        const role = req.body.role || "usuario";
        if (!email || !senha || !nome) {
            res.status(400).json({ erro: "Email, senha e nome são obrigatórios." });
            return;
        }
        if (senha.length < 6) {
            res.status(400).json({ erro: "Senha deve ter pelo menos 6 caracteres." });
            return;
        }
        if (!["admin", "usuario"].includes(role)) {
            res.status(400).json({ erro: "Role deve ser 'admin' ou 'usuario'." });
            return;
        }
        const { data: admins } = await supabaseClient_1.supabase
            .from("usuarios")
            .select("id")
            .eq("role", "admin")
            .limit(1);
        const isFirstUser = !admins || admins.length === 0;
        if (!isFirstUser) {
            const header = req.headers.authorization;
            if (!header || !header.startsWith("Bearer ")) {
                res.status(401).json({ erro: "Apenas administradores podem criar novos usuários." });
                return;
            }
            const jwt = await Promise.resolve().then(() => __importStar(require("jsonwebtoken")));
            const JWT_SECRET = process.env.JWT_SECRET || "plataforma-agendamentos-secret-key-2024";
            try {
                const decoded = jwt.default.verify(header.split(" ")[1], JWT_SECRET);
                if (decoded.role !== "admin") {
                    res.status(403).json({ erro: "Apenas administradores podem criar novos usuários." });
                    return;
                }
            }
            catch {
                res.status(401).json({ erro: "Token inválido." });
                return;
            }
        }
        const { data: existente } = await supabaseClient_1.supabase
            .from("usuarios")
            .select("id")
            .eq("email", email)
            .single();
        if (existente) {
            res.status(409).json({ erro: "Email já cadastrado." });
            return;
        }
        const senhaHash = await bcryptjs_1.default.hash(senha, 12);
        const finalRole = isFirstUser ? "admin" : role;
        const { data, error } = await supabaseClient_1.supabase
            .from("usuarios")
            .insert({
            email,
            senha_hash: senhaHash,
            nome,
            role: finalRole,
            owner_id: null,
            provedor: "email",
        })
            .select("id, email, nome, role, criado_em")
            .single();
        if (error) {
            console.error("Erro ao registrar:", error);
            res.status(500).json({ erro: "Erro ao cadastrar usuário.", detalhes: error.message });
            return;
        }
        if (finalRole === "admin") {
            await supabaseClient_1.supabase.from("usuarios").update({ owner_id: data.id }).eq("id", data.id);
        }
        res.status(201).json({
            sucesso: true,
            usuario: data,
            mensagem: isFirstUser
                ? "Conta admin criada com sucesso! Você é o primeiro administrador."
                : `Usuário ${finalRole} criado com sucesso.`,
        });
    }
    catch (erro) {
        console.error("Erro no registro:", erro);
        res.status(500).json({ erro: "Erro interno.", detalhes: erro.message });
    }
});
// ============================================================
// POST /api/auth/login (email + senha)
// ============================================================
exports.authRouter.post("/auth/login", async (req, res) => {
    try {
        const email = (req.body.email || "").trim().toLowerCase();
        const senha = req.body.senha || "";
        if (!email || !senha) {
            res.status(400).json({ erro: "Email e senha são obrigatórios." });
            return;
        }
        const { data: user, error } = await supabaseClient_1.supabase
            .from("usuarios")
            .select("*")
            .eq("email", email)
            .single();
        if (error || !user) {
            res.status(401).json({ erro: "Email ou senha incorretos." });
            return;
        }
        if (!user.ativo) {
            res.status(403).json({ erro: "Conta desativada. Contate o administrador." });
            return;
        }
        if (!user.senha_hash) {
            res.status(400).json({
                erro: `Esta conta foi criada via ${user.provedor}. Use o botão "${user.provedor}" para entrar.`,
            });
            return;
        }
        const senhaOk = await bcryptjs_1.default.compare(senha, user.senha_hash);
        if (!senhaOk) {
            res.status(401).json({ erro: "Email ou senha incorretos." });
            return;
        }
        res.json(gerarResposta(user));
    }
    catch (erro) {
        console.error("Erro no login:", erro);
        res.status(500).json({ erro: "Erro interno." });
    }
});
// ============================================================
// POST /api/auth/google — Login/Registro via Google
// ============================================================
exports.authRouter.post("/auth/google", async (req, res) => {
    try {
        const { credential } = req.body;
        if (!credential) {
            res.status(400).json({ erro: "Token do Google não fornecido." });
            return;
        }
        const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
        if (!GOOGLE_CLIENT_ID) {
            res.status(503).json({ erro: "Login com Google não configurado no servidor." });
            return;
        }
        const { OAuth2Client } = await Promise.resolve().then(() => __importStar(require("google-auth-library")));
        const client = new OAuth2Client(GOOGLE_CLIENT_ID);
        let ticket;
        try {
            ticket = await client.verifyIdToken({
                idToken: credential,
                audience: GOOGLE_CLIENT_ID,
            });
        }
        catch {
            res.status(401).json({ erro: "Token do Google inválido." });
            return;
        }
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
            res.status(401).json({ erro: "Token do Google não contém email." });
            return;
        }
        const { usuario } = await criarOuAtualizarUsuarioOAuth(payload.email, payload.name || payload.email.split("@")[0], "google", payload.sub, payload.picture);
        if (!usuario.ativo) {
            res.status(403).json({ erro: "Conta desativada." });
            return;
        }
        res.json(gerarResposta(usuario));
    }
    catch (erro) {
        console.error("Erro Google OAuth:", erro);
        res.status(500).json({ erro: "Erro ao autenticar com Google.", detalhes: erro.message });
    }
});
// ============================================================
// POST /api/auth/facebook — Login/Registro via Facebook
// ============================================================
exports.authRouter.post("/auth/facebook", async (req, res) => {
    try {
        const { accessToken } = req.body;
        if (!accessToken) {
            res.status(400).json({ erro: "Token do Facebook não fornecido." });
            return;
        }
        const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
        const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
        if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
            res.status(503).json({ erro: "Login com Facebook não configurado no servidor." });
            return;
        }
        const debugUrl = `https://graph.facebook.com/debug_token?input_token=${accessToken}&access_token=${FACEBOOK_APP_ID}|${FACEBOOK_APP_SECRET}`;
        const debugRes = await fetch(debugUrl);
        const debugData = await debugRes.json();
        if (!debugData.data || !debugData.data.is_valid) {
            res.status(401).json({ erro: "Token do Facebook inválido." });
            return;
        }
        const profileUrl = `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${accessToken}`;
        const profileRes = await fetch(profileUrl);
        const profile = await profileRes.json();
        if (!profile.email) {
            res.status(400).json({ erro: "O Facebook não retornou o email. Verifique as permissões." });
            return;
        }
        const { usuario } = await criarOuAtualizarUsuarioOAuth(profile.email, profile.name || profile.email.split("@")[0], "facebook", profile.id, profile.picture?.data?.url || null);
        if (!usuario.ativo) {
            res.status(403).json({ erro: "Conta desativada." });
            return;
        }
        res.json(gerarResposta(usuario));
    }
    catch (erro) {
        console.error("Erro Facebook OAuth:", erro);
        res.status(500).json({ erro: "Erro ao autenticar com Facebook.", detalhes: erro.message });
    }
});
// ============================================================
// GET /api/auth/me
// ============================================================
exports.authRouter.get("/auth/me", auth_1.autenticar, async (req, res) => {
    try {
        const { data: user } = await supabaseClient_1.supabase
            .from("usuarios")
            .select("id, email, nome, role, ativo, provedor, avatar_url, owner_id")
            .eq("id", req.auth.userId)
            .single();
        if (!user) {
            res.status(404).json({ erro: "Usuário não encontrado." });
            return;
        }
        res.json({
            usuario: {
                id: user.id,
                email: user.email,
                nome: user.nome,
                role: user.role,
                ownerId: user.role === "admin" ? user.id : (user.owner_id || user.id),
                avatarUrl: user.avatar_url,
                provedor: user.provedor,
            },
        });
    }
    catch {
        res.json({
            usuario: {
                userId: req.auth.userId,
                email: req.auth.email,
                role: req.auth.role,
                ownerId: req.auth.ownerId,
            },
        });
    }
});
// ============================================================
// GET /api/auth/usuarios — Admin lista seus usuários
// ============================================================
exports.authRouter.get("/auth/usuarios", auth_1.autenticar, auth_1.apenasAdmin, async (req, res) => {
    try {
        const { data, error } = await supabaseClient_1.supabase
            .from("usuarios")
            .select("id, email, nome, role, ativo, criado_em, provedor, avatar_url")
            .or(`id.eq.${req.auth.userId},owner_id.eq.${req.auth.userId}`)
            .order("criado_em", { ascending: false });
        if (error) {
            res.status(500).json({ erro: "Erro ao listar usuários." });
            return;
        }
        res.json({ usuarios: data || [] });
    }
    catch (erro) {
        console.error("Erro ao listar usuários:", erro);
        res.status(500).json({ erro: "Erro interno." });
    }
});
// ============================================================
// POST /api/auth/usuarios — Admin cria usuário vinculado
// ============================================================
exports.authRouter.post("/auth/usuarios", auth_1.autenticar, auth_1.apenasAdmin, async (req, res) => {
    try {
        const email = (req.body.email || "").trim().toLowerCase();
        const senha = req.body.senha || "";
        const nome = (0, sanitizar_1.sanitizar)(req.body.nome || "");
        if (!email || !senha || !nome) {
            res.status(400).json({ erro: "Email, senha e nome são obrigatórios." });
            return;
        }
        if (senha.length < 6) {
            res.status(400).json({ erro: "Senha mínima: 6 caracteres." });
            return;
        }
        const { data: existente } = await supabaseClient_1.supabase
            .from("usuarios")
            .select("id")
            .eq("email", email)
            .single();
        if (existente) {
            res.status(409).json({ erro: "Email já cadastrado." });
            return;
        }
        const senhaHash = await bcryptjs_1.default.hash(senha, 12);
        const { data, error } = await supabaseClient_1.supabase
            .from("usuarios")
            .insert({
            email,
            senha_hash: senhaHash,
            nome,
            role: "usuario",
            owner_id: req.auth.userId,
            provedor: "email",
        })
            .select("id, email, nome, role, criado_em")
            .single();
        if (error) {
            res.status(500).json({ erro: "Erro ao criar usuário." });
            return;
        }
        res.status(201).json({ sucesso: true, usuario: data });
    }
    catch (erro) {
        console.error("Erro ao criar usuário:", erro);
        res.status(500).json({ erro: "Erro interno." });
    }
});
// ============================================================
// GET /api/auth/oauth-config — quais provedores estão ativos
// ============================================================
exports.authRouter.get("/auth/oauth-config", async (_req, res) => {
    res.json({
        google: !!process.env.GOOGLE_CLIENT_ID,
        facebook: !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET),
        googleClientId: process.env.GOOGLE_CLIENT_ID || null,
        facebookAppId: process.env.FACEBOOK_APP_ID || null,
    });
});
//# sourceMappingURL=auth.js.map