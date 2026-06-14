import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, Eye, EyeOff, ArrowRight, Zap, BarChart3, Upload } from 'lucide-react';

// Minimal floating expense "receipt" cards shown in background
const FLOAT_CARDS = [
  { label: 'Groceries', amount: '₹1,240', tag: 'equal', delay: '0s', x: '6%', y: '18%' },
  { label: 'Netflix', amount: '₹649', tag: 'shares', delay: '1.8s', x: '78%', y: '12%' },
  { label: 'Electricity', amount: '₹3,100', tag: 'exact', delay: '3.2s', x: '82%', y: '68%' },
  { label: 'Cab — Airport', amount: '₹520', tag: 'equal', delay: '1s', x: '4%', y: '72%' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Delay mount so card animates in smoothly
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#070711',
      fontFamily: "'Inter', sans-serif",
      position: 'relative',
      overflow: 'hidden',
      padding: '24px',
      boxSizing: 'border-box',
    }}>

      {/* ── Decorative background layer ─── */}

      {/* Subtle dot grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'radial-gradient(rgba(99,102,241,0.10) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
        maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)',
      }} />

      {/* Ambient indigo glow — center */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -60%)',
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 70%)',
        filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0,
      }} />

      {/* Ambient violet glow — bottom right */}
      <div style={{
        position: 'absolute', bottom: '-5%', right: '5%',
        width: 360, height: 360, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)',
        filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0,
      }} />

      {/* ── Floating expense mini-cards (background decoration) ── */}
      {FLOAT_CARDS.map((card, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: card.x,
            top: card.y,
            zIndex: 1,
            opacity: 0,
            animation: `floatCardIn 0.7s ease forwards, floatY 5s ease-in-out infinite alternate`,
            animationDelay: card.delay,
            pointerEvents: 'none',
          }}
        >
          <div style={{
            padding: '10px 14px',
            borderRadius: '12px',
            background: 'rgba(13,13,28,0.75)',
            border: '1px solid rgba(255,255,255,0.07)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            minWidth: '120px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>{card.label}</span>
              <span style={{
                fontSize: '9px', fontWeight: 600, padding: '2px 7px',
                borderRadius: '100px', letterSpacing: '0.05em',
                background: 'rgba(99,102,241,0.12)', color: '#818cf8',
                border: '1px solid rgba(99,102,241,0.2)',
              }}>{card.tag}</span>
            </div>
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'white', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em' }}>
              {card.amount}
            </span>
            <div style={{ display: 'flex', gap: '3px', marginTop: '2px' }}>
              {[...Array(3)].map((_, j) => (
                <div key={j} style={{
                  height: '3px', flex: 1, borderRadius: '2px',
                  background: j === 0 ? '#6366f1' : j === 1 ? '#8b5cf6' : 'rgba(255,255,255,0.08)',
                }} />
              ))}
            </div>
          </div>
        </div>
      ))}

      {/* ── Main content ── */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>

        {/* Logo */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(-12px)',
          transition: 'opacity 0.5s ease, transform 0.5s ease',
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: '12px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: '13px', color: 'white',
            boxShadow: '0 6px 24px rgba(99,102,241,0.4)', flexShrink: 0,
          }}>ST</div>
          <span style={{ fontSize: '18px', fontWeight: 700, color: 'white', letterSpacing: '-0.02em' }}>
            Spree<span style={{ color: '#818cf8' }}>Tail</span>
          </span>
        </div>

        {/* Hero */}
        <div style={{
          textAlign: 'center', marginBottom: '32px',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(-8px)',
          transition: 'opacity 0.55s ease 0.07s, transform 0.55s ease 0.07s',
        }}>
          <h1 style={{
            fontSize: 'clamp(1.5rem, 3.5vw, 2rem)',
            fontWeight: 800, color: 'white',
            letterSpacing: '-0.04em', lineHeight: 1.2,
            margin: '0 0 8px',
          }}>
            Track shared <span style={{
              background: 'linear-gradient(90deg, #818cf8, #a78bfa)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>expenses</span>
          </h1>
          <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.7, maxWidth: '320px', margin: '0 auto' }}>
            Split bills, settle debts and manage group finances — all in one place.
          </p>
        </div>

        {/* Card */}
        <div style={{
          width: '100%', maxWidth: '420px',
          padding: '36px',
          background: 'rgba(13,13,28,0.90)',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03) inset',
          position: 'relative', boxSizing: 'border-box',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.98)',
          transition: 'opacity 0.6s ease 0.15s, transform 0.6s ease 0.15s',
        }}>

          {/* Top shimmer accent */}
          <div style={{
            position: 'absolute', top: 0, left: '18%', right: '18%', height: '1.5px',
            background: 'linear-gradient(90deg, transparent, #6366f1 50%, transparent)',
            borderRadius: '0 0 4px 4px',
          }} />

          <div style={{ marginBottom: '22px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white', letterSpacing: '-0.03em', margin: '0 0 4px' }}>
              Welcome back
            </h2>
            <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>
              Sign in to your workspace
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '12px 14px', borderRadius: '12px', marginBottom: '16px',
              background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)',
              color: '#f43f5e', fontSize: '13px',
            }}>
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label className="section-label" style={{ display: 'block', marginBottom: '7px' }}>Email</label>
              <input
                type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required className="input-field" autoComplete="email"
              />
            </div>

            <div>
              <label className="section-label" style={{ display: 'block', marginBottom: '7px' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required className="input-field"
                  style={{ paddingRight: '46px' }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#475569', display: 'flex', alignItems: 'center',
                    padding: '4px', borderRadius: '6px',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#94a3b8')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit" disabled={isLoading}
              className="btn-primary"
              style={{ width: '100%', padding: '13px', marginTop: '4px', fontSize: '14px' }}
            >
              {isLoading ? (
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white', animation: 'spin 0.8s linear infinite',
                }} />
              ) : (
                <>
                  <LogIn size={17} />
                  <span>Sign In</span>
                  <ArrowRight size={15} style={{ marginLeft: 'auto' }} />
                </>
              )}
            </button>
          </form>

          <p style={{ marginTop: '20px', textAlign: 'center', fontSize: '13px', color: '#475569' }}>
            Don't have an account?{' '}
            <Link
              to="/register"
              style={{ fontWeight: 600, color: '#818cf8', textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#a5b4fc')}
              onMouseLeave={e => (e.currentTarget.style.color = '#818cf8')}
            >
              Create account
            </Link>
          </p>
        </div>

        {/* Feature chips */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          marginTop: '28px', flexWrap: 'wrap', justifyContent: 'center',
          opacity: mounted ? 1 : 0,
          transition: 'opacity 0.6s ease 0.35s',
        }}>
          {[
            { icon: <Zap size={11} />, label: '4 split modes' },
            { icon: <BarChart3 size={11} />, label: 'Real-time balances' },
            { icon: <Upload size={11} />, label: 'CSV anomaly import' },
          ].map((chip, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '5px 12px', borderRadius: '100px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              fontSize: '11px', color: '#64748b', fontWeight: 500,
            }}>
              <span style={{ color: '#818cf8' }}>{chip.icon}</span>
              {chip.label}
            </div>
          ))}
        </div>
      </div>

      {/* Animation keyframes injected inline */}
      <style>{`
        @keyframes floatCardIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 0.65; transform: translateY(0); }
        }
        @keyframes floatY {
          from { transform: translateY(0px); }
          to   { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
}
