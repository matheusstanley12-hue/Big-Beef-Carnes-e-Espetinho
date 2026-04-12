import { useCartStore } from '../../store/cartStore';
import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';

export const Cart = () => {
  const { items, addItem, removeItem, checkout } = useCartStore();
  const total = items.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
  const { qr_code } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    if (items.length === 0) return;
    setLoading(true);
    const success = await checkout(qr_code || '');
    setLoading(false);
    
    if (success) {
      alert("Pedido enviado com sucesso para a Cozinha e Bar!");
      navigate(`/c/${qr_code}`);
    } else {
      alert("Erro ao enviar pedido. Verifique o banco de dados.");
    }
  };

  if (items.length === 0) {
    return (
      <div className="animate-fade-in d-flex flex-col items-center justify-center text-center" style={{ minHeight: '50vh', padding: '2rem' }}>
        <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ width: 64, height: 64, color: 'var(--text-muted)', marginBottom: '1rem' }}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5h.008v.008H8.625v-.008Zm5.625 0h.008v.008h-.008v-.008Z" /></svg>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>O seu carrinho está vazio</p>
        <button className="btn-primary mt-4" onClick={() => navigate(`/c/${qr_code}`)}>Explorar Cardápio</button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-4">
      <h3 className="section-title">Meu Pedido</h3>
      
      <div className="d-flex flex-col gap-3 mb-4">
        {items.map(item => (
          <div key={item.id} className="card d-flex justify-between items-center">
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: 0, fontSize: '1.05rem' }}>{item.nome}</h4>
              <span style={{ fontWeight: 'bold', color: 'var(--accent-color)' }}>
                R$ {item.preco.toFixed(2).replace('.', ',')}
              </span>
            </div>
            
            <div className="d-flex items-center gap-4" style={{ backgroundColor: 'var(--bg-color)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <button onClick={() => removeItem(item.id)} style={{ color: 'var(--text-main)', padding: '0.25rem' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
              <span style={{ minWidth: '20px', textAlign: 'center', fontWeight: 'bold' }}>{item.quantidade}</span>
              <button onClick={() => addItem(item)} style={{ color: 'var(--text-main)', padding: '0.25rem' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ position: 'sticky', bottom: '-20px', zIndex: 10 }}>
        <div className="d-flex justify-between mb-4">
          <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>Total:</span>
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>
            R$ {total.toFixed(2).replace('.', ',')}
          </span>
        </div>
        <button className="btn-success" onClick={handleCheckout} disabled={loading}>
          {loading ? 'Enviando...' : 'Finalizar Pedido'}
        </button>
      </div>
    </div>
  );
};
