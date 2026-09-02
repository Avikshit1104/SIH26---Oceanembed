import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Shield, LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import PageLayout from './PageLayout';

interface ProtectedRouteProps {
  children: ReactNode;
  requiresGovernment?: boolean;
}

export default function ProtectedRoute({
  children,
  requiresGovernment = false,
}: ProtectedRouteProps) {
  const { isAuthenticated, isGovernment } = useAuth();
  const navigate = useNavigate();

  // Not logged in at all
  if (!isAuthenticated) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
          <div className="glass rounded-2xl p-10 border border-white/10 text-center max-w-sm w-full mx-4 fade-in-up">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center mx-auto mb-5">
              <Lock size={24} className="text-cyan-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Authentication Required</h2>
            <p className="text-white/50 text-sm mb-6">
              You need to sign in to access this page.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm glow-cyan hover:opacity-90 transition-opacity"
            >
              <LogIn size={16} />
              Sign In
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  // Logged in but wrong role for government pages
  if (requiresGovernment && !isGovernment) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
          <div className="glass rounded-2xl p-10 border border-yellow-500/20 text-center max-w-sm w-full mx-4 fade-in-up">
            <div className="w-14 h-14 rounded-2xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center mx-auto mb-5">
              <Shield size={24} className="text-yellow-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Government Access Only</h2>
            <p className="text-white/50 text-sm mb-6">
              This portal is restricted to authorised government officers.
            </p>
            <button
              onClick={() => navigate('/login?role=government')}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              <Shield size={16} />
              Government Login
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  return <>{children}</>;
}
