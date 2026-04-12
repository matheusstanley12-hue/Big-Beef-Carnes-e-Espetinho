-- Tabelas para Gestão de Caixa Avançada

-- 1. Tabela de Turnos
CREATE TABLE IF NOT EXISTS public.turnos_caixa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operador_id UUID REFERENCES public.profiles(id),
    aberto_em TIMESTAMPTZ DEFAULT NOW(),
    fechado_em TIMESTAMPTZ,
    fundo_troco NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    valor_declarado NUMERIC(10,2),
    status TEXT NOT NULL CHECK (status IN ('aberto', 'fechado')) DEFAULT 'aberto',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Movimentações (Sangrias e Suprimentos)
CREATE TABLE IF NOT EXISTS public.movimentacoes_caixa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    turno_id UUID REFERENCES public.turnos_caixa(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('sangria', 'suprimento')),
    valor NUMERIC(10,2) NOT NULL,
    motivo TEXT NOT NULL,
    operador_nome TEXT,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Relacionar Pedidos com Turnos
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS garcom_id UUID REFERENCES public.profiles(id);
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS turno_id UUID REFERENCES public.turnos_caixa(id);
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS finalizado_at TIMESTAMPTZ;

-- Habilitar RLS
ALTER TABLE public.turnos_caixa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes_caixa ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso
CREATE POLICY "Acesso Total Turnos" ON public.turnos_caixa FOR ALL USING (
  EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'dono', 'caixa'))
);

CREATE POLICY "Acesso Total Movimentacoes" ON public.movimentacoes_caixa FOR ALL USING (
  EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'dono', 'caixa'))
);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.turnos_caixa;
ALTER PUBLICATION supabase_realtime ADD TABLE public.movimentacoes_caixa;

-- Recarregar cache do esquema
NOTIFY pgrst, 'reload schema';
