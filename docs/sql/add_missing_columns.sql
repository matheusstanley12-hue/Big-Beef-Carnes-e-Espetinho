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
