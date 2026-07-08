import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Lock, Terminal, ShieldAlert, Award } from 'lucide-react';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('STUDENT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const loggedUser = await register(name, email, password, role);
      if (loggedUser.role === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate('/join');
      }
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md glass-panel rounded-2xl border border-slate-800 p-8 z-10 glow-blue">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400 mb-3">
            <Terminal size={32} />
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Get Started
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Create your account on CodeGuard AI
          </p>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <User size={18} />
              </span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 focus:border-blue-500 rounded-lg py-2.5 pl-10 pr-4 text-slate-200 outline-none transition text-sm"
                placeholder="Ada Lovelace"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <Mail size={18} />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 focus:border-blue-500 rounded-lg py-2.5 pl-10 pr-4 text-slate-200 outline-none transition text-sm"
                placeholder="ada@lovelace.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <Lock size={18} />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 focus:border-blue-500 rounded-lg py-2.5 pl-10 pr-4 text-slate-200 outline-none transition text-sm"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Select Role
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setRole('STUDENT')}
                className={`py-3 px-4 rounded-lg border text-sm font-semibold transition flex flex-col items-center gap-2 ${
                  role === 'STUDENT'
                    ? 'bg-blue-600/10 border-blue-500 text-blue-400'
                    : 'bg-slate-900/40 border-slate-850 text-slate-400 hover:border-slate-800'
                }`}
              >
                <Award size={20} />
                <span>Student</span>
              </button>

              <button
                type="button"
                onClick={() => setRole('ADMIN')}
                className={`py-3 px-4 rounded-lg border text-sm font-semibold transition flex flex-col items-center gap-2 ${
                  role === 'ADMIN'
                    ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400'
                    : 'bg-slate-900/40 border-slate-850 text-slate-400 hover:border-slate-800'
                }`}
              >
                <ShieldAlert size={20} />
                <span>Admin</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-700 text-white font-semibold rounded-lg py-3 transition shadow-lg mt-6 text-sm flex items-center justify-center gap-2"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="text-center mt-6 text-slate-500 text-sm">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-400 hover:underline">
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}
