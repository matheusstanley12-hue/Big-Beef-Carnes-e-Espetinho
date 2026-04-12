-- Tabela de Auditoria de Exclusões Administrativas
CREATE TABLE IF NOT EXISTS public.auditoria_exclusoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id UUID REFERENCES public.pedidos(id) ON DELETE SET NULL,
    produto_nome TEXT NOT NULL,
    quantidade INTEGER NOT NULL,
    valor_removido NUMERIC(10,2) NOT NULL,
    motivo TEXT NOT NULL,
    usuario_nome TEXT, -- Nome de quem realizou a exclusão
    mesa_numero INTEGER,
    turno_id UUID REFERENCES public.turnos_caixa(id) ON DELETE SET NULL,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.auditoria_exclusoes ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso (Apenas Admins e Donos)
CREATE POLICY "Admins e Donos acessam auditoria" ON public.auditoria_exclusoes FOR SELECT USING (
  EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'dono'))
);

CREATE POLICY "Admins e Donos inserem auditoria" ON public.auditoria_exclusoes FOR INSERT WITH CHECK (
  EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'dono'))
);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.auditoria_exclusoes;
