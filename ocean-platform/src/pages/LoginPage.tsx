import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Waves, Eye, EyeOff, Lock, Mail, Shield, User, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const defaultRole = searchParams.get('role') === 'government' ? 'government' : 'general';

  const [role, setRole] = useState<'general' | 'government'>(defaultRole);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard');
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const success = await login(email, password, role);
    setLoading(false);
    if (success) {
      navigate(role === 'government' ? '/gov' : '/dashboard');
    } else {
      setError('Invalid credentials. Check the demo credentials below.');
    }
  };

  const fillDemo = () => {
    if (role === 'general') {
      setEmail('user@ocean.gov');
      setPassword('ocean123');
    } else {
      setEmail('gov@ndma.gov.in');
      setPassword('gov@2026');
    }
  };

  return (
    <div className="min-h-screen gradient-ocean bg-grid flex items-center justify-center p-4">
      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md fade-in-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 glow-cyan mb-4">
            <Waves size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold gradient-text-ocean">OceanIntel</h1>
          <p className="text-white/50 mt-1 text-sm">Ocean & Climate Intelligence Platform</p>
        </div>

        {/* Role selector */}
        <div className="flex rounded-xl overflow-hidden glass border border-white/10 mb-6 p-1 gap-1">
          {(['general', 'government'] as const).map(r => (
            <button
              key={r}
              onClick={() => { setRole(r); setError(''); setEmail(''); setPassword(''); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                role === r
                  ? 'bg-gradient-to-r from-cyan-500/30 to-blue-600/30 text-white border border-cyan-500/30'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              {r === 'general' ? <User size={14} /> : <Shield size={14} />}
              {r === 'general' ? 'Analyst Login' : 'Government Login'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="glass rounded-2xl p-8 space-y-5 border border-white/10">
          {role === 'government' && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
              <Shield size={14} className="text-yellow-400 shrink-0" />
              <p className="text-yellow-400 text-xs">Government portal — restricted access</p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertCircle size={14} className="text-red-400 shrink-0" />
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs text-white/60 uppercase tracking-wider">Email</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50 focus:bg-white/8 transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-white/60 uppercase tracking-wider">Password</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-10 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50 focus:bg-white/8 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(o => !o)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm glow-cyan hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Authenticating...
              </span>
            ) : (
              `Sign in as ${role === 'government' ? 'Government Officer' : 'Analyst'}`
            )}
          </button>
        </form>

        {/* Demo credentials */}
        <div className="mt-4 glass rounded-xl p-4 border border-white/5">
          <p className="text-xs text-white/40 mb-2">Demo credentials</p>
          <div className="text-xs text-white/60 space-y-1">
            {role === 'general' ? (
              <>
                <p>Email: <span className="text-cyan-400">user@ocean.gov</span></p>
                <p>Password: <span className="text-cyan-400">ocean123</span></p>
              </>
            ) : (
              <>
                <p>Email: <span className="text-yellow-400">gov@ndma.gov.in</span></p>
                <p>Password: <span className="text-yellow-400">gov@2026</span></p>
              </>
            )}
          </div>
          <button onClick={fillDemo} className="mt-2 text-xs text-cyan-400 hover:text-cyan-300 underline underline-offset-2">
            Auto-fill
          </button>
        </div>
      </div>
    </div>
  );
}
