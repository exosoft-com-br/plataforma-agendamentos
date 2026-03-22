import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import * as fs from "fs";
import * as path from "path";
import { supabase } from "../supabaseClient";

type WStatus = "desconectado" | "conectando" | "conectado";

interface WInstance {
  socket: ReturnType<typeof makeWASocket> | null;
  qr: string | null;
  status: WStatus;
}

class BaileysManager {
  private instances = new Map<string, WInstance>();
  private readonly sessionsDir = "/tmp/wa-sessions";

  constructor() {
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  getStatus(negocioId: string): WStatus {
    return this.instances.get(negocioId)?.status ?? "desconectado";
  }

  getQR(negocioId: string): string | null {
    return this.instances.get(negocioId)?.qr ?? null;
  }

  async connect(negocioId: string): Promise<void> {
    const existing = this.instances.get(negocioId);
    if (existing?.status === "conectado") return;

    // Fecha socket existente
    try { existing?.socket?.end(undefined); } catch {}

    const sessionDir = path.join(this.sessionsDir, negocioId);
    fs.mkdirSync(sessionDir, { recursive: true });

    const instance: WInstance = { socket: null, qr: null, status: "conectando" };
    this.instances.set(negocioId, instance);
    await this.updateStatus(negocioId, "conectando");

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      browser: ["Agendei.io", "Chrome", "22.0"],
      connectTimeoutMs: 60_000,
      defaultQueryTimeoutMs: 60_000,
      keepAliveIntervalMs: 25_000,
    });

    instance.socket = socket;

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        instance.qr = qr;
        instance.status = "conectando";
      }

      if (connection === "close") {
        const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = code !== DisconnectReason.loggedOut;
        instance.status = "desconectado";
        instance.qr = null;
        instance.socket = null;
        await this.updateStatus(negocioId, "desconectado");
        if (shouldReconnect) {
          setTimeout(() => this.connect(negocioId).catch(console.error), 5_000);
        }
      }

      if (connection === "open") {
        instance.status = "conectado";
        instance.qr = null;
        await this.updateStatus(negocioId, "conectado");
        console.log(`[baileys] ✅ Negócio ${negocioId} conectado ao WhatsApp`);
      }
    });
  }

  async disconnect(negocioId: string): Promise<void> {
    const inst = this.instances.get(negocioId);
    if (inst?.socket) {
      try { await inst.socket.logout(); } catch {}
      try { inst.socket.end(undefined); } catch {}
    }
    this.instances.delete(negocioId);
    const sessionDir = path.join(this.sessionsDir, negocioId);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
    await this.updateStatus(negocioId, "desconectado");
  }

  async sendText(negocioId: string, phone: string, text: string): Promise<void> {
    const inst = this.instances.get(negocioId);
    if (!inst?.socket || inst.status !== "conectado") {
      throw new Error("WhatsApp não conectado");
    }
    const digits = phone.replace(/\D/g, "");
    const number = digits.startsWith("55") ? digits : `55${digits}`;
    const jid = `${number}@s.whatsapp.net`;
    await inst.socket.sendMessage(jid, { text });
  }

  private async updateStatus(negocioId: string, status: string): Promise<void> {
    try {
      await supabase.from("negocios").update({ whatsapp_status: status }).eq("id", negocioId);
    } catch (e) {
      console.error("[baileys] Erro ao atualizar status:", e);
    }
  }
}

export const baileysManager = new BaileysManager();
