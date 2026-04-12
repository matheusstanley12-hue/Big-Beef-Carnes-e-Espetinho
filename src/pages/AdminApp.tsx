import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LogOut, Package, LayoutGrid, Users as UsersIcon,
  FileText, Plus, Minus, Trash2, Star,
  TrendingUp, AlertTriangle, CheckCircle, Clock,
  BarChart2, Settings, ChevronDown, ChevronUp, Search,
  QrCode, Link as LinkIcon, X, ShoppingBag, Utensils, Lock
} from 'lucide-react';
import { OwnerViewBanner } from '../components/OwnerViewBanner';
import { FechamentoCaixa } from '../components/FechamentoCaixa';

type AdminTab = 'dashboard' | 'estoque' | 'mesas' | 'equipe' | 'avaliacoes' | 'entregues' | 'fechamento';


const ROLE_LABELS: Record<string, string> = {
  garcom: 'Garçom', caixa: 'Caixa', cozinha: 'Cozinha',
  admin: 'Administrador', dono: 'Proprietário'
};

const ROLE_COLORS: Record<string, string> = {
  garcom: '#3b82f6', caixa: '#10b981', cozinha: '#f59e0b',
  admin: '#8b5cf6', dono: 'var(--primary-color)'
};

const StatCard = ({ icon, label, value, sub, color }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
    className="card" style={{ padding: '1.5rem', borderLeft: `4px solid ${color}`, display: 'flex', alignItems: 'center', gap: '1.2rem' }}
  >
    <div style={{ background: `${color}22`, borderRadius: '12px', padding: '12px', display: 'flex' }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: '0.65rem', opacity: 0.5, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '2rem', fontWeight: 900, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.75rem', color, fontWeight: 600, marginTop: '2px' }}>{sub}</div>}
    </div>
  </motion.div>
);

const StockBar = ({ value }: { value: number }) => {
  const pct = Math.min(100, (value / 100) * 100);
  const color = value <= 0 ? '#ef4444' : value < 10 ? '#f59e0b' : '#10b981';
  return (
    <div style={{ width: '80px', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '3px', transition: 'width 0.5s' }} />
    </div>
  );
};

export const Administracao = () => {
  const { signOut, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [loading, setLoading] = useState(true);

  // Data
  const [produtos, setProdutos] = useState<any[]>([]);
  const [mesas, setMesas] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<any[]>([]);
  const [pedidosAtivos, setPedidosAtivos] = useState<any[]>([]);
  const [itensEntregues, setItensEntregues] = useState<any[]>([]);
  const [selectedMesaComanda, setSelectedMesaComanda] = useState<any>(null);
  const [historicoVendas, setHistoricoVendas] = useState<any[]>([]);


  // UI state
  const [stockSearch, setStockSearch] = useState('');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [expandedProduto, setExpandedProduto] = useState<string | null>(null);
  const [itemParaExcluir, setItemParaExcluir] = useState<any>(null); // Ponto de auditoria
  const [motivoExclusao, setMotivoExclusao] = useState('');
  const [isExcluindo, setIsExcluindo] = useState(false);

  const filteredProdutos = useMemo(() => {
    const normalizeStr = (s: string) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const searchLower = normalizeStr(stockSearch);
    return produtos.filter(p => {
      const matchesSearch = normalizeStr(p.nome).includes(searchLower) || normalizeStr(p.categoria).includes(searchLower);
      return stockSearch ? matchesSearch : true;
    });
  }, [produtos, stockSearch]);

  const fetchData = async () => {
    const [pRes, mRes, uRes, pedRes, avRes, itemsEntRes] = await Promise.all([
      supabase.from('produtos').select('*').order('categoria'),
      supabase.from('mesas').select('*').order('numero'),
      supabase.from('profiles').select('*').not('role', 'eq', 'dono').order('role', { ascending: true }),
      supabase.from('pedidos').select('*, mesas(numero), itens_pedido(*, produtos(nome, categoria))').neq('status', 'finalizado'),
      supabase.from('avaliacoes').select('*').order('created_at', { ascending: false }),
      supabase.from('itens_pedido').select('*, produtos(nome), pedidos(id, mesas(numero))').eq('status', 'entregue')
    ]);

    setProdutos(pRes.data || []);
    setMesas(mRes.data || []);
    setUsuarios(uRes.data || []);
    setPedidosAtivos(pedRes.data || []);
    setAvaliacoes(avRes.data || []);
    setItensEntregues(itemsEntRes.data || []);

    // Identificar turno ativo para filtrar histórico
    const { data: activeTurno } = await supabase
      .from('turnos_caixa')
      .select('id')
      .eq('status', 'aberto')
      .order('aberto_em', { ascending: false })
      .limit(1)
      .single();

    // Histórico (Filtrar por turno ativo se houver, caso contrário últimas 24 horas)
    let qHist = supabase.from('pedidos')
      .select('*, profiles:garcom_id(full_name), mesas(numero)')
      .eq('status', 'finalizado');

    if (activeTurno) {
      qHist = qHist.eq('turno_id', activeTurno.id);
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      qHist = qHist.gte('finalizado_at', today.toISOString());
    }

    const { data: historico } = await qHist.order('finalizado_at', { ascending: false });
    setHistoricoVendas(historico || []);
    
    setLoading(false);
  };


  useEffect(() => { 
    fetchData(); 
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // --- Handlers ---
  const handleCopyLink = (qrCode: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/c/${qrCode}`);
    alert("Link copiado para o clipboard! 🔗");
  };

  const handleGeneratePDF = (numero: number, qrCode: string) => {
    import('jspdf').then(({ default: jsPDF }) => {
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a6' });
      const url = `${window.location.origin}/c/${qrCode}`;
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}&margin=0`;
      img.onload = () => {
        // Fundo com cor leve para destacar bordas
        doc.setFillColor(252, 252, 252); 
        doc.rect(0, 0, 105, 148, 'F');
        
        // Borda externa dourada (espessa)
        doc.setDrawColor(212, 175, 55); 
        doc.setLineWidth(1.5);
        doc.rect(5, 5, 95, 138);
        
        // Borda interna dourada (fina)
        doc.setLineWidth(0.3);
        doc.rect(7, 7, 91, 134);
        
        // Título Principal
        doc.setTextColor(212, 175, 55); 
        doc.setFontSize(18); 
        doc.setFont('helvetica', 'bold');
        doc.text('BIG BEEF CARNES E ESPETINHO', 52.5, 23, { align: 'center' });
        
        // Linha divisória ornamental
        doc.setDrawColor(212, 175, 55);
        doc.setLineWidth(0.5);
        doc.line(30, 27, 75, 27);
        
        // Fundo da Mesa (Pílula dourada)
        doc.setFillColor(212, 175, 55); 
        doc.roundedRect(32.5, 33, 40, 11, 4, 4, 'F');
        
        // Texto da Mesa (Branco vazado no fundo escuro)
        doc.setTextColor(255, 255, 255); 
        doc.setFontSize(16); 
        doc.setFont('helvetica', 'bold');
        doc.text(`MESA ${numero}`, 52.5, 40.5, { align: 'center' });
        
        // Moldura do QR Code
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(212, 175, 55);
        doc.setLineWidth(0.5);
        doc.roundedRect(24, 52, 57, 57, 4, 4, 'FD');
        
        // Logo/QR Code
        doc.addImage(img, 'PNG', 27.5, 55.5, 50, 50);
        
        // Textos inferiores
        doc.setTextColor(40, 40, 40); 
        doc.setFontSize(11); 
        doc.setFont('helvetica', 'bold');
        doc.text('Acesse nosso cardápio digital', 52.5, 120, { align: 'center' });
        
        doc.setTextColor(100, 100, 100); 
        doc.setFontSize(10); 
        doc.setFont('helvetica', 'normal');
        doc.text('Aponte a câmera do seu celular', 52.5, 127, { align: 'center' });
        doc.text('para o QR Code acima.', 52.5, 132, { align: 'center' });
        
        doc.save(`BigBeef_Mesa_${numero}.pdf`);
      };
    });
  };


  const handleGenerateAllPDFs = () => {
    if (mesas.length === 0) {
      alert("Nenhuma mesa configurada!");
      return;
    }
    
    alert("Iniciando geração do PDF de todas as mesas. Isso pode levar alguns segundos devido à quantidade, por favor aguarde o download...");
    
    import('jspdf').then(async ({ default: jsPDF }) => {
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a6' });
      
      for (let i = 0; i < mesas.length; i++) {
        if (i > 0) doc.addPage();
        const m = mesas[i];
        const url = `${window.location.origin}/c/${m.qr_code}`;
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}&margin=0&t=${Date.now()}`;
        
        await new Promise((resolve) => {
          img.onload = () => {
            doc.setFillColor(252, 252, 252); doc.rect(0, 0, 105, 148, 'F');
            doc.setDrawColor(212, 175, 55); doc.setLineWidth(1.5); doc.rect(5, 5, 95, 138);
            doc.setLineWidth(0.3); doc.rect(7, 7, 91, 134);
            doc.setTextColor(212, 175, 55); doc.setFontSize(18); doc.setFont('helvetica', 'bold');
            doc.text('BIG BEEF CARNES E ESPETINHO', 52.5, 23, { align: 'center' });
            doc.setDrawColor(212, 175, 55); doc.setLineWidth(0.5); doc.line(30, 27, 75, 27);
            doc.setFillColor(212, 175, 55); doc.roundedRect(32.5, 33, 40, 11, 4, 4, 'F');
            doc.setTextColor(255, 255, 255); doc.setFontSize(16); doc.setFont('helvetica', 'bold');
            doc.text(`MESA ${m.numero}`, 52.5, 40.5, { align: 'center' });
            doc.setFillColor(255, 255, 255); doc.setDrawColor(212, 175, 55); doc.setLineWidth(0.5);
            doc.roundedRect(24, 52, 57, 57, 4, 4, 'FD');
            doc.addImage(img, 'PNG', 27.5, 55.5, 50, 50);
            doc.setTextColor(40, 40, 40); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
            doc.text('Acesse nosso cardápio digital', 52.5, 120, { align: 'center' });
            doc.setTextColor(100, 100, 100); doc.setFontSize(10); doc.setFont('helvetica', 'normal');
            doc.text('Aponte a câmera do seu celular', 52.5, 127, { align: 'center' });
            doc.text('para o QR Code acima.', 52.5, 132, { align: 'center' });
            resolve(true);
          };
          img.onerror = () => {
            console.error("Falha ao carregar QR code da mesa", m.numero);
            resolve(false);
          };
        });
        
        // Delay para evitar Rate Limiting da API pública
        await new Promise(r => setTimeout(r, 400));
      }
      doc.save(`BigBeef_Todas_Mesas.pdf`);
    });
  };

  const handleUpdateEstoque = async (id: string, current: number, delta: number) => {
    const newValue = Math.max(0, current + delta);
    await supabase.from('produtos').update({ estoque: newValue }).eq('id', id);
    setProdutos(produtos.map(p => p.id === id ? { ...p, estoque: newValue } : p));
  };

  const handleDirectStockInput = async (id: string, value: string) => {
    const newValue = parseInt(value);
    if (isNaN(newValue) || newValue < 0) return;
    await supabase.from('produtos').update({ estoque: newValue }).eq('id', id);
    setProdutos(produtos.map(p => p.id === id ? { ...p, estoque: newValue } : p));
  };

  const handleLiberarMesa = async (mesaId: string) => {
    if (!confirm("Deseja realmente liberar esta mesa vazia?")) return;
    try {
      await supabase.from('mesas').update({ status: 'livre', precisa_garcom: false }).eq('id', mesaId);
      setSelectedMesaComanda(null);
      fetchData();
      alert("Mesa liberada com sucesso!");
    } catch (err) {
      alert("Erro ao liberar mesa.");
    }
  };

  const handleUpdatePreco = async (id: string, value: string) => {
    const newPreco = parseFloat(value.replace(',', '.'));
    if (isNaN(newPreco) || newPreco < 0) return;
    await supabase.from('produtos').update({ preco: newPreco }).eq('id', id);
    setProdutos(produtos.map(p => p.id === id ? { ...p, preco: newPreco } : p));
  };

  const handleAddProduto = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);
    const { error } = await supabase.from('produtos').insert({
      nome: data.nome, categoria: data.categoria,
      preco: parseFloat(data.preco as string),
      estoque: parseInt(data.estoque as string), ativo: true
    });
    if (!error) { fetchData(); setShowAddProduct(false); (e.target as HTMLFormElement).reset(); }
    else alert('Erro ao adicionar: ' + error.message);
  };

  const handleDeleteProduto = async (id: string) => {
    if (!confirm('Excluir item do cardápio?')) return;
    await supabase.from('produtos').delete().eq('id', id);
    fetchData();
  };

  const handleAddMesa = async () => {
    const numero = prompt('Número da nova mesa:');
    if (!numero) return;
    await supabase.from('mesas').insert({ numero: parseInt(numero), qr_code: `mesa-${numero}-qr`, status: 'livre' });
    fetchData();
  };

  const handleDeleteMesa = async (id: string) => {
    if (confirm('Excluir esta mesa?')) { 
      await supabase.from('mesas').delete().eq('id', id); 
      fetchData(); 
    }
  };

  const handleExcluirItemComanda = async (item: any, motivo: string = 'Exclusão via Admin') => {
    if (!item.id) return;

    setIsExcluindo(true);
    try {
      const pId = item.pedido_id || item.pedidos?.id;
      if (!pId) throw new Error("ID do pedido não identificado.");

      // 1. Salvar na Auditoria
      const { error: auditError } = await supabase.from('auditoria_exclusoes').insert({
        pedido_id: pId,
        produto_nome: item.produtos?.nome || 'Item',
        quantidade: item.quantidade,
        valor_removido: Number(item.preco_unitario) * item.quantidade,
        motivo: motivo,
        usuario_nome: profile?.full_name || 'Administrador',
        mesa_numero: item.pedidos?.mesas?.numero || 0,
        turno_id: item.turno_id // Fallback se disponível
      });
      if (auditError) throw auditError;

      // 2. Excluir o item
      const { error: deleteError } = await supabase.from('itens_pedido').delete().eq('id', item.id);
      if (deleteError) throw deleteError;

      // 3. Atualizar o total
      const { data: currentPedido } = await supabase.from('pedidos').select('total').eq('id', pId).single();
      if (currentPedido) {
        const subtotalItem = Number(item.preco_unitario) * item.quantidade;
        const novoTotal = Math.max(0, Number(currentPedido.total) - subtotalItem);
        await supabase.from('pedidos').update({ total: novoTotal }).eq('id', pId);
      }

      setItemParaExcluir(null);
      setMotivoExclusao('');
      fetchData();
      alert("Exclusão auditada e realizada com sucesso!");
    } catch (err: any) {
      console.error("ERRO CRÍTICO NA EXCLUSÃO:", err);
      alert("⚠️ FALHA NA EXCLUSÃO:\n\n" + (err.message || 'Erro desconhecido no banco de dados. Verifique se a tabela de auditoria existe.'));
    } finally {
      setIsExcluindo(false);
    }
  };

  // --- Computed ---
  const mesasOcupadas = mesas.filter(m => m.status !== 'livre').length;
  const itensCriticos = produtos.filter(p => p.estoque < 10).length;
  const itensEsgotados = produtos.filter(p => p.estoque <= 0).length;
  const mediaNota = avaliacoes.length
    ? ((avaliacoes.reduce((a, av) => a + av.nota_atendimento + av.nota_comida + av.nota_ambiente, 0)) / (avaliacoes.length * 3)).toFixed(1)
    : '—';

  // filteredProdutos is now a useMemo at the top

  const groupedProdutos = filteredProdutos.reduce((acc: any, p) => {
    if (!acc[p.categoria]) acc[p.categoria] = [];
    acc[p.categoria].push(p);
    return acc;
  }, {});

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

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050505' }}>
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        style={{ width: '40px', height: '40px', border: '3px solid var(--primary-color)', borderTopColor: 'transparent', borderRadius: '50%' }}
      />
    </div>
  );

  const SideItem = ({ id, icon, label }: { id: AdminTab; icon: any; label: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px',
        border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', transition: 'all 0.2s',
        background: activeTab === id ? 'rgba(212,175,55,0.12)' : 'transparent',
        color: activeTab === id ? 'var(--primary-color)' : 'rgba(255,255,255,0.5)',
        fontWeight: activeTab === id ? 700 : 500, fontSize: '0.9rem',
        borderLeft: activeTab === id ? '3px solid var(--primary-color)' : '3px solid transparent'
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="layout-container" style={{ background: '#060608', color: '#fff' }}>
      {/* SIDEBAR */}
      <aside className="sidebar" style={{ width: '240px' }}>

        <div style={{ marginBottom: '2.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
            <img src="/logo.jpg" alt="Logo" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'contain', border: '1px solid var(--primary-color)' }} />
            <div className="mobile-hide" style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--primary-color)', letterSpacing: '1px' }}>BIG BEEF CARNES E ESPETINHO</div>
          </div>

          <div className="mobile-hide" style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '2px', marginTop: '2px' }}>ADMINISTRAÇÃO</div>
          <div className="mobile-hide" style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>
            {profile?.full_name}
          </div>
        </div>

        <nav className="sidebar-nav">
          <SideItem id="dashboard" icon={<BarChart2 size={18}/>} label="Dashboard" />
          <SideItem id="estoque" icon={<Package size={18}/>} label="Estoque" />
          <SideItem id="mesas" icon={<LayoutGrid size={18}/>} label="Mesas" />
          <SideItem id="equipe" icon={<UsersIcon size={18}/>} label="Equipe" />
          <SideItem id="avaliacoes" icon={<Star size={18}/>} label="Avaliações" />


          <SideItem id="entregues" icon={<CheckCircle size={18}/>} label="Pedidos Entregues" />
          <SideItem id="fechamento" icon={<Lock size={18}/>} label="Fluxo de Caixa" />
        </nav>


        <button onClick={() => signOut()} className="sidebar-item" style={{
          background: 'rgba(239,68,68,0.08)', color: '#ef4444', marginTop: 'auto'
        }}>
          <LogOut size={16}/> <span className="mobile-hide">Sair</span>
        </button>
      </aside>

      {/* MAIN */}
      <main className="main-content">
        <OwnerViewBanner panelName="Administrador" />
        <AnimatePresence mode="wait">
          {/* === DASHBOARD === */}
          {activeTab === 'dashboard' && (
            <motion.div key="dash" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h1 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '0.3rem' }}>Dashboard Operacional</h1>
              <p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: '2rem', fontSize: '0.85rem' }}>
                Visão geral das operações em tempo real — {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
              </p>

              <div className="stat-grid mb-8">
                <StatCard icon={<LayoutGrid size={22} color="#3b82f6"/>} label="Mesas Ocupadas" value={`${mesasOcupadas}/${mesas.length}`} sub={`${mesas.filter(m => m.status === 'aguardando conta').length} aguardando conta`} color="#3b82f6" />
                <StatCard icon={<AlertTriangle size={22} color="#f59e0b"/>} label="Estoque Crítico" value={itensCriticos} sub={itensEsgotados > 0 ? `${itensEsgotados} esgotados` : 'Nenhum esgotado'} color="#f59e0b" />
                <StatCard icon={<ShoppingBag size={22} color="#10b981"/>} label="Pedidos Ativos" value={pedidosAtivos.length} sub="Mesas atendidas agora" color="#10b981" />
                <StatCard icon={<Star size={22} color="var(--primary-color)"/>} label="Nota Média" value={mediaNota} sub={`${avaliacoes.length} avaliaç${avaliacoes.length === 1 ? 'ão' : 'ões'}`} color="var(--primary-color)" />
              </div>

              {/* Status das Mesas */}
              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ marginBottom: '1.2rem', fontWeight: 800, fontSize: '1rem' }}>
                  <LayoutGrid size={16} style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--primary-color)' }}/>
                  Status das Mesas
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.8rem' }}>
                  {mesas.map(m => {
                    const statusLower = (m.status || '').toLowerCase();
                    const color = statusLower === 'livre' ? '#10b981' : statusLower === 'aguardando conta' ? 'var(--primary-color)' : '#ef4444';
                    const isOccupied = statusLower !== 'livre';
                    return (
                      <motion.div key={m.id} 
                        whileHover={isOccupied ? { scale: 1.05, filter: 'brightness(1.2)' } : {}}
                        onClick={() => isOccupied && setSelectedMesaComanda(m)}
                        style={{ 
                          background: `${color}11`, 
                          border: `1px solid ${color}33`, 
                          borderRadius: '10px', 
                          padding: '1rem', 
                          textAlign: 'center',
                          cursor: isOccupied ? 'pointer' : 'default',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ fontSize: '1.5rem', fontWeight: 900, color }}>{m.numero}</div>
                        <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', color, fontWeight: 700, marginTop: '4px' }}>
                          {m.status === 'livre' ? 'Livre' : m.status === 'aguardando conta' ? 'Conta' : 'Ocup.'}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Alertas de Estoque */}
              {itensCriticos > 0 && (
                <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
                  <h3 style={{ marginBottom: '1rem', fontWeight: 800, fontSize: '1rem', color: '#f59e0b' }}>
                    <AlertTriangle size={16} style={{ verticalAlign: 'middle', marginRight: '8px' }}/>
                    Alertas de Estoque
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {produtos.filter(p => p.estoque < 10).map(p => (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(245,158,11,0.06)', borderRadius: '8px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.nome}</span>
                        <span style={{ color: p.estoque <= 0 ? '#ef4444' : '#f59e0b', fontWeight: 800, fontSize: '0.85rem' }}>
                          {p.estoque <= 0 ? 'ESGOTADO' : `${p.estoque} restantes`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* === ESTOQUE === */}
          {activeTab === 'estoque' && (
            <motion.div key="estoque" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                  <h1 style={{ fontSize: '1.8rem', fontWeight: 900 }}>Gestão de Estoque</h1>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>{produtos.length} itens no cardápio</p>
                </div>
                <button onClick={() => setShowAddProduct(!showAddProduct)} style={{
                  display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--primary-color)', color: '#000',
                  border: 'none', borderRadius: '10px', padding: '10px 18px', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem'
                }}>
                  {showAddProduct ? <X size={16}/> : <Plus size={16}/>}
                  {showAddProduct ? 'Cancelar' : 'Novo Produto'}
                </button>
              </div>

              <AnimatePresence>
                {showAddProduct && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="card" style={{ marginBottom: '1.5rem', border: '1px solid rgba(212,175,55,0.2)', overflow: 'hidden' }}
                  >
                    <h3 style={{ fontWeight: 800, marginBottom: '1rem', color: 'var(--primary-color)', fontSize: '0.9rem' }}>✚ ADICIONAR PRODUTO</h3>
                    <form onSubmit={handleAddProduto} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto auto', gap: '10px', alignItems: 'end' }}>
                      <div><label style={{ fontSize: '0.65rem', opacity: 0.5, display: 'block', marginBottom: '4px' }}>NOME</label>
                        <input name="nome" placeholder="Ex: Heineken 600ml" required style={{ width: '100%', padding: '0.7rem', background: '#111', border: '1px solid #333', borderRadius: '8px', color: '#fff', outline: 'none' }} />
                      </div>
                      <div><label style={{ fontSize: '0.65rem', opacity: 0.5, display: 'block', marginBottom: '4px' }}>CATEGORIA</label>
                        <select name="categoria" className="input-field">
                          <option>PETISCO</option><option>BEBIDAS</option><option>COQUETÉIS</option><option>DESTILADOS (DOSE)</option><option>OUTROS</option>
                        </select>
                      </div>
                      <div><label style={{ fontSize: '0.65rem', opacity: 0.5, display: 'block', marginBottom: '4px' }}>PREÇO</label>
                        <input name="preco" type="number" step="0.01" placeholder="0.00" required style={{ width: '90px', padding: '0.7rem', background: '#111', border: '1px solid #333', borderRadius: '8px', color: '#fff', outline: 'none' }} />
                      </div>
                      <div><label style={{ fontSize: '0.65rem', opacity: 0.5, display: 'block', marginBottom: '4px' }}>ESTOQUE</label>
                        <input name="estoque" type="number" placeholder="Qtd" required style={{ width: '80px', padding: '0.7rem', background: '#111', border: '1px solid #333', borderRadius: '8px', color: '#fff', outline: 'none' }} />
                      </div>
                      <button type="submit" style={{ background: 'var(--primary-color)', color: '#000', border: 'none', borderRadius: '8px', padding: '0.7rem 1.2rem', fontWeight: 800, cursor: 'pointer' }}>Salvar</button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Search */}
              <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                <input value={stockSearch} onChange={e => setStockSearch(e.target.value)} placeholder="Buscar produto ou categoria..."
                  style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.8rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', color: '#fff', outline: 'none' }} />
              </div>

              {/* Grouped Products */}
              {Object.entries(groupedProdutos).map(([cat, items]: any) => (
                <div key={cat} style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '2px', color: 'var(--primary-color)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ height: '1px', width: '20px', background: 'rgba(212,175,55,0.3)' }}/>
                    {cat}
                    <div style={{ height: '1px', flex: 1, background: 'rgba(212,175,55,0.1)' }}/>
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>{items.length} itens</span>
                  </div>
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    {items.map((p: any, idx: number) => {
                      const stockColor = p.estoque <= 0 ? '#ef4444' : p.estoque < 10 ? '#f59e0b' : '#10b981';
                      return (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.2rem', borderBottom: idx < items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', transition: 'background 0.2s' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{p.nome}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--primary-color)', fontWeight: 600 }}>R$</span>
                              <input 
                                key={p.id + '-preco-' + p.preco}
                                type="number" 
                                step="0.01" 
                                defaultValue={p.preco} 
                                onBlur={(e) => handleUpdatePreco(p.id, e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleUpdatePreco(p.id, (e.target as HTMLInputElement).value)}
                                style={{ width: '70px', padding: '2px 4px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: '4px', color: '#fff', fontSize: '0.8rem', fontWeight: 700, outline: 'none' }}
                              />
                            </div>
                          </div>
                          <StockBar value={p.estoque} />
                          <span style={{ color: stockColor, fontWeight: 800, fontSize: '0.85rem', minWidth: '50px', textAlign: 'center' }}>
                            {p.estoque <= 0 ? 'SEM' : p.estoque}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button onClick={() => handleUpdateEstoque(p.id, p.estoque, -1)} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', width: '28px', height: '28px', borderRadius: '7px', cursor: 'pointer', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Minus size={12}/>
                            </button>
                            <input type="number" defaultValue={p.estoque} key={p.estoque}
                              onBlur={e => handleDirectStockInput(p.id, e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleDirectStockInput(p.id, (e.target as HTMLInputElement).value)}
                              style={{ width: '52px', padding: '4px 6px', background: '#111', border: '1px solid #333', borderRadius: '7px', color: stockColor, fontWeight: 800, textAlign: 'center', outline: 'none', fontSize: '0.9rem' }}
                            />
                            <button onClick={() => handleUpdateEstoque(p.id, p.estoque, 1)} style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', width: '28px', height: '28px', borderRadius: '7px', cursor: 'pointer', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Plus size={12}/>
                            </button>
                          </div>
                          <button onClick={() => handleDeleteProduto(p.id)} style={{ background: 'rgba(239,68,68,0.08)', border: 'none', color: '#ef4444', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Trash2 size={14}/>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* === MESAS === */}
          {activeTab === 'mesas' && (
            <motion.div key="mesas" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                  <h1 style={{ fontSize: '1.8rem', fontWeight: 900 }}>Gestão de Mesas</h1>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>{mesas.length} mesas configuradas · {mesasOcupadas} ocupadas</p>
                </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleGenerateAllPDFs} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', color: 'var(--primary-color)', border: '1px solid var(--primary-color)', borderRadius: '10px', padding: '10px 18px', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem' }}>
                <QrCode size={16}/> Imprimir Todos
              </button>
              <button onClick={handleAddMesa} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--primary-color)', color: '#000', border: 'none', borderRadius: '10px', padding: '10px 18px', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem' }}>
                <Plus size={16}/> Nova Mesa
              </button>
            </div>
          </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.2rem' }}>
                {mesas.map(m => {
                  const statusColor = m.status === 'livre' ? '#10b981' : m.status === 'aguardando conta' ? 'var(--primary-color)' : '#ef4444';
                  return (
                    <motion.div key={m.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card"
                      style={{ padding: '1.5rem', borderTop: `4px solid ${statusColor}`, position: 'relative' }}
                    >
                      <button onClick={() => handleDeleteMesa(m.id)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', padding: '4px' }}>
                        <X size={14}/>
                      </button>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.2rem' }}>
                        <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: `${statusColor}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 900, color: statusColor }}>
                          {m.numero}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>Mesa {m.numero}</div>
                          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: statusColor }}>
                            {m.status}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginBottom: '1rem', wordBreak: 'break-all' }}>
                        {window.location.origin}/c/{m.qr_code}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <button onClick={() => handleGeneratePDF(m.numero, m.qr_code)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', background: 'var(--primary-color)', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem' }}>
                          <QrCode size={14}/> QR Code
                        </button>
                        <button onClick={() => handleCopyLink(m.qr_code)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem' }}>
                          <LinkIcon size={14}/> Link
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* === EQUIPE === */}
          {activeTab === 'equipe' && (
            <motion.div key="equipe" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h1 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '0.3rem' }}>Equipe</h1>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', marginBottom: '2rem' }}>{usuarios.length} membros cadastrados</p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                {usuarios.map(u => {
                  const color = ROLE_COLORS[u.role] || '#888';
                  const roleLabel = ROLE_LABELS[u.role] || u.role;
                  const initials = (u.full_name || 'U').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
                  return (
                    <motion.div key={u.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className="card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.2rem' }}
                    >
                      <div style={{ width: '50px', height: '50px', borderRadius: '14px', background: `${color}22`, border: `2px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.1rem', color, flexShrink: 0 }}>
                        {initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.full_name || 'Sem nome'}</div>
                        <div style={{ fontSize: '0.75rem', color, fontWeight: 700, marginTop: '2px' }}>{roleLabel}</div>
                        {u.email && <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>}
                      </div>
                      <div style={{ background: `${color}15`, border: `1px solid ${color}30`, borderRadius: '8px', padding: '4px 10px', fontSize: '0.65rem', fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '1px', flexShrink: 0 }}>
                        {u.role}
                      </div>
                    </motion.div>
                  );
                })}
                {usuarios.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)' }}>Nenhum membro cadastrado.</p>}
              </div>
            </motion.div>
          )}

          {/* === AVALIAÇÕES === */}
          {activeTab === 'avaliacoes' && (
            <motion.div key="aval" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h1 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '0.3rem' }}>Avaliações</h1>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', marginBottom: '2rem' }}>{avaliacoes.length} avaliaç{avaliacoes.length === 1 ? 'ão' : 'ões'} recebida{avaliacoes.length === 1 ? '' : 's'}</p>

              {avaliacoes.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                  {[{ label: 'Atendimento', key: 'nota_atendimento', color: 'var(--primary-color)' }, { label: 'Comida', key: 'nota_comida', color: '#10b981' }, { label: 'Ambiente', key: 'nota_ambiente', color: '#3b82f6' }].map(cat => {
                    const avg = (avaliacoes.reduce((a, av) => a + av[cat.key], 0) / avaliacoes.length).toFixed(1);
                    const pct = (parseFloat(avg) / 5) * 100;
                    return (
                      <div key={cat.key} className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '2.5rem', fontWeight: 900, color: cat.color }}>{avg}</div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '10px' }}>{cat.label}</div>
                        <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: cat.color, borderRadius: '3px' }} />
                        </div>
                        <div style={{ fontSize: '0.65rem', opacity: 0.35, marginTop: '6px' }}>{pct.toFixed(0)}% de 5 estrelas</div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {avaliacoes.map(av => (
                  <motion.div key={av.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--primary-color)' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: av.sugestoes ? '1rem' : 0 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '1rem' }}>Mesa {av.mesa_numero}</div>
                        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)' }}>{new Date(av.created_at).toLocaleString('pt-BR')}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
                        <span style={{ color: 'var(--primary-color)' }}>⭐ {av.nota_atendimento}</span>
                        <span style={{ color: '#10b981' }}>🍽 {av.nota_comida}</span>
                        <span style={{ color: '#3b82f6' }}>🏮 {av.nota_ambiente}</span>
                      </div>
                    </div>
                    {av.sugestoes && (
                      <p style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', fontStyle: 'italic', color: 'rgba(255,255,255,0.7)', margin: 0, fontSize: '0.9rem', lineHeight: 1.6 }}>
                        "{av.sugestoes}"
                      </p>
                    )}
                  </motion.div>
                ))}
                {avaliacoes.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '4rem', color: 'rgba(255,255,255,0.2)' }}>
                    <Star size={48} style={{ margin: '0 auto 1rem', display: 'block' }}/>
                    <p>Nenhuma avaliação ainda.<br/>Elas aparecerão aqui após o fechamento das mesas.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}


          {/* === FECHAMENTO === */}
          {activeTab === 'fechamento' && (
            <motion.div key="fechamento" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <FechamentoCaixa 
                historicoVendas={historicoVendas}
                paymentTotals={paymentTotals}
                onRefresh={fetchData}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* MODAL DETALHES COMANDA (DASHBOARD CLICK) */}
        <AnimatePresence>
          {selectedMesaComanda && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setSelectedMesaComanda(null)}>
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} 
                onClick={e => e.stopPropagation()}
                style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', width: '100%', maxWidth: '500px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                
                <div style={{ padding: '1.5rem', background: 'var(--primary-color)', color: '#000', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0 }}>MESA {selectedMesaComanda.numero}</h2>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.8 }}>Relatório Rápido</span>
                  </div>
                  <button onClick={() => setSelectedMesaComanda(null)} style={{ background: 'rgba(0,0,0,0.1)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={18} />
                  </button>
                </div>

                <div style={{ padding: '1.5rem', maxHeight: '60vh', overflowY: 'auto' }}>
                  {(() => {
                    const pedido = pedidosAtivos.find(p => p.mesa_id === selectedMesaComanda.id);
                    const items = pedido?.itens_pedido || [];
                    
                    if (items.length === 0) return <p style={{ textAlign: 'center', opacity: 0.5, padding: '2rem' }}>Nenhum item lançado nesta mesa.</p>;

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {items.map((it: any) => (
                           <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{it.quantidade}x {it.produtos?.nome}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--primary-color)', fontWeight: 600 }}>{it.status.toUpperCase()}</div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <div style={{ fontWeight: 800 }}>R$ {(Number(it.preco_unitario) * it.quantidade).toFixed(2)}</div>
                                <button 
                                  type="button"
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    const itParaExcluirObj = { ...it, pedido_id: pedido?.id, pedidos: { mesas: { numero: selectedMesaComanda.numero } } };
                                    setItemParaExcluir(itParaExcluirObj); 
                                  }}
                                  style={{ background: 'rgba(239,68,68,0.1)', border: 'none', color: '#ef4444', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                           </div>
                        ))}
                        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '2px solid rgba(212,175,55,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 800 }}>TOTAL DA MESA</span>
                          <span style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--primary-color)' }}>R$ {Number(pedido?.total || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                   <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginBottom: '1rem' }}>Para exclusões ou auditoria completa, use a aba "Comandas".</p>
                   <button onClick={() => setSelectedMesaComanda(null)} style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', padding: '0.8rem 2.5rem', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', width: '100%' }}>
                     FECHAR VISUALIZAÇÃO
                   </button>
                </div>

              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </main>

      {/* MODAL DETALHES COMANDA (DASHBOARD CLICK) - MOVEMOS PARA FORA DO MAIN PARA EVITAR PROBLEMAS DE Z-INDEX */}
      <AnimatePresence>
        {selectedMesaComanda && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setSelectedMesaComanda(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} 
              onClick={e => e.stopPropagation()}
              style={{ background: '#101010', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', width: '100%', maxWidth: '450px', overflow: 'hidden', boxShadow: '0 30px 60px -12px rgba(0,0,0,0.7)' }}>
              
              <div style={{ padding: '1.5rem', background: 'var(--primary-color)', color: '#000', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: '1.3rem', fontWeight: 900, margin: 0 }}>MESA {selectedMesaComanda.numero}</h2>
                  <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.8, letterSpacing: '1px' }}>Consumo em Tempo Real</div>
                </div>
                <button onClick={() => setSelectedMesaComanda(null)} style={{ background: 'rgba(0,0,0,0.1)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ padding: '1.5rem', maxHeight: '65vh', overflowY: 'auto' }}>
                {(() => {
                  const pedido = pedidosAtivos.find(p => p.mesa_id === selectedMesaComanda.id);
                  const items = pedido?.itens_pedido || [];
                  
                  if (items.length === 0) return (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                      <FileText size={40} style={{ margin: '0 auto 1rem', opacity: 0.1 }} />
                      <p style={{ opacity: 0.5, marginBottom: '2rem' }}>Nenhum item lançado nesta mesa.</p>
                      <button 
                        onClick={() => handleLiberarMesa(selectedMesaComanda.id)}
                        style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', padding: '0.8rem 1.5rem', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        LIBERAR MESA AGORA
                      </button>
                    </div>
                  );

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                      {items.map((it: any) => (
                         <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>{it.quantidade}x {it.produtos?.nome}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: it.status === 'pronto' ? '#10b981' : '#f59e0b' }} />
                                <div style={{ fontSize: '0.7rem', color: 'var(--primary-color)', fontWeight: 700, textTransform: 'uppercase' }}>{it.status}</div>
                              </div>
                            </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <div style={{ fontWeight: 800, color: '#fff', fontSize: '1rem' }}>R$ {(Number(it.preco_unitario) * it.quantidade).toFixed(2)}</div>
                                <button 
                                  type="button"
                                  onClick={(e) => { 
                                    e.preventDefault();
                                    e.stopPropagation(); 
                                    if(confirm(`Excluir ${it.quantidade}x ${it.produtos?.nome}?`)) {
                                      handleExcluirItemComanda({
                                        ...it, 
                                        pedido_id: pedido.id,
                                        pedidos: { id: pedido.id, mesas: { numero: selectedMesaComanda.numero } } 
                                      }, 'Exclusão Direta Admin (Dashboard)');
                                    }
                                  }}
                                  style={{ 
                                    background: 'rgba(239,68,68,0.15)', 
                                    border: '1px solid rgba(239,68,68,0.3)', 
                                    color: '#ef4444', 
                                    width: '40px', 
                                    height: '40px', 
                                    borderRadius: '10px', 
                                    cursor: 'pointer', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    transition: 'all 0.2s' 
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.25)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                         </div>
                      ))}
                      <div style={{ marginTop: '1rem', padding: '1.2rem', background: 'rgba(212,175,55,0.05)', borderRadius: '12px', border: '1px solid rgba(212,175,55,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.7rem', opacity: 0.5, fontWeight: 700 }}>VALOR TOTAL</div>
                          <div style={{ fontWeight: 800 }}>SUBTOTAL ACUMULADO</div>
                        </div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--primary-color)' }}>R$ {Number(pedido?.total || 0).toFixed(2)}</div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div style={{ padding: '1.2rem', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                 <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', marginBottom: '1.2rem' }}>Auditando mesa em modo de visualização rápida.</p>
                 <button onClick={() => setSelectedMesaComanda(null)} style={{ background: 'var(--primary-color)', color: '#000', border: 'none', padding: '1rem', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', width: '100%', boxShadow: '0 10px 20px -5px rgba(212,175,55,0.3)' }}>
                   ENTENDIDO, FECHAR
                 </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
