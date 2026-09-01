import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { User, KeyRound, AlertCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { OrbitLogo } from '../components/ui/OrbitLogo';

export function Setup() {
  const { t } = useTranslation();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password || !confirmPassword) {
      setError(t('auth.required_fields', 'Por favor, preencha todos os campos.'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('auth.password_mismatch', 'As senhas não coincidem.'));
      return;
    }

    if (password.length < 6) {
      setError(t('auth.password_min_length', 'A senha deve ter no mínimo 6 caracteres.'));
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        throw new Error(t('auth.setup_error', 'Erro ao configurar usuário. Pode já existir.'));
      }

      await response.json();
      
      // We simulate storing a token because the actual auth is in HttpOnly cookie
      login('logged_in_token');
      
      // Hard refresh to reload contexts and skip setup check
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || t('auth.setup_error', 'Erro ao realizar setup inicial.'));
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
          <div className="p-1 rounded-3xl bg-card border border-border/80 shadow-2xl shadow-orbit-500/10 flex items-center justify-center transform hover:scale-105 transition-transform duration-500">
            <OrbitLogo size={64} className="rounded-2xl" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-primary">
          {t('auth.welcome_orbit', 'Bem-vindo ao Orbit')}
        </h2>
        <p className="mt-2 text-center text-sm text-secondary">
          {t('auth.setup_subtitle', 'Crie seu usuário administrador para começar')}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 animate-slide-up">
        <div className="bg-card py-8 px-4 shadow-2xl sm:rounded-2xl sm:px-10 border border-border hover:shadow-orbit-500/10 transition-shadow duration-500">
          <form className="space-y-6" onSubmit={handleSubmit}>
            
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/50 rounded-lg p-3 flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-rose-500 font-medium">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-primary">
                {t('auth.username', 'Usuário')}
              </label>
              <div className="mt-2 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-secondary" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 bg-background border border-border rounded-xl text-primary placeholder:text-secondary/60 focus:outline-none focus:ring-2 focus:ring-orbit-500/50 focus:border-orbit-500 text-sm transition-colors shadow-sm"
                  placeholder={t('auth.username', 'admin')}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-primary">
                {t('auth.password', 'Senha')}
              </label>
              <div className="mt-2 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyRound className="h-5 w-5 text-secondary" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 bg-background border border-border rounded-xl py-2.5 text-primary placeholder:text-secondary/60 focus:ring-2 focus:ring-orbit-500/50 focus:border-orbit-500 text-sm transition-colors shadow-sm"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-secondary hover:text-primary transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-primary">
                {t('auth.confirm_password', 'Confirmar Senha')}
              </label>
              <div className="mt-2 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyRound className="h-5 w-5 text-secondary" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 bg-background border border-border rounded-xl py-2.5 text-primary placeholder:text-secondary/60 focus:ring-2 focus:ring-orbit-500/50 focus:border-orbit-500 text-sm transition-colors shadow-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center items-center space-x-2 rounded-xl bg-orbit-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orbit-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orbit-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5" />
                    <span>{t('auth.create_account_sign_in', 'Criar Conta e Entrar')}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
