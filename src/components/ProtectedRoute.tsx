import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="container d-flex items-center justify-center" style={{ minHeight: '100vh' }}>
        <div className="text-center">
          <div className="animate-spin" style={{ width: '40px', height: '40px', border: '4px solid var(--primary-color)', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto' }}></div>
          <p className="mt-4 text-muted">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // O 'dono' tem acesso total a todas as rotas — pode visualizar qualquer painel da equipe
  if (allowedRoles && profile && !allowedRoles.includes(profile.role) && profile.role !== 'dono') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
