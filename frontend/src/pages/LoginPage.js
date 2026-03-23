import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const LoginPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '', email: '', password: ''
  });
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const result = await login(formData.username, formData.password);
      if (result.success) {
        toast.success('Welcome back!');
        navigate('/dashboard');
      } else {
        toast.error(result.error);
      }
    } else {
      const result = await register(formData.username, formData.email, formData.password);
      if (result.success) {
        toast.success('Account created! Please login.');
        setIsLogin(true);
      } else {
        toast.error(result.error);
      }
    }
    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logo}>
          <span style={styles.logoIcon}>📈</span>
          <h1 style={styles.logoText}>Orion Market AI</h1>
          <p style={styles.logoSubtext}>AI-Powered Stock Sentiment Analysis</p>
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          <button
            style={{ ...styles.tab, ...(isLogin ? styles.activeTab : {}) }}
            onClick={() => setIsLogin(true)}
          >
            Login
          </button>
          <button
            style={{ ...styles.tab, ...(!isLogin ? styles.activeTab : {}) }}
            onClick={() => setIsLogin(false)}
          >
            Register
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Username</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              style={styles.input}
              placeholder="Enter username"
              required
            />
          </div>

          {!isLogin && (
            <div style={styles.inputGroup}>
              <label style={styles.label}>Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                style={styles.input}
                placeholder="Enter email"
                required
              />
            </div>
          )}

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              style={styles.input}
              placeholder="Enter password"
              required
            />
          </div>

          <button
            type="submit"
            style={{ ...styles.button, opacity: loading ? 0.7 : 1 }}
            disabled={loading}
          >
            {loading ? 'Please wait...' : (isLogin ? 'Login' : 'Create Account')}
          </button>
        </form>

        <p style={styles.switchText}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span
            style={styles.switchLink}
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? 'Register' : 'Login'}
          </span>
        </p>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  card: {
    background: 'rgba(255,255,255,0.05)',
    backdropFilter: 'blur(10px)',
    borderRadius: '20px',
    padding: '40px',
    width: '100%',
    maxWidth: '420px',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 25px 45px rgba(0,0,0,0.3)',
  },
  logo: {
    textAlign: 'center',
    marginBottom: '30px',
  },
  logoIcon: { fontSize: '48px' },
  logoText: {
    color: '#fff',
    fontSize: '24px',
    fontWeight: '700',
    margin: '10px 0 5px',
  },
  logoSubtext: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '13px',
  },
  tabs: {
    display: 'flex',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '10px',
    padding: '4px',
    marginBottom: '25px',
  },
  tab: {
    flex: 1,
    padding: '10px',
    border: 'none',
    background: 'transparent',
    color: 'rgba(255,255,255,0.5)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s',
  },
  activeTab: {
    background: '#6c63ff',
    color: '#fff',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: '500' },
  input: {
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
  },
  button: {
    padding: '13px',
    background: 'linear-gradient(135deg, #6c63ff, #3d35b5)',
    border: 'none',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '8px',
    transition: 'all 0.2s',
  },
  switchText: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.5)',
    fontSize: '13px',
    marginTop: '20px',
  },
  switchLink: {
    color: '#6c63ff',
    cursor: 'pointer',
    fontWeight: '600',
  },
};

export default LoginPage;