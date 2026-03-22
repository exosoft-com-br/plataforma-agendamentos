import { Router, Request, Response } from "express";
import { supabase } from "../supabaseClient";
import { sanitizar, sanitizarId } from "../utils/sanitizar";
import { autenticar } from "../middleware/auth";

/** Retorna os IDs de negócios pertencentes ao usuário autenticado. */
async function negociosDoUsuario(userId: string): Promise<string[]> {
  const { data } = await supabase.from("negocios").select("id").eq("owner_id", userId);
  return (data || []).map((n: any) => n.id);
}

export const servicoRouter = Router();

// ============================================================
// PRESTADORES — CRUD
// ============================================================

/**
 * GET /api/prestadores?nichoId=xxx
 * Lista prestadores de um nicho.
 */
servicoRouter.get("/prestadores", async (req: Request, res: Response) => {
  try {
    const nichoId = sanitizarId((req.query.nichoId as string) || "");
    const negocioId = sanitizarId((req.query.negocioId as string) || "");

    let query = supabase.from("prestadores").select("*");

    if (negocioId) {
      query = query.eq("negocio_id", negocioId);
    } else if (nichoId) {
      query = query.eq("nicho_id", nichoId);
    } else {
      res.status(400).json({ erro: "Parâmetro obrigatório: negocioId ou nichoId" });
      return;
    }

    const { data, error } = await query.order("criado_em", { ascending: false });

    if (error) {
      console.error("Erro ao listar prestadores:", error);
      res.status(500).json({ erro: "Erro ao listar prestadores." });
      return;
    }

    const prestadores = (data || []).map((p: any) => ({
      id: p.id,
      nichoId: p.nicho_id,
      negocioId: p.negocio_id,
      nome: p.nome,
      categoria: p.categoria,
      horarioInicio: p.horario_inicio,
      horarioFim: p.horario_fim,
      diasSemana: p.dias_semana,
      whatsappNumero: p.whatsapp_numero,
      ativo: p.ativo,
      criadoEm: p.criado_em,
    }));

    res.json({ prestadores });
  } catch (erro) {
    console.error("Erro ao listar prestadores:", erro);
    res.status(500).json({ erro: "Erro interno." });
  }
});

/**
 * POST /api/prestadores
 * Cria um novo prestador.
 */
servicoRouter.post("/prestadores", autenticar, async (req: Request, res: Response) => {
  try {
    let nichoId   = sanitizarId(req.body.nichoId);
    const negocioId = req.body.negocioId ? sanitizarId(req.body.negocioId) : null;
    const nome = sanitizar(req.body.nome || "");
    const categoria = sanitizar(req.body.categoria || "");
    const horarioInicio = (req.body.horarioInicio || "08:00").trim();
    const horarioFim = (req.body.horarioFim || "18:00").trim();
    const diasSemana = req.body.diasSemana || [1, 2, 3, 4, 5];
    const whatsappNumero = (req.body.whatsappNumero || "").replace(/\D/g, "") || null;
    const id = sanitizarId(req.body.id) || `prest-${Date.now()}`;

    if (!nome) { res.status(400).json({ erro: "Nome é obrigatório." }); return; }

    // Verifica ownership do negócio
    if (negocioId) {
      const ids = await negociosDoUsuario(req.auth!.userId);
      if (!ids.includes(negocioId)) {
        res.status(403).json({ erro: "Sem permissão para este negócio." }); return;
      }
      // Deriva nichoId do negócio se não informado
      if (!nichoId) {
        const { data: neg } = await supabase.from("negocios").select("nicho_id").eq("id", negocioId).single();
        nichoId = neg?.nicho_id || "";
      }
    }

    if (!nichoId) { res.status(400).json({ erro: "nichoId ou negocioId são obrigatórios." }); return; }

    // Validar formato de horário
    const horaRegex = /^\d{2}:\d{2}$/;
    if (!horaRegex.test(horarioInicio) || !horaRegex.test(horarioFim)) {
      res.status(400).json({ erro: "Horários devem estar no formato HH:MM" });
      return;
    }

    const { data, error } = await supabase
      .from("prestadores")
      .insert({
        id,
        nicho_id: nichoId,
        negocio_id: negocioId,
        nome,
        categoria,
        horario_inicio: horarioInicio,
        horario_fim: horarioFim,
        dias_semana: diasSemana,
        whatsapp_numero: whatsappNumero,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        res.status(409).json({ erro: "Já existe um prestador com este ID." });
        return;
      }
      console.error("Erro ao criar prestador:", error);
      res.status(500).json({ erro: "Erro ao criar prestador." });
      return;
    }

    res.status(201).json({
      sucesso: true,
      prestador: {
        id: data.id,
        nichoId: data.nicho_id,
        negocioId: data.negocio_id,
        nome: data.nome,
        categoria: data.categoria,
        horarioInicio: data.horario_inicio,
        horarioFim: data.horario_fim,
        diasSemana: data.dias_semana,
        whatsappNumero: data.whatsapp_numero,
        ativo: data.ativo,
        slug: data.slug,
      },
    });
  } catch (erro) {
    console.error("Erro ao criar prestador:", erro);
    res.status(500).json({ erro: "Erro interno." });
  }
});

/**
 * PUT /api/prestadores/:prestadorId
 * Atualiza um prestador.
 */
servicoRouter.put("/prestadores/:prestadorId", autenticar, async (req: Request, res: Response) => {
  try {
    const prestadorId = sanitizarId(req.params.prestadorId);
    if (!prestadorId) { res.status(400).json({ erro: "prestadorId inválido." }); return; }

    // Verifica ownership
    const ids = await negociosDoUsuario(req.auth!.userId);
    if (ids.length) {
      const { data: prest } = await supabase.from("prestadores").select("negocio_id").eq("id", prestadorId).single();
      if (prest?.negocio_id && !ids.includes(prest.negocio_id)) {
        res.status(403).json({ erro: "Sem permissão para editar este prestador." }); return;
      }
    }

    const updates: Record<string, any> = {};

    if (req.body.nome !== undefined) updates.nome = sanitizar(req.body.nome);
    if (req.body.categoria !== undefined) updates.categoria = sanitizar(req.body.categoria);
    if (req.body.horarioInicio !== undefined) updates.horario_inicio = req.body.horarioInicio.trim();
    if (req.body.horarioFim !== undefined) updates.horario_fim = req.body.horarioFim.trim();
    if (req.body.diasSemana !== undefined) updates.dias_semana = req.body.diasSemana;
    if (req.body.whatsappNumero !== undefined) {
      updates.whatsapp_numero = (req.body.whatsappNumero || "").replace(/\D/g, "") || null;
    }
    if (req.body.ativo !== undefined) updates.ativo = Boolean(req.body.ativo);
    if (req.body.negocioId) updates.negocio_id = sanitizarId(req.body.negocioId);

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ erro: "Nenhum campo para atualizar." });
      return;
    }

    const { data, error } = await supabase
      .from("prestadores")
      .update(updates)
      .eq("id", prestadorId)
      .select()
      .single();

    if (error) {
      console.error("Erro ao atualizar prestador:", error);
      res.status(500).json({ erro: "Erro ao atualizar prestador." });
      return;
    }

    res.json({ sucesso: true, prestador: data });
  } catch (erro) {
    console.error("Erro ao atualizar prestador:", erro);
    res.status(500).json({ erro: "Erro interno." });
  }
});

/**
 * DELETE /api/prestadores/:prestadorId
 * Exclui um prestador (cascata: serviços vinculados).
 */
servicoRouter.delete("/prestadores/:prestadorId", autenticar, async (req: Request, res: Response) => {
  try {
    const prestadorId = sanitizarId(req.params.prestadorId);
    if (!prestadorId) { res.status(400).json({ erro: "prestadorId inválido." }); return; }

    // Verifica ownership
    const ids = await negociosDoUsuario(req.auth!.userId);
    if (ids.length) {
      const { data: prest } = await supabase.from("prestadores").select("negocio_id").eq("id", prestadorId).single();
      if (prest?.negocio_id && !ids.includes(prest.negocio_id)) {
        res.status(403).json({ erro: "Sem permissão para excluir este prestador." }); return;
      }
    }

    // Excluir agendamentos vinculados ao prestador
    await supabase.from("agendamentos").delete().eq("prestador_id", prestadorId);

    // Excluir serviços vinculados (e seus agendamentos)
    const { data: servicosVinculados } = await supabase
      .from("servicos")
      .select("id")
      .eq("prestador_id", prestadorId);

    for (const s of servicosVinculados || []) {
      await supabase.from("agendamentos").delete().eq("servico_id", s.id);
    }

    await supabase.from("servicos").delete().eq("prestador_id", prestadorId);

    const { error } = await supabase
      .from("prestadores")
      .delete()
      .eq("id", prestadorId);

    if (error) {
      console.error("Erro ao excluir prestador:", error);
      res.status(500).json({ erro: "Erro ao excluir prestador." });
      return;
    }

    res.json({ sucesso: true, mensagem: "Prestador excluído com sucesso." });
  } catch (erro) {
    console.error("Erro ao excluir prestador:", erro);
    res.status(500).json({ erro: "Erro interno." });
  }
});

