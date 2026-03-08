import { Router, Request, Response } from "express";
import { getGoogleOAuth2Client, getGoogleCalendarEvents } from "../utils/googleCalendar";

export const googleRouter = Router();

// Configurações do Google OAuth2
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/google/oauth2/callback";

// 1. Iniciar OAuth2
// GET /api/google/oauth2/init
// Redireciona para o consentimento do Google
googleRouter.get("/oauth2/init", (req: Request, res: Response) => {
  const oAuth2Client = getGoogleOAuth2Client({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, redirectUri: REDIRECT_URI });
  const scopes = [
    "https://www.googleapis.com/auth/calendar.readonly"
  ];
  const url = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent"
  });
  res.redirect(url);
});

// 2. Callback OAuth2
// GET /api/google/oauth2/callback
// Recebe o código, troca por tokens e retorna ao frontend
// (Ajuste para salvar tokens conforme sua estratégia de autenticação)
googleRouter.get("/oauth2/callback", async (req: Request, res: Response) => {
  const code = req.query.code as string;
  if (!code) return res.status(400).send("Código não informado");
  const oAuth2Client = getGoogleOAuth2Client({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, redirectUri: REDIRECT_URI });
  try {
    const { tokens } = await oAuth2Client.getToken(code);
    // Aqui você pode salvar tokens no banco, associar ao usuário, etc.
    // Para demo, retorna o access_token no localStorage via script
    res.send(`<script>localStorage.setItem('googleAccessToken', '${tokens.access_token}');window.close();window.opener.location.reload();</script>`);
  } catch (e) {
    res.status(500).send("Erro ao obter token do Google");
  }
});

// 3. Buscar eventos do Google Calendar
// GET /api/google/calendar/events
// Requer Authorization: Bearer <access_token>
googleRouter.get("/calendar/events", async (req: Request, res: Response) => {
  const auth = req.headers.authorization || "";
  const accessToken = auth.replace("Bearer ", "");
  if (!accessToken) return res.status(401).json({ erro: "Token não informado" });
  try {
    const items = await getGoogleCalendarEvents({
      accessToken,
      refreshToken: "", // Para demo, não faz refresh
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      timeMin: new Date().toISOString(),
      timeMax: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Próximos 7 dias
    });
    res.json({ items });
  } catch (e) {
    res.status(500).json({ erro: "Erro ao buscar eventos do Google Calendar" });
  }
});
