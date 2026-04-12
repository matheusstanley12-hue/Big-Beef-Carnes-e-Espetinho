import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';

// Helper mock array in case DB isn't seeded yet
const MOCK_PRODUCTS = [
  { id: '1', nome: 'Frango a Passarinho', categoria: 'PETISCO', preco: 29.90, estoque: 99 },
  { id: '2', nome: 'Batata Turbinada', categoria: 'PETISCO', preco: 29.90, estoque: 99 },
  { id: '3', nome: 'Heineken Long Neck', categoria: 'BEBIDAS', preco: 12.00, estoque: 99 },
  { id: '4', nome: 'Caipirinha Cachaça', categoria: 'COQUETÉIS', preco: 15.00, estoque: 99 },
  { id: '5', nome: 'Johnnie Walker', categoria: 'DESTILADOS (DOSE)', preco: 15.00, estoque: 99 }
];

export const Menu = () => {
  const [products, setProducts] = useState(MOCK_PRODUCTS);
  const [activeTab, setActiveTab] = useState('PETISCO');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchProducts = async () => {
    const { data } = await supabase.from('produtos').select('*').eq('ativo', true).order('nome', { ascending: true });
    if (data && data.length > 0) {
      setProducts(data);
    }
  };

  useEffect(() => {
    fetchProducts();
    
    // Polling de 10 segundos para garantir preços atualizados
    const interval = setInterval(fetchProducts, 10000);

    // Inscrição em tempo real para mudanças nos produtos
    const channel = supabase
      .channel('menu-products-realtime')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'produtos' }, 
        () => {
          fetchProducts();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const categories = Array.from(new Set(products.map(p => p.categoria.toUpperCase())));
  const filtered = useMemo(() => {
    const normalizeStr = (s: string) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const searchLower = normalizeStr(searchTerm);
    return products.filter(p => {
      const matchesSearch = normalizeStr(p.nome).includes(searchLower) || normalizeStr(p.categoria).includes(searchLower);
      const matchesCategory = p.categoria.toUpperCase() === activeTab;
      return searchTerm ? matchesSearch : matchesCategory;
    });
  }, [products, searchTerm, activeTab]);

  // Garantir que a aba ativa existe nas categorias se elas mudarem
  useEffect(() => {
    if (categories.length > 0 && !categories.includes(activeTab)) {
      setActiveTab(categories[0]);
    }
  }, [categories]);

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '2rem' }}>
      {/* Barra de Pesquisa Global */}
      <div style={{ marginBottom: '1.5rem' }}>
        <input 
          type="text" 
          placeholder="🔍 O que você procura?" 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '1rem 1.5rem',
            background: 'var(--surface-color)',
            border: '1px solid var(--border-color)',
            borderRadius: '15px',
            color: '#fff',
            fontSize: '1rem',
            outline: 'none',
            boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
          }}
        />
      </div>

      {/* Categoria Tabs - Estilo Screenshot (Arredondado) */}
      <div className="no-scrollbar" style={{ 
        display: 'flex', 
        gap: '0.8rem', 
        overflowX: 'auto', 
        WebkitOverflowScrolling: 'touch', 
        marginBottom: '2rem', 
        padding: '1rem 0',
        position: 'sticky',
        top: '75px',
        zIndex: 10,
        margin: '0 -1.25rem 1.5rem -1.25rem',
        paddingLeft: '1.25rem'
      }}>
        {categories.map(cat => (
          <button 
            key={cat} 
            onClick={() => setActiveTab(cat)}
            style={{
              padding: '0.8rem 1.5rem', 
              borderRadius: '20px', 
              whiteSpace: 'nowrap', 
              textTransform: 'uppercase',
              fontSize: '0.8rem',
              letterSpacing: '1px',
              backgroundColor: activeTab === cat ? '#facc15' : 'rgba(255,255,255,0.1)',
              color: activeTab === cat ? '#000' : '#fff',
              fontWeight: 800,
              boxShadow: activeTab === cat ? '0 4px 15px rgba(250, 204, 21, 0.3)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid de Itens (Cards como estava antes) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {filtered.map(product => (
          <div key={product.id} className="card" style={{ 
            padding: '1.5rem', 
            background: 'var(--surface-color)',
            border: '1px solid var(--border-color)',
            borderRadius: '20px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>{product.nome}</h4>
                <div style={{ fontSize: '0.7rem', color: 'var(--primary-color)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>{product.categoria}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ 
                  color: 'var(--primary-color)', 
                  fontWeight: 900, 
                  fontSize: '1.3rem',
                  textShadow: '0 2px 10px rgba(0,0,0,0.3)'
                }}>
                  R$ {product.preco?.toFixed(2).replace('.', ',')}
                </div>
              </div>
            </div>
            
            {product.estoque <= 0 && (
              <div style={{ 
                marginTop: '10px', 
                color: 'var(--danger-color)', 
                fontSize: '0.7rem', 
                fontWeight: 900, 
                textTransform: 'uppercase',
                letterSpacing: '1px',
                background: 'rgba(239, 68, 68, 0.1)',
                padding: '4px 8px',
                borderRadius: '4px',
                display: 'inline-block'
              }}>
                Esgotado
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
