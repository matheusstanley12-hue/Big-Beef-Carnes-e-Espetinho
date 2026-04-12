import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import './index.css';

// AUTH
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';

// PÁGINAS
import { CustomerApp } from './pages/CustomerApp';
import { Garcom } from './pages/WaiterApp';
import { Producao } from './pages/ProductionApp';
import { Caixa } from './pages/CashierApp';
import { Administracao } from './pages/AdminApp';
import { Dono } from './pages/OwnerApp';
import { LoginPage } from './pages/LoginPage';

const RootRedirect = () => {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !profile && !loading) {
      signOut();
    }
  }, [user, profile, loading, signOut]);
  
  if (loading) {
    return (
      <div className="d-flex justify-center items-center h-screen" style={{ backgroundColor: '#000' }}>
        <div className="animate-spin" style={{ 
          width: '40px', 
          height: '40px', 
          border: '3px solid rgba(212, 175, 55, 0.1)', 
          borderTop: '3px solid var(--primary-color)', 
          borderRadius: '50%' 
        }}></div>
      </div>
    );
  }
  
  if (!user) return <Navigate to="/login" replace />;

  if (user && !profile) {
    return <Navigate to="/login" replace state={{ errorMessage: 'Usuário ou senha não foram encontrados, contate o seu gerente' }}/>;
  }
  
  // Se logado, redireciona para o painel correspondente ao cargo
  if (!profile) return null; // Espera o useEffect deslogar ou redirecionar

  switch (profile.role) {
    case 'dono': return <Navigate to="/dono" replace />;
    case 'admin': return <Navigate to="/admin" replace />;
    case 'caixa': return <Navigate to="/caixa" replace />;
    case 'cozinha': return <Navigate to="/producao" replace />;
    case 'garcom': return <Navigate to="/garcom" replace />;
    default: 
      return (
        <div className="container text-center mt-20">
          <h2>Cargo não reconhecido: {profile.role}</h2>
          <p>Contate o administrador.</p>
          <button onClick={() => signOut()} className="btn-danger mt-4" style={{ width: 'auto' }}>Sair e Voltar ao Login</button>
        </div>
      );
  }
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          
          {/* Public Route for Customers */}
          <Route path="/c/:qr_code/*" element={<CustomerApp />} />
          
          {/* Protected Routes for Staff */}
          <Route path="/garcom" element={<ProtectedRoute allowedRoles={['garcom', 'admin', 'dono', 'caixa']}><Garcom /></ProtectedRoute>} />
          <Route path="/producao" element={<ProtectedRoute allowedRoles={['cozinha']}><Producao /></ProtectedRoute>} />
          <Route path="/caixa" element={<ProtectedRoute allowedRoles={['caixa', 'garcom']}><Caixa /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><Administracao /></ProtectedRoute>} />
          <Route path="/dono" element={<ProtectedRoute allowedRoles={['dono']}><Dono /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
