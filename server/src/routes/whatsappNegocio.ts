import { Router, Request, Response } from "express";
import { supabase } from "../supabaseClient";
import { autenticar } from "../middleware/auth";
import { baileysManager } from "../utils/baileysManager";
import { sanitizarId } from "../utils/sanitizar";
import QRCode from "qrcode";

export const whatsappNegocioRouter = Router();

/**
 * POST /api/negocio/:id/whatsapp/conectar
 * Inicia conexão Baileys e retorna QR code como imagem base64.
 */
whatsappNegocioRouter.post(
  "/negocio/:id/whatsapp/conectar",
  autenticar,
  async (req: Request, res: Response) => {
    const negocioId = sanitizarId(req.params.id);
    if (!negocioId) { res.status(400).json({ erro: "negocioId inválido." }); return; }

    // Inicia conexão (não-bloqueante — QR gerado assincronamente)
    baileysManager.connect(negocioId).catch(console.error);

    // Aguarda até 8s para o QR aparecer
    let qrString: string | null = null;
    for (let i = 0; i < 16; i++) {
      await new Promise(r => setTimeout(r, 500));
      qrString = baileysManager.getQR(negocioId);
      if (qrString) break;
    }

    let qrImage: string | null = null;
    if (qrString) {
      qrImage = await QRCode.toDataURL(qrString);
    }

    res.json({
      status: baileysManager.getStatus(negocioId),
      qrcode: qrImage,
    });
  }
);

/**
 * GET /api/negocio/:id/whatsapp/status
 * Retorna status atual e QR code se ainda conectando.
 */
whatsappNegocioRouter.get(
  "/negocio/:id/whatsapp/status",
  autenticar,
  async (req: Request, res: Response) => {
    const negocioId = sanitizarId(req.params.id);
    if (!negocioId) { res.status(400).json({ erro: "negocioId inválido." }); return; }

    const status = baileysManager.getStatus(negocioId);
    let qrImage: string | null = null;

    if (status === "conectando") {
      const qrString = baileysManager.getQR(negocioId);
      if (qrString) {
        qrImage = await QRCode.toDataURL(qrString);
      }
    }

    res.json({ status, qrcode: qrImage });
  }
);

/**
 * DELETE /api/negocio/:id/whatsapp/desconectar
 */
whatsappNegocioRouter.delete(
  "/negocio/:id/whatsapp/desconectar",
  autenticar,
  async (req: Request, res: Response) => {
    const negocioId = sanitizarId(req.params.id);
    if (!negocioId) { res.status(400).json({ erro: "negocioId inválido." }); return; }

    await baileysManager.disconnect(negocioId);
    res.json({ sucesso: true });
  }
);

/**
 * POST /api/whatsapp/webhook — mantido para compatibilidade, não usado com Baileys
 */
whatsappNegocioRouter.post("/whatsapp/webhook", async (_req: Request, res: Response) => {
  res.status(200).json({ ok: true });
});
