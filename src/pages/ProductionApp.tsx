import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Printer } from 'lucide-react';
import { OwnerViewBanner } from '../components/OwnerViewBanner';
import { printPetiscoTicket } from '../utils/printUtils';

// Helper view based on DB
interface KDSItem {
  id: string; // item_pedido.id
  pedido_id: string;
  produto_nome: string;
  quantidade: number;
  categoria: string;
  status: string; // pendente, em preparo, pronto
  mesa: number;
}

export const Producao = () => {
  const { signOut } = useAuth();
  const [items, setItems] = useState<KDSItem[]>([]);
  const [filter, setFilter] = useState<'cozinha' | 'bar'>('cozinha');

  const fetchActiveItems = async () => {
    // Busca itens de pedidos que estão nas fases iniciais (pendente ou em preparo)
    const { data: itens, error } = await supabase
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

    if (itens) {
       const formatted = itens.map((i: any) => ({
         id: i.id,
         pedido_id: i.pedido_id,
         produto_nome: i.produtos.nome,
         categoria: i.produtos.categoria,
         quantidade: i.quantidade,
         status: i.status,
         mesa: i.pedidos?.mesas?.numero || 0,
         data_hora: i.pedidos?.data_hora
       }));
       // Ordenar por data_hora ASC (Antigos primeiro, último é o mais recente)
       formatted.sort((a: any, b: any) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime());
       setItems(formatted);
    }
  };

  useEffect(() => {
    fetchActiveItems();
    const interval = setInterval(fetchActiveItems, 5000);
    return () => clearInterval(interval);
  }, []);

  // Auto-impressão DESATIVADA - usar botão de impressora manual em cada item
  // useEffect(() => { ... }, [items]);

  const handleStatusChange = async (itemId: string) => {
      // Vai direto para pronto (Aceite automático)
      const nextStatus = 'pronto';
      const updates: any = { 
        status: nextStatus,
        preparo_fim_at: new Date().toISOString()
      };
      
      const { error } = await supabase.from('itens_pedido').update(updates).eq('id', itemId);
      if (!error) fetchActiveItems();
  };

  const CATS_COZINHA = [
    'PETISCO', 'PETISCOS', 'LANCHES', 'LANCHE', 'PORÇÕES', 'PORCOES', 
    'PORÇÃO', 'PORCAO', 'COZINHA', 'PRATOS', 'PRATO', 'REFEIÇÕES', 
    'REFEICOES', 'ENTRADAS', 'SOBREMESAS', 'SOBREMESA', 'PIZZA', 'BURGER',
    'BEBIDAS', 'BEBIDA', 'CHOPP', 'CERVEJA', 'OUTROS'
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

  const visibleItems = items.filter(item => {
    const cat = (item.categoria || '').toUpperCase();
    const nome = (item.produto_nome || '').trim().toLowerCase();

    if (filter === 'cozinha') {
      return CATS_COZINHA.includes(cat);
    }
    if (filter === 'bar') {
      return CATS_BAR.includes(cat) || NAMES_BAR_FALLBACK.includes(nome);
    }
    return false;
  });

  const pendentesCozinha = items.filter(i => {
    const cat = (i.categoria || '').toUpperCase();
    return i.status === 'pendente' && CATS_COZINHA.includes(cat);
  }).length;
  
  const pendentesBar = items.filter(i => {
    const cat = (i.categoria || '').toUpperCase();
    const nome = (i.produto_nome || '').trim().toLowerCase();
    const isPendente = i.status === 'pendente';
    return isPendente && (CATS_BAR.includes(cat) || NAMES_BAR_FALLBACK.includes(nome));
  }).length;


  const [monitoringActive, setMonitoringActive] = useState(false);

  // Wake Lock
  useEffect(() => {
    if (!monitoringActive) return;
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
  }, [monitoringActive]);

  // Alertas visuais e vibração
  useEffect(() => {
    if (!monitoringActive) return;
    const hasPendente = visibleItems.some(i => i.status === 'pendente');

    if (hasPendente) {
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification("🚨 NOVO PEDIDO!", {
            body: "O pedido precisa ser aceito.",
            icon: "/logo.png",
            vibrate: [500, 200, 500]
          } as any);
        } catch (err) {
          console.error("Notifications are not supported in this context.", err);
        }
      }


      if (navigator.vibrate) {
        navigator.vibrate([500, 200, 500]);
      }
    }
  }, [visibleItems, monitoringActive]);

  const startMonitoring = () => {
    if ('Notification' in window) {
      Notification.requestPermission();
    }
    setMonitoringActive(true);
  };

  return (
    <div className="container animate-fade-in" style={{ paddingBottom: '8rem' }}>
      <OwnerViewBanner panelName="Cozinha / Bar" />
      <header className="d-flex justify-between items-center flex-col-mobile" style={{ marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/logo.png" alt="Logo" style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'contain', border: '1px solid var(--primary-color)' }} />
          <h2 className="page-title" style={{ margin: 0, border: 'none' }}>Produção (KDS)</h2>
        </div>
        <div className="d-flex gap-3 w-full-mobile">
          <Link to="/" className="btn-outline" style={{ flex: 1, textAlign: 'center', padding: '0.5rem 1rem' }}>Voltar</Link>
          <button 
            onClick={() => signOut()} 
            style={{ 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              color: 'var(--danger-color)',
              background: 'rgba(239, 63, 94, 0.1)',
              borderRadius: '8px',
              padding: '0.5rem 1rem',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              flex: 1
            }}
          >
            <LogOut size={20} />
            <span>Sair</span>
          </button>
        </div>
      </header>

      {!monitoringActive && (
        <div className="card mb-8" style={{ backgroundColor: 'rgba(212, 175, 55, 0.1)', border: '1px solid var(--primary-color)', textAlign: 'center' }}>
          <h4 style={{ color: 'var(--primary-color)', marginBottom: '0.5rem' }}>Monitoramento de Pedidos</h4>
          <p className="text-muted mb-4" style={{ fontSize: '0.85rem' }}>Ative para receber notificações visuais/vibração e proibir a tela de apagar:</p>
          <button onClick={startMonitoring} className="btn-primary" style={{ width: 'auto', padding: '0.8rem 2rem' }}>
            🔔 Ativar Alertas e Radar
          </button>
        </div>
      )}

      <div className="d-flex gap-4 flex-col-mobile" style={{ marginBottom: '2rem' }}>
        <button 
          className="btn-outline w-full-mobile" 
          style={{ 
            position: 'relative',
            backgroundColor: filter === 'cozinha' ? 'var(--primary-color)' : 'transparent', 
            color: filter === 'cozinha' ? '#000' : 'var(--primary-color)',
            padding: '1rem 2rem',
            fontSize: '1.1rem',
            fontWeight: 700,
            flex: 1
          }}
          onClick={() => setFilter('cozinha')}
        >
          🍳 Cozinha
          {pendentesCozinha > 0 && (
            <span style={{ position: 'absolute', top: '-10px', right: '-10px', background: 'var(--danger-color)', color: 'white', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', border: '2px solid #000', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>
              {pendentesCozinha}
            </span>
          )}
        </button>
        <button 
          className="btn-outline w-full-mobile" 
          style={{ 
            position: 'relative',
            backgroundColor: filter === 'bar' ? 'var(--primary-color)' : 'transparent', 
            color: filter === 'bar' ? '#000' : 'var(--primary-color)',
            padding: '1rem 2rem',
            fontSize: '1.1rem',
            fontWeight: 700,
            flex: 1
          }}
          onClick={() => setFilter('bar')}
        >
          🍹 Coquetéis
          {pendentesBar > 0 && (
            <span style={{ position: 'absolute', top: '-10px', right: '-10px', background: 'var(--danger-color)', color: 'white', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', border: '2px solid #000', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>
              {pendentesBar}
            </span>
          )}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
        {visibleItems.length === 0 ? (
          <p className="text-muted">Nenhum pedido pendente nesta área.</p>
        ) : (
          visibleItems.map(item => (
            <div key={item.id} className="card" style={{ borderLeft: '6px solid var(--danger-color)', padding: '1.5rem' }}>
              <div className="d-flex justify-between items-center mb-4" style={{ background: 'rgba(212, 175, 55, 0.1)', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(212, 175, 55, 0.2)' }}>
                <span style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--primary-color)' }}>MESA {item.mesa}</span>
                <div className="d-flex flex-col items-end">
                   <span style={{ color: item.status === 'pendente' ? 'var(--danger-color)' : 'var(--warning-color)', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>{item.status}</span>
                   <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>#{item.id.slice(0,4)}</span>
                </div>
              </div>
              <h2 style={{ margin: '1rem 0', fontSize: '1.5rem', fontWeight: 800 }}>{item.quantidade}x {item.produto_nome}</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Sessão: {item.categoria}</p>
              
              <div className="d-flex gap-2">
                <button 
                  className="btn-outline" 
                  style={{ padding: '0.5rem 0.8rem', flexShrink: 0 }}
                  title="Reimprimir comanda"
                  onClick={() => printPetiscoTicket(
                    item.mesa.toString(),
                    'Cozinha',
                    [item.pedido_id],
                    [{ qtd: item.quantidade, nome: item.produto_nome }]
                  )}
                >
                  <Printer size={18} />
                </button>
                <button className="btn-success w-full" style={{ padding: '0.5rem' }} onClick={() => handleStatusChange(item.id)}>Marcar Pronto</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
