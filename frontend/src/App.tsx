import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { AuthProvider } from './contexts/AuthContext';
import { InstallProvider } from './contexts/InstallContext';
import { StatsProvider } from './contexts/StatsContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './contexts/ThemeContext';
import { Loader2 } from 'lucide-react';

// Code Splitting & Dynamic Route Imports for Minimal Memory Footprint
const Overview = lazy(() => import('./pages/Overview').then(m => ({ default: m.Overview })));
const Containers = lazy(() => import('./pages/Containers').then(m => ({ default: m.Containers })));
const ContainerDetail = lazy(() => import('./pages/ContainerDetail').then(m => ({ default: m.ContainerDetail })));
const AppStore = lazy(() => import('./pages/AppStore').then(m => ({ default: m.AppStore })));
const AppDetail = lazy(() => import('./pages/AppDetail').then(m => ({ default: m.AppDetail })));
const Images = lazy(() => import('./pages/Images').then(m => ({ default: m.Images })));
const Networks = lazy(() => import('./pages/Networks').then(m => ({ default: m.Networks })));
const Terminal = lazy(() => import('./pages/Terminal').then(m => ({ default: m.Terminal })));
const Metrics = lazy(() => import('./pages/Metrics').then(m => ({ default: m.Metrics })));
const Volumes = lazy(() => import('./pages/Volumes').then(m => ({ default: m.Volumes })));
const Logs = lazy(() => import('./pages/Logs').then(m => ({ default: m.Logs })));
const FileManager = lazy(() => import('./pages/FileManager').then(m => ({ default: m.FileManager })));
const DiskAnalyzer = lazy(() => import('./pages/DiskAnalyzer').then(m => ({ default: m.DiskAnalyzer })));
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Setup = lazy(() => import('./pages/Setup').then(m => ({ default: m.Setup })));

function PageFallback() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[50vh] p-8">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-orbit-500" />
        <span className="text-xs text-secondary font-medium tracking-wide">Carregando...</span>
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" defaultColor="zinc">
      <AuthProvider>
        <InstallProvider>
          <BrowserRouter>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/setup" element={<Setup />} />
                
                {/* Protected Dashboard Routes */}
                <Route 
                  path="/*" 
                  element={
                    <ProtectedRoute>
                      <StatsProvider>
                        <DashboardLayout>
                          <Suspense fallback={<PageFallback />}>
                            <Routes>
                              <Route path="/" element={<Overview />} />
                              <Route path="/metrics" element={<Metrics />} />
                              <Route path="/containers" element={<Containers />} />
                              <Route path="/containers/:id" element={<ContainerDetail />} />
                              <Route path="/store" element={<AppStore />} />
                              <Route path="/store/app/:id" element={<AppDetail />} />
                              <Route path="/images" element={<Images />} />
                              <Route path="/networks" element={<Networks />} />
                              <Route path="/volumes" element={<Volumes />} />
                              <Route path="/files" element={<FileManager />} />
                              <Route path="/disk-analyzer" element={<DiskAnalyzer />} />
                              <Route path="/terminal" element={<Terminal />} />
                              <Route path="/logs" element={<Logs />} />
                              <Route path="*" element={<Navigate to="/" replace />} />
                            </Routes>
                          </Suspense>
                        </DashboardLayout>
                      </StatsProvider>
                    </ProtectedRoute>
                  } 
                />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </InstallProvider>
        <Toaster 
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--card)',
              color: 'var(--primary)',
              border: '1px solid var(--border)',
            },
            success: {
              iconTheme: {
                primary: 'var(--orbit-500)',
                secondary: 'var(--bg)',
              },
            },
          }}
        />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
