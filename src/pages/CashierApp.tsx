import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  LogOut, Receipt, History as HistoryIcon, Printer, 
  Lock, DollarSign,
  ShoppingCart, Store, Search, X, Utensils, Trash2, Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { OwnerViewBanner } from '../components/OwnerViewBanner';
import { FechamentoCaixa } from '../components/FechamentoCaixa';
import { AberturaCaixa } from '../components/AberturaCaixa';
import { printContaMesa, printPetiscoTicket } from '../utils/printUtils';

type TabType = 'mesas' | 'balcao' | 'cozinha' | 'fechamento';
type PaymentMethod = 'dinheiro' | 'pix' | 'cartao' | 'debito' | 'credito';

interface Payment {
  method: PaymentMethod;
  amount: number;
}

interface CartItem {
  id: string;
  nome: string;
  preco: number;
  quantidade: number;
}

export const Caixa = ({ isEmbedded = false }: { isEmbedded?: boolean }) => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('mesas');
  const [mesasPendentes, setMesasPendentes] = useState<any[]>([]);
  const [pedidosAtivos, setPedidosAtivos] = useState<any[]>([]);
  const [historicoVendas, setHistoricoVendas] = useState<any[]>([]);
  const [cozinhaItems, setCozinhaItems] = useState<any[]>([]);
  const [printedItemIds, setPrintedItemIds] = useState<string[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [autoPrintKds, setAutoPrintKds] = useState(false);
  const [selectedPedidoDetail, setSelectedPedidoDetail] = useState<any>(null);
  const [itemsPedidoDetail, setItemsPedidoDetail] = useState<any[]>([]);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('TODOS');
  const [isCaixaAberto, setIsCaixaAberto] = useState(false);
  
  // Verificar turno ativo no banco ao carregar
  useEffect(() => {
    const checkActiveTurno = async () => {
      const { data } = await supabase
        .from('turnos_caixa')
        .select('*')
        .eq('status', 'aberto')
        .order('aberto_em', { ascending: false })
        .limit(1)
        .single();
      
      if (data) {
        setIsCaixaAberto(true);
        localStorage.setItem('turno_id', data.id);
        localStorage.setItem('turno_inicio', data.aberto_em);
        localStorage.setItem('fundo_troco', data.fundo_troco.toString());
      } else {
        setIsCaixaAberto(false);
        localStorage.removeItem('turno_id');
        localStorage.removeItem('turno_inicio');
        localStorage.removeItem('fundo_troco');
      }
    };
    checkActiveTurno();
  }, []);
  
  // Quick Sale (Balcão) State
  const [carrinho, setCarrinho] = useState<CartItem[]>([]);
  
  // Checkout Modal State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedMesa, setSelectedMesa] = useState<any>(null);
  const [checkoutItens, setCheckoutItens] = useState<any[]>([]);
  const [pagamentos, setPagamentos] = useState<Payment[]>([]);
  const [dividirPor, setDividirPor] = useState(1);
  const [splitPayments, setSplitPayments] = useState<{method: PaymentMethod | null, amount: number}[]>([]);
  const [incluirTaxa, setIncluirTaxa] = useState(false);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [valorRecebido, setValorRecebido] = useState<string>('');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);

  const handleRemovePayment = (index: number) => {
    const newPayments = [...pagamentos];
    newPayments.splice(index, 1);
    setPagamentos(newPayments);
  };
  
  // Fechamento State (agora gerenciado pelo componente FechamentoCaixa)
  
  const { signOut, profile } = useAuth();

  const fetchData = async () => {
    try {
      // 1. Mesas Abertas
      const { data: mesas } = await supabase.from('mesas').select('*').eq('status', 'aguardando conta');
      setMesasPendentes(mesas || []);

      const { data: pedidos } = await supabase.from('pedidos')
        .select(`
          *, 
          profiles:garcom_id(full_name)
        `)
        .neq('status', 'finalizado');
      setPedidosAtivos(pedidos || []);

      // 1b. Itens para Cozinha/Bar (KDS)
      const { data: itensKds } = await supabase
         .from('itens_pedido')
         .select(`
           id, 
           pedido_id, 
           quantidade, 
           status,
           produtos(nome, categoria),
           pedidos(mesa_id, data_hora, mesas(numero))
         `)
         .in('status', ['pendente', 'em preparo']);

      if (itensKds) {
         const formatted = itensKds.map((i: any) => ({
           id: i.id,
           pedido_id: i.pedido_id,
           produto_nome: i.produtos?.nome,
           categoria: i.produtos?.categoria,
           quantidade: i.quantidade,
           status: i.status,
           params: {
             mesa: i.pedidos?.mesas?.numero || 0,
             data_hora: i.pedidos?.data_hora
           }
         }));
         
         const formattedWithExtra = formatted.map(f => ({
           ...f,
           mesa: f.params.mesa,
           data_hora: f.params.data_hora
         }));

         const CATS_COZINHA = [
           'PETISCO', 'PETISCOS', 'LANCHES', 'LANCHE', 'PORÇÕES', 'PORCOES', 
           'PORÇÃO', 'PORCAO', 'COZINHA', 'PRATOS', 'PRATO', 'REFEIÇÕES', 
           'REFEICOES', 'ENTRADAS', 'SOBREMESAS', 'SOBREMESA', 'PIZZA', 'BURGER',
           'BEBIDAS', 'BEBIDA', 'CHOPP', 'CERVEJA'
         ];
         const CATS_BAR = [
           'COQUETÉIS', 'COQUITEIS', 'COQUETEIS', 'DRINKS', 'DRINK', 
           'DOSES', 'DOSE', 'GIN', 'CAIPIRINHA', 'BATIDAS', 'DESTILADOS (DOSE)', 'DESTILADOS'
         ];
         const NAMES_BAR_FALLBACK = [
           "caipirinha cachaça", "caipivodka smirnoff", "caipivodka absolut",
           "gin tônica tanqueray", "gin tanqueray com red bull", "dry martini",
           "campari", "aperol"
         ];

         const filtered = formattedWithExtra.filter((item: any) => {
           const cat = (item.categoria || '').toUpperCase();
           const nome = (item.produto_nome || '').trim().toLowerCase();
           
           // Cozinha
           if (CATS_COZINHA.includes(cat)) return true;
           
           // Bar
           if (CATS_BAR.includes(cat)) return true;
           if (NAMES_BAR_FALLBACK.includes(nome)) return true;
           
           return false;
         });

         // Ordenar por data_hora ASC (Antigos primeiro)
         filtered.sort((a: any, b: any) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime());
         setCozinhaItems(filtered);

         if (isInitialLoad && itensKds) {
            setPrintedItemIds(itensKds.map((i: any) => i.id));
            setIsInitialLoad(false);
         }
      }

      // 2. Histórico (Filtrar por turno_id se estiver aberto, caso contrário últimas 24 horas)
      const currentTurnoId = localStorage.getItem('turno_id');
      let query = supabase.from('pedidos')
        .select('*, profiles:garcom_id(full_name), mesas(numero)')
        .eq('status', 'finalizado');

      if (currentTurnoId) {
        query = query.eq('turno_id', currentTurnoId);
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        query = query.gte('finalizado_at', today.toISOString());
      }

      const { data: historico } = await query.order('finalizado_at', { ascending: false });
      setHistoricoVendas(historico || []);

      // 3. Produtos para Venda de Balcão
      const { data: prods } = await supabase.from('produtos').select('*').eq('ativo', true).order('nome', { ascending: true });
      setProdutos(prods || []);

    } catch (err) {
      console.error("Erro ao carregar dados do caixa:", err);
    } finally {
      setLoading(false);
    }
  };

  const [lastAccountRequestCount, setLastAccountRequestCount] = useState(0);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); 
    return () => clearInterval(interval);
  }, []);

  // Monitorar solicitações de conta
  useEffect(() => {
    const currentCount = mesasPendentes.filter(m => m.status === 'aguardando conta').length;
    setLastAccountRequestCount(currentCount);
  }, [mesasPendentes]);

  // --- Lógica de Carrinho (Balcão) ---
  const addToCart = (product: any) => {
    const existing = carrinho.find(item => item.id === product.id);
    if (existing) {
      setCarrinho(carrinho.map(item => item.id === product.id ? { ...item, quantidade: item.quantidade + 1 } : item));
    } else {
      setCarrinho([...carrinho, { id: product.id, nome: product.nome, preco: Number(product.preco), quantidade: 1 }]);
    }
  };

  const removeFromCart = (id: string) => {
     setCarrinho(carrinho.filter(item => item.id !== id));
  };

  const updateCartQty = (id: string, delta: number) => {
    setCarrinho(carrinho.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantidade + delta);
        return { ...item, quantidade: newQty };
      }
      return item;
    }));
  };

  // --- Lógica de Checkout ---
  const openTableCheckout = async (mesa: any) => {
    setSelectedMesa(mesa);
    setPagamentos([]);
    setValorRecebido('');
    setCustomAmount('');
    setDividirPor(1);
    setSplitPayments([]);
    setIncluirTaxa(false);
    setSelectedMethod(null);
    
    // Buscar pedidos da mesa
    const { data: pedidosMesa } = await supabase.from('pedidos')
      .select('id')
      .eq('mesa_id', mesa.id)
      .neq('status', 'finalizado');

    if (!pedidosMesa || pedidosMesa.length === 0) {
      setCheckoutItens([]);
      setIsCheckoutOpen(true);
      return;
    }
    
    const { data: itens } = await supabase.from('itens_pedido')
      .select('*, produtos(nome, categoria)')
      .in('pedido_id', pedidosMesa.map(p => p.id));
    
    setCheckoutItens(itens?.map(i => ({
       id: i.id,
       nome: i.produtos?.nome,
       quantidade: i.quantidade,
       preco: Number(i.preco_unitario),
       categoria: i.produtos?.categoria,
       status: i.status,
       pedido_id: i.pedido_id
    })) || []);
    setIsCheckoutOpen(true);
  };
  
  const handleDeleteCheckoutItem = async (item: any) => {
    if (!confirm(`Deseja remover "${item.nome}" da comanda?`)) return;

    if (selectedMesa) {
      // 1. Remover item_pedido
      const { error: delError } = await supabase.from('itens_pedido').delete().eq('id', item.id);
      if (delError) {
        alert("Erro ao remover item do banco.");
        return;
      }
      // 2. Atualizar total no pedido
      const { data: pedido } = await supabase.from('pedidos').select('total').eq('id', item.pedido_id).single();
      if (pedido) {
        const novoTotal = Math.max(0, Number(pedido.total) - (item.preco * item.quantidade));
        await supabase.from('pedidos').update({ total: novoTotal }).eq('id', item.pedido_id);
      }
      // 3. Update local
      setCheckoutItens(prev => prev.filter(i => i.id !== item.id));
    } else {
       // Balcão
       setCarrinho(prev => prev.filter(i => i.id !== item.id));
       setCheckoutItens(prev => prev.filter(i => i.id !== item.id));
    }
  };

  const openQuickCheckout = () => {
    if (carrinho.length === 0) return;
    setSelectedMesa(null);
    setCheckoutItens([...carrinho]);
    setPagamentos([]);
    setValorRecebido('');
    setCustomAmount('');
    setDividirPor(1);
    setIncluirTaxa(false); // Balcão geralmente não tem taxa
    setSelectedMethod(null);
    setIsCheckoutOpen(true);
  };

  const totalCheckout = useMemo(() => {
    return checkoutItens.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
  }, [checkoutItens]);

  // Taxa de serviço removida
  const taxaServico = 0;
  const totalComTaxa = totalCheckout;
  const totalPago = pagamentos.reduce((acc, p) => acc + Number(p.amount), 0);
  const totalRestante = Math.max(0, totalComTaxa - totalPago);
  const valorIndividual = dividirPor > 1 ? totalComTaxa / dividirPor : totalComTaxa;
  const suggestedAmount = (dividirPor > 1 && totalRestante >= valorIndividual - 0.01) ? valorIndividual : totalRestante;

  // Cálculo de troco reativo
  const valorInput = parseFloat(valorRecebido.replace(',', '.')) || 0;
  const totalEmDinheiro = pagamentos
    .filter(p => p.method === 'dinheiro')
    .reduce((acc, p) => acc + Number(p.amount), 0);
  
  const customAmountVal = parseFloat(customAmount) || 0;
  const baseParaTroco = customAmountVal > 0 ? customAmountVal : totalRestante;
  const troco = valorInput > 0 ? Math.max(0, valorInput - baseParaTroco) : 0;

  const handleAddPayment = (method: PaymentMethod, amount: number) => {
    if (amount <= 0) return;
    setPagamentos([...pagamentos, { method, amount }]);
    setCustomAmount('');
    setSelectedMethod(null);
    setValorRecebido(''); // Reset troco input after add
  };

  const handleFinalizar = async () => {

    if (totalRestante > 0.1) {
      alert("A conta ainda não foi totalmente paga!");
      return;
    }

    try {
      const formaPagamentoStr = pagamentos.map(p => `${p.method.toUpperCase()} (R$${p.amount.toFixed(2)})`).join(', ');

      if (selectedMesa) {
        // Buscar IDs dos pedidos que serão fechados
        console.log("Finalizando mesa:", selectedMesa.id);
        const { data: pedidosAtivosDb } = await supabase.from('pedidos')
          .select('id')
          .eq('mesa_id', selectedMesa.id)
          .neq('status', 'finalizado');

        if (!pedidosAtivosDb || pedidosAtivosDb.length === 0) {
          console.warn("Mesa tentou ser fechada mas pedidos sumiram no DB:", selectedMesa.id);
          throw new Error("Nenhum pedido ativo encontrado no banco para esta mesa.");
        }

        const ids = pedidosAtivosDb.map(p => p.id);
        const masterId = ids[0];
        const otherIds = ids.slice(1);

        // 1. Atualizar o pedido mestre com o valor total e pagamento
        const turnoId = localStorage.getItem('turno_id');
        const updateData: any = { 
          status: 'finalizado', 
          forma_pagamento: formaPagamentoStr,
          total: totalComTaxa,
          finalizado_at: new Date().toISOString()
        };
        if (turnoId) updateData.turno_id = turnoId;

        const { error: masterError } = await supabase.from('pedidos')
          .update(updateData)
          .eq('id', masterId);

        if (masterError) throw masterError;

        // 2. Se houver outros pedidos na mesa, fechá-los com total zero para não duplicar no financeiro
        if (otherIds.length > 0) {
          const bulkUpdateData: any = { 
            status: 'finalizado', 
            forma_pagamento: 'AGRUPADO',
            total: 0,
            finalizado_at: new Date().toISOString()
          };
          if (turnoId) bulkUpdateData.turno_id = turnoId;

          await supabase.from('pedidos')
            .update(bulkUpdateData)
            .in('id', otherIds);
        }

        // 3. Liberar a mesa
        await supabase.from('mesas').update({ status: 'livre', precisa_garcom: false }).eq('id', selectedMesa.id);
      } else {
        const turnoId = localStorage.getItem('turno_id');
        const insertData: any = {
          mesa_id: null,
          garcom_id: profile?.id,
          status: 'finalizado',
          total: totalCheckout,
          forma_pagamento: formaPagamentoStr,
          finalizado_at: new Date().toISOString()
        };
        if (turnoId) insertData.turno_id = turnoId;

        const { data: newPedido, error: pErr } = await supabase.from('pedidos')
          .insert(insertData)
          .select().single();

        if (pErr) throw pErr;

        const itensToInsert = checkoutItens.map(item => ({
          pedido_id: newPedido.id,
          produto_id: item.id,
          quantidade: item.quantidade,
          preco_unitario: item.preco,
          status: 'pronto'
        }));
        await supabase.from('itens_pedido').insert(itensToInsert);
        setCarrinho([]);
      }
      
      alert("Venda finalizada com sucesso! 💰");
      setIsCheckoutOpen(false);
      fetchData();
    } catch (err: any) {
      console.error("ERRO CRITICAL AO FINALIZAR:", err);
      alert("Erro ao finalizar venda: " + (err.message || "Verifique a conexão ou chame o suporte."));
    }
  };

  const handleStatusChangeCozinha = async (itemId: string) => {
      const nextStatus = 'pronto';
      const updates: any = { 
        status: nextStatus,
        preparo_fim_at: new Date().toISOString()
      };
      const { error } = await supabase.from('itens_pedido').update(updates).eq('id', itemId);
      if (!error) fetchData();
  };

  const handleImprimirCozinha = (item: any) => {
    printPetiscoTicket(
      item.mesa.toString(),
      'Atendimento',
      [item.pedido_id],
      [{ qtd: item.quantidade, nome: item.produto_nome }]
    );
  };

  const handleVerDetalhes = async (pedido: any) => {
    setSelectedPedidoDetail(pedido);
    setItemsPedidoDetail([]);
    const { data } = await supabase
      .from('itens_pedido')
      .select('*, produtos(nome)')
      .eq('pedido_id', pedido.id);
    if (data) setItemsPedidoDetail(data);
    setIsDetailModalOpen(true);
  };

  const handleImprimir = (itens: any[]) => {
    printContaMesa(
      selectedMesa ? selectedMesa.numero.toString() : null,
      itens.map(i => ({ nome: i.nome, quantidade: i.quantidade, preco: i.preco })),
      incluirTaxa
    );
  };

  const paymentTotals = useMemo(() => {
    const totals = { pix: 0, dinheiro: 0, debito: 0, credito: 0, outrosCartoes: 0 };
    historicoVendas.forEach(p => {
      if (!p.forma_pagamento) return;
      const matches = p.forma_pagamento.match(/(PIX|DINHEIRO|DÉBITO|DEBITO|CRÉDITO|CREDITO|CARTAO|CARTÃO)\s*\(R\$([0-9.]+)\)/gi);
      if (matches) {
        matches.forEach((m: string) => {
          const typeMatch = m.match(/(PIX|DINHEIRO|DÉBITO|DEBITO|CRÉDITO|CREDITO|CARTAO|CARTÃO)/i);
          const valMatch = m.match(/R\$([0-9.]+)/);
          if (typeMatch && valMatch) {
            const type = typeMatch[1].toUpperCase();
            const val = parseFloat(valMatch[1]);
            if (type === 'PIX') totals.pix += val;
            else if (type === 'DINHEIRO') totals.dinheiro += val;
            else if (type === 'DÉBITO' || type === 'DEBITO') totals.debito += val;
            else if (type === 'CRÉDITO' || type === 'CREDITO') totals.credito += val;
          }
        });
      }
    });
    return totals;
  }, [historicoVendas]);

  const filteredProdutos = useMemo(() => {
    const normalizeStr = (s: string) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const searchLower = normalizeStr(searchTerm);
    return produtos.filter(p => {
      const matchesSearch = normalizeStr(p.nome).includes(searchLower) || normalizeStr(p.categoria).includes(searchLower);
      const matchesCategory = selectedCategory === 'TODOS' || p.categoria === selectedCategory;
      return searchTerm ? matchesSearch : matchesCategory;
    });
  }, [produtos, searchTerm, selectedCategory]);

  // handleFechamentoCaixa movido para o componente FechamentoCaixa

  const handleSimularMesasCaixa = async () => {
    if (!confirm("GERAR MESAS DE TESTE?")) return;
    const { data: mesasLivres } = await supabase.from('mesas').select('*').eq('status', 'livre').limit(3);
    const { data: prods } = await supabase.from('produtos').select('*').limit(5);
    if (!mesasLivres || !prods) return;
    for (const mesa of mesasLivres) {
       await supabase.from('mesas').update({ status: 'aguardando conta', precisa_garcom: true }).eq('id', mesa.id);
       const { data: p } = await supabase.from('pedidos').insert({ mesa_id: mesa.id, garcom_id: profile?.id, status: 'aberto', total: 50, data_hora: new Date().toISOString() }).select().single();
       if (p) {
          await supabase.from('itens_pedido').insert({ pedido_id: p.id, produto_id: prods[0].id, quantidade: 2, preco_unitario: prods[0].preco, status: 'entregue' });
       }
    }
    fetchData();
  };

  const handleSimularCozinha = async () => {
    const { data: prods } = await supabase.from('produtos').select('*').limit(3);
    if (!prods) return;
    const { data: p } = await supabase.from('pedidos').insert({ mesa_id: null, garcom_id: profile?.id, status: 'novo', total: 0, data_hora: new Date().toISOString() }).select().single();
    if (p) {
       await supabase.from('itens_pedido').insert({ pedido_id: p.id, produto_id: prods[0].id, quantidade: 1, preco_unitario: prods[0].preco, status: 'pendente' });
    }
    fetchData();
  };

  const handleSimularHistorico = async () => {
    const pagamentosFixos = ['DINHEIRO', 'PIX', 'DÉBITO', 'CRÉDITO'];
    for (const pagType of pagamentosFixos) {
       const totalRand = 50;
       const pagStr = `${pagType} (R$${totalRand.toFixed(2)})`;
       await supabase.from('pedidos').insert({ mesa_id: null, garcom_id: profile?.id, status: 'finalizado', total: totalRand, forma_pagamento: pagStr, data_hora: new Date().toISOString(), finalizado_at: new Date().toISOString() });
    }
    fetchData();
  };

  const categories = ['TODOS', 'PETISCO', 'BEBIDAS', 'COQUETÉIS', 'DESTILADOS (DOSE)', 'OUTROS'];

  if (loading) return <div className="layout-container d-flex justify-center items-center" style={{height: '100vh', background: '#000', color: 'var(--primary-color)'}}>CARREGANDO CAIXA BIG BEEF...</div>;

  return (
    <div className="layout-container" style={{ background: '#0a0a0a', color: '#fff' }}>
      {!isEmbedded && (
        <aside className="sidebar" style={{ width: '100px' }}>
           <div style={{ marginBottom: '3rem' }}>
             <img src="/logo.jpg" alt="Logo" style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'contain', border: '1px solid var(--primary-color)' }} />
           </div>
           <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2rem', opacity: isCaixaAberto ? 1 : 0.3, pointerEvents: isCaixaAberto ? 'auto' : 'none' }}>
              <button onClick={() => setActiveTab('mesas')} style={{ background: 'none', border: 'none', color: activeTab === 'mesas' ? 'var(--primary-color)' : '#444', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', cursor: 'pointer', position: 'relative' }}>
                <Store size={28} /> <span style={{ fontSize: '0.6rem', fontWeight: 700 }}>MESAS</span>
              </button>
              <button onClick={() => setActiveTab('balcao')} style={{ background: 'none', border: 'none', color: activeTab === 'balcao' ? 'var(--primary-color)' : '#444', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                <ShoppingCart size={28} /> <span style={{ fontSize: '0.6rem', fontWeight: 700 }}>BALCÃO</span>
              </button>
              <button onClick={() => setActiveTab('cozinha')} style={{ background: 'none', border: 'none', color: activeTab === 'cozinha' ? 'var(--primary-color)' : '#444', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                <Utensils size={28} /> <span style={{ fontSize: '0.6rem', fontWeight: 700 }}>COZINHA</span>
              </button>
  
              <button onClick={() => setActiveTab('fechamento')} style={{ background: 'none', border: 'none', color: activeTab === 'fechamento' ? 'var(--danger-color)' : '#444', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                <Lock size={28} /> <span style={{ fontSize: '0.6rem', fontWeight: 700 }}>FECHAR DIA</span>
              </button>

              <div style={{ marginTop: 'auto', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <Link to="/garcom" style={{ textDecoration: 'none', color: 'var(--primary-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                  <Users size={28} /> <span style={{ fontSize: '0.6rem', fontWeight: 800 }}>GARÇOM</span>
                </Link>
              </div>
           </nav>
           <button onClick={() => signOut()} style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer' }}><LogOut size={28}/></button>
        </aside>
      )}

      <main className="main-content" style={{ paddingLeft: isEmbedded ? '0' : '100px' }}>
        <OwnerViewBanner panelName="Caixa" />
        <header className="d-flex justify-between items-center mb-6">
           <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--primary-color)' }}>
             {!isCaixaAberto ? 'STATUS DO SISTEMA' : (activeTab === 'mesas' ? 'GESTÃO DE MESAS' : activeTab === 'balcao' ? 'VENDA DE BALCÃO' : activeTab === 'cozinha' ? 'PEDIDOS COZINHA' : 'FECHAMENTO E LEITURA Z')}
           </h1>
           <div className="d-flex items-center gap-4">
              <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>LOGADO COMO: <b style={{color: '#fff'}}>{profile?.full_name?.toUpperCase()}</b></span>
              {(profile?.role === 'garcom' || profile?.role === 'admin' || profile?.role === 'dono') && (
                <Link to="/garcom" className="btn-outline" style={{ fontSize: '0.7rem', borderColor: 'var(--success-color)', color: 'var(--success-color)' }}>
                  🏃 Painel Garçom
                </Link>
              )}
              <Link to="/" className="btn-outline" style={{ fontSize: '0.7rem' }}>PAINEL GERAL</Link>
           </div>
        </header>

        
        <AnimatePresence mode="wait">
          {isCaixaAberto ? (
            <>
              {activeTab === 'mesas' && (
                <motion.div key="mesas" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                   {mesasPendentes.map(mesa => (
                     <div key={mesa.id} className="card hover-surface" style={{ borderLeft: '8px solid var(--primary-color)', padding: '1.5rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.6rem', opacity: 0.5, marginBottom: '0.5rem' }}>AGUARDANDO CONTA</div>
                        <div style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '0.5rem' }}>Mesa {mesa.numero}</div>
                        <button className="btn-primary w-full mt-4" onClick={() => openTableCheckout(mesa)} style={{ background: 'var(--primary-color)', color: '#000' }}>FECHAR CONTA</button>
                     </div>
                   ))}
                   {mesasPendentes.length === 0 && (
                     <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '5rem', opacity: 0.8 }}>
                       <Receipt size={80} style={{margin: '0 auto 1.5rem', opacity: 0.3}} />
                       <h3 style={{ opacity: 0.3 }}>Nenhuma mesa ativa no momento.</h3>
                       <button onClick={handleSimularMesasCaixa} className="btn-outline mt-6">Simular Mesas</button>
                     </div>
                   )}
                </motion.div>
              )}

              {activeTab === 'balcao' && (
                <motion.div key="balcao" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
                  style={{ display: 'grid', gridTemplateColumns: window.innerWidth > 768 ? '1fr 350px' : '1fr', gap: '1.5rem', height: 'auto' }}>
                    <div className="d-flex flex-col gap-3">
                       <div style={{ position: 'relative' }}>
                          <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', opacity: 0.4 }} />
                          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Pesquisar..." style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.8rem', background: '#111', border: '1px solid #222', borderRadius: '10px', color: '#fff' }} />
                       </div>
                       <div className="mb-2">
                          <select 
                            value={selectedCategory} 
                            onChange={(e) => { setSelectedCategory(e.target.value); setSearchTerm(''); }} 
                            style={{ 
                              width: '100%',
                              padding: '0.70rem',
                              background: '#111',
                              border: '1px solid var(--primary-color)',
                              borderRadius: '10px',
                              color: '#fff',
                              fontSize: '1rem',
                              fontWeight: 800,
                              outline: 'none',
                              appearance: 'none',
                              backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23d4af37' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
                              backgroundRepeat: 'no-repeat',
                              backgroundPosition: 'right 1rem center'
                            }}
                          >
                            {categories.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                       </div>
                       <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))', gap: '0.8rem', overflowY: 'auto' }}>
                           {filteredProdutos.map(p => (
                             <div key={p.id} className="card hover-surface text-center" style={{ padding: '0.8rem', cursor: p.estoque > 0 ? 'pointer' : 'not-allowed', opacity: p.estoque > 0 ? 1 : 0.4 }} onClick={() => p.estoque > 0 && addToCart(p)}>
                                <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{p.nome}</div>
                                <div style={{ color: p.estoque > 0 ? 'var(--primary-color)' : '#666', fontWeight: 900 }}>R$ {Number(p.preco).toFixed(2)}</div>
                                {p.estoque <= 0 && <div style={{fontSize: '0.55rem', fontWeight: 900, color: 'var(--danger-color)', marginTop: '4px'}}>ESGOTADO</div>}
                             </div>
                           ))}
                       </div>
                    </div>
                   
                   <div className="card d-flex flex-col" style={{ padding: '0', background: '#f8f8f8', border: '1px solid #ddd', borderRadius: '4px', color: '#111', fontFamily: 'monospace' }}>
                      <div style={{ background: '#eee', padding: '1rem', textAlign: 'center', borderBottom: '2px dashed #ccc' }}>
                         <h3 style={{ fontSize: '0.9rem', fontWeight: 900 }}>BIG BEEF CARNES E ESPETINHO</h3>
                      </div>
                      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }} className="d-flex flex-col gap-2">
                         {carrinho.map(item => (
                           <div key={item.id} className="d-flex justify-between">
                              <span>{item.quantidade}x {item.nome}</span>
                              <span>{(item.preco * item.quantidade).toFixed(2)}</span>
                           </div>
                         ))}
                      </div>
                      <div style={{ padding: '1rem', background: '#fff', borderTop: '2px dashed #ccc' }}>
                         <div className="d-flex justify-between mb-4">
                            <b>TOTAL GERAL:</b>
                            <b style={{ fontSize: '1.5rem' }}>R$ {carrinho.reduce((acc, i) => acc + (i.preco * i.quantidade), 0).toFixed(2)}</b>
                         </div>
                         <button className="btn-primary w-full py-4" onClick={openQuickCheckout}>RECEBER AGORA</button>
                         <button className="w-full mt-2" style={{ background: 'none', border: 'none', color: '#666', fontSize: '0.6rem' }} onClick={() => setCarrinho([])}>CANCELAR TUDO</button>
                      </div>
                   </div>
                </motion.div>
              )}

              {activeTab === 'cozinha' && (
                <motion.div key="cozinha" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                   <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                      {cozinhaItems.map(item => (
                        <div key={item.id} className="card" style={{ borderLeft: '6px solid var(--danger-color)', padding: '1.2rem' }}>
                           <div className="d-flex justify-between items-center mb-3">
                              <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--primary-color)' }}>MESA {item.mesa}</span>
                              <span style={{ fontSize: '0.65rem', opacity: 0.5 }}>{new Date(item.data_hora).toLocaleTimeString()}</span>
                           </div>
                           <div style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>{item.quantidade}x {item.produto_nome}</div>
                           <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '1rem', textTransform: 'uppercase' }}>CATEGORIA: {item.categoria}</div>
                           <div className="d-flex gap-2">
                              <button className="btn-success w-full" style={{ padding: '0.5rem', fontSize: '0.75rem' }} onClick={() => handleStatusChangeCozinha(item.id)}>CONCLUIR PREPARO</button>
                              <button className="btn-outline" style={{ padding: '0.5rem' }} onClick={() => handleImprimirCozinha(item)}><Printer size={16}/></button>
                           </div>
                        </div>
                      ))}
                      {cozinhaItems.length === 0 && (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '5rem', opacity: 0.3 }}>
                           <Utensils size={64} style={{ margin: '0 auto 1rem' }} />
                           <p>Nenhum pedido de produção pendente.</p>
                        </div>
                      )}
                   </div>
                </motion.div>
              )}



              {activeTab === 'fechamento' && (
                <motion.div key="fechamento" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <FechamentoCaixa
                    historicoVendas={historicoVendas}
                    paymentTotals={paymentTotals}
                    onRefresh={fetchData}
                    onClose={() => setIsCaixaAberto(false)}
                  />
                </motion.div>
              )}
            </>
          ) : (
            <AberturaCaixa onOpen={() => setIsCaixaAberto(true)} />
          )}
        </AnimatePresence>
      </main>
      <AnimatePresence>
        {isCheckoutOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(10px)', zIndex: 10000 }}>
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="card" style={{ width: '100vw', height: '100vh', maxWidth: 'none', maxHeight: 'none', borderRadius: 0, padding: 0, overflowY: 'auto', display: 'grid', gridTemplateColumns: window.innerWidth > 992 ? '1fr 380px' : '1fr', alignItems: 'stretch' }}>
                {/* Coluna Esquerda: Itens e Conferência */}
                <div style={{ padding: '1.2rem', borderRight: '1px solid #222', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                   <div className="d-flex justify-between items-center mb-4">
                      <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 900 }}>CONFERÊNCIA</h2>
                        <span style={{ opacity: 0.5 }}>{selectedMesa ? `Mesa ${selectedMesa.numero}` : 'Venda Rápida'}</span>
                      </div>
                      <button onClick={() => setIsCheckoutOpen(false)} style={{ background: '#222', border: 'none', color: '#fff', padding: '8px', borderRadius: '50%' }}><X size={18}/></button>
                   </div>
                   
                   <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }} className="d-flex flex-col gap-2">
                      {checkoutItens.map((item, i) => (
                        <div key={i} className="d-flex justify-between items-center p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
                           <div className="d-flex items-center gap-3">
                              <span style={{ fontWeight: 800, color: 'var(--primary-color)' }}>{item.quantidade}x</span>
                              <span style={{ fontWeight: 600 }}>{item.nome}</span>
                           </div>
                           <div className="d-flex items-center gap-4">
                              <span style={{ fontWeight: 700 }}>R$ {(item.preco * item.quantidade).toFixed(2)}</span>
                              {profile && (
                                <button 
                                  onClick={() => handleDeleteCheckoutItem(item)}
                                  style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', padding: '4px' }}
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                           </div>
                        </div>
                      ))}
                   </div>

                   {selectedMesa && (
                     <div className="card mb-4" style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)' }}>
                         <div className="d-flex justify-between items-center">
                            <div className="d-flex flex-col">
                               <span style={{ opacity: 0.6 }}>DIVIDIR CONTA POR:</span>
                               {dividirPor > 1 && (
                                 <span style={{ fontSize: '0.8rem', color: 'var(--primary-color)', fontWeight: 800 }}>
                                   VLR. INDIVIDUAL: R$ {(totalComTaxa / dividirPor).toFixed(2)}
                                 </span>
                               )}
                            </div>
                            <div className="d-flex items-center gap-3">
                               <button 
                                 onClick={() => {
                                   const next = Math.max(1, dividirPor-1);
                                   setDividirPor(next);
                                   if (next > 1) {
                                      setCustomAmount((totalComTaxa / next).toFixed(2));
                                   } else {
                                      setCustomAmount(totalComTaxa.toFixed(2));
                                   }
                                 }} 
                                 className="btn-outline" 
                                 style={{width: '30px', height: '30px', padding: 0}}
                               >
                                 -
                               </button>
                               <b>{dividirPor}</b>
                               <button 
                                 onClick={() => {
                                   const next = dividirPor + 1;
                                   setDividirPor(next);
                                   setCustomAmount((totalComTaxa / next).toFixed(2));
                                 }} 
                                 className="btn-outline" 
                                 style={{width: '30px', height: '30px', padding: 0}}
                               >
                                 +
                               </button>
                            </div>
                         </div>
                      </div>
                    )}
                    
                    {false && (
                      <div className="card mb-4" style={{ padding: '1rem', border: '1px solid var(--primary-color)', background: 'rgba(212, 175, 55, 0.05)' }}>
                         <h4 className="mb-3" style={{ fontSize: '0.8rem', color: 'var(--primary-color)' }}>DIVISÃO POR PESSOA</h4>
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', maxHeight: '200px', overflowY: 'auto', paddingRight: '5px' }}>
                            {splitPayments.map((p, idx) => (
                              <div key={idx} style={{ paddingBottom: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                 <div className="d-flex justify-between items-center mb-2">
                                    <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>PESSOA {idx+1}</span>
                                    <input 
                                       type="number" 
                                       value={p.amount.toFixed(2)} 
                                       onChange={(e) => {
                                          const newSplits = [...splitPayments];
                                          newSplits[idx].amount = parseFloat(e.target.value) || 0;
                                          setSplitPayments(newSplits);
                                       }}
                                       style={{ width: '80px', background: 'transparent', border: 'none', borderBottom: '1px solid #444', color: '#fff', textAlign: 'right', fontSize: '0.8rem', fontWeight: 700 }}
                                    />
                                 </div>
                                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                                    {['dinheiro', 'pix', 'debito', 'credito'].map(m => (
                                      <button 
                                        key={m}
                                        onClick={() => {
                                          const newSplits = [...splitPayments];
                                          newSplits[idx].method = m as PaymentMethod;
                                          setSplitPayments(newSplits);
                                        }}
                                        style={{ 
                                          fontSize: '0.55rem', 
                                          padding: '4px 2px', 
                                          background: p.method === m ? 'var(--primary-color)' : 'rgba(255,255,255,0.05)',
                                          color: p.method === m ? '#000' : '#fff',
                                          border: 'none',
                                          borderRadius: '4px',
                                          fontWeight: 800
                                        }}
                                      >
                                        {m.toUpperCase()}
                                      </button>
                                    ))}
                                 </div>
                              </div>
                            ))}
                         </div>
                         <button 
                           onClick={() => {
                             const completed = splitPayments.filter(s => s.method !== null);
                             if (completed.length === 0) {
                                alert("Selecione a forma de pagamento de pelo menos uma person!");
                                return;
                             }
                             const newPayments = [...pagamentos];
                             completed.forEach(s => {
                                newPayments.push({ method: s.method!, amount: s.amount });
                             });
                             setPagamentos(newPayments);
                             setDividirPor(1);
                             setSplitPayments([]);
                           }}
                           className="btn-primary w-full mt-4" 
                           style={{ fontSize: '0.7rem' }}
                         >
                           ADICIONAR PAGAMENTOS DA DIVISÃO
                         </button>
                      </div>
                    )}
                   <button className="btn-outline w-full p-4" onClick={() => handleImprimir(checkoutItens)}><Printer size={18} /> IMPRIMIR CONFERÊNCIA</button>
                </div>

                {/* Coluna Direita: Pagamentos */}
                <div style={{ background: '#111', padding: '1.2rem', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
                    <div className="mb-4">
                       <span style={{ fontSize: '0.7rem', opacity: 0.4 }}>VALOR TOTAL</span>
                       <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--primary-color)' }}>R$ {totalComTaxa.toFixed(2)}</div>
                    </div>

                    <div className="mb-4">
                        <label style={{ fontSize: '0.65rem', opacity: 0.4, display: 'block', marginBottom: '8px', fontWeight: 800 }}>MÉTODO DE PAGAMENTO</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginBottom: '1rem' }}>
                           {[
                             { id: 'dinheiro', label: 'DINHEIRO', color: '#10b981' },
                             { id: 'pix', label: 'PIX', color: 'var(--primary-color)' },
                             { id: 'debito', label: 'DÉBITO', color: '#fff' },
                             { id: 'credito', label: 'CRÉDITO', color: '#fff' }
                           ].map(m => (
                             <button 
                                key={m.id}
                                onClick={() => setSelectedMethod(m.id as PaymentMethod)}
                                className={selectedMethod === m.id ? 'btn-primary' : 'btn-outline'}
                                style={{ 
                                  padding: '0.5rem', 
                                  fontSize: '0.7rem', 
                                  fontWeight: 800,
                                  borderColor: selectedMethod === m.id ? m.color : 'rgba(255,255,255,0.1)',
                                  background: selectedMethod === m.id ? m.color : 'transparent',
                                  color: selectedMethod === m.id ? '#000' : m.color,
                                  transition: '0.2s'
                                }}
                             >
                               {m.label}
                             </button>
                           ))}
                        </div>

                        <div className="card" style={{ padding: '0.8rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                           <div className="d-flex justify-between items-center mb-1">
                              <div className="d-flex flex-col">
                                <label style={{ fontSize: '0.65rem', opacity: 0.4, display: 'block' }}>VALOR PARCIAL (R$)</label>
                                {dividirPor > 1 && (
                                  <span style={{ fontSize: '0.6rem', color: 'var(--primary-color)', fontWeight: 800 }}>
                                    PAGAMENTO {pagamentos.length + 1} DE {dividirPor}
                                  </span>
                                )}
                              </div>
                              {dividirPor > 1 && (
                                <button 
                                  onClick={() => setCustomAmount(valorIndividual.toFixed(2))}
                                  style={{ background: 'var(--primary-color)', border: 'none', color: '#000', fontSize: '0.6rem', fontWeight: 900, padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                  COTA INDIVIDUAL
                                </button>
                              )}
                           </div>
                           <input 
                             type="number" 
                             value={customAmount} 
                             onChange={e => setCustomAmount(e.target.value)} 
                             placeholder={suggestedAmount.toFixed(2)}
                             style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '2px solid #333', color: '#fff', padding: '0.2rem 0', marginBottom: '0.8rem', fontSize: '1.5rem', fontWeight: 900, outline: 'none' }} 
                           />

                           {selectedMethod === 'dinheiro' && (
                               <div className="mt-2 mb-4 p-3 rounded-lg" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                 <div className="d-flex justify-between items-center mb-2">
                                   <label style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 800 }}>VALOR RECEBIDO DO CLIENTE (R$)</label>
                                   {troco > 0 && (
                                     <div style={{ background: '#10b981', color: '#000', fontSize: '0.7rem', fontWeight: 900, padding: '2px 8px', borderRadius: '4px' }}>
                                       TROCO: R$ {troco.toFixed(2)}
                                     </div>
                                   )}
                                 </div>
                                 <input 
                                   type="number" 
                                   value={valorRecebido} 
                                   onChange={e => setValorRecebido(e.target.value)} 
                                   placeholder="0.00"
                                   style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid #10b981', color: '#fff', fontSize: '1.2rem', fontWeight: 800, outline: 'none' }}
                                 />
                               </div>
                             )}
                           
                           <button 
                             onClick={() => {
                               if (!selectedMethod) {
                                  alert("Selecione um método de pagamento primeiro!");
                                  return;
                               }
                               const val = parseFloat(customAmount) || suggestedAmount;
                               handleAddPayment(selectedMethod, val);
                             }}
                             disabled={!selectedMethod}
                             className="btn-primary w-full"
                             style={{ opacity: selectedMethod ? 1 : 0.5 }}
                           >
                             ADICIONAR PAGAMENTO
                           </button>
                        </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
                       <label style={{ fontSize: '0.65rem', opacity: 0.4, display: 'block', marginBottom: '8px' }}>PAGAMENTOS RECEBIDOS</label>
                       {pagamentos.map((p, i) => (
                         <div key={i} className="d-flex justify-between items-center p-2 rounded-lg mb-2" style={{ background: 'rgba(255,255,255,0.05)', borderLeft: `4px solid ${p.method === 'dinheiro' ? '#10b981' : 'var(--primary-color)'}` }}>
                            <div className="d-flex flex-col">
                              <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>{p.method.toUpperCase()}</span>
                            </div>
                            <div className="d-flex items-center gap-3">
                              <b style={{ fontSize: '0.9rem' }}>R$ {p.amount.toFixed(2)}</b>
                              <button 
                                onClick={() => handleRemovePayment(i)} 
                                style={{ background: 'rgba(220, 53, 69, 0.1)', border: 'none', color: 'var(--danger-color)', padding: '5px', borderRadius: '4px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                         </div>
                       ))}
                       {pagamentos.length === 0 && <div style={{ textAlign: 'center', opacity: 0.3, padding: '1rem', border: '1px dashed #333', borderRadius: '8px', fontSize: '0.7rem' }}>Aguardando...</div>}
                    </div>

                    <div className="pt-4" style={{ borderTop: '1px solid #222' }}>
                        <div className="d-flex justify-between items-center mb-4">
                           <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>RESTANTE</span>
                           <div style={{ fontSize: '1.5rem', fontWeight: 900, color: totalRestante > 0 ? 'var(--danger-color)' : 'var(--success-color)' }}>
                             R$ {totalRestante.toFixed(2)}
                           </div>
                        </div>

                        <button 
                           onClick={handleFinalizar}
                           className="btn-primary w-full py-4" 
                           style={{ 
                             fontSize: '1rem', 
                             fontWeight: 900,
                             background: totalRestante <= 0.1 ? 'var(--success-color)' : '#222',
                             color: totalRestante <= 0.1 ? '#000' : '#444'
                           }}
                        >
                           {totalRestante <= 0.1 ? 'FINALIZAR VENDA' : 'PAGAMENTO PENDENTE'}
                        </button>
                    </div>
                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Detalhes do Pedido (Histórico) */}
      <AnimatePresence>
        {isDetailModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" onClick={() => setIsDetailModalOpen(false)}>
             <motion.div initial={{ y: 20 }} animate={{ y: 0 }} className="card" style={{ maxWidth: '500px', width: '90%' }} onClick={e => e.stopPropagation()}>
                <div className="d-flex justify-between mb-4">
                   <h3>DETALHES DO PEDIDO</h3>
                   <button onClick={() => setIsDetailModalOpen(false)}><X/></button>
                </div>
                <div className="mb-4">
                   <div style={{fontSize: '0.8rem', opacity: 0.6}}>FORMA DE PAGAMENTO:</div>
                   <div style={{fontWeight: 700}}>{selectedPedidoDetail?.forma_pagamento}</div>
                </div>
                <div className="d-flex flex-col gap-2">
                   {itemsPedidoDetail.map((item: any, idx) => (
                      <div key={idx} className="d-flex justify-between p-2 rounded" style={{background: 'rgba(255,255,255,0.05)'}}>
                         <span>{item.quantidade}x {item.produtos?.nome}</span>
                         <span>R$ {(item.preco_unitario * item.quantidade).toFixed(2)}</span>
                      </div>
                   ))}
                </div>
                <div className="mt-4 pt-4 text-right" style={{borderTop: '1px solid #333'}}>
                   <div style={{fontSize: '0.8rem', opacity: 0.6}}>TOTAL:</div>
                   <div style={{fontSize: '1.5rem', fontWeight: 900, color: 'var(--primary-color)'}}>R$ {Number(selectedPedidoDetail?.total).toFixed(2)}</div>
                </div>
                <button className="btn-outline w-full mt-6" onClick={() => handleImprimir(itemsPedidoDetail)}>IMPRIMIR SEGUNDA VIA</button>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
