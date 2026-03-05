"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
// Carregar variáveis de ambiente ANTES de qualquer import que use process.env
dotenv_1.default.config();
const availability_1 = require("./routes/availability");
const booking_1 = require("./routes/booking");
const nichoConfig_1 = require("./routes/nichoConfig");
const webhook_1 = require("./routes/webhook");
const profile_1 = require("./routes/profile");
const negocio_1 = require("./routes/negocio");
const calendario_1 = require("./routes/calendario");
const auth_1 = require("./routes/auth");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// ============================================================
// SEGURANÇA: Helmet — headers HTTP de proteção
// ============================================================
app.use((0, helmet_1.default)());
// ============================================================
// SEGURANÇA: CORS — restringir origens permitidas
// ============================================================
const allowedOrigins = [
    "https://exosoft-com-br.github.io", // GitHub Pages (produção)
    "http://localhost:3000", // Dev local
    "http://localhost:5500", // Live Server (VS Code)
    "http://127.0.0.1:5500",
    "http://localhost:8080",
];
// Adicionar origens extras via env (ALLOWED_ORIGINS=url1,url2)
if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(",").forEach((o) => allowedOrigins.push(o.trim()));
}
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Permitir requests sem origin (ex: curl, Postman, webhooks)
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.includes(origin))
            return callback(null, true);
        console.warn(`⚠️  CORS bloqueado: ${origin}`);
        callback(new Error("Não permitido por CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400, // Cache preflight por 24h
}));
// ============================================================
// SEGURANÇA: Rate Limiting — proteção contra abuso/DDoS
// ============================================================
// Limiter geral: 500 requests por IP a cada 15 min
const generalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: "Muitas requisições. Tente novamente em alguns minutos." },
});
// Limiter para booking: 10 agendamentos por IP a cada 15 min
const bookingLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: "Limite de agendamentos atingido. Tente novamente em alguns minutos." },
});
// Limiter para webhook: 200 requests por IP a cada 1 min
const webhookLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: "Rate limit excedido." },
});
// Limiter para auth: 30 tentativas por IP a cada 5 min
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 5 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: "Muitas tentativas de login. Tente em 5 minutos." },
});
// Trust proxy (Render/CloudFlare) para identificar IP real de cada usuário
app.set('trust proxy', 1);
app.use(generalLimiter);
// ============================================================
// SEGURANÇA: Body parser com limite de tamanho
// ============================================================
app.use(express_1.default.json({ limit: "10kb" }));
// ============================================================
// SEGURANÇA: Desabilitar header X-Powered-By
// ============================================================
app.disable("x-powered-by");
// ============================================================
// Rotas com limiters específicos
// ============================================================
app.use("/api/booking", bookingLimiter);
app.use("/api/whatsapp", webhookLimiter);
app.use("/api/auth", authLimiter);
app.use("/api", auth_1.authRouter);
app.use("/api", availability_1.availabilityRouter);
app.use("/api", booking_1.bookingRouter);
app.use("/api", nichoConfig_1.nichoConfigRouter);
app.use("/api", webhook_1.webhookRouter);
app.use("/api", profile_1.profileRouter);
app.use("/api", negocio_1.negocioRouter);
app.use("/api", calendario_1.calendarioRouter);
// Health check
app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});
// Rota raiz (sem expor detalhes internos em produção)
app.get("/", (_req, res) => {
    res.json({
        nome: "Plataforma de Agendamentos",
        versao: "2.0.0",
        status: "online",
    });
});
// ============================================================
// SEGURANÇA: Tratar rotas não encontradas
// ============================================================
app.use((_req, res) => {
    res.status(404).json({ erro: "Endpoint não encontrado." });
});
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`🔒 CORS restrito a: ${allowedOrigins.join(", ")}`);
});
exports.default = app;
//# sourceMappingURL=index.js.map