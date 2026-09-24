import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  Shield,
  User,
  AlertCircle,
  ArrowLeft,
  FileText,
  Building2,
  BookOpen,
  ArrowRight,
  Sparkles,
  Unlock,
} from 'lucide-react';
import { useAuth, MOCK_USERS } from '../contexts/AuthContext';
import WaterBackground from '../components/WaterBackground';
import IndiaFlag from '../components/IndiaFlag';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const urlRole = searchParams.get('role');
  const initialRole =
    urlRole === 'government'
      ? 'government'
      : urlRole === 'researcher'
      ? 'researcher'
      : 'general';

  const [role, setRole] = useState<'general' | 'government' | 'researcher'>(initialRole);
  const [loginId, setLoginId] = useState(MOCK_USERS[initialRole].email);
  const [password, setPassword] = useState(MOCK_USERS[initialRole].password);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login, quickLogin, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      if (user?.role === 'government') navigate('/gov');
      else if (user?.role === 'researcher') navigate('/docs');
      else navigate('/dashboard');
    }
  }, [isAuthenticated, user, navigate]);

  // Update credentials when role changes
  const handleSelectRole = (newRole: 'general' | 'government' | 'researcher') => {
    setRole(newRole);
    setError('');
    setLoginId(MOCK_USERS[newRole].email);
    setPassword(MOCK_USERS[newRole].password);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const success = await login(loginId, password, role);
    setLoading(false);
    if (success) {
      if (role === 'government') navigate('/gov');
      else if (role === 'researcher') navigate('/docs');
      else navigate('/dashboard');
    } else {
      setError('Invalid Login ID or security password. Please verify your credentials.');
    }
  };

  const handleInstantQuickEnter = (chosenRole: 'general' | 'government' | 'researcher') => {
    quickLogin(chosenRole);
    if (chosenRole === 'government') navigate('/gov');
    else if (chosenRole === 'researcher') navigate('/docs');
    else navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#04101e] flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Living Underwater Background */}
      <WaterBackground showSeaFloor={true} />

      {/* Full-page ocean depth overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-[1]"
        style={{
          background: `linear-gradient(
            180deg,
            rgba(26,107,138,0.45)  0%,
            rgba(8,54,89,0.32)    25%,
            rgba(3,30,50,0.20)    50%,
            rgba(1,12,23,0.42)    75%,
            rgba(1,4,7,0.80)     100%
          )`,
        }}
      />

      <div className="relative w-full max-w-5xl fade-in-up my-6 z-10">
        {/* Navigation Bar / Back link */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/')}
            className="btn-3d inline-flex items-center gap-2 px-3.5 py-2 rounded-xl glass border border-white/15 text-xs text-white/70 hover:text-cyan-300 transition-all cursor-pointer"
          >
            <ArrowLeft size={14} /> Back to Ocean Home
          </button>

          <div className="flex items-center gap-2 text-xs text-amber-300/90 font-mono px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>NIC-SECURED NODE · SIH-2026 FAST-TRACK</span>
          </div>
        </div>

        {/* Sovereign Government & SIH-2026 Header Card */}
        <div className="text-center max-w-3xl mx-auto mb-8 space-y-3">
          {/* National Tricolor Top Accent */}
          <div className="h-1.5 w-48 mx-auto rounded-full overflow-hidden flex shadow-md mb-2">
            <div className="h-full w-1/3 bg-[#FF9933]" />
            <div className="h-full w-1/3 bg-white" />
            <div className="h-full w-1/3 bg-[#138808]" />
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full text-xs font-mono bg-gradient-to-r from-amber-500/15 via-white/5 to-emerald-500/15 border border-amber-500/40 text-amber-200 shadow-lg">
            <IndiaFlag className="w-4 h-2.5" />
            <span className="font-bold text-amber-300 tracking-wider uppercase">भारत सरकार · GOVERNMENT OF INDIA</span>
            <span className="text-white/30">•</span>
            <span className="text-emerald-300 font-semibold">MoES &amp; INCOIS</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            <span
              style={{
                background: 'linear-gradient(135deg,#38d7df 0%,#249bd0 45%,#8b5cf6 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              OCEANINTEL
            </span>{' '}
            Sovereign Clearance Gateway
          </h1>

          <p className="text-white/70 text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed">
            Smart India Hackathon 2026 evaluation terminal. Authenticate below or use the{' '}
            <strong className="text-cyan-300">1-Click Fast-Track</strong> buttons to instantly explore the designated sovereign oceanographic console.
          </p>
        </div>

        {/* ──────────────────────────────────────────────────────────
            THREE INTERACTIVE CLEARANCE OPTIONS CARDS
        ────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* OPTION 1: CITIZEN */}
          <div
            onClick={() => handleSelectRole('general')}
            className={`view-card rounded-2xl p-5 border cursor-pointer transition-all flex flex-col justify-between relative overflow-hidden ${
              role === 'general'
                ? 'bg-cyan-950/50 border-cyan-400/80 shadow-[0_0_30px_rgba(6,182,212,0.3)] ring-1 ring-cyan-400/50'
                : 'bg-black/40 border-white/10 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                OPTION 01 • PUBLIC
              </span>
              <Unlock className="w-3.5 h-3.5 text-cyan-400" />
            </div>

            <div className="space-y-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
                <User className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Citizen Ocean Platform</h3>
              <p className="text-xs text-white/60 leading-relaxed">
                Open public exploration of 0–1000m subsurface digital twin, SST/SSS satellite heatmaps, 15-depth profiling, and AI chat.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  handleInstantQuickEnter('general');
                }}
                className="btn-3d w-full py-2 px-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
              >
                <span>Enter as Citizen</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* OPTION 2: GOVERNMENT */}
          <div
            onClick={() => handleSelectRole('government')}
            className={`view-card rounded-2xl p-5 border cursor-pointer transition-all flex flex-col justify-between relative overflow-hidden ${
              role === 'government'
                ? 'bg-amber-950/50 border-amber-400/80 shadow-[0_0_30px_rgba(245,158,11,0.3)] ring-1 ring-amber-400/50'
                : 'bg-black/40 border-white/10 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                OPTION 02 • CONFIDENTIAL
              </span>
              <Shield className="w-3.5 h-3.5 text-amber-400" />
            </div>

            <div className="space-y-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
                <Building2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Government &amp; Disaster Command</h3>
              <p className="text-xs text-white/60 leading-relaxed">
                Restricted NDMA official portal: cyclone storm surge warnings, coastal district risk classification, and NDRF evacuation orders.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  handleInstantQuickEnter('government');
                }}
                className="btn-3d w-full py-2 px-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Enter Gov Command</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* OPTION 3: RESEARCHER */}
          <div
            onClick={() => handleSelectRole('researcher')}
            className={`view-card rounded-2xl p-5 border cursor-pointer transition-all flex flex-col justify-between relative overflow-hidden ${
              role === 'researcher'
                ? 'bg-purple-950/50 border-purple-400/80 shadow-[0_0_30px_rgba(168,85,247,0.3)] ring-1 ring-purple-400/50'
                : 'bg-black/40 border-white/10 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                OPTION 03 • SCIENTIFIC
              </span>
              <FileText className="w-3.5 h-3.5 text-purple-400" />
            </div>

            <div className="space-y-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Neural Architecture Docs</h3>
              <p className="text-xs text-white/60 leading-relaxed">
                Restricted technical documentation: 61-D latent manifold tensors, 15-layer vertical MLP formulations, and ARGO float validation loss.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  handleInstantQuickEnter('researcher');
                }}
                className="btn-3d w-full py-2 px-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Enter Technical Docs</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ──────────────────────────────────────────────────────────
            AUTHENTICATION FORM TERMINAL
        ────────────────────────────────────────────────────────── */}
        <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-white/15 depth-shadow relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-white/10">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Selected Clearance:</span>
                <span className={`capitalize font-mono px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  role === 'government'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : role === 'researcher'
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                    : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                }`}>
                  {role === 'government' ? 'NDMA Official' : role === 'researcher' ? 'Research Scientist' : 'Citizen Analyst'}
                </span>
              </h2>
              <p className="text-xs text-white/50">Authenticate to establish an encrypted operator session</p>
            </div>

            {/* Tab switchers */}
            <div className="flex rounded-xl overflow-hidden glass border border-white/10 p-1 gap-1">
              {(['general', 'government', 'researcher'] as const).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleSelectRole(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    role === r
                      ? 'bg-white/15 text-white shadow-md'
                      : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  {r === 'general' ? 'Citizen' : r === 'government' ? 'Gov' : 'Docs'}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 max-w-xl mx-auto">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-300">
                <AlertCircle size={16} className="text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] text-white/60 uppercase font-mono tracking-wider block">
                Login ID
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="email"
                  value={loginId}
                  onChange={e => setLoginId(e.target.value)}
                  placeholder={MOCK_USERS[role].email}
                  required
                  className="w-full bg-black/50 border border-white/15 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-400 transition-all font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-white/60 uppercase font-mono tracking-wider block">
                  Security Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setLoginId(MOCK_USERS[role].email);
                    setPassword(MOCK_USERS[role].password);
                  }}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 underline font-mono cursor-pointer"
                >
                  Reset to demo credentials
                </button>
              </div>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-black/50 border border-white/15 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-400 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(o => !o)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-3d w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all"
              style={{
                background:
                  role === 'government'
                    ? 'linear-gradient(135deg,#d97706,#b45309)'
                    : role === 'researcher'
                    ? 'linear-gradient(135deg,#7c3aed,#6d28d9)'
                    : 'linear-gradient(135deg,#0891b2,#2563eb)',
              }}
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying clearance credentials...</span>
                </>
              ) : (
                <>
                  <Lock size={15} />
                  <span>Sign In &amp; Launch {role === 'government' ? 'Government Command' : role === 'researcher' ? 'Documentation' : 'Dashboard'}</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* ──────────────────────────────────────────────────────────
            CURRENT TESTING ACCESS
        ────────────────────────────────────────────────────────── */}
        <div className="mt-6 glass-panel rounded-3xl p-5 sm:p-6 border border-white/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Current Testing
              </h3>
              <p className="text-[11px] text-white/45 mt-1">
                Available modules for the current OceanEmbed evaluation build
              </p>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300">
              Testing Available
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {[
              { name: 'Dashboard', detail: 'Live ocean data', icon: Shield },
              { name: 'Forecast', detail: '7-day sequence', icon: ArrowRight },
              { name: 'Heatmap', detail: 'Depth visualization', icon: Sparkles },
              { name: 'Ocean Profile', detail: '15-depth output', icon: User },
              { name: 'XAI', detail: 'Model explanation', icon: BookOpen },
              { name: 'Gov Console', detail: 'Risk & alerts', icon: Building2 },
            ].map(({ name, detail, icon: Icon }) => (
              <div
                key={name}
                className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 hover:border-cyan-400/30 hover:bg-cyan-950/20 transition-all"
              >
                <div className="flex items-center justify-between gap-2">
                  <Icon size={14} className="text-cyan-300" />
                  <span className="text-[9px] font-mono text-emerald-300 uppercase">
                    Available
                  </span>
                </div>
                <div className="mt-2 text-xs font-semibold text-white">{name}</div>
                <div className="mt-0.5 text-[9px] text-white/40">{detail}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Guidance tip regarding X AI popup */}
        <div className="mt-6 text-center text-xs text-white/50 flex items-center justify-center gap-2">
          <Sparkles size={14} className="text-cyan-400" />
          <span>Need help choosing? Click the <strong>X AI Copilot</strong> popup in the bottom right corner for 24/7 assistance.</span>
        </div>
      </div>
    </div>
  );
}
