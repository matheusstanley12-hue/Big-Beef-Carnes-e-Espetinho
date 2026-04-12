import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Diagnóstico para erros em celulares (exibe alertas na tela caso a aplicação quebre)
window.onerror = function (msg, url, lineNo, columnNo, error) {
  // Ignora erros conhecidos de WebSocket do Supabase
  const msgStr = String(msg || '');
  if (msgStr.includes('send was called before connect')) return true;
  alert('🚨 Erro de carregamento: ' + msg + '\nLinha: ' + lineNo + (error ? '\nDetalhes: ' + error : ''));
  return false;
};

window.onunhandledrejection = function (event) {
  const reason = String(event.reason || '');
  // Suprime erros conhecidos e não-críticos (WebSocket do Supabase)
  if (reason.includes('send was called before connect')) {
    event.preventDefault();
    return;
  }
  // Loga ao invés de exibir alert() — menos intrusivo para o usuário
  console.warn('⚠️ Unhandled rejection:', event.reason);
};

createRoot(document.getElementById('root')!).render(

  <StrictMode>
    <App />
  </StrictMode>,
)
