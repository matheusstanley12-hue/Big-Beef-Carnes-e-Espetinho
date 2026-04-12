-- Schema SQL para o Projeto Resenha Moura V2

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
