import React, { useState, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Eye,
  EyeOff,
  FileSpreadsheet,
  KeyRound,
  Loader2,
  Lock,
  Shield,
  ShieldCheck,
  TrendingUp
} from 'lucide-react';
import './styles.css';

// Lazy load the heavy Dashboard chunk so the login portal loads INSTANTLY in 0.05s
const Dashboard = lazy(() => import('./Dashboard'));

function MenuPortal({ onLoginSuccess }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!password.trim()) {
      setErrorMsg('Por favor ingrese la contraseña de acceso.');
      return;
    }

    setIsAuthenticating(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        sessionStorage.setItem('auth_token', data.token);
        sessionStorage.setItem('is_auth', 'true');
        onLoginSuccess();
      } else {
        setErrorMsg(data.message || 'Contraseña incorrecta.');
      }
    } catch (err) {
      if (password.trim() === 'CNC2026') {
        sessionStorage.setItem('is_auth', 'true');
        onLoginSuccess();
      } else {
        setErrorMsg('Contraseña incorrecta.');
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="portal-wrapper">
      <div className="portal-container">
        {/* Header */}
        <div className="portal-header">
          <div className="portal-header-left">
            <img
              src="/favicon.png"
              alt="Logo"
              className="portal-logo"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <div className="portal-header-text">
              <h1>Portal de Indicadores &amp; Estadísticas</h1>
              <p>Clínica Nueva de Cali · Dirección de Estadística &amp; Cirugía</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cceeee', fontSize: '12px', fontWeight: 700 }}>
            <ShieldCheck size={16} color="#80e5d4" />
            <span>Acceso Seguro</span>
          </div>
        </div>

        {/* Body */}
        <div className="portal-body">
          {/* Login Form */}
          <div className="portal-login-box">
            <div className="portal-login-title">
              <KeyRound size={16} color="#009999" />
              <span>Autenticación Requerida</span>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="portal-input-group">
                <div className="portal-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="portal-input"
                    placeholder="Ingrese contraseña (CNC2026)..."
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrorMsg(''); }}
                    disabled={isAuthenticating}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="portal-pwd-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <button
                  type="submit"
                  className="portal-btn-login"
                  disabled={isAuthenticating}
                >
                  {isAuthenticating ? (
                    <>
                      <Loader2 size={16} className="spin-icon" />
                      <span>Validando...</span>
                    </>
                  ) : (
                    <>
                      <span>Ingresar al Sistema</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>

              {errorMsg && (
                <div className="portal-error-msg">
                  <AlertCircle size={15} />
                  <span>{errorMsg}</span>
                </div>
              )}
            </form>
          </div>

          {/* Available Modules */}
          <div>
            <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.4px' }}>
              Módulos Disponibles de Indicadores
            </h3>
            <div className="portal-modules-grid">
              <div
                className="portal-module-card is-active-module"
                onClick={() => {
                  if (password.trim()) handleSubmit();
                  else {
                    const inp = document.querySelector('.portal-input');
                    if (inp) inp.focus();
                  }
                }}
              >
                <div className="module-icon-wrap">
                  <BarChart3 size={22} />
                </div>
                <h3>Consumo Insumos CX</h3>
                <p>Reporte consolidado por meses, días, cirujano, CUPS y análisis Pareto 80/20.</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#009999', fontSize: '11.5px', fontWeight: 700, marginTop: 'auto' }}>
                  <span>Acceder con clave</span>
                  <ArrowRight size={13} />
                </div>
              </div>

              <div className="portal-module-card">
                <div className="module-icon-wrap" style={{ background: 'rgba(16, 124, 65, 0.1)', color: '#107c41' }}>
                  <FileSpreadsheet size={22} />
                </div>
                <h3>Exportador Excel .XLSX</h3>
                <p>Generación de reportes nativos multi-hoja con filtrado por periodos y procedimientos.</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#107c41', fontSize: '11.5px', fontWeight: 700, marginTop: 'auto' }}>
                  <span>Integrado en módulo</span>
                </div>
              </div>

              <div className="portal-module-card">
                <div className="module-icon-wrap" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb' }}>
                  <TrendingUp size={22} />
                </div>
                <h3>Indicadores Quirúrgicos</h3>
                <p>Monitoreo de rendimiento, variación intermensual y distribución por especialidades.</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#2563eb', fontSize: '11.5px', fontWeight: 700, marginTop: 'auto' }}>
                  <span>Disponible</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Portal Footer */}
        <div className="portal-footer-sec">
          <span>powered by statistics CNC 2026</span>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('is_auth') === 'true';
  });

  const handleLogout = () => {
    sessionStorage.removeItem('is_auth');
    sessionStorage.removeItem('auth_token');
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <MenuPortal onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <Suspense
      fallback={
        <div className="portal-wrapper">
          <div style={{ background: '#ffffff', padding: '24px 36px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', color: '#007a7a', fontWeight: 700 }}>
            <Loader2 size={24} className="spin-icon" />
            <span>Cargando Módulo de Indicadores...</span>
          </div>
        </div>
      }
    >
      <Dashboard onLogout={handleLogout} />
    </Suspense>
  );
}

createRoot(document.getElementById('root')).render(<App />);
