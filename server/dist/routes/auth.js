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
/**
 * POST /api/auth/register
 * Cadastrar novo usuário.
 * - Primeiro registro vira admin automaticamente.
 * - Depois, apenas admin pode criar novos usuários.
 */
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
        // Verificar se já existe algum admin (primeiro registro = admin)
        const { data: admins } = await supabaseClient_1.supabase
            .from("usuarios")
            .select("id")
            .eq("role", "admin")
            .limit(1);
        const isFirstUser = !admins || admins.length === 0;
        // Se NÃO é o primeiro user, exigir autenticação admin
        if (!isFirstUser) {
            const header = req.headers.authorization;
            if (!header || !header.startsWith("Bearer ")) {
                res.status(401).json({ erro: "Apenas administradores podem criar usuários." });
                return;
            }
            const jwt = await Promise.resolve().then(() => __importStar(require("jsonwebtoken")));
            const JWT_SECRET = process.env.JWT_SECRET || "plataforma-agendamentos-secret-key-2024";
            try {
                const decoded = jwt.default.verify(header.split(" ")[1], JWT_SECRET);
                if (decoded.role !== "admin") {
                    res.status(403).json({ erro: "Apenas administradores podem criar usuários." });
                    return;
                }
            }
            catch {
                res.status(401).json({ erro: "Token inválido." });
                return;
            }
        }
        // Check duplicado
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
            owner_id: null, // será preenchido no login para usuarios
        })
            .select("id, email, nome, role, criado_em")
            .single();
        if (error) {
            console.error("Erro ao registrar:", error);
            res.status(500).json({ erro: "Erro ao cadastrar usuário." });
            return;
        }
        // Se é admin, owner_id = próprio id
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
        res.status(500).json({ erro: "Erro interno." });
    }
});
/**
 * POST /api/auth/login
 * Autenticar e retornar JWT + dados do usuário.
 */
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
        const senhaOk = await bcryptjs_1.default.compare(senha, user.senha_hash);
        if (!senhaOk) {
            res.status(401).json({ erro: "Email ou senha incorretos." });
            return;
        }
        // Para admin, ownerId é o próprio id. Para usuario, é o owner_id salvo.
        const ownerId = user.role === "admin" ? user.id : (user.owner_id || user.id);
        const token = (0, auth_1.gerarToken)({
            userId: user.id,
            email: user.email,
            role: user.role,
            ownerId,
        });
        res.json({
            sucesso: true,
            token,
            usuario: {
                id: user.id,
                email: user.email,
                nome: user.nome,
                role: user.role,
                ownerId,
            },
        });
    }
    catch (erro) {
        console.error("Erro no login:", erro);
        res.status(500).json({ erro: "Erro interno." });
    }
});
/**
 * GET /api/auth/me
 * Retorna dados do usuário autenticado.
 */
exports.authRouter.get("/auth/me", auth_1.autenticar, async (req, res) => {
    res.json({
        usuario: {
            userId: req.auth.userId,
            email: req.auth.email,
            role: req.auth.role,
            ownerId: req.auth.ownerId,
        },
    });
});
/**
 * GET /api/auth/usuarios
 * Admin lista todos os usuários que criou.
 */
exports.authRouter.get("/auth/usuarios", auth_1.autenticar, auth_1.apenasAdmin, async (req, res) => {
    try {
        const { data, error } = await supabaseClient_1.supabase
            .from("usuarios")
            .select("id, email, nome, role, ativo, criado_em")
            .or(`id.eq.${req.auth.userId},owner_id.eq.${req.auth.userId}`)
            .order("criado_em", { ascending: false });
        if (error) {
            console.error("Erro ao listar usuários:", error);
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
/**
 * POST /api/auth/usuarios
 * Admin cria um novo usuário vinculado a ele.
 */
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
            owner_id: req.auth.userId, // vinculado ao admin
        })
            .select("id, email, nome, role, criado_em")
            .single();
        if (error) {
            console.error("Erro ao criar usuário:", error);
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
//# sourceMappingURL=auth.js.map