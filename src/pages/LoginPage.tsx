import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff } from 'lucide-react';

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const from = location.state?.from?.pathname || '/';
  const stateErrorMessage = location.state?.errorMessage;

  useEffect(() => {
    if (stateErrorMessage) {
      setMessage({ type: 'error', text: stateErrorMessage });
      // Limpa o state para não ficar mostrando o erro caso a página recarregue
      window.history.replaceState({}, document.title)
    }
  }, [stateErrorMessage]);

  useEffect(() => {
    if (user && !stateErrorMessage) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from, stateErrorMessage]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;
      
      navigate(from, { replace: true });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao realizar login' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="d-flex items-center justify-center" 
      style={{ 
        minHeight: '100vh',
        backgroundColor: '#000000',
        position: 'relative',
        width: '100%'
      }}
    >
      <div 
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          zIndex: 0
        }}
      />
      
      <div 
        className="card" 
        style={{ 
          width: '90%', 
          maxWidth: '400px', 
          padding: '2.5rem', 
          zIndex: 1, 
          position: 'relative', 
          backdropFilter: 'blur(12px)', 
          backgroundColor: 'rgba(20, 20, 20, 0.75)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)'
        }}
      >
        <div className="text-center mb-8">
          <img src="/logo.jpg" alt="Logo BIG BEEF CARNES E ESPETINHO" style={{ width: '120px', height: '120px', objectFit: 'contain', marginBottom: '1rem', borderRadius: '50%', border: '2px solid var(--primary-color)', padding: '5px', backgroundColor: 'rgba(0,0,0,0.3)' }} />
          <h1 style={{ color: 'var(--primary-color)', fontSize: '1.75rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Acesso Restrito</h1>
          <p style={{ color: '#ccc' }}>Área Privada - BIG BEEF CARNES E ESPETINHO</p>
        </div>


        {message.text && (
          <div className={`mb-4 p-3 rounded text-center ${message.type === 'error' ? 'bg-danger-light text-danger' : 'bg-success-light text-success'}`} style={{ fontSize: '0.85rem' }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleLogin} className="d-flex flex-col gap-4">
          <div className="d-flex flex-col gap-2">
            <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                padding: '0.8rem', backgroundColor: '#222', border: '1px solid var(--border-color)',
                borderRadius: '8px', color: 'white', outline: 'none'
              }}
              placeholder="seu@email.com"
            />
          </div>

          <div className="d-flex flex-col gap-2 relative">
            <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Senha</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: '100%', padding: '0.8rem', paddingRight: '2.5rem', backgroundColor: '#222', border: '1px solid var(--border-color)',
                  borderRadius: '8px', color: 'white', outline: 'none'
                }}
                placeholder="••••••••"
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: '0.8rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', paddingTop: '2px'
                }}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn-primary" 
            disabled={loading}
            style={{ marginTop: '1rem' }}
          >
            {loading ? 'Entrando...' : 'Entrar no Sistema'}
          </button>
        </form>

        <p className="text-center mt-6" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Esqueceu seu acesso? Contate o gerente.
        </p>
      </div>
    </div>
  );
};
