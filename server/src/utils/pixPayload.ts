/**
 * pixPayload.ts
 * Gera o payload PIX (formato EMV/QR Code) do BACEN.
 *
 * Funciona com qualquer banco brasileiro — sem API, sem certificado, sem OAuth.
 * Basta ter a chave PIX, nome do recebedor e cidade.
 *
 * Spec: https://www.bcb.gov.br/content/estabilidadefinanceira/forumpayments/
 *       RequisitosQRCodeMockup.pdf
 */

import QRCode from "qrcode";

/** CRC-16/CCITT-FALSE (polinômio 0x1021) */
function crc16(str: string): string {
  let crc = 0xffff;
  for (const char of str) {
    crc ^= char.charCodeAt(0) << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Monta um campo TLV (ID + tamanho + valor) */
function tlv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

/** Normaliza string removendo acentos e caracteres especiais */
function normalizar(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim();
}

export interface PixPayloadParams {
  chavePix: string;          // Chave PIX do recebedor
  nomeMerchant: string;      // Nome do recebedor (max 25 chars)
  cidadeMerchant: string;    // Cidade (max 15 chars)
  valor?: number;            // Valor em reais (omitir para "qualquer valor")
  txid?: string;             // ID único da transação (max 25 chars, alphanum)
  descricao?: string;        // Descrição (ex: "Taxa de agendamento")
}

/**
 * Gera a string PIX Copia e Cola (payload EMV).
 * Compatível com todos os apps de banco brasileiros.
 */
export function gerarPixCopiaECola(params: PixPayloadParams): string {
  const nome    = normalizar(params.nomeMerchant).slice(0, 25).toUpperCase();
  const cidade  = normalizar(params.cidadeMerchant).slice(0, 15).toUpperCase();
  const txid    = (params.txid || "***").replace(/[^a-zA-Z0-9]/g, "").slice(0, 25) || "***";
  const descricao = params.descricao
    ? normalizar(params.descricao).slice(0, 72)
    : "";

  // Merchant Account Information (campo 26)
  const guiPix     = tlv("00", "br.gov.bcb.pix");
  const chaveTlv   = tlv("01", params.chavePix);
  const descTlv    = descricao ? tlv("02", descricao) : "";
  const merchantAccount = tlv("26", `${guiPix}${chaveTlv}${descTlv}`);

  // Additional Data (campo 62): txid como referência
  const additionalData = tlv("62", tlv("05", txid));

  let payload =
    tlv("00", "01") +           // Payload Format Indicator
    tlv("01", "12") +           // Point of Initiation: 12 = single use (dinâmico)
    merchantAccount +
    tlv("52", "0000") +         // Merchant Category Code
    tlv("53", "986") +          // Currency: 986 = BRL
    (params.valor != null ? tlv("54", params.valor.toFixed(2)) : "") +
    tlv("58", "BR") +           // Country
    tlv("59", nome) +           // Merchant name
    tlv("60", cidade) +         // City
    additionalData +
    "6304";                     // CRC placeholder

  return payload + crc16(payload);
}

/**
 * Gera imagem base64 do QR Code a partir do payload PIX.
 */
export async function gerarQrCodeBase64(payload: string): Promise<string> {
  return await QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 300,
    color: { dark: "#000000", light: "#ffffff" },
  });
}
