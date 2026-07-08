import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  FileCode2, 
  Settings, 
  Users, 
  PieChart, 
  Activity, 
  LogOut, 
  ShieldCheck 
} from 'lucide-react';

export default function AdminLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center">
        <h1 className="text-2xl font-bold text-rose-400 mb-2">Access Denied</h1>
        <p className="text-slate-400 mb-4">You must be logged in as an administrator to view this area.</p>
        <button 
          onClick={() => navigate('/login')} 
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-semibold transition"
        >
          Go to Login
        </button>
      </div>
    );
  }

  const navItems = [
    { name: 'Dashboard', path: '/admin', icon: <LayoutDashboard size={18} /> },
    { name: 'Create Test', path: '/admin/create-test', icon: <FileCode2 size={18} /> },
    { name: 'Manage Tests', path: '/admin/manage-tests', icon: <PieChart size={18} /> },
    { name: 'Live Monitoring', path: '/admin/monitoring', icon: <Activity size={18} /> },
    { name: 'Reports', path: '/admin/reports', icon: <Users size={18} /> },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900/60 border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div>
          {/* Logo Header */}
          <div className="p-6 border-b border-slate-800/80 flex items-center gap-3">
            <div className="bg-blue-600/10 text-blue-400 p-2 rounded-lg border border-blue-500/20">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 className="font-extrabold text-slate-200 text-sm uppercase tracking-wider">CodeGuard AI</h2>
              <span className="text-xs text-slate-500 font-medium">Admin Portal</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/60'
                  }`
                }
                end={item.path === '/admin'}
              >
                {item.icon}
                <span>{item.name}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* User profile section */}
        <div className="p-4 border-t border-slate-800/80">
          <div className="flex items-center gap-3 px-3 py-2 bg-slate-850/30 rounded-lg border border-slate-800/50 mb-3">
            <div className="w-9 h-9 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400 text-sm">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-slate-200 truncate">{user.name}</h4>
              <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-16 border-b border-slate-800/60 flex items-center justify-between px-8 bg-slate-900/10 backdrop-blur-sm sticky top-0 z-40">
          <h1 className="text-lg font-bold text-slate-200">
            {navItems.find((item) => location.pathname === item.path)?.name || 'Admin Area'}
          </h1>
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-400">
            <span>Server Status: <span className="text-emerald-400">Online</span></span>
          </div>
        </header>

        <div className="p-8 max-w-7xl w-full mx-auto flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
