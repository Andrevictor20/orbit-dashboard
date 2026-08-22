import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { Overview } from './pages/Overview';
import { Containers } from './pages/Containers';
import { ContainerDetail } from './pages/ContainerDetail';
import { AppStore } from './pages/AppStore';
import { AppDetail } from './pages/AppDetail';
import { Images } from './pages/Images';
import { Networks } from './pages/Networks';
import { Terminal } from './pages/Terminal';
import { Metrics } from './pages/Metrics';
import { Volumes } from './pages/Volumes';
import { Logs } from './pages/Logs';
import { FileManager } from './pages/FileManager';
import { Login } from './pages/Login';
import { Setup } from './pages/Setup';
import { AuthProvider } from './contexts/AuthContext';
import { InstallProvider } from './contexts/InstallContext';
import { StatsProvider } from './contexts/StatsContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './components/ThemeProvider';

function App() {
  return (
    <ThemeProvider defaultTheme="dark" defaultColor="zinc">
      <AuthProvider>
        <InstallProvider>
          <BrowserRouter>
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
                        <Route path="/terminal" element={<Terminal />} />
                        <Route path="/logs" element={<Logs />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </DashboardLayout>
                  </StatsProvider>
                </ProtectedRoute>
              } 
            />
          </Routes>
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