// ============================================================
// SERVIÇOS — CRUD
// ============================================================

/**
 * GET /api/servicos?nichoId=xxx
 * Lista serviços de um nicho.
 */
servicoRouter.get("/servicos", async (req: Request, res: Response) => {
  try {
    const idsParam    = req.query.ids as string;
    const nichoId     = sanitizarId((req.query.nichoId   as string) || "");
    const negocioId   = sanitizarId((req.query.negocioId as string) || "");
    const prestadorId = sanitizarId((req.query.prestadorId as string) || "");
    let query = supabase.from("servicos").select("*, prestadores(nome)");
    if (idsParam) {
      const ids = idsParam.split(',').map((id) => id.trim()).filter(Boolean);
      if (ids.length === 0) { res.status(400).json({ erro: "Parâmetro ids inválido." }); return; }
      query = query.in('id', ids);
    } else if (prestadorId) {
      query = query.eq("prestador_id", prestadorId);
    } else if (negocioId) {
      // Busca prestador IDs do negócio e filtra serviços
      const { data: prests } = await supabase.from("prestadores").select("id").eq("negocio_id", negocioId);
      const pids = (prests || []).map((p: any) => p.id);
      if (!pids.length) { res.json({ servicos: [] }); return; }
      query = query.in("prestador_id", pids);
    } else if (nichoId) {
      query = query.eq("nicho_id", nichoId);
    } else {
      res.status(400).json({ erro: "Parâmetro obrigatório: negocioId, nichoId, prestadorId ou ids" });
      return;
    }
    query = query.order("criado_em", { ascending: false });

    const { data, error } = await query;
    if (error) {
      console.error("Erro ao listar serviços:", error);
      res.status(500).json({ erro: "Erro ao listar serviços." });
      return;
    }
    const servicos = (data || []).map((s: any) => ({
      id: s.id,
      nichoId: s.nicho_id,
      prestadorId: s.prestador_id,
      prestadorNome: s.prestadores?.nome || "",
      nome: s.nome,
      duracaoMinutos: s.duracao_minutos,
      preco: s.preco ? Number(s.preco) : null,
      ativo: s.ativo,
      criadoEm: s.criado_em,
    }));
    res.json({ servicos });
  } catch (erro) {
    console.error("Erro ao listar serviços:", erro);
    res.status(500).json({ erro: "Erro interno." });
  }
});

/**
 * POST /api/servicos
 * Cria um novo serviço.
 */
servicoRouter.post("/servicos", autenticar, async (req: Request, res: Response) => {
  try {
    let nichoId = sanitizarId(req.body.nichoId);
    const prestadorId = sanitizarId(req.body.prestadorId);
    const id = sanitizarId(req.body.id) || `srv-${Date.now()}`;
    const nome = sanitizar(req.body.nome || "");
    const duracaoMinutos = parseInt(req.body.duracaoMinutos) || 30;
    const preco = req.body.preco ? parseFloat(req.body.preco) : null;

    if (!prestadorId || !nome) {
      res.status(400).json({ erro: "Campos obrigatórios: prestadorId, nome" });
      return;
    }

    if (duracaoMinutos < 5 || duracaoMinutos > 480) {
      res.status(400).json({ erro: "Duração deve ser entre 5 e 480 minutos." });
      return;
    }

    // Verificar se o prestador existe + derivar nichoId + verificar ownership
    const { data: prest } = await supabase
      .from("prestadores")
      .select("id, nicho_id, negocio_id")
      .eq("id", prestadorId)
      .single();

    if (!prest) { res.status(404).json({ erro: "Prestador não encontrado." }); return; }

    if (!nichoId) nichoId = prest.nicho_id || "";

    // Ownership: verifica se o prestador pertence a um negócio do usuário
    const ids = await negociosDoUsuario(req.auth!.userId);
    if (ids.length && prest.negocio_id && !ids.includes(prest.negocio_id)) {
      res.status(403).json({ erro: "Sem permissão para este prestador." }); return;
    }

    const { data, error } = await supabase
      .from("servicos")
      .insert({
        id,
        nicho_id: nichoId,
        prestador_id: prestadorId,
        nome,
        duracao_minutos: duracaoMinutos,
        preco,
      })
      .select("*, prestadores(nome)")
      .single();

    if (error) {
      if (error.code === "23505") {
        res.status(409).json({ erro: "Já existe um serviço com este ID." });
        return;
      }
      console.error("Erro ao criar serviço:", error);
      res.status(500).json({ erro: "Erro ao criar serviço." });
      return;
    }

    res.status(201).json({
      sucesso: true,
      servico: {
        id: data.id,
        nichoId: data.nicho_id,
        prestadorId: data.prestador_id,
        prestadorNome: data.prestadores?.nome || "",
        nome: data.nome,
        duracaoMinutos: data.duracao_minutos,
        preco: data.preco ? Number(data.preco) : null,
        ativo: data.ativo,
      },
    });
  } catch (erro) {
    console.error("Erro ao criar serviço:", erro);
    res.status(500).json({ erro: "Erro interno." });
  }
});

