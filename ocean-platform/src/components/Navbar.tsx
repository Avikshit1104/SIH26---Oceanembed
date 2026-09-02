import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Waves, MessageSquare, LayoutDashboard, Globe, Wind,
  Thermometer, FileText, Shield, BarChart2, LogOut,
  Menu, X, ChevronDown, User, CheckSquare,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// Ordered exactly as specified:
// Dashboard, Input, Surface View, 3D View, Cyclone, Validation, Docs, X AI
// Gov Portal appended when logged in as government
const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/input',     label: 'Input Data',   icon: BarChart2 },
  { to: '/surface',   label: 'Surface Obs',  icon: Thermometer },
  { to: '/map',       label: '3D Profile',   icon: Globe },
  { to: '/cyclone',   label: 'Reconstruct',  icon: Wind },
  { to: '/validation',label: 'Validation',   icon: CheckSquare },
  { to: '/docs',      label: 'Docs',         icon: FileText, requiresAuth: true },
  { to: '/gov',       label: 'Gov Portal',   icon: Shield,   requiresGov: true },
  { to: '/chat',      label: 'X AI',         icon: MessageSquare },
];

export default function Navbar() {
  const { user, logout, isAuthenticated, isGovernment } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
    setUserMenuOpen(false);
  };

  const visibleItems = NAV_ITEMS.filter(item => {
    if (item.requiresGov) return isGovernment;
    return true;
  });

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-dark border-b border-white/10">
      <div className="max-w-screen-2xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <NavLink to="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center glow-cyan group-hover:scale-110 transition-transform">
            <Waves size={16} className="text-white" />
          </div>
          <span className="font-bold text-lg gradient-text-ocean hidden sm:block">
            OceanIntel
          </span>
        </NavLink>

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center gap-0.5 overflow-x-auto">
          {visibleItems.map(({ to, label, icon: Icon, requiresAuth }) => {
            // Docs link: if not authenticated, still show the link — the page
            // itself handles the "please login" state instead of hard-redirecting
            return (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all whitespace-nowrap
                  ${isActive
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : requiresAuth && !isAuthenticated
                      ? 'text-white/40 hover:text-white/60 hover:bg-white/5'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <Icon size={14} />
                {label}
                {requiresAuth && !isAuthenticated && (
                  <span className="text-[10px] opacity-60">🔒</span>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3 shrink-0">
          {isAuthenticated ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(o => !o)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg glass hover:bg-white/10 transition-all text-sm"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
                  <User size={12} className="text-white" />
                </div>
                <span className="hidden sm:block text-white/80">{user?.name}</span>
                <ChevronDown size={14} className={`text-white/50 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 glass-strong rounded-xl border border-white/15 p-1 shadow-2xl z-50">
                  <div className="px-3 py-2 border-b border-white/10 mb-1">
                    <p className="text-xs text-white/50">Signed in as</p>
                    <p className="text-sm text-white truncate">{user?.email}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full mt-1 inline-block ${
                      isGovernment ? 'bg-yellow-500/20 text-yellow-400' : 'bg-cyan-500/20 text-cyan-400'
                    }`}>
                      {isGovernment ? 'Government' : 'Analyst'}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                  >
                    <LogOut size={14} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-medium hover:opacity-90 transition-opacity glow-cyan"
            >
              Login
            </button>
          )}

          {/* Mobile toggle */}
          <button
            className="lg:hidden p-2 text-white/70 hover:text-white"
            onClick={() => setMobileOpen(o => !o)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden glass-dark border-t border-white/10 p-4 space-y-1">
          {visibleItems.map(({ to, label, icon: Icon, requiresAuth }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all
                ${isActive
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : requiresAuth && !isAuthenticated
                    ? 'text-white/40'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <Icon size={16} />
              {label}
              {requiresAuth && !isAuthenticated && <span className="ml-auto text-xs opacity-50">Login required</span>}
            </NavLink>
          ))}
        </div>
      )}
    </nav>
  );
}
