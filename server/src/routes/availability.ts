import { Router, Request, Response } from "express";
import { supabase } from "../supabaseClient";
import { gerarSlotsDoDia, Slot } from "../utils/validarHorario";
import { sanitizarId } from "../utils/sanitizar";

export const availabilityRouter = Router();

/**
 * GET /api/availability?prestadorId=...&servicoId=...&data=YYYY-MM-DD
 *
 * Retorna horários disponíveis para um prestador/serviço em uma data.
 */
availabilityRouter.get("/availability", async (req: Request, res: Response) => {
  try {
    const prestadorId = sanitizarId((req.query.prestadorId as string) || "");
    const servicoId = sanitizarId((req.query.servicoId as string) || "");
    const data = req.query.data;

    if (!prestadorId || !servicoId) {
      res.status(400).json({ erro: "Parâmetros obrigatórios: prestadorId e servicoId" });
      return;
    }

    const dataConsulta =
      (data as string) || new Date().toISOString().split("T")[0];

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataConsulta)) {
      res.status(400).json({ erro: "Formato de data inválido. Use YYYY-MM-DD." });
      return;
    }

    // 1. Buscar prestador
    const { data: p, error: pErr } = await supabase
      .from("prestadores")
      .select("*")
      .eq("id", prestadorId)
      .single();

    if (pErr || !p) {
      res.status(404).json({ erro: "Prestador não encontrado." });
      return;
    }

    if (!p.ativo) {
      res.status(400).json({ erro: "Prestador não está ativo no momento." });
      return;
    }

    // Mapear para formato esperado pelo utilitário
    const prestador = {
      id: p.id,
      nichoId: p.nicho_id,
      nome: p.nome,
      categoria: p.categoria,
      ativo: p.ativo,
      horarioAtendimento: {
        inicio: p.horario_inicio,
        fim: p.horario_fim,
        diasSemana: p.dias_semana,
      },
    };

    // 2. Buscar serviço
    const { data: s, error: sErr } = await supabase
      .from("servicos")
      .select("*")
      .eq("id", servicoId)
      .single();

    if (sErr || !s) {
      res.status(404).json({ erro: "Serviço não encontrado." });
      return;
    }

    if (!s.ativo) {
      res.status(400).json({ erro: "Serviço não está disponível no momento." });
      return;
    }

    // 3. Verificar disponibilidade personalizada para esta data
    const { data: disp } = await supabase
      .from("disponibilidades")
      .select("*")
      .eq("prestador_id", prestadorId)
      .eq("data", dataConsulta)
      .maybeSingle();

    if (disp) {
      if (!disp.disponivel) {
        res.json({ slots: [], mensagem: "Prestador não atende nesta data." });
        return;
      }
      // Sobrescreve horário com o personalizado do dia
      if (disp.horario_inicio) prestador.horarioAtendimento.inicio = disp.horario_inicio;
      if (disp.horario_fim)    prestador.horarioAtendimento.fim    = disp.horario_fim;
      // Garante que o dia da semana está incluído (pode não estar em dias_semana padrão)
      const diaSemana = new Date(`${dataConsulta}T12:00:00Z`).getUTCDay();
      if (!prestador.horarioAtendimento.diasSemana.includes(diaSemana)) {
        prestador.horarioAtendimento.diasSemana = [...prestador.horarioAtendimento.diasSemana, diaSemana];
      }
    }

    // 4. Gerar slots do dia
    const todosSlots = gerarSlotsDoDia(dataConsulta, prestador, s.duracao_minutos);

    if (todosSlots.length === 0) {
      res.json({ slots: [], mensagem: "Não há horários disponíveis para esta data." });
      return;
    }

    // 5. Buscar agendamentos confirmados do dia (horário de Brasília UTC-3)
    const inicioDoDia = `${dataConsulta}T00:00:00-03:00`;
    const fimDoDia = `${dataConsulta}T23:59:59-03:00`;

    const { data: agendamentos } = await supabase
      .from("agendamentos")
      .select("data_hora")
      .eq("prestador_id", prestadorId)
      .eq("status", "confirmado")
      .gte("data_hora", inicioDoDia)
      .lte("data_hora", fimDoDia);

    const horariosOcupados = (agendamentos || []).map((a: any) => a.data_hora);

    // 6. Marcar slots ocupados
    const slotsComDisponibilidade: Slot[] = todosSlots.map((slot) => {
      const slotInicio = new Date(slot.inicio).getTime();
      const slotFim = new Date(slot.fim).getTime();

      const ocupado = horariosOcupados.some((horario: string) => {
        const horarioMs = new Date(horario).getTime();
        return horarioMs >= slotInicio && horarioMs < slotFim;
      });

      return { ...slot, disponivel: !ocupado };
    });

    res.json({ slots: slotsComDisponibilidade });
  } catch (erro) {
    console.error("Erro ao buscar horários disponíveis:", erro);
    res.status(500).json({ erro: "Erro interno ao buscar horários disponíveis." });
  }
});
