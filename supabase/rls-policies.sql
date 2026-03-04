-- ============================================================
-- Supabase RLS - Políticas de segurança restritivas
-- Executar no SQL Editor do Supabase APÓS o schema.sql
-- ============================================================

-- 1. REMOVER políticas permissivas anteriores
DROP POLICY IF EXISTS "Nichos são públicos" ON nichos;
DROP POLICY IF EXISTS "Prestadores são públicos" ON prestadores;
DROP POLICY IF EXISTS "Serviços são públicos" ON servicos;
DROP POLICY IF EXISTS "Agendamentos leitura via API" ON agendamentos;
DROP POLICY IF EXISTS "Agendamentos inserção via API" ON agendamentos;
DROP POLICY IF EXISTS "Agendamentos atualização via API" ON agendamentos;

-- 2. NICHOS — somente leitura pública (anon pode ler, ninguém pode alterar via client)
CREATE POLICY "nichos_select_public"
  ON nichos FOR SELECT
  USING (true);

-- 3. PRESTADORES — somente leitura pública de ativos
CREATE POLICY "prestadores_select_public"
  ON prestadores FOR SELECT
  USING (ativo = true);

-- 4. SERVICOS — somente leitura pública de ativos
CREATE POLICY "servicos_select_public"
  ON servicos FOR SELECT
  USING (ativo = true);

-- 5. AGENDAMENTOS — NENHUM acesso via anon key (client-side)
-- Toda operação de agendamento passa pela API (service_role bypassa RLS)
-- Isso impede que alguém com a anon key leia/crie/altere agendamentos diretamente

-- Se precisar permitir leitura via anon (ex: para o Typebot consultar direto):
-- CREATE POLICY "agendamentos_select_by_telefone"
--   ON agendamentos FOR SELECT
--   USING (cliente_telefone = current_setting('request.jwt.claims')::json->>'phone');

-- 6. Garantir que RLS está ativado em todas as tabelas
ALTER TABLE nichos ENABLE ROW LEVEL SECURITY;
ALTER TABLE prestadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;

-- 7. Forçar RLS mesmo para o dono da tabela (segurança extra)
ALTER TABLE agendamentos FORCE ROW LEVEL SECURITY;
