import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import './login-page.css';

const LoginPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const onInputChange = (event) => {
    setFormData((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);

    if (isLogin) {
      const result = await login(formData.username, formData.password);
      if (result.success) {
        toast.success('Welcome back');
        navigate('/dashboard');
      } else {
        toast.error(result.error);
      }
      setLoading(false);
      return;
    }

    const result = await register(formData.username, formData.email, formData.password);
    if (result.success) {
      toast.success('Account created. Please login.');
      setIsLogin(true);
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <h1>Orion Market AI</h1>
          <p>Dark-theme stock analytics workspace</p>
        </div>

        <div className="auth-toggle">
          <button
            type="button"
            className={isLogin ? 'active' : ''}
            onClick={() => setIsLogin(true)}
          >
            Login
          </button>
          <button
            type="button"
            className={!isLogin ? 'active' : ''}
            onClick={() => setIsLogin(false)}
          >
            Register
          </button>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          <div className="auth-field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              value={formData.username}
              onChange={onInputChange}
              required
            />
          </div>

          {!isLogin ? (
            <div className="auth-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={onInputChange}
                required
              />
            </div>
          ) : null}

          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={onInputChange}
              required
            />
          </div>

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="auth-switch">
          {isLogin ? 'Need an account?' : 'Already registered?'}{' '}
          <button type="button" onClick={() => setIsLogin((value) => !value)}>
            {isLogin ? 'Register' : 'Login'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
