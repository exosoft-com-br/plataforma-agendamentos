-- Adicionar campos CEP e bairro na tabela negocios
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS cep VARCHAR(8);
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS bairro VARCHAR(200);

-- Índice para busca por CEP
CREATE INDEX IF NOT EXISTS idx_negocios_cep ON negocios(cep);
