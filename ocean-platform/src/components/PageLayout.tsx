import type { ReactNode } from 'react';
import Navbar from './Navbar';

interface PageLayoutProps {
  children: ReactNode;
  className?: string;
  fullHeight?: boolean;
}

export default function PageLayout({ children, className = '', fullHeight = false }: PageLayoutProps) {
  return (
    // Transparent background — WaveBackground canvas shows through from App.tsx
    <div className="min-h-screen" style={{ background: 'transparent' }}>
      {/* Subtle prism glass overlay layer — sits above the wave canvas,
          adds the frosted prismatic sheen across the whole page */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 1,
          background: `
            radial-gradient(ellipse 80% 60% at 20% 30%, rgba(6,30,80,0.38) 0%, transparent 70%),
            radial-gradient(ellipse 60% 50% at 80% 70%, rgba(4,20,55,0.32) 0%, transparent 65%),
            radial-gradient(ellipse 50% 40% at 50% 0%,  rgba(10,40,100,0.25) 0%, transparent 60%)
          `,
        }}
      />

      {/* Ambient glow blobs (subtle, above prism layer) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 2 }}>
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/8 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-80 h-80 bg-blue-600/8 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-72 h-72 bg-purple-600/6 rounded-full blur-3xl" />
      </div>

      {/* Navbar sits above everything */}
      <Navbar />

      {/* Page content */}
      <main
        className={`relative pt-16 ${fullHeight ? 'h-screen' : 'min-h-screen'} ${className}`}
        style={{ zIndex: 10 }}
      >
        {children}
      </main>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, subtitle, icon, className = '' }: SectionHeaderProps) {
  return (
    <div className={`mb-8 ${className}`}>
      <div className="flex items-center gap-3 mb-2">
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
            {icon}
          </div>
        )}
        <h1 className="text-2xl font-bold gradient-text-ocean">{title}</h1>
      </div>
      {subtitle && <p className="text-white/50 text-sm ml-11">{subtitle}</p>}
    </div>
  );
}
