import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Eye, EyeOff, ArrowRight } from 'lucide-react';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setIsLoading(true);
    try {
      await register(name, email, password);
      navigate('/onboarding');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex"
      style={{ background: '#070711', fontFamily: "'Geist', sans-serif" }}
    >
      {/* ── Left Branding Panel ─────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[460px] shrink-0 p-12 relative overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #0d0d20 0%, #0a0a1a 100%)',
          borderRight: '1px solid rgba(99,102,241,0.08)',
        }}
      >
        {/* Animated blobs */}
        <div
          className="absolute animate-float"
          style={{
            top: '20%', right: '10%',
            width: 260, height: 260,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)',
            filter: 'blur(30px)',
            pointerEvents: 'none',
          }}
        />
        <div
          className="absolute animate-float"
          style={{
            bottom: '20%', left: '10%',
            width: 200, height: 200,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.14) 0%, transparent 70%)',
            filter: 'blur(24px)',
            pointerEvents: 'none',
            animationDelay: '-4s',
          }}
        />
        <div className="absolute inset-0 bg-dot-grid opacity-25 pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                boxShadow: '0 6px 24px rgba(99,102,241,0.45)',
              }}
            >
              ST
            </div>
            <span className="text-[18px] font-bold text-white tracking-tight">
              Spree<span style={{ color: '#818cf8' }}>Tail</span>
            </span>
          </div>

          <h2
            className="text-[2.4rem] font-bold leading-tight mb-4"
            style={{ color: 'white', letterSpacing: '-0.04em', lineHeight: 1.15 }}
          >
            Join your
            <br />
            <span className="gradient-text">flatmates</span>
            <br />
            on SpreeTail.
          </h2>
          <p style={{ color: '#475569', fontSize: '15px', lineHeight: 1.7 }}>
            Create your account and start tracking shared household expenses in minutes.
          </p>
        </div>

        {/* Steps */}
        <div className="relative z-10 space-y-4">
          {['Create your account', 'Create or join a group', 'Start logging bills'].map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold"
                style={{
                  background: 'rgba(99,102,241,0.15)',
                  border: '1px solid rgba(99,102,241,0.3)',
                  color: '#818cf8',
                }}
              >
                {i + 1}
              </div>
              <span style={{ color: '#64748b', fontSize: '13px' }}>{step}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right Form Panel ────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-[420px] animate-fade-in relative" style={{
          padding: '40px', background: 'rgba(13,13,28,0.9)', borderRadius: '24px',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03) inset'
        }}>
          <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: '1.5px', background: 'linear-gradient(90deg, transparent 0%, #6366f1 50%, transparent 100%)', zIndex: 20 }} />
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm text-white"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              ST
            </div>
            <span className="text-[17px] font-bold text-white">
              Spree<span style={{ color: '#818cf8' }}>Tail</span>
            </span>
          </div>

          <div className="mb-8">
            <h1 className="text-[1.6rem] font-bold text-white mb-1.5" style={{ letterSpacing: '-0.04em' }}>
              Create account
            </h1>
            <p style={{ color: '#475569', fontSize: '14px' }}>
              Get started with SpreeTail for free
            </p>
          </div>

          {/* Error */}
          {error && (
            <div
              className="flex items-center gap-2.5 p-3.5 rounded-xl mb-6 text-[13px]"
              style={{
                background: 'rgba(244,63,94,0.08)',
                border: '1px solid rgba(244,63,94,0.2)',
                color: '#f43f5e',
              }}
            >
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="section-label mb-2 block pl-0.5">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Aisha Kumar"
                required
                className="input-field"
                autoComplete="name"
              />
            </div>

            {/* Email */}
            <div>
              <label className="section-label mb-2 block pl-0.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="input-field"
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div>
              <label className="section-label mb-2 block pl-0.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  required
                  className="input-field pr-12"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg cursor-pointer transition-colors"
                  style={{ color: '#475569' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#94a3b8')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="section-label mb-2 block pl-0.5">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
                required
                className="input-field"
                autoComplete="new-password"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3 mt-2 text-[14px]"
            >
              {isLoading ? (
                <div className="w-5 h-5 rounded-full border-2 animate-spin"
                  style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
              ) : (
                <>
                  <UserPlus size={17} />
                  <span>Create Account</span>
                  <ArrowRight size={15} className="ml-auto" />
                </>
              )}
            </button>
          </form>

          {/* Login link */}
          <p className="mt-7 text-center text-[13px]" style={{ color: '#475569' }}>
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-semibold transition-colors"
              style={{ color: '#818cf8' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#a5b4fc')}
              onMouseLeave={e => (e.currentTarget.style.color = '#818cf8')}
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
