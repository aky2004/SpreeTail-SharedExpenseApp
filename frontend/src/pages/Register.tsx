import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserPlus, Eye, EyeOff, Wallet } from 'lucide-react';

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

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

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
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: 'linear-gradient(135deg, #12121F 0%, #1A1A2E 50%, #12121F 100%)' }}>
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 right-1/4 w-96 h-96 rounded-full opacity-5"
             style={{ background: 'radial-gradient(circle, #00B4A6 0%, transparent 70%)' }} />
        <div className="absolute bottom-1/3 left-1/4 w-64 h-64 rounded-full opacity-5"
             style={{ background: 'radial-gradient(circle, #00B4A6 0%, transparent 70%)' }} />
      </div>

      <div className="glass-card p-8 w-full max-w-md animate-fade-in relative z-10">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center"
               style={{ background: 'var(--color-accent-dim)' }}>
            <Wallet className="w-6 h-6" style={{ color: 'var(--color-accent)' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              <span style={{ color: 'var(--color-accent)' }}>EX</span>
              <span className="text-white">Pensio</span>
            </h1>
          </div>
        </div>

        <p className="text-center mb-8" style={{ color: 'var(--color-text-secondary)' }}>
          Create your account to get started
        </p>

        {error && (
          <div className="mb-6 p-3 rounded-lg text-sm font-medium"
               style={{ background: 'var(--color-danger-dim)', color: 'var(--color-danger)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2"
                   style={{ color: 'var(--color-text-secondary)' }}>
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Aisha Kumar"
              required
              className="input-field"
              autoComplete="name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2"
                   style={{ color: 'var(--color-text-secondary)' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="input-field"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2"
                   style={{ color: 'var(--color-text-secondary)' }}>
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                required
                className="input-field pr-12"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2"
                   style={{ color: 'var(--color-text-secondary)' }}>
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password"
              required
              className="input-field"
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full flex items-center justify-center gap-2 mt-6"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <UserPlus size={18} />
                Create Account
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold hover:underline"
                style={{ color: 'var(--color-accent)' }}>
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
