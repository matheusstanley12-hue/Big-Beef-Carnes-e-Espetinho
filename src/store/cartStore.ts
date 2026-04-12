import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface Product {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  estoque: number;
}

export interface CartItem extends Product {
  quantidade: number;
}

interface CartState {
  items: CartItem[];
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  checkout: (mesaId: string, garcomId?: string) => Promise<boolean>;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  addItem: (product) => set((state) => {
    const existing = state.items.find(i => i.id === product.id);
    if (existing) {
      if (existing.quantidade >= product.estoque) {
        alert(`Quantidade máxima em estoque atingida para "${product.nome}"!`);
        return state;
      }
      return { items: state.items.map(i => i.id === product.id ? { ...i, quantidade: i.quantidade + 1 } : i) };
    }
    
    if (product.estoque <= 0) {
      alert(`O item "${product.nome}" está esgotado!`);
      return state;
    }

    return { items: [...state.items, { ...product, quantidade: 1 }] };
  }),
  removeItem: (productId) => set((state) => {
    const existing = state.items.find(i => i.id === productId);
    if (existing && existing.quantidade > 1) {
      return { items: state.items.map(i => i.id === productId ? { ...i, quantidade: i.quantidade - 1 } : i) };
    }
    return { items: state.items.filter(i => i.id !== productId) };
  }),
  clearCart: () => set({ items: [] }),
  checkout: async (mesaId: string, garcomId?: string) => {
    const state = get();
    if (state.items.length === 0) return false;

    // Previne múltiplos cliques esvaziando o carrinho sincronicamente antes da requisição
    const itemsToSubmit = [...state.items];
    set({ items: [] });

    const totalCalculado = itemsToSubmit.reduce((a, b) => a + (b.preco * b.quantidade), 0);

    // 1. Criar Pedido no Supabase
    let uuidRealDaMesa = mesaId;
    
    if (mesaId.startsWith('mesa-') && mesaId.endsWith('-qr')) {
      const { data: mesaData } = await supabase.from('mesas').select('id').eq('qr_code', mesaId).single();
      if (!mesaData) {
         console.error("Mesa não encontrada no Supabase:", mesaId);
         set({ items: itemsToSubmit }); // Reverte o carrinho
         return false;
      }
      uuidRealDaMesa = mesaData.id;
    }

    const { data: pedido, error: errPedido } = await supabase.from('pedidos').insert({
      mesa_id: uuidRealDaMesa,
      garcom_id: garcomId || null,
      cliente_nome: 'Cliente Web',
      status: 'novo',
      total: totalCalculado
    }).select().single();

    if (errPedido || !pedido) {
      console.error(errPedido);
      set({ items: itemsToSubmit }); // Reverte o carrinho
      return false;
    }

    // 2. Criar Itens do Pedido
    const itensInsert = itemsToSubmit.map(i => ({
      pedido_id: pedido.id,
      produto_id: i.id,
      quantidade: i.quantidade,
      preco_unitario: i.preco
    }));

    await supabase.from('itens_pedido').insert(itensInsert);

    // Sucesso (já limpou antes)
    return true;
  }
}));
