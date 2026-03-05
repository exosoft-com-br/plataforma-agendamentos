-- ============================================================
-- Tabela de Usuários para autenticação da plataforma
-- Roles: admin (CRUD completo) | usuario (só editar)
-- ============================================================

CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  nome TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'usuario' CHECK (role IN ('admin', 'usuario')),
  owner_id UUID, -- admin: NULL (é o dono); usuario: UUID do admin que o criou
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_owner ON usuarios(owner_id);

-- RLS
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_usuarios" ON usuarios;
CREATE POLICY "service_role_full_usuarios" ON usuarios
  FOR ALL USING (true) WITH CHECK (true);
