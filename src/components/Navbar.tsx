import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Waves, Flame, MessageSquare, LayoutDashboard, Globe, Wind,
  Thermometer, FileText, Shield, BarChart2, LogOut,
  Menu, X, CheckSquare, Map, Calendar, GitCompare,
  Search, Compass, Sparkles
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: Waves },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/worldmap', label: 'Map', icon: Map },
  { to: '/profile-3d', label: '3D Profile', icon: Globe },
  { to: '/predictions', label: 'Predictions', icon: Sparkles },
  { to: '/forecast', label: 'Forecast', icon: Calendar },
  { to: '/compare', label: 'Compare', icon: GitCompare },
  { to: '/validation', label: 'Validation', icon: CheckSquare },
  { to: '/gov', label: 'Gov Command', icon: Shield },
  { to: '/docs', label: 'Docs', icon: FileText, requiresAuth: true },
  { to: '/chat', label: 'X AI', icon: MessageSquare },
];

export default function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const visibleItems = NAV_ITEMS;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const q = searchQuery.toLowerCase();
    if (q.includes('gov') || q.includes('ndma') || q.includes('emergency')) navigate('/gov');
    else if (q.includes('dash') || q.includes('kpi')) navigate('/dashboard');
    else if (q.includes('cyclone') || q.includes('wind') || q.includes('storm')) navigate('/predictions?tab=cyclone');
    else if (q.includes('heat') || q.includes('tchp') || q.includes('ohc') || q.includes('thermal')) navigate('/predictions?tab=heat');
    else if (q.includes('season') || q.includes('fno') || q.includes('climatology')) navigate('/predictions?tab=seasonal');
    else if (q.includes('predict')) navigate('/predictions');
    else if (q.includes('surf') || q.includes('sst')) navigate('/dashboard?subpage=surface');
    else if (q.includes('3d') || q.includes('profile') || q.includes('depth')) navigate('/profile-3d');
    else if (q.includes('fore') || q.includes('week')) navigate('/forecast');
    else if (q.includes('valid') || q.includes('argo')) navigate('/validation');
    else if (q.includes('model') || q.includes('cnn') || q.includes('swin')) navigate('/compare');
    else if (q.includes('ai') || q.includes('chat')) navigate('/chat');
    else navigate('/dashboard');
    setSearchQuery('');
  };

  return (
    <header className="w-full bg-white/90 backdrop-blur-xl border-b border-slate-200/70 shadow-sm z-50 sticky top-0 transition-all">
      {/* Sleek Government Header Strip */}
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
        {/* Left: INCOIS Emblem + Clean Title */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <img src="/incois-logo.svg" alt="INCOIS Seal" className="w-8 h-8 object-contain shrink-0 drop-shadow-xs" />
          <div className="flex flex-col">
            <span className="text-sm font-black text-[#005088] leading-tight tracking-tight">
              OCEANINTEL &bull; INCOIS
            </span>
            <span className="text-[10.5px] font-medium text-slate-500 leading-tight">
              Ministry of Earth Sciences, Govt. of India
            </span>
          </div>
        </div>

        {/* Right: Search Box + User Status */}
        <div className="flex items-center gap-2.5">
          {/* Search Box */}
          <form onSubmit={handleSearch} className="hidden sm:flex items-center">
            <div className="flex items-center">
              <input
                type="text"
                placeholder="Search portal..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-36 lg:w-48 px-2.5 py-1 text-xs border border-r-0 border-slate-300 bg-white/80 rounded-l focus:outline-none focus:border-[#005088] focus:bg-white"
              />
              <button
                type="submit"
                className="bg-blue-50 hover:bg-blue-100 text-[#005088] border border-l-0 border-slate-300 px-2.5 py-1 text-xs font-bold rounded-r transition-colors flex items-center cursor-pointer"
                title="Search"
              >
                <Search size={18} />
              </button>
            </div>
          </form>

          {/* User Login/Status */}
          {isAuthenticated ? (
            <div className="flex items-center gap-2 pl-1">
              <span className="text-xs font-bold text-slate-800 hidden md:inline">{user?.name}</span>
              {user?.role === 'government' && (
                <NavLink
                  to="/gov"
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 hover:bg-amber-200 transition-colors"
                >
                  <Shield size={11} />
                  <span>NDMA Gov</span>
                </NavLink>
              )}
              <button
                onClick={handleLogout}
                className="p-1.5 text-slate-500 hover:text-red-600 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                title="Logout"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <NavLink
              to="/login"
              className="text-xs font-bold px-3 py-1 rounded bg-[#005088] hover:bg-[#003d66] text-white transition-colors shadow-2xs"
            >
              Login
            </NavLink>
          )}
        </div>
      </div>

      {/* Clean Standard Navbar with Saffron Active Indicator */}
      <nav className="bg-white/75 backdrop-blur-md border-t border-slate-200/60">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 flex items-center justify-between">
          {/* Desktop Navigation Items */}
          <div className="hidden lg:flex items-center overflow-x-auto gap-0 text-sm font-semibold">
            {visibleItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-3 whitespace-nowrap text-xs font-semibold transition-all relative ${isActive
                    ? 'text-[#005088] font-bold bg-white/80 after:content-[""] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[3.5px] after:bg-[#ff9933]'
                    : 'text-slate-700 hover:text-[#005088] hover:bg-white/50'
                  }`
                }
              >
                <Icon size={14} className="shrink-0" />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>

          {/* Mobile Hamburger Button */}
          <div className="flex lg:hidden py-2 w-full justify-between items-center">
            <span className="text-xs font-bold text-[#005088] uppercase">Portal Navigation</span>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-1.5 rounded text-[#005088] hover:bg-slate-100"
              aria-label="Toggle Mobile Menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1 shadow-lg">
            {visibleItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded text-xs font-semibold ${isActive ? 'bg-[#0f3b6d] text-white' : 'text-slate-800 hover:bg-slate-100'
                  }`
                }
              >
                <Icon size={15} />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        )}
      </nav>
    </header>
  );
}
