import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Calculator, ArrowRight, DollarSign, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface AberturaCaixaProps {
  onOpen: () => void;
}

export const AberturaCaixa = ({ onOpen }: AberturaCaixaProps) => {
  const { profile } = useAuth();
  const [fundoTroco, setFundoTroco] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAbrirCaixa = async () => {
    const valor = parseFloat(fundoTroco.replace(',', '.'));
    if (isNaN(valor) || valor < 0) {
      alert('Informe um valor de fundo de troco válido (pode ser 0).');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('turnos_caixa')
        .insert([{
          operador_id: profile?.id,
          fundo_troco: valor,
          status: 'aberto'
        }])
        .select()
        .single();

      if (error) throw error;

      // Guardar ID no localStorage para referência rápida
      localStorage.setItem('turno_id', data.id);
      localStorage.setItem('os_number', (data.os_number || '---').toString());
      localStorage.setItem('turno_inicio', data.aberto_em);
      localStorage.setItem('fundo_troco', valor.toFixed(2));
      
      alert(`Caixa Aberto com Sucesso!\nO.S. Número: #${data.os_number || '---'}`);
      onOpen();
    } catch (err: any) {
      alert('Erro ao abrir o caixa: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '80vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at center, rgba(212,175,55,0.05) 0%, transparent 70%)'
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
          width: '100%',
          maxWidth: '450px',
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(212, 175, 55, 0.2)',
          borderRadius: '24px',
          padding: '2.5rem',
          textAlign: 'center',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}
      >
        <div style={{
          width: '70px',
          height: '70px',
          background: 'rgba(212, 175, 55, 0.1)',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem',
          color: '#d4af37'
        }}>
          <Lock size={32} />
        </div>

        <h1 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '0.5rem', color: '#fff', letterSpacing: '-0.5px' }}>
          CONTROLE DE ACESSO
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '2.5rem', fontSize: '1rem', lineHeight: '1.5' }}>
          Boa tarde, <b>{profile?.full_name?.split(' ')[0]}</b>! <br />
          <span style={{ fontSize: '0.85rem', opacity: 0.7 }}>Identifique o <b>fundo de troco inicial</b> para liberar as vendas e mesas.</span>
        </p>

        <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
          <label style={{
            fontSize: '0.7rem',
            fontWeight: 800,
            color: '#d4af37',
            letterSpacing: '1px',
            display: 'block',
            marginBottom: '8px'
          }}>
            FUNDO DE TROCO INICIAL (R$)
          </label>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute',
              left: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '1.2rem',
              fontWeight: 900,
              color: 'rgba(255,255,255,0.2)'
            }}>R$</span>
            <input
              type="number"
              step="0.01"
              autoFocus
              value={fundoTroco}
              onChange={(e) => setFundoTroco(e.target.value)}
              placeholder="0,00"
              onKeyDown={(e) => e.key === 'Enter' && handleAbrirCaixa()}
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.2)',
                border: '2px solid rgba(212,175,55,0.3)',
                borderRadius: '16px',
                padding: '1.2rem 1rem 1.2rem 3.5rem',
                color: '#fff',
                fontSize: '1.5rem',
                fontWeight: 900,
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = '#d4af37'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(212,175,55,0.3)'}
            />
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '1rem',
          background: 'rgba(255,255,255,0.02)',
          padding: '1rem',
          borderRadius: '16px',
          marginBottom: '2rem'
        }}>
          <div style={{ textAlign: 'left' }}>
             <div style={{ fontSize: '0.6rem', opacity: 0.4 }}>DATA</div>
             <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{new Date().toLocaleDateString('pt-BR')}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
             <div style={{ fontSize: '0.6rem', opacity: 0.4 }}>HORA ATUAL</div>
             <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={loading}
          onClick={handleAbrirCaixa}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #d4af37 0%, #b8962e 100%)',
            color: '#000',
            border: 'none',
            borderRadius: '16px',
            padding: '1.2rem',
            fontWeight: 900,
            fontSize: '1rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            boxShadow: '0 10px 20px -5px rgba(212, 175, 55, 0.3)',
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              style={{ width: '20px', height: '20px', border: '2px solid rgba(0,0,0,0.1)', borderTopColor: '#000', borderRadius: '50%' }}
            />
          ) : (
            <>
              INICIAR JORNADA <ArrowRight size={20} />
            </>
          )}
        </motion.button>

        <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: 0.4, fontSize: '0.75rem' }}>
          <Clock size={12} />
          Início de registro automático em tempo real
        </div>
      </motion.div>
    </div>
  );
};
