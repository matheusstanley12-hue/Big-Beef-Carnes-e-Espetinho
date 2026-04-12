-- Schema SQL para o Projeto Big Beef

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- TABELAS PRINCIPAIS
CREATE TABLE IF NOT EXISTS public.produtos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    categoria TEXT NOT NULL,
    preco NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    estoque INTEGER NOT NULL DEFAULT 999,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.mesas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero INTEGER NOT NULL UNIQUE,
    qr_code TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('livre', 'ocupada', 'aguardando conta')) DEFAULT 'livre',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pedidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mesa_id UUID REFERENCES public.mesas(id) ON DELETE CASCADE,
    garcom_id UUID REFERENCES public.profiles(id),
    turno_id UUID REFERENCES public.turnos_caixa(id),
    cliente_nome TEXT,
    data_hora TIMESTAMPTZ DEFAULT NOW(),
    finalizado_at TIMESTAMPTZ,
    status TEXT NOT NULL CHECK (status IN ('novo', 'em preparo', 'pronto', 'entregue', 'finalizado')) DEFAULT 'novo',
    total NUMERIC(10,2) DEFAULT 0.00,
    forma_pagamento TEXT
);

CREATE TABLE IF NOT EXISTS public.itens_pedido (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id UUID REFERENCES public.pedidos(id) ON DELETE CASCADE,
    produto_id UUID REFERENCES public.produtos(id) ON DELETE CASCADE,
    quantidade INTEGER NOT NULL CHECK (quantidade > 0),
    preco_unitario NUMERIC(10,2) NOT NULL,
    status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'em preparo', 'pronto', 'entregue'))
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    role TEXT CHECK (role IN ('garcom', 'caixa', 'cozinha', 'admin', 'dono')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CONFIGURAÇÕES DE REALTIME
alter publication supabase_realtime add table public.pedidos;
alter publication supabase_realtime add table public.itens_pedido;
alter publication supabase_realtime add table public.mesas;

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_pedido ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS PROFILES
CREATE POLICY "Ver próprio perfil" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins e Donos vejam todos" ON public.profiles FOR SELECT USING (
  (auth.uid() = id) OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'dono'))
);
CREATE POLICY "Admins e Donos inserem perfis" ON public.profiles FOR INSERT WITH CHECK (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'dono'))
);
CREATE POLICY "Admins e Donos atualizam perfis" ON public.profiles FOR UPDATE USING (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'dono'))
);

-- POLÍTICAS PRODUTOS/MESAS
CREATE POLICY "Public Select Produtos" ON public.produtos FOR SELECT USING (true);
CREATE POLICY "Admin/Dono Modify Produtos" ON public.produtos FOR ALL USING (
  EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'dono'))
) WITH CHECK (
  EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'dono'))
);

CREATE POLICY "Public Select Mesas" ON public.mesas FOR SELECT USING (true);
CREATE POLICY "Admin/Dono Modify Mesas" ON public.mesas FOR ALL USING (
  EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'dono'))
) WITH CHECK (
  EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'dono'))
);

-- POLÍTICAS PEDIDOS
CREATE POLICY "Admin/Dono All Pedidos" ON public.pedidos FOR ALL USING (
  EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'dono', 'caixa', 'garcom'))
) WITH CHECK (
  EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'dono', 'caixa', 'garcom'))
);
CREATE POLICY "Customer Insert Pedidos" ON public.pedidos FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Select Pedidos" ON public.pedidos FOR SELECT USING (true);

CREATE POLICY "Admin/Dono All Itens" ON public.itens_pedido FOR ALL USING (
  EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'dono', 'caixa', 'garcom', 'cozinha'))
) WITH CHECK (
  EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'dono', 'caixa', 'garcom', 'cozinha'))
);
CREATE POLICY "Customer Insert Itens" ON public.itens_pedido FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Select Itens" ON public.itens_pedido FOR SELECT USING (true);

-- DADOS INICIAIS (EXEMPLO)
INSERT INTO public.produtos (nome, categoria, preco) VALUES 
('Chopp', 'BEBIDAS', 6.50), ('Batata Frita', 'PETISCO', 19.90), ('Red Bull', 'BEBIDAS', 15.00);

INSERT INTO public.mesas (numero, qr_code, status) VALUES 
(1, 'mesa-1-qr', 'livre');

-- TRIGGERS E FUNÇÕES
CREATE OR REPLACE FUNCTION decrementar_estoque()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.produtos
  SET estoque = estoque - NEW.quantidade
  WHERE id = NEW.produto_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_decrementar_estoque
AFTER INSERT ON public.itens_pedido
FOR EACH ROW
EXECUTE FUNCTION decrementar_estoque();
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
-- Script de Migração: Adicionar Colunas Faltantes na Tabela 'pedidos'
-- Execute este script no SQL Editor do seu Supabase para corrigir o erro.

-- 1. Garcom_id (se não existir)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pedidos' AND column_name='garcom_id') THEN
        ALTER TABLE public.pedidos ADD COLUMN garcom_id UUID REFERENCES public.profiles(id);
    END IF;
END $$;

-- 2. Turno_id (se não existir)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pedidos' AND column_name='turno_id') THEN
        ALTER TABLE public.pedidos ADD COLUMN turno_id UUID REFERENCES public.turnos_caixa(id);
    END IF;
END $$;

-- 3. Finalizado_at (se não existir)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pedidos' AND column_name='finalizado_at') THEN
        ALTER TABLE public.pedidos ADD COLUMN finalizado_at TIMESTAMPTZ;
    END IF;
END $$;

-- Recarregar cache do esquema (importante para o PostgREST)
NOTIFY pgrst, 'reload schema';
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
