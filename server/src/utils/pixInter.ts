/**
 * pixInter.ts
 * Cliente para a API PIX do Banco Inter (v2).
 *
 * Autenticação: OAuth 2.0 com mTLS (certificado X.509 por negócio).
 * Docs: https://developers.inter.co/references/cobrancas
 */

import axios from "axios";
import https from "https";

export interface InterCredentials {
  clientId: string;
  clientSecret: string;
  chavePix: string;       // chave PIX do recebedor (CPF/CNPJ/email/telefone/aleatória)
  certPem: string;        // conteúdo PEM do certificado
  keyPem: string;         // conteúdo PEM da chave privada
  sandbox?: boolean;      // true = ambiente de homologação
}

export interface PixCobranca {
  txid: string;
  qr: string;        // copia-e-cola (PIX payload)
  qrImagem: string;  // base64 PNG do QR code
  expiraEm: string;  // ISO datetime
  locId: number;     // id da location (para polling de QR atualizado)
}

const BASE_PROD    = "https://cdpj.partners.bancointer.com.br";
const BASE_SANDBOX = "https://cdpj.partners.uatinter.co";

/** Monta httpsAgent com mTLS do negócio */
function buildAgent(creds: InterCredentials): https.Agent {
  return new https.Agent({
    cert: creds.certPem,
    key:  creds.keyPem,
    rejectUnauthorized: !creds.sandbox,
  });
}

/** Obtém token OAuth 2.0 do Inter */
async function getToken(creds: InterCredentials): Promise<string> {
  const base  = creds.sandbox ? BASE_SANDBOX : BASE_PROD;
  const agent = buildAgent(creds);
  const auth  = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64");

  const { data } = await axios.post(
    `${base}/oauth/v2/token`,
    "grant_type=client_credentials&scope=cob.write%20cob.read",
    {
      httpsAgent: agent,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${auth}`,
      },
    }
  );
  return data.access_token as string;
}

/**
 * Cria uma cobrança PIX imediata.
 * Retorna txid, QR copia-e-cola e imagem base64.
 */
export async function criarCobrancaPix(
  creds: InterCredentials,
  valorReais: number,
  descricao: string
): Promise<PixCobranca> {
  const base  = creds.sandbox ? BASE_SANDBOX : BASE_PROD;
  const agent = buildAgent(creds);
  const token = await getToken(creds);

  // 1. Criar cobrança (cob imediata)
  const cobBody = {
    calendario: { expiracao: 1800 }, // 30 minutos
    valor: { original: valorReais.toFixed(2) },
    chave: creds.chavePix,
    solicitacaoPagador: descricao.slice(0, 140),
  };

  const { data: cob } = await axios.post(
    `${base}/pix/v2/cob`,
    cobBody,
    {
      httpsAgent: agent,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  const txid  = cob.txid as string;
  const locId = cob.loc?.id as number;
  const expira = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  // 2. Buscar QR code (copia-e-cola + imagem)
  const { data: qrData } = await axios.get(
    `${base}/pix/v2/loc/${locId}/qrcode`,
    {
      httpsAgent: agent,
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const qr       = qrData.qrcode as string;                        // copia-e-cola
  const qrImagem = qrData.imagemQrcode as string;                  // base64 PNG

  return { txid, qr, qrImagem, expiraEm: expira, locId };
}

/**
 * Verifica se uma cobrança foi paga.
 * Status Inter: ATIVA | CONCLUIDA | REMOVIDA_PELO_USUÁRIO_RECEBEDOR | REMOVIDA_PELO_PSP
 */
export async function verificarPagamentoPix(
  creds: InterCredentials,
  txid: string
): Promise<{ pago: boolean; status: string }> {
  const base  = creds.sandbox ? BASE_SANDBOX : BASE_PROD;
  const agent = buildAgent(creds);
  const token = await getToken(creds);

  const { data } = await axios.get(
    `${base}/pix/v2/cob/${txid}`,
    {
      httpsAgent: agent,
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const status = data.status as string;
  return { pago: status === "CONCLUIDA", status };
}