/**
 * PUT /api/servicos/:servicoId
 * Atualiza um serviço.
 */
servicoRouter.put("/servicos/:servicoId", autenticar, async (req: Request, res: Response) => {
  try {
    const servicoId = sanitizarId(req.params.servicoId);
    if (!servicoId) { res.status(400).json({ erro: "servicoId inválido." }); return; }

    // Ownership via prestador do serviço
    const ids = await negociosDoUsuario(req.auth!.userId);
    if (ids.length) {
      const { data: svc } = await supabase.from("servicos").select("prestadores(negocio_id)").eq("id", servicoId).single();
      const negId = (svc?.prestadores as any)?.negocio_id;
      if (negId && !ids.includes(negId)) {
        res.status(403).json({ erro: "Sem permissão para editar este serviço." }); return;
      }
    }

    const updates: Record<string, any> = {};

    if (req.body.nome !== undefined) updates.nome = sanitizar(req.body.nome);
    if (req.body.duracaoMinutos !== undefined) {
      const dur = parseInt(req.body.duracaoMinutos);
      if (dur < 5 || dur > 480) {
        res.status(400).json({ erro: "Duração deve ser entre 5 e 480 minutos." });
        return;
      }
      updates.duracao_minutos = dur;
    }
    if (req.body.preco !== undefined) {
      updates.preco = req.body.preco ? parseFloat(req.body.preco) : null;
    }
    if (req.body.prestadorId !== undefined) {
      const pid = sanitizarId(req.body.prestadorId);
      if (pid) updates.prestador_id = pid;
    }
    if (req.body.ativo !== undefined) updates.ativo = Boolean(req.body.ativo);

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ erro: "Nenhum campo para atualizar." });
      return;
    }

    const { data, error } = await supabase
      .from("servicos")
      .update(updates)
      .eq("id", servicoId)
      .select()
      .single();

    if (error) {
      console.error("Erro ao atualizar serviço:", error);
      res.status(500).json({ erro: "Erro ao atualizar serviço." });
      return;
    }

    res.json({ sucesso: true, servico: data });
  } catch (erro) {
    console.error("Erro ao atualizar serviço:", erro);
    res.status(500).json({ erro: "Erro interno." });
  }
});

/**
 * DELETE /api/servicos/:servicoId
 * Exclui um serviço.
 */
servicoRouter.delete("/servicos/:servicoId", autenticar, async (req: Request, res: Response) => {
  try {
    const servicoId = sanitizarId(req.params.servicoId);
    if (!servicoId) { res.status(400).json({ erro: "servicoId inválido." }); return; }

    // Ownership via prestador do serviço
    const ids = await negociosDoUsuario(req.auth!.userId);
    if (ids.length) {
      const { data: svc } = await supabase.from("servicos").select("prestadores(negocio_id)").eq("id", servicoId).single();
      const negId = (svc?.prestadores as any)?.negocio_id;
      if (negId && !ids.includes(negId)) {
        res.status(403).json({ erro: "Sem permissão para excluir este serviço." }); return;
      }
    }

    // Excluir agendamentos vinculados primeiro
    await supabase.from("agendamentos").delete().eq("servico_id", servicoId);

    const { error } = await supabase
      .from("servicos")
      .delete()
      .eq("id", servicoId);

    if (error) {
      console.error("Erro ao excluir serviço:", error);
      res.status(500).json({ erro: "Erro ao excluir serviço." });
      return;
    }

    res.json({ sucesso: true, mensagem: "Serviço excluído com sucesso." });
  } catch (erro) {
    console.error("Erro ao excluir serviço:", erro);
    res.status(500).json({ erro: "Erro interno." });
  }
});
