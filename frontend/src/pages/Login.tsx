import React, { useState } from 'react';
import { useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Lock, User, KeyRound, AlertCircle, Eye, EyeOff, Sparkles } from 'lucide-react';

export function Login() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const isUpdated = searchParams.get('updated') === 'true';
  const updatedVersion = searchParams.get('version') || localStorage.getItem('orbit_last_updated_version');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, needsSetup } = useAuth();
  const navigate = useNavigate();

  if (needsSetup) {
    return <Navigate to="/setup" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!username || !password) {
      setError(t('auth.required_fields', 'Por favor, preencha todos os campos.'));
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(t('auth.invalid_credentials', 'Credenciais inválidas.'));
        } else if (response.status === 429) {
          throw new Error(t('auth.too_many_attempts', 'Muitas tentativas. Aguarde 5 minutos.'));
        } else {
          throw new Error(t('auth.server_error', 'Erro ao conectar com o servidor.'));
        }
      }

      await response.json();
      
      login('logged_in_token');
      
      navigate('/');
    } catch (err: any) {
      setError(err.message || t('auth.login_error', 'Erro ao realizar login.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden text-secondary">
      {/* Background decoration */}
      <div className="absolute inset-0 z-0 opacity-10">
        <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-orbit-500 rounded-full blur-[120px]" />
        <div className="absolute top-3/4 right-0 w-1/3 h-1/3 bg-blue-500 rounded-full blur-[100px]" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 animate-fade-in">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-accent/80 backdrop-blur-xl border border-border/50 rounded-2xl flex items-center justify-center shadow-2xl shadow-orbit-900/50 overflow-hidden transform hover:scale-105 transition-transform duration-500">
            <img src="/favicon.jpg?v=2" alt="Orbit Logo" className="w-full h-full object-cover" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-white">
          Orbit
        </h2>
        <p className="mt-2 text-center text-sm text-gray-400">
          {t('auth.login_subtitle', 'Painel de Controle de Contêineres')}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 animate-slide-up">
        <div className="bg-card/40 backdrop-blur-xl py-8 px-4 shadow-2xl sm:rounded-2xl sm:px-10 border border-border hover:shadow-orbit-500/10 transition-shadow duration-500">
          {isUpdated && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3 text-left animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  {t('auth.update_success_banner_title', 'Orbit Atualizado com Sucesso!')}
                  {updatedVersion && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      v{updatedVersion.replace(/^v/, '')}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-emerald-200/80 mt-1 leading-relaxed">
                  {t('auth.update_success_banner_msg', 'O sistema foi atualizado para a versão mais recente. Faça login para acessar o painel.')}
                </p>
              </div>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/50 rounded-lg p-3 flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-rose-200">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300">
                {t('auth.username', 'Usuário')}
              </label>
              <div className="mt-2 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 bg-background/50 border border-border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orbit-500/50 focus:border-orbit-500 text-sm transition-colors"
                  placeholder={t('auth.username', 'Seu usuário')}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                {t('auth.password', 'Senha')}
              </label>
              <div className="mt-2 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-2.5 bg-background/50 border border-border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orbit-500/50 focus:border-orbit-500 text-sm transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-orbit-600 hover:bg-orbit-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orbit-500 disabled:opacity-50 transition-all duration-300 transform active:scale-95"
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{t('auth.signing_in', 'Entrando...')}</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <KeyRound className="w-4 h-4" />
                    <span>{t('auth.sign_in', 'Entrar no Dashboard')}</span>
                  </div>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-card/40 text-gray-500 text-xs">
                  {t('auth.secure_panel', 'Painel Seguro')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
