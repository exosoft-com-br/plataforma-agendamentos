"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvolutionAPIProvider = void 0;
exports.criarProvedorWhatsApp = criarProvedorWhatsApp;
const axios_1 = __importDefault(require("axios"));
class EvolutionAPIProvider {
    constructor(apiUrl, apiToken, instanceName = "default") {
        this.apiUrl = apiUrl.replace(/\/$/, "");
        this.apiToken = apiToken;
        this.instanceName = instanceName;
    }
    parseWebhook(payload) {
        try {
            const data = payload;
            const eventData = data.data;
            if (!eventData)
                return null;
            const key = eventData.key;
            const message = eventData.message;
            if (!key || !message)
                return null;
            if (key.fromMe)
                return null;
            const remoteJid = key.remoteJid;
            const texto = message.conversation ||
                message.extendedTextMessage?.text ||
                "";
            if (!remoteJid || !texto)
                return null;
            const numero = remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
            return {
                de: numero,
                para: "",
                texto: texto.trim(),
                timestamp: eventData.messageTimestamp || Math.floor(Date.now() / 1000),
            };
        }
        catch {
            return null;
        }
    }
    async sendMessage(para, texto) {
        await axios_1.default.post(`${this.apiUrl}/message/sendText/${this.instanceName}`, { number: para, text: texto }, { headers: { "Content-Type": "application/json", apikey: this.apiToken } });
    }
}
exports.EvolutionAPIProvider = EvolutionAPIProvider;
function criarProvedorWhatsApp(provider, apiUrl, apiToken, instanceName = "default") {
    switch (provider.toLowerCase()) {
        case "evolution":
            return new EvolutionAPIProvider(apiUrl, apiToken, instanceName);
        default:
            throw new Error(`Provedor não suportado: ${provider}`);
    }
}
//# sourceMappingURL=whatsappAdapter.js.map