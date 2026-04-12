import { useState, useMemo, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Lock, Printer, TrendingUp, TrendingDown, DollarSign,
  CreditCard, Smartphone, Banknote, AlertTriangle, CheckCircle,
  Clock, BarChart3, ArrowDownCircle, ArrowUpCircle, RefreshCw,
  FileText, X, ChevronDown, ChevronUp, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { printFechamentoZ } from '../utils/printUtils';

interface FechamentoCaixaProps {
  historicoVendas: any[];
  paymentTotals: { pix: number; dinheiro: number; debito: number; credito: number };
  onRefresh: () => void;
  onClose?: () => void;
}

interface Movimentacao {
  tipo: 'sangria' | 'suprimento';
  valor: number;
  motivo: string;
  hora: string;
  operador: string;
}

export const FechamentoCaixa = ({ historicoVendas, paymentTotals, onRefresh, onClose }: FechamentoCaixaProps) => {
  const { profile, signOut } = useAuth();
  const isGestor = profile?.role === 'dono' || profile?.role === 'admin';

  const [turnoId, setTurnoId] = useState<string | null>(localStorage.getItem('turno_id'));
  const [fundoTroco, setFundoTroco] = useState('0.00');
  const [dinheiroGaveta, setDinheiroGaveta] = useState('');
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [showMovModal, setShowMovModal] = useState<'sangria' | 'suprimento' | null>(null);
  const [movValor, setMovValor] = useState('');
  const [movMotivo, setMovMotivo] = useState('');
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [showDetalhesPix, setShowDetalhesPix] = useState(false);
  const [showDetalhesDinheiro, setShowDetalhesDinheiro] = useState(false);
  const [turnoInicio, setTurnoInicio] = useState(new Date().toISOString());
  const [osNumber, setOsNumber] = useState<string | null>(localStorage.getItem('os_number'));

  // Carregar dados do Banco
  useEffect(() => {
    const fetchTurnoData = async () => {
      // 1. Buscar turno aberto
      let currentId = turnoId;
      if (!currentId) {
        const { data: activeTurno } = await supabase
          .from('turnos_caixa')
          .select('*')
          .eq('status', 'aberto')
          .order('aberto_em', { ascending: false })
          .limit(1)
          .single();
        
        if (activeTurno) {
          currentId = activeTurno.id;
          setTurnoId(activeTurno.id);
          setFundoTroco(activeTurno.fundo_troco.toString());
          setTurnoInicio(activeTurno.aberto_em);
          setOsNumber(activeTurno.os_number?.toString() || null);
        }
      } else {
        const { data: activeTurno } = await supabase
          .from('turnos_caixa')
          .select('*')
          .eq('id', currentId)
          .single();
        
        if (activeTurno) {
          setFundoTroco(activeTurno.fundo_troco.toString());
          setTurnoInicio(activeTurno.aberto_em);
          setOsNumber(activeTurno.os_number?.toString() || null);
        }
      }

      // 2. Buscar movimentações
      if (currentId) {
        const { data: movs } = await supabase
          .from('movimentacoes_caixa')
          .select('*')
          .eq('turno_id', currentId)
          .order('criado_em', { ascending: true });
        
        if (movs) {
          setMovimentacoes(movs.map(m => ({
            tipo: m.tipo as 'sangria' | 'suprimento',
            valor: Number(m.valor),
            motivo: m.motivo,
            hora: new Date(m.criado_em).toLocaleTimeString('pt-BR'),
            operador: m.operador_nome || 'Operador'
          })));
        }
      }
    };

    fetchTurnoData();
  }, [turnoId]);

  const handleUpdateFundoTroco = async (val: string) => {
    const novoValor = parseFloat(val.replace(',', '.'));
    if (isNaN(novoValor)) return;
    
    setFundoTroco(novoValor.toFixed(2));
    
    if (turnoId) {
      try {
        await supabase
          .from('turnos_caixa')
          .update({ fundo_troco: novoValor })
          .eq('id', turnoId);
      } catch (err) {
        console.error("Erro ao atualizar fundo de troco:", err);
      }
    }
  };

  const saveMovimentacaoDB = async (nova: Movimentacao) => {
    if (!turnoId) return;
    try {
      const { error } = await supabase
        .from('movimentacoes_caixa')
        .insert([{
          turno_id: turnoId,
          tipo: nova.tipo,
          valor: nova.valor,
          motivo: nova.motivo,
          operador_nome: nova.operador
        }]);
      
      if (error) throw error;
      setMovimentacoes([...movimentacoes, nova]);
    } catch (err: any) {
      alert('Erro ao salvar movimentação: ' + err.message);
    }
  };

  // Totais calculados
  const totalSangrias = movimentacoes.filter(m => m.tipo === 'sangria').reduce((a, m) => a + m.valor, 0);
  const totalSuprimentos = movimentacoes.filter(m => m.tipo === 'suprimento').reduce((a, m) => a + m.valor, 0);
  const totalVendas = paymentTotals.pix + paymentTotals.dinheiro + paymentTotals.debito + paymentTotals.credito;
  const totalDigital = paymentTotals.pix + paymentTotals.debito + paymentTotals.credito;

  // Dinheiro esperado na gaveta
  const dinheiroEsperado = parseFloat(fundoTroco || '0') + paymentTotals.dinheiro + totalSuprimentos - totalSangrias;
  const dinheiroDeclarado = parseFloat(dinheiroGaveta || '0');
  const diferenca = dinheiroDeclarado - dinheiroEsperado;
  const gavetaConferida = dinheiroGaveta !== '' && Math.abs(diferenca) < 0.02;

  // Ticket médio
  const vendasFinalizadas = historicoVendas.filter(v => v.total > 0);
  const ticketMedio = vendasFinalizadas.length > 0 ? totalVendas / vendasFinalizadas.length : 0;

  // Pedidos por método
  const pedidosPorMetodo = useMemo(() => {
    const result = { pix: [] as any[], dinheiro: [] as any[], debito: [] as any[], credito: [] as any[] };
    historicoVendas.forEach(v => {
      if (!v.forma_pagamento) return;
      const fp = v.forma_pagamento.toLowerCase();
      if (fp.includes('pix')) result.pix.push(v);
      else if (fp.includes('dinheiro')) result.dinheiro.push(v);
      else if (fp.includes('déb') || fp.includes('deb')) result.debito.push(v);
      else if (fp.includes('créd') || fp.includes('cred')) result.credito.push(v);
    });
    return result;
  }, [historicoVendas]);

  const handleAddMovimentacao = (tipo: 'sangria' | 'suprimento') => {
    const valor = parseFloat(movValor.replace(',', '.'));
    if (!valor || valor <= 0) { alert('Informe um valor válido!'); return; }
    if (!movMotivo.trim()) { alert('Informe o motivo!'); return; }
    const nova: Movimentacao = {
      tipo,
      valor,
      motivo: movMotivo,
      hora: new Date().toLocaleTimeString('pt-BR'),
      operador: profile?.full_name || 'Operador'
    };
    saveMovimentacaoDB(nova);
    setMovValor('');
    setMovMotivo('');
    setShowMovModal(null);
  };

  const handleGerarRelatorio = () => {
    printFechamentoZ(
      osNumber || '---',
      profile?.full_name || 'CAIXA',
      turnoInicio,
      paymentTotals,
      pedidosPorMetodo,
      totalVendas,
      vendasFinalizadas.length,
      ticketMedio,
      movimentacoes,
      parseFloat(fundoTroco || '0'),
      totalSangrias,
      totalSuprimentos,
      dinheiroEsperado,
      dinheiroDeclarado,
      diferenca
    );
  };

  const handleFechamento = async () => {
    if (dinheiroGaveta === '') { alert('Informe o dinheiro contado na gaveta antes de fechar!'); return; }
    
    // 1. Gerar PDF
    handleGerarRelatorio();
    
    // 2. Fechar no Banco e Resetar Interface com pequeno delay para o download
    setTimeout(async () => {
      try {
        if (turnoId) {
          await supabase
            .from('turnos_caixa')
            .update({
              fechado_em: new Date().toISOString(),
              valor_declarado: dinheiroDeclarado,
              status: 'fechado'
            })
            .eq('id', turnoId);
        }
        
        localStorage.removeItem('turno_id');
        localStorage.removeItem('os_number');
        localStorage.removeItem('turno_inicio');
        localStorage.removeItem('fundo_troco');
        localStorage.removeItem('movimentacoes_caixa');
        
        if (onClose) onClose();
        // Não chamamos signOut() aqui para manter o usuário logado, apenas voltamos para "Iniciar Jornada"
        
      } catch (err: any) {
        alert('Erro ao fechar turno no banco: ' + err.message);
      }
    }, 1000);
    
    setShowConfirmClose(false);
  };

  const tempoTurno = useMemo(() => {
    const inicio = new Date(turnoInicio).getTime();
    const agora = Date.now();
    const diffMs = agora - inicio;
    const h = Math.floor(diffMs / 3600000);
    const m = Math.floor((diffMs % 3600000) / 60000);
    return `${h}h ${m}min`;
  }, [turnoInicio]);

  const cardStyle = (color: string) => ({
    background: `rgba(${color}, 0.08)`,
    border: `1px solid rgba(${color}, 0.2)`,
    borderRadius: '16px',
    padding: '1.2rem',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', height: 'calc(100vh - 160px)', overflowY: 'auto', paddingRight: '4px' }}>

      {/* Banner turno */}
      <div style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.15) 0%, rgba(212,175,55,0.05) 100%)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '16px', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Clock size={20} color="#d4af37" />
          <div>
            <div style={{ fontSize: '0.65rem', opacity: 0.5, fontWeight: 700 }}>TURNO EM ANDAMENTO • O.S. #{osNumber || '---'}</div>
            <div style={{ fontWeight: 900, color: '#d4af37' }}>Início: {new Date(turnoInicio).toLocaleTimeString('pt-BR')} • Duração: {tempoTurno}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onRefresh} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '10px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>
            <RefreshCw size={14} /> ATUALIZAR
          </button>
          <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px', padding: '6px 14px', fontSize: '0.75rem', fontWeight: 900, color: '#10b981' }}>
            {vendasFinalizadas.length} VENDAS
          </div>
        </div>
      </div>

      {/* Cards de resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: isGestor ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)', gap: '1rem' }}>
        {[
          ...(isGestor ? [{ label: 'DINHEIRO', icon: Banknote, val: paymentTotals.dinheiro, color: '16,185,129', qtd: pedidosPorMetodo.dinheiro.length }] : []),
          { label: 'PIX', icon: Smartphone, val: paymentTotals.pix, color: '212,175,55', qtd: pedidosPorMetodo.pix.length },
          { label: 'DÉBITO', icon: CreditCard, val: paymentTotals.debito, color: '99,102,241', qtd: pedidosPorMetodo.debito.length },
          { label: 'CRÉDITO', icon: CreditCard, val: paymentTotals.credito, color: '244,63,94', qtd: pedidosPorMetodo.credito.length },
        ].map(({ label, icon: Icon, val, color, qtd }) => (
          <div key={label} style={cardStyle(color)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <Icon size={18} color={`rgb(${color})`} />
              <span style={{ fontSize: '0.6rem', color: `rgb(${color})`, fontWeight: 800, background: `rgba(${color},0.1)`, padding: '2px 8px', borderRadius: '20px' }}>{qtd} pdos</span>
            </div>
            <div style={{ fontSize: '0.6rem', opacity: 0.4, fontWeight: 700, marginBottom: '4px' }}>{label}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: `rgb(${color})` }}>R$ {val.toFixed(2)}</div>
          </div>
        ))}
      </div>

      {/* Total + Ticket Médio - Somente gestor */}
      {isGestor && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          <div style={{ ...cardStyle('212,175,55'), gridColumn: 'span 2' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.65rem', opacity: 0.5, fontWeight: 700 }}>TOTAL GERAL DO TURNO</div>
                <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#d4af37' }}>R$ {totalVendas.toFixed(2)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.65rem', opacity: 0.5 }}>Digital (PIX + Cartões)</div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#a78bfa' }}>R$ {totalDigital.toFixed(2)}</div>
                <div style={{ fontSize: '0.65rem', opacity: 0.5, marginTop: '4px' }}>Físico (Dinheiro)</div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#10b981' }}>R$ {paymentTotals.dinheiro.toFixed(2)}</div>
              </div>
            </div>
          </div>
          <div style={cardStyle('99,102,241')}>
            <BarChart3 size={18} color="#a78bfa" style={{ marginBottom: '8px' }} />
            <div style={{ fontSize: '0.6rem', opacity: 0.4, fontWeight: 700 }}>TICKET MÉDIO</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#a78bfa' }}>R$ {ticketMedio.toFixed(2)}</div>
            <div style={{ fontSize: '0.6rem', opacity: 0.4, marginTop: '4px' }}>{vendasFinalizadas.length} vendas finalizadas</div>
          </div>
        </div>
      )}

      {/* Movimentações - Somente gestor */}
      {isGestor && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <button onClick={() => setShowMovModal('sangria')} style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: '16px', padding: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', color: '#f43f5e' }}>
              <ArrowDownCircle size={24} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, opacity: 0.7 }}>REGISTRAR SANGRIA</div>
                <div style={{ fontSize: '1rem', fontWeight: 900 }}>-R$ {totalSangrias.toFixed(2)}</div>
              </div>
            </button>
            <button onClick={() => setShowMovModal('suprimento')} style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '16px', padding: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', color: '#10b981' }}>
              <ArrowUpCircle size={24} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, opacity: 0.7 }}>REGISTRAR SUPRIMENTO</div>
                <div style={{ fontSize: '1rem', fontWeight: 900 }}>+R$ {totalSuprimentos.toFixed(2)}</div>
              </div>
            </button>
          </div>

          {/* Lista movimentações */}
          {movimentacoes.length > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '1rem' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, opacity: 0.4, marginBottom: '0.8rem' }}>MOVIMENTAÇÕES DO TURNO</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {movimentacoes.map((m, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: '10px', background: m.tipo === 'sangria' ? 'rgba(244,63,94,0.07)' : 'rgba(16,185,129,0.07)', border: `1px solid ${m.tipo === 'sangria' ? 'rgba(244,63,94,0.15)' : 'rgba(16,185,129,0.15)'}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {m.tipo === 'sangria' ? <TrendingDown size={14} color="#f43f5e" /> : <TrendingUp size={14} color="#10b981" />}
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700 }}>{m.motivo}</div>
                        <div style={{ fontSize: '0.6rem', opacity: 0.4 }}>{m.hora} • {m.operador}</div>
                      </div>
                    </div>
                    <div style={{ fontWeight: 900, color: m.tipo === 'sangria' ? '#f43f5e' : '#10b981', fontSize: '0.9rem' }}>
                      {m.tipo === 'sangria' ? '-' : '+'}R$ {m.valor.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Conferência de Gaveta */}
      <div style={{ background: 'rgba(212,175,55,0.04)', border: '2px solid rgba(212,175,55,0.2)', borderRadius: '20px', padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.2rem' }}>
          <DollarSign size={20} color="#d4af37" />
          <h3 style={{ color: '#d4af37', fontSize: '0.85rem', fontWeight: 900, margin: 0 }}>CONFERÊNCIA DE GAVETA</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isGestor ? '1fr 1fr' : '1fr', gap: '1rem', marginBottom: '1.2rem' }}>
          <div>
            <label style={{ fontSize: '0.6rem', opacity: 0.4, fontWeight: 700, display: 'block', marginBottom: '6px' }}>FUNDO DE TROCO (R$) {profile?.role !== 'dono' && '🔒'}</label>
            {profile?.role === 'dono' ? (
              <input
                type="number"
                step="0.01"
                value={fundoTroco}
                onChange={(e) => setFundoTroco(e.target.value)}
                onBlur={(e) => handleUpdateFundoTroco(e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid #d4af37', borderRadius: '10px', padding: '0.7rem 1rem', color: '#d4af37', fontSize: '1.1rem', fontWeight: 700, outline: 'none' }}
              />
            ) : (
              <div style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.7rem 1rem', color: '#d4af37', fontSize: '1.1rem', fontWeight: 700 }}>
                R$ {parseFloat(fundoTroco || '0').toFixed(2)}
              </div>
            )}
          </div>
          {isGestor && (
            <div>
              <label style={{ fontSize: '0.6rem', opacity: 0.4, fontWeight: 700, display: 'block', marginBottom: '6px' }}>DINHEIRO ESPERADO</label>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.7rem 1rem', fontSize: '1.1rem', fontWeight: 700, color: '#a78bfa' }}>
                R$ {dinheiroEsperado.toFixed(2)}
              </div>
            </div>
          )}
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.6rem', opacity: 0.4, fontWeight: 700, display: 'block', marginBottom: '6px' }}>💰 DINHEIRO CONTADO NA GAVETA (R$) — OBRIGATÓRIO</label>
          <input
            type="number"
            value={dinheiroGaveta}
            onChange={e => setDinheiroGaveta(e.target.value)}
            placeholder="Digite o valor contado..."
            style={{ width: '100%', background: dinheiroGaveta ? 'rgba(212,175,55,0.05)' : 'rgba(255,255,255,0.03)', border: `2px solid ${dinheiroGaveta ? '#d4af37' : 'rgba(255,255,255,0.1)'}`, borderRadius: '12px', padding: '1rem', color: '#fff', fontSize: '1.8rem', fontWeight: 900, textAlign: 'center', outline: 'none', transition: '0.2s' }}
          />
        </div>

        {dinheiroGaveta !== '' && isGestor && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            style={{ padding: '1rem', borderRadius: '12px', textAlign: 'center', background: gavetaConferida ? 'rgba(16,185,129,0.1)' : diferenca > 0 ? 'rgba(212,175,55,0.1)' : 'rgba(244,63,94,0.1)', border: `1px solid ${gavetaConferida ? 'rgba(16,185,129,0.3)' : diferenca > 0 ? 'rgba(212,175,55,0.3)' : 'rgba(244,63,94,0.3)'}` }}>
            {gavetaConferida ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: 900 }}>
                <CheckCircle size={20} /> GAVETA CONFERE ✓
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', color: diferenca > 0 ? '#d4af37' : '#f43f5e', fontWeight: 900 }}>
                  <AlertTriangle size={20} />
                  {diferenca > 0 ? `SOBRA DE R$ ${diferenca.toFixed(2)}` : `QUEBRA DE R$ ${Math.abs(diferenca).toFixed(2)}`}
                </div>
                <div style={{ fontSize: '0.65rem', opacity: 0.5, marginTop: '4px' }}>Verifique os valores e registre movimentações se necessário</div>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Botões de ação */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', paddingBottom: '2rem' }}>
        <button onClick={handleGerarRelatorio}
          style={{ background: 'rgba(212,175,55,0.1)', border: '2px solid rgba(212,175,55,0.4)', borderRadius: '14px', color: '#d4af37', padding: '1rem', fontWeight: 900, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <Printer size={18} /> IMPRIMIR PARCIAL
        </button>
        <button onClick={() => { if (dinheiroGaveta === '') { alert('Conte e informe o dinheiro da gaveta antes de fechar!'); return; } setShowConfirmClose(true); }}
          style={{ background: dinheiroGaveta ? 'linear-gradient(135deg, #f43f5e, #dc2626)' : 'rgba(255,255,255,0.05)', border: `2px solid ${dinheiroGaveta ? '#f43f5e' : 'rgba(255,255,255,0.1)'}`, borderRadius: '14px', color: dinheiroGaveta ? '#fff' : '#444', padding: '1rem', fontWeight: 900, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: '0.2s' }}>
          <Lock size={18} /> FECHAR TURNO
        </button>
      </div>

      {/* Modal Sangria/Suprimento */}
      <AnimatePresence>
        {showMovModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setShowMovModal(null)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
              onClick={e => e.stopPropagation()}
              style={{ background: '#111', border: `2px solid ${showMovModal === 'sangria' ? 'rgba(244,63,94,0.4)' : 'rgba(16,185,129,0.4)'}`, borderRadius: '20px', padding: '2rem', width: '90%', maxWidth: '420px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <h3 style={{ color: showMovModal === 'sangria' ? '#f43f5e' : '#10b981', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  {showMovModal === 'sangria' ? <ArrowDownCircle size={22} /> : <ArrowUpCircle size={22} />}
                  {showMovModal === 'sangria' ? 'REGISTRAR SANGRIA' : 'REGISTRAR SUPRIMENTO'}
                </h3>
                <button onClick={() => setShowMovModal(null)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.65rem', fontWeight: 700, opacity: 0.5, display: 'block', marginBottom: '6px' }}>VALOR (R$)</label>
                <input type="number" value={movValor} onChange={e => setMovValor(e.target.value)} placeholder="0,00"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '1rem', color: '#fff', fontSize: '1.8rem', fontWeight: 900, textAlign: 'center', outline: 'none' }} />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ fontSize: '0.65rem', fontWeight: 700, opacity: 0.5, display: 'block', marginBottom: '6px' }}>MOTIVO / OBSERVAÇÃO</label>
                <input type="text" value={movMotivo} onChange={e => setMovMotivo(e.target.value)} placeholder={showMovModal === 'sangria' ? 'Ex: Retirada para cofre' : 'Ex: Troco para caixa'}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '0.9rem 1rem', color: '#fff', fontSize: '1rem', outline: 'none' }} />
              </div>
              <button onClick={() => handleAddMovimentacao(showMovModal)}
                style={{ width: '100%', background: showMovModal === 'sangria' ? '#f43f5e' : '#10b981', border: 'none', borderRadius: '12px', padding: '1rem', color: '#fff', fontWeight: 900, fontSize: '1rem', cursor: 'pointer' }}>
                CONFIRMAR {showMovModal === 'sangria' ? 'SANGRIA' : 'SUPRIMENTO'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Confirmação de Fechamento */}
      <AnimatePresence>
        {showConfirmClose && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}
              style={{ background: '#0d0d0d', border: '2px solid rgba(244,63,94,0.5)', borderRadius: '24px', padding: '2.5rem', width: '90%', maxWidth: '480px', textAlign: 'center' }}>
              <AlertTriangle size={48} color="#f43f5e" style={{ margin: '0 auto 1rem' }} />
              <h2 style={{ color: '#f43f5e', marginBottom: '0.5rem' }}>FECHAR TURNO?</h2>
              <p style={{ opacity: 0.6, marginBottom: '1.5rem', fontSize: '0.85rem' }}>Esta ação irá gerar o Relatório Z, encerrar o turno e deslogar do sistema.</p>

              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', textAlign: 'left' }}>
                <div><div style={{ fontSize: '0.6rem', opacity: 0.4 }}>TOTAL VENDAS</div><div style={{ fontWeight: 900, color: '#d4af37' }}>R$ {totalVendas.toFixed(2)}</div></div>
                <div><div style={{ fontSize: '0.6rem', opacity: 0.4 }}>Nº VENDAS</div><div style={{ fontWeight: 900 }}>{vendasFinalizadas.length}</div></div>
                <div><div style={{ fontSize: '0.6rem', opacity: 0.4 }}>DINHEIRO ESPERADO</div><div style={{ fontWeight: 900, color: '#a78bfa' }}>R$ {dinheiroEsperado.toFixed(2)}</div></div>
                <div><div style={{ fontSize: '0.6rem', opacity: 0.4 }}>DINHEIRO DECLARADO</div>
                  <div style={{ fontWeight: 900, color: gavetaConferida ? '#10b981' : '#f43f5e' }}>R$ {dinheiroDeclarado.toFixed(2)}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <button onClick={() => setShowConfirmClose(false)}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '0.9rem', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                  CANCELAR
                </button>
                <button onClick={handleFechamento}
                  style={{ background: 'linear-gradient(135deg, #f43f5e, #dc2626)', border: 'none', borderRadius: '12px', padding: '0.9rem', color: '#fff', fontWeight: 900, cursor: 'pointer' }}>
                  CONFIRMAR FECHAMENTO
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
