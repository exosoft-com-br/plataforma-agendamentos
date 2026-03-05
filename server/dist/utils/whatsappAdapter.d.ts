export interface WhatsAppMessage {
    de: string;
    para: string;
    texto: string;
    timestamp: number;
}
export interface WhatsAppProvider {
    parseWebhook(payload: unknown): WhatsAppMessage | null;
    sendMessage(para: string, texto: string): Promise<void>;
}
export declare class EvolutionAPIProvider implements WhatsAppProvider {
    private apiUrl;
    private apiToken;
    private instanceName;
    constructor(apiUrl: string, apiToken: string, instanceName?: string);
    parseWebhook(payload: unknown): WhatsAppMessage | null;
    sendMessage(para: string, texto: string): Promise<void>;
}
export declare function criarProvedorWhatsApp(provider: string, apiUrl: string, apiToken: string, instanceName?: string): WhatsAppProvider;
//# sourceMappingURL=whatsappAdapter.d.ts.map