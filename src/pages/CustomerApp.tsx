import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Menu } from './customer/Menu';
import { useState, useEffect } from 'react';

// Toast Component (substituindo alert() nativo que causa bugs no mobile)
const Toast = ({ message, type }: { message: string; type: 'success' | 'error' | 'info' }) => {
  const colors: Record<string, string> = {
    success: 'var(--success-color)',
    error: 'var(--danger-color)',
    info: 'var(--primary-color)'
  };
  return (
    <div style={{
      position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)',
      background: colors[type], color: '#000', padding: '1rem 1.5rem',
      borderRadius: '12px', fontWeight: 700, fontSize: '1rem', zIndex: 9999,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)', maxWidth: '90vw', textAlign: 'center',
      animation: 'slideDown 0.3s ease'
    }}>
      {message}
    </div>
  );
};

const StarRating = ({ rating, setRating, label }: any) => {
  return (
    <div className="mb-4">
      <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
      <div className="d-flex gap-2">
        {[1, 2, 3, 4, 5].map(star => (
          <svg 
            key={star} onClick={() => setRating(star)}
            width="32" height="32" viewBox="0 0 24 24" 
            fill={star <= rating ? 'var(--primary-color)' : 'transparent'} 
            stroke={star <= rating ? 'var(--primary-color)' : 'var(--text-muted)'} 
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
            style={{ cursor: 'pointer', transition: 'all 0.2s', filter: star <= rating ? 'drop-shadow(0 0 4px rgba(212,175,55,0.4))' : 'none' }}
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        ))}
      </div>
    </div>
  );
};

export const CustomerApp = () => {
  const { qr_code } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const mesaNum = qr_code?.replace('mesa-', '').replace('-qr', '');

  const [showAvaliacao, setShowAvaliacao] = useState(false);
  const [notaAtendimento, setNotaAtendimento] = useState(0);
  const [notaComida, setNotaComida] = useState(0);
  const [notaAmbiente, setNotaAmbiente] = useState(0);
  const [sugestoes, setSugestoes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!mesaNum) return;
    
    const interval = setInterval(async () => {
      const { data } = await supabase.from('mesas').select('status').eq('numero', parseInt(mesaNum)).single();
      if (data) {
        if (data.status !== 'livre') {
          localStorage.setItem(`mesa_ativa_${mesaNum}`, 'true');
        } else if (data.status === 'livre' && localStorage.getItem(`mesa_ativa_${mesaNum}`) === 'true') {
          setShowAvaliacao(true);
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [mesaNum]);

  const handleCallWaiter = async () => {
    if (!mesaNum) return;
    const { error } = await supabase.rpc('chamar_garcom', { p_numero: parseInt(mesaNum) });
    if (!error) {
      showToast('🛎️ Garçom chamado! Aguarde ele está a caminho.', 'success');
    } else {
      showToast('Erro ao chamar garçom. Tente novamente.', 'error');
    }
  };


  const handleEnviarAvaliacao = async () => {
    if (notaAtendimento === 0 || notaComida === 0 || notaAmbiente === 0) {
      showToast('⚠️ Selecione as estrelas para todas as categorias!', 'error');
      return;
    }
    
    setIsSubmitting(true);
    await supabase.from('avaliacoes').insert({
      mesa_numero: parseInt(mesaNum || '0'),
      nota_atendimento: notaAtendimento,
      nota_comida: notaComida,
      nota_ambiente: notaAmbiente,
      sugestoes: sugestoes
    });
    
    localStorage.removeItem(`mesa_ativa_${mesaNum}`);
    setIsSubmitting(false);
    setShowAvaliacao(false);
    showToast('🙏 Obrigado pela avaliação! Volte sempre!', 'success');
  };

  const handlePularAvaliacao = () => {
    localStorage.removeItem(`mesa_ativa_${mesaNum}`);
    setShowAvaliacao(false);
  };

  if (showAvaliacao) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {toast && <Toast message={toast.message} type={toast.type} />}
        <h2 style={{ fontSize: '1.8rem', color: 'var(--primary-color)', textAlign: 'center', marginBottom: '0.5rem' }}>Obrigado pela preferência!</h2>
        <p className="text-muted text-center" style={{ marginBottom: '2rem' }}>Sua mesa foi finalizada. O que achou da experiência no BIG BEEF CARNES E ESPETINHO?</p>

        
        <div className="container" style={{ padding: '1.5rem', marginBottom: '2rem', paddingBottom: '8rem' }}>
          <StarRating label="Como foi o Atendimento?" rating={notaAtendimento} setRating={setNotaAtendimento} />
          <StarRating label="O que achou da Comida?" rating={notaComida} setRating={setNotaComida} />
          <StarRating label="A vibe e o Ambiente?" rating={notaAmbiente} setRating={setNotaAmbiente} />
          
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase' }}>Críticas ou Sugestões? (Opcional)</div>
            <textarea 
              value={sugestoes}
              onChange={e => setSugestoes(e.target.value)}
              placeholder="Conta pra gente o que podemos melhorar..."
              style={{ width: '100%', height: '100px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', padding: '1rem', resize: 'none', outline: 'none' }}
            />
          </div>
        </div>
        
        <div className="d-flex flex-col gap-3">
          <button className="btn-primary" style={{ padding: '1.2rem', fontSize: '1.2rem' }} onClick={handleEnviarAvaliacao} disabled={isSubmitting}>
            {isSubmitting ? 'Enviando...' : '⭐ Enviar Avaliação'}
          </button>
          <button onClick={handlePularAvaliacao} style={{ backgroundColor: 'transparent', color: 'var(--text-muted)', border: 'none', padding: '1rem', textDecoration: 'underline' }}>
             Pular por enquanto
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {toast && <Toast message={toast.message} type={toast.type} />}

      <header style={{ 
        padding: '1.2rem 1.5rem', backgroundColor: 'rgba(0, 0, 0, 0.4)', borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        position: 'sticky', top: 0, zIndex: 100, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <img src="/logo.jpg" alt="Logo" style={{ width: '50px', height: '50px', borderRadius: '12px', objectFit: 'contain' }} />
          <div>
            <h2 style={{ fontSize: '1.3rem', margin: 0, color: 'var(--primary-color)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1 }}>BIG BEEF CARNES E ESPETINHO</h2>
            <div style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 600, marginTop: '4px', opacity: 0.8 }}>MESA {mesaNum}</div>
          </div>
        </div>
        <div style={{ border: '1px solid rgba(212, 175, 55, 0.5)', padding: '8px 12px', borderRadius: '10px', backgroundColor: 'rgba(212, 175, 55, 0.05)' }}>
           <span style={{ fontSize: '0.7rem', color: 'var(--primary-color)', fontWeight: 800, letterSpacing: '0.5px' }}>CARDÁPIO DIGITAL</span>
        </div>
      </header>

      <main className="container" style={{ flex: 1, overflowY: 'auto', paddingBottom: '90px' }}>
        <Routes>
          <Route path="/" element={<Menu />} />
        </Routes>

        <footer style={{ 
          marginTop: '3rem', padding: '2rem 1rem', textAlign: 'center', 
          borderTop: '1px solid var(--border-color)', opacity: 0.7 
        }}>
          <p style={{ color: 'var(--primary-color)', fontStyle: 'italic', fontSize: '0.8rem', lineHeight: 1.6, textAlign: 'center' }}>
            BIG BEEF CARNES E ESPETINHO<br/>O melhor churrasco da região
          </p>

        </footer>
      </main>

      {/* Bottom Nav - Refined Mobile Layout */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, 
        backgroundColor: 'rgba(26, 26, 26, 0.95)',
        borderTop: '1px solid rgba(212, 175, 55, 0.1)', 
        padding: '0.75rem 0 1.5rem',
        display: 'flex', justifyContent: 'space-around', alignItems: 'center', 
        zIndex: 1000,
        backdropFilter: 'blur(15px)'
      }}>
        <button onClick={() => navigate(`/c/${qr_code}`)} style={{ 
          color: location.pathname.endsWith(qr_code || '') ? 'var(--primary-color)' : 'var(--text-muted)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>Início</div>
        </button>

        <button onClick={handleCallWaiter} style={{ 
          backgroundColor: 'var(--primary-color)',
          color: '#000',
          width: '56px',
          height: '56px',
          borderRadius: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: '-30px',
          boxShadow: '0 8px 20px rgba(212, 175, 55, 0.3)',
          border: '4px solid #121212'
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
        </button>

        <button style={{ color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1, opacity: 0.5 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>Sacola</div>
        </button>
      </div>

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
};
