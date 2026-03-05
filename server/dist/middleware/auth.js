"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gerarToken = gerarToken;
exports.autenticar = autenticar;
exports.apenasAdmin = apenasAdmin;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || "plataforma-agendamentos-secret-key-2024";
/**
 * Gera um JWT com payload do usuário.
 */
function gerarToken(payload) {
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: "24h" });
}
/**
 * Middleware: exige autenticação (qualquer role).
 */
function autenticar(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        res.status(401).json({ erro: "Token não fornecido." });
        return;
    }
    try {
        const token = header.split(" ")[1];
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.auth = decoded;
        next();
    }
    catch {
        res.status(401).json({ erro: "Token inválido ou expirado." });
    }
}
/**
 * Middleware: exige role admin.
 */
function apenasAdmin(req, res, next) {
    if (!req.auth) {
        res.status(401).json({ erro: "Não autenticado." });
        return;
    }
    if (req.auth.role !== "admin") {
        res.status(403).json({ erro: "Acesso restrito a administradores." });
        return;
    }
    next();
}
//# sourceMappingURL=auth.js.map