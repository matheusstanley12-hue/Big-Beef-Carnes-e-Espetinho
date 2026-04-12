import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useCartStore } from '../store/cartStore';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Trash2 } from 'lucide-react';
import { OwnerViewBanner } from '../components/OwnerViewBanner';
import { Caixa } from './CashierApp';

export const Garcom = () => {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<'atendimento' | 'caixa'>('atendimento');
  const [mesas, setMesas] = useState<any[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [itensPedido, setItensPedido] = useState<any[]>([]);
  const [lastNotificationIds, setLastNotificationIds] = useState<Set<string>>(new Set());
  
  const [selectedMesa, setSelectedMesa] = useState<any | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('TODOS');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [targetMesaId, setTargetMesaId] = useState<string>('');
  
  const { items, addItem, removeItem, clearCart, checkout } = useCartStore();
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const fetchData = async () => {
    try {
      const { data: mesasData } = await supabase.from('mesas').select('*').order('numero', { ascending: true });
      const { data: pedidosData } = await supabase.from('pedidos').select('id, mesa_id, status, total').neq('status', 'finalizado');
      const { data: prodsData } = await supabase.from('produtos').select('*').order('categoria', { ascending: true });
      
      if (mesasData) setMesas(mesasData);
      if (pedidosData) {
        setPedidos(pedidosData);
        const activeIds = pedidosData.map(p => p.id);
        if (activeIds.length > 0) {
          const { data: allItens } = await supabase.from('itens_pedido')
            .select('*, produtos(nome, categoria)')
            .in('pedido_id', activeIds);
          if (allItens) setItensPedido(allItens);
        } else {
          setItensPedido([]);
        }
      }
      if (prodsData) setProdutos(prodsData);
    } catch (err) {
      console.error("Fetch Data Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    
    // Realtime subscription for products (stock/price updates)
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'produtos' }, 
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (selectedMesa) {
      const updated = mesas.find(m => m.id === selectedMesa.id);
      if (updated) setSelectedMesa(updated);
    }
  }, [mesas]);

  const [monitoringActive, setMonitoringActive] = useState(() => {
    return localStorage.getItem('garcom_monitoring_active') === 'true';
  });

  useEffect(() => {
    if (!monitoringActive || activeView !== 'atendimento') return;

    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) {
        console.error('Wake Lock error:', err);
      }
    };
    requestWakeLock();

    return () => {
      if (wakeLock !== null) wakeLock.release().catch(console.error);
    };
  }, [monitoringActive, activeView]);

  useEffect(() => {
    if (!monitoringActive || activeView !== 'atendimento') return;

    const precisaGarcom = mesas.some(m => m.precisaGarcom || m.precisa_garcom);
    const novosItensProntos = itensPedido.filter(i => i.status === 'pronto' && !lastNotificationIds.has(i.id));
    const temPedidoPronto = novosItensProntos.length > 0;
    
    if (precisaGarcom || temPedidoPronto) {
      const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
      audio.volume = 0.5;
      audio.play().catch(() => {});
      if (navigator.vibrate) navigator.vibrate([500, 200, 500]);

      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification("🚨 ATENÇÃO!", {
            body: precisaGarcom ? "Mesa chamando atendimento!" : "Pedido pronto no balcão!",
            icon: "/logo.png"
          } as any);
        } catch (err) {
          console.error("Notifications error", err);
        }
      }

      if (temPedidoPronto) {
        const newIds = new Set(lastNotificationIds);
        novosItensProntos.forEach(i => newIds.add(i.id));
        setLastNotificationIds(newIds);
      }
    }
  }, [mesas, itensPedido, monitoringActive, activeView]);

  const startMonitoring = async () => {
    localStorage.setItem('garcom_monitoring_active', 'true');
    setMonitoringActive(true);
    if ('Notification' in window && Notification.permission !== 'granted') {
      try {
        await Notification.requestPermission();
      } catch (e) {}
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'livre') return 'var(--success-color)';
    if (status === 'aguardando conta') return 'var(--warning-color)';
    return 'var(--danger-color)';
  };

  const handleEntregarPedido = async (itemId: string) => {
    await supabase.from('itens_pedido').update({ status: 'entregue' }).eq('id', itemId);
    fetchData();
  };

  const handleExcluirItem = async (itemId: string, item: any) => {
    const categoriasCriticas = ['PETISCO', 'PETISCOS', 'COZINHA', 'COQUETÉIS', 'COQUETEIS', 'COQUITEIS'];
    const categoriaItem = (item.produtos?.categoria || '').toUpperCase();
    const ehGestor = profile?.role === 'dono' || profile?.role === 'admin';

    if (item.status === 'pronto' && !ehGestor) {
      alert(`⚠️ BLOQUEADO: Item pronto.`);
      return;
    }
    if (categoriasCriticas.includes(categoriaItem) && item.status !== 'pendente' && !ehGestor) {
      alert(`⚠️ BLOQUEADO: Item em preparo.`);
      return;
    }
    if(!confirm(`Deseja excluir "${item.produtos?.nome}"?`)) return;
    
    const { error: deleteError } = await supabase.from('itens_pedido').delete().eq('id', itemId);
    if (deleteError) {
      alert("Erro ao excluir item.");
      return;
    }
    const { data: currentPedido } = await supabase.from('pedidos').select('total').eq('id', item.pedido_id).single();
    if (currentPedido) {
      const novoTotal = Math.max(0, Number(currentPedido.total) - (Number(item.preco_unitario) * item.quantidade));
      await supabase.from('pedidos').update({ total: novoTotal }).eq('id', item.pedido_id);
    }
    fetchData();
  };

  const handleAbrirMesa = async (mesaId: string) => {
    await supabase.from('pedidos').update({ status: 'finalizado' }).eq('mesa_id', mesaId).neq('status', 'finalizado');
    await supabase.from('mesas').update({ status: 'ocupada' }).eq('id', mesaId);
    fetchData();
  };

  const handleLiberarMesa = async (mesaId: string) => {
    if (!confirm("Liberar mesa vazia?")) return;
    await supabase.from('mesas').update({ status: 'livre', precisa_garcom: false }).eq('id', mesaId);
    setSelectedMesa(null);
    fetchData();
  };

  const handleAtenderChamado = async (mesaId: string) => {
    await supabase.from('mesas').update({ precisa_garcom: false }).eq('id', mesaId);
    fetchData();
  };

  const handleCancelarFechamento = async (mesaId: string) => {
    if(!confirm("Cancelar pedido de conta e voltar para ocupada?")) return;
    try {
      await supabase.from('mesas').update({ status: 'ocupada', precisa_garcom: false }).eq('id', mesaId);
      alert("Mesa voltou para status Ocupada!");
      fetchData();
      setSelectedMesa(null);
    } catch (err) {
      alert("Erro ao cancelar fechamento.");
    }
  };

  const handlePedirConta = async (mesaId: string) => {
    const mesaItens = (itensPedido || []).filter(i => {
       const p = (pedidos || []).find(ped => ped.id === i.pedido_id);
       return p && p.mesa_id === mesaId;
    });
    if (mesaItens.length === 0) {
      if(!confirm("Sem itens. Pedir conta?")) return;
    }
    if(!confirm("Pedir conta ao caixa?")) return;
    try {
      await supabase.from('mesas').update({ status: 'aguardando conta' }).eq('id', mesaId);
      alert("Sucesso!");
      fetchData();
      setSelectedMesa(null);
    } catch (err) {
      alert("Erro.");
    }
  };

  const handleTransferMesa = async () => {
    if (!targetMesaId || !selectedMesa) return;
    if(!confirm("Transferir mesa?")) return;
    await supabase.from('pedidos').update({ mesa_id: targetMesaId }).eq('mesa_id', selectedMesa.id).neq('status', 'finalizado');
    await supabase.from('mesas').update({ status: 'livre', precisa_garcom: false }).eq('id', selectedMesa.id);
    await supabase.from('mesas').update({ status: selectedMesa.status, precisa_garcom: selectedMesa.precisa_garcom }).eq('id', targetMesaId);
    alert(`Transferido!`);
    setShowTransferModal(false);
    setTargetMesaId('');
    setSelectedMesa(null);
    fetchData();
  };

  const currentCartTotal = items.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);

  const handleLaunchOrder = async () => {
    if (items.length === 0) return;
    setIsCheckingOut(true);
    const success = await checkout(selectedMesa.id, profile?.id);
    if (success) {
      alert("Pedido enviado!");
      setShowAddMenu(false);
      fetchData();
    } else {
      alert("Erro.");
    }
    setIsCheckingOut(false);
  };

  const filteredProdutosAtendimento = useMemo(() => {
    const normalizeStr = (s: string) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const searchLower = normalizeStr(searchTerm);
    return produtos.filter(p => {
        const pCat = (p.categoria || "GERAL").toUpperCase();
        const matchesSearch = normalizeStr(p.nome).includes(searchLower) || normalizeStr(pCat).includes(searchLower);
        const matchesCategory = activeCategory === 'TODOS' || pCat === activeCategory;
        return searchTerm ? matchesSearch : matchesCategory;
    });
  }, [produtos, searchTerm, activeCategory]);

  if (loading) return <div className="container text-center" style={{padding: '5rem'}}><p>Carregando...</p></div>;

  const currentMesaPedidos = selectedMesa ? pedidos.filter(p => p.mesa_id === selectedMesa.id) : [];
  const currentMesaTotal = currentMesaPedidos.reduce((acc, p) => acc + (Number(p.total) || 0), 0);

  return (
    <div className="container animate-fade-in" style={{ paddingBottom: '2rem' }}>
      <OwnerViewBanner panelName="Garçom" />
      
      {/* HEADER DE NAVEGAÇÃO PERMANENTE */}
      <header className="d-flex justify-between items-center mb-6" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
        <div className="d-flex gap-4">
          <button 
            onClick={() => setActiveView('atendimento')}
            style={{ padding: '8px 20px', borderRadius: '10px', background: activeView === 'atendimento' ? 'var(--primary-color)' : 'rgba(255,255,255,0.05)', color: activeView === 'atendimento' ? '#000' : '#fff', border: 'none', fontWeight: 800, cursor: 'pointer' }}
          >
            🏠 Atendimento
          </button>
          <button 
            onClick={() => navigate('/caixa')}
            style={{ padding: '8px 20px', borderRadius: '10px', background: activeView === 'caixa' ? 'var(--primary-color)' : 'rgba(255,255,255,0.05)', color: activeView === 'caixa' ? '#000' : '#fff', border: 'none', fontWeight: 800, cursor: 'pointer' }}
          >
            📊 Caixa
          </button>
        </div>
        <button onClick={() => signOut()} style={{ color: 'var(--danger-color)', background: 'none', border: 'none', cursor: 'pointer' }}><LogOut size={24} /></button>
      </header>

      {activeView === 'caixa' ? (
        <Caixa isEmbedded={true} />
      ) : (
        <>
          {selectedMesa ? (
            <div className="animate-fade-in" style={{ paddingBottom: '10rem' }}>
              <header className="d-flex justify-between items-center mb-6">
                <button onClick={() => { setSelectedMesa(null); setShowAddMenu(false); clearCart(); setSearchTerm(''); }} className="btn-outline" style={{ width: 'auto', padding: '0.4rem 0.8rem' }}>&larr; Voltar</button>
                <h2 className="page-title" style={{ margin: 0, border: 'none' }}>Mesa {selectedMesa.numero}</h2>
                <span style={{ fontSize: '0.8rem', padding: '4px 12px', borderRadius: '12px', background: `${getStatusColor(selectedMesa.status)}33`, color: getStatusColor(selectedMesa.status), fontWeight: 'bold' }}>
                  {selectedMesa.status}
                </span>
              </header>

              {selectedMesa.status === 'livre' ? (
                <div className="card text-center" style={{ padding: '3rem 1rem' }}>
                  <button className="btn-success" onClick={() => handleAbrirMesa(selectedMesa.id)} style={{ fontSize: '1.2rem', padding: '1rem' }}>Abrir Mesa Agora</button>
                </div>
              ) : (
                <>
                  {showTransferModal && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                      <div className="card w-100" style={{ padding: '2rem', maxWidth: '400px' }}>
                        <h4 className="mb-4">Transferir mesa?</h4>
                        <select value={targetMesaId} onChange={(e) => setTargetMesaId(e.target.value)} className="input-field" style={{ marginBottom: '1.5rem' }}>
                          <option value="">Selecione...</option>
                          {mesas.filter(m => m.status === 'livre').map(m => (
                            <option key={m.id} value={m.id}>Mesa {m.numero}</option>
                          ))}
                        </select>
                        <div className="d-flex gap-3">
                          <button className="btn-outline" onClick={() => setShowTransferModal(false)} style={{ flex: 1 }}>Sair</button>
                          <button className="btn-warning" onClick={handleTransferMesa} style={{ flex: 1 }}>Confirmar</button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="d-flex justify-between items-center mb-4">
                    <div>
                        <h3 style={{ margin: 0 }}>Comanda</h3>
                        <div className="text-muted">Total: R$ {currentMesaTotal.toFixed(2)}</div>
                    </div>
                    <div className="d-flex gap-2">
                      <button className="btn-outline" onClick={() => setShowTransferModal(true)} style={{ width: 'auto' }}>⇄</button>
                      <button className="btn-primary" onClick={() => setShowAddMenu(!showAddMenu)} style={{ width: 'auto' }}>{showAddMenu ? 'Ver' : '✚'}</button>
                    </div>
                  </div>

                  {showAddMenu ? (
                    <div className="card">
                      {items.length > 0 && (
                        <div style={{ padding: '1rem', borderBottom: '2px solid var(--border-color)', backgroundColor: 'rgba(212, 175, 55, 0.1)' }}>
                          {items.map(it => (
                            <div key={it.id} className="d-flex justify-between items-center mb-2">
                              <span>{it.quantidade}x {it.nome}</span>
                              <div className="d-flex gap-2">
                                  <button className="btn-outline" style={{width: 'auto', padding: '4px 8px'}} onClick={() => removeItem(it.id)}>-</button>
                                  <button className="btn-success" style={{width: 'auto', padding: '4px 8px'}} onClick={() => addItem(it)}>+</button>
                              </div>
                            </div>
                          ))}
                          <button className="btn-success mt-4" onClick={handleLaunchOrder} disabled={isCheckingOut}>Lançar (R$ {currentCartTotal.toFixed(2)})</button>
                        </div>
                      )}
                      <div style={{ padding: '1rem' }}>
                        <div className="mb-4">
                          <input 
                            type="text" 
                            placeholder="🔍 Pesquisar item..." 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            className="input-field"
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '10px' }}
                          />
                        </div>
                        <select value={activeCategory} onChange={(e) => { setActiveCategory(e.target.value); setSearchTerm(''); }} className="input-field mb-4" style={{ borderRadius: '10px' }}>
                          <option value="TODOS">Todas Categorias</option>
                          {Array.from(new Set(produtos.map(p => (p.categoria || "GERAL").toUpperCase()))).map(cat => (
                            <option key={cat as string} value={cat as string}>{cat}</option>
                          ))}
                        </select>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          {filteredProdutosAtendimento.map(p => (
                             <div key={p.id} onClick={() => p.estoque > 0 && addItem(p)} className="card text-center" style={{ padding: '0.5rem', opacity: p.estoque > 0 ? 1 : 0.5, cursor: 'pointer' }}>
                               <div style={{fontSize: '0.8rem', fontWeight: 600}}>{p.nome}</div>
                               <div style={{ color: 'var(--primary-color)', fontSize: '0.9rem' }}>R$ {p.preco.toFixed(2)}</div>
                             </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="card d-flex flex-col gap-1">
                        {currentMesaPedidos.map(pedido => (
                          <div key={pedido.id} style={{ padding: '0.75rem', borderLeft: '3px solid var(--primary-color)', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', marginBottom: '8px' }}>
                            {itensPedido.filter(i => i.pedido_id === pedido.id).map(item => (
                              <div key={item.id} className="d-flex justify-between items-center mb-2">
                                  <span>{item.quantidade}x {item.produtos?.nome}</span>
                                  <button onClick={() => handleExcluirItem(item.id, item)} style={{ color: 'var(--danger-color)', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={16}/></button>
                              </div>
                            ))}
                          </div>
                        ))}
                        {currentMesaPedidos.length === 0 && <p className="text-center text-muted p-4">Nenhum item lançado.</p>}
                      </div>
                      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '1rem', background: 'var(--surface-color)', zIndex: 100, borderTop: '1px solid var(--border-color)', display: 'flex', gap: '1rem' }}>
                        {currentMesaPedidos.length === 0 && selectedMesa.status === 'ocupada' ? (
                          <button className="btn-danger" onClick={() => handleLiberarMesa(selectedMesa.id)} style={{ flex: 1, padding: '1rem', fontWeight: 800 }}>
                            LIBERAR MESA
                          </button>
                        ) : (
                          <button className="btn-warning" onClick={() => handlePedirConta(selectedMesa.id)} disabled={selectedMesa.status === 'aguardando conta'} style={{ flex: 2, padding: '1rem', fontWeight: 800 }}>
                            {selectedMesa.status === 'aguardando conta' ? 'FECHAMENTO SOLICITADO' : 'SOLICITAR FECHAMENTO'}
                          </button>
                        )}
                        {selectedMesa.status === 'aguardando conta' && (
                          <button className="btn-danger" onClick={() => handleCancelarFechamento(selectedMesa.id)} style={{ flex: 1, padding: '1rem', fontWeight: 800 }}>
                             CANCELAR
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          ) : (
            <>
              {!monitoringActive && (
                <div className="card mb-6 text-center" style={{background: 'rgba(212,175,55,0.1)', border: '1px solid var(--primary-color)'}}>
                  <p className="mb-4">Ative os alertas para receber notificações de chamados e pedidos prontos.</p>
                  <button onClick={startMonitoring} className="btn-primary" style={{width: 'auto', padding: '8px 20px'}}>Ativar Alertas 🔔</button>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '1rem' }}>
                {mesas.map(mesa => (
                  <div key={mesa.id} onClick={() => setSelectedMesa(mesa)} className="card text-center" style={{ borderTop: `4px solid ${getStatusColor(mesa.status)}`, cursor: 'pointer' }}>
                    <h2 style={{ fontSize: '2.5rem', margin: '0.5rem 0' }}>{mesa.numero}</h2>
                    <span style={{fontSize: '0.7rem', fontWeight: 700, opacity: 0.7, textTransform: 'uppercase'}}>{mesa.status}</span>
                    {mesa.precisa_garcom && (
                      <div className="mt-4">
                        <button onClick={(e) => { e.stopPropagation(); handleAtenderChamado(mesa.id); }} className="btn-danger p-2" style={{fontSize: '0.7rem', animation: 'pulse 1s infinite'}}>ATENDER CHAMADO</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};
