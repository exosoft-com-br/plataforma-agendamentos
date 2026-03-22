/**
 * disponibilidades.ts
 * Gerencia disponibilidade personalizada por data/prestador.
 *
 * Permite sobrescrever o horário semanal padrão do prestador para dias específicos.
 * Exemplos:
 *   - Terça-feira da semana que vem: só à tarde (13:00–18:00)
 *   - Quarta-feira: bloqueada (disponivel=false)
 *   - Sexta-feira feriado: dia livre
 */

import { Router, Request, Response } from "express";
import { supabase } from "../supabaseClient";
import { autenticar } from "../middleware/auth";
import { sanitizarId } from "../utils/sanitizar";

export const disponibilidadesRouter = Router();

// ============================================================
// GET /api/disponibilidades?prestadorId=X[&dias=60]
// Lista disponibilidades customizadas de um prestador (a partir de hoje).
// ============================================================
disponibilidadesRouter.get("/disponibilidades", autenticar, async (req: Request, res: Response) => {
  const prestadorId = sanitizarId((req.query.prestadorId as string) || "");
  if (!prestadorId) {
    res.status(400).json({ erro: "prestadorId obrigatório." });
    return;
  }

  const dias = Math.min(parseInt((req.query.dias as string) || "60", 10), 365);
  const hoje = new Date().toISOString().split("T")[0];
  const limite = new Date(Date.now() + dias * 86400000).toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("disponibilidades")
    .select("*")
    .eq("prestador_id", prestadorId)
    .gte("data", hoje)
    .lte("data", limite)
    .order("data", { ascending: true });

  if (error) {
    res.status(500).json({ erro: "Erro ao listar disponibilidades." });
    return;
  }

  res.json({ disponibilidades: data || [] });
});

// ============================================================
// POST /api/disponibilidades
// Cria ou atualiza (upsert) disponibilidade de um dia específico.
// Body: { prestadorId, data, disponivel, horarioInicio?, horarioFim?, observacao? }
// ============================================================
disponibilidadesRouter.post("/disponibilidades", autenticar, async (req: Request, res: Response) => {
  const prestadorId = sanitizarId(req.body.prestadorId || "");
  const data        = (req.body.data || "") as string;
  const disponivel  = req.body.disponivel !== false; // default true
  const horarioInicio = req.body.horarioInicio?.trim() || null;
  const horarioFim    = req.body.horarioFim?.trim()    || null;
  const observacao    = req.body.observacao             || null;

  if (!prestadorId || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    res.status(400).json({ erro: "prestadorId e data (YYYY-MM-DD) são obrigatórios." });
    return;
  }

  const horaRegex = /^\d{2}:\d{2}$/;
  if (horarioInicio && !horaRegex.test(horarioInicio)) {
    res.status(400).json({ erro: "horarioInicio deve ser HH:MM." });
    return;
  }
  if (horarioFim && !horaRegex.test(horarioFim)) {
    res.status(400).json({ erro: "horarioFim deve ser HH:MM." });
    return;
  }

  const { data: result, error } = await supabase
    .from("disponibilidades")
    .upsert(
      {
        prestador_id:   prestadorId,
        data,
        disponivel,
        horario_inicio: horarioInicio,
        horario_fim:    horarioFim,
        observacao,
      },
      { onConflict: "prestador_id,data" }
    )
    .select()
    .single();

  if (error) {
    console.error("[disponibilidades] Erro ao salvar:", error);
    res.status(500).json({ erro: "Erro ao salvar disponibilidade." });
    return;
  }

  res.json({ sucesso: true, disponibilidade: result });
});

// ============================================================
// DELETE /api/disponibilidades/:id
// Remove uma entrada (volta ao horário padrão do prestador).
// ============================================================
disponibilidadesRouter.delete("/disponibilidades/:id", autenticar, async (req: Request, res: Response) => {
  const { id } = req.params;

  const { error } = await supabase
    .from("disponibilidades")
    .delete()
    .eq("id", id);

  if (error) {
    res.status(500).json({ erro: "Erro ao remover disponibilidade." });
    return;
  }

  res.json({ sucesso: true });
});
