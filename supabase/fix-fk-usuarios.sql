-- ============================================================
-- Correção: Alterar FKs de profiles_atendimentos para usuarios
-- A tabela profiles_atendimentos dependia de auth.users (Supabase Auth nativo).
-- Agora usamos a tabela "usuarios" como sistema de auth próprio (JWT).
-- ============================================================

-- 1. Remover FK antiga de negocios → profiles_atendimentos
ALTER TABLE negocios DROP CONSTRAINT IF EXISTS negocios_owner_id_fkey;

-- 2. Criar FK nova de negocios → usuarios
ALTER TABLE negocios
  ADD CONSTRAINT negocios_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES usuarios(id) ON DELETE CASCADE;

-- 3. Remover FK antiga de nichos → profiles_atendimentos  
ALTER TABLE nichos DROP CONSTRAINT IF EXISTS nichos_owner_id_fkey;

-- 4. Criar FK nova de nichos → usuarios
ALTER TABLE nichos
  ADD CONSTRAINT nichos_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES usuarios(id) ON DELETE SET NULL;

-- 5. Adicionar RLS permissiva para negocios (service_role)
ALTER TABLE negocios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_negocios" ON negocios;
CREATE POLICY "service_role_full_negocios" ON negocios
  FOR ALL USING (true) WITH CHECK (true);

-- 6. Adicionar RLS permissiva para nichos (service_role)
ALTER TABLE nichos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_nichos" ON nichos;
CREATE POLICY "service_role_full_nichos" ON nichos
  FOR ALL USING (true) WITH CHECK (true);

-- 7. Adicionar RLS permissiva para personalizacoes (service_role)
ALTER TABLE personalizacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_personalizacoes" ON personalizacoes;
CREATE POLICY "service_role_full_personalizacoes" ON personalizacoes
  FOR ALL USING (true) WITH CHECK (true);
