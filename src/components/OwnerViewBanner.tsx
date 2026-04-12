import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * OwnerViewBanner
 * Shown at the top of any staff panel when the owner is viewing it.
 * Provides a one-click return to the owner's dashboard.
 */
export const OwnerViewBanner = ({ panelName }: { panelName: string }) => {
  const { profile } = useAuth();
  const navigate = useNavigate();

  if (profile?.role !== 'dono') return null;

  return (
    <div style={{
      position: 'sticky', top: 0, left: 0, right: 0, zIndex: 100,
      background: 'linear-gradient(90deg, #d4af37, #b8961e)',
      color: '#000', padding: '12px 1.5rem',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      boxShadow: '0 4px 15px rgba(0,0,0,0.3)', fontSize: '0.85rem',
      marginBottom: '1rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700 }}>
        <span>👁️</span>
        <span>Visualizando como: <strong>{panelName}</strong></span>
      </div>
      <button
        onClick={() => navigate('/dono')}
        style={{
          background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(0,0,0,0.3)',
          color: '#000', padding: '5px 14px', borderRadius: '20px',
          fontWeight: 800, cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px'
        }}
      >
        ← Voltar ao Painel do Proprietário
      </button>
    </div>
  );
};
