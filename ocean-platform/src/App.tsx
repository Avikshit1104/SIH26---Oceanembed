import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import ProtectedRoute from './components/ProtectedRoute';

// Eagerly loaded
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';

// Lazy loaded pages
const ChatPage        = lazy(() => import('./pages/ChatPage'));
const InputPage       = lazy(() => import('./pages/InputPage'));
const DashboardPage   = lazy(() => import('./pages/DashboardPage'));
const MapPage         = lazy(() => import('./pages/MapPage'));
const CyclonePage     = lazy(() => import('./pages/CyclonePage'));
const SurfacePage     = lazy(() => import('./pages/SurfacePage'));
const DocsPage        = lazy(() => import('./pages/DocsPage'));
const GovPortalPage   = lazy(() => import('./pages/GovPortalPage'));
const ValidationPage  = lazy(() => import('./pages/ValidationPage'));

function PageLoader() {
  return (
    <div className="min-h-screen gradient-ocean flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
        <p className="text-white/40 text-sm">Loading...</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/"         element={<HomePage />} />
              <Route path="/login"    element={<LoginPage />} />
              <Route path="/chat"     element={<ChatPage />} />
              <Route path="/input"    element={<InputPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/map"      element={<MapPage />} />
              <Route path="/cyclone"  element={<CyclonePage />} />
              <Route path="/surface"  element={<SurfacePage />} />
              <Route path="/docs"     element={
                <ProtectedRoute><DocsPage /></ProtectedRoute>
              } />
              <Route path="/gov"      element={
              <ProtectedRoute requiresGovernment>
                  <GovPortalPage />
                </ProtectedRoute>
              } />
              <Route path="/validation" element={<ValidationPage />} />
            </Routes>
          </Suspense>
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
