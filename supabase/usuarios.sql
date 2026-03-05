-- ============================================================
-- Tabela de Usuários para autenticação da plataforma
-- Roles: admin (CRUD completo) | usuario (só editar)
-- Suporta login via email/senha, Google e Facebook
-- ============================================================

CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL DEFAULT '',
  nome TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'usuario' CHECK (role IN ('admin', 'usuario')),
  owner_id UUID,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- OAuth
  provedor TEXT NOT NULL DEFAULT 'email',  -- 'email', 'google', 'facebook'
  provedor_id TEXT,                         -- ID do provedor OAuth (Google sub, Facebook ID)
  avatar_url TEXT                           -- URL da foto do perfil (OAuth)
);

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_owner ON usuarios(owner_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_provedor ON usuarios(provedor, provedor_id);

-- RLS
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_usuarios" ON usuarios;
CREATE POLICY "service_role_full_usuarios" ON usuarios
  FOR ALL USING (true) WITH CHECK (true);
