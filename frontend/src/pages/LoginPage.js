import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import './login-page.css';

const LOGIN_METHOD = {
  PASSWORD: 'password',
  TELEGRAM: 'telegram',
};

const REGISTER_METHOD = {
  USERNAME: 'username',
  TELEGRAM: 'telegram',
};

const LoginPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loginMethod, setLoginMethod] = useState(LOGIN_METHOD.PASSWORD);
  const [registerMethod, setRegisterMethod] = useState(REGISTER_METHOD.USERNAME);
  const [telegramOtpSent, setTelegramOtpSent] = useState(false);
  const [telegramBotLink, setTelegramBotLink] = useState('');
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [resetOtpSent, setResetOtpSent] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    telegramIdentifier: '',
    telegramOtp: '',
    newPassword: '',
    securityQuestion1: '',
    securityAnswer1: '',
    securityQuestion2: '',
    securityAnswer2: '',
    securityQuestion3: '',
    securityAnswer3: '',
  });
  const [loading, setLoading] = useState(false);
  const { login, register, sendTelegramOtp, loginWithTelegram, resetPasswordWithTelegram } = useAuth();
  const navigate = useNavigate();
  const normalizeTelegramUsername = (value) => String(value || '').trim().replace(/^@/, '');
  const isPhoneLikeIdentifier = (value) => /^\+?\d+$/.test(String(value || '').trim());

  const onInputChange = (event) => {
    setFormData((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);

    if (forgotPasswordMode) {
      const telegramUsername = normalizeTelegramUsername(formData.telegramIdentifier);
      if (isPhoneLikeIdentifier(formData.telegramIdentifier)) {
        toast.error('Use Telegram username only (phone numbers are not supported).');
        setLoading(false);
        return;
      }

      if (!resetOtpSent) {
        const sendResult = await sendTelegramOtp(telegramUsername, 'reset_password');
        if (sendResult.success) {
          setResetOtpSent(true);
          setTelegramBotLink('');
          toast.success('Password reset OTP sent to Telegram');
        } else {
          setTelegramBotLink(sendResult.botLink || '');
          toast.error(sendResult.error);
        }
        setLoading(false);
        return;
      }

      const resetResult = await resetPasswordWithTelegram(
        telegramUsername,
        formData.telegramOtp,
        formData.newPassword
      );
      if (resetResult.success) {
        toast.success('Password reset successful. Please login.');
        setForgotPasswordMode(false);
        setResetOtpSent(false);
        setLoginMethod(LOGIN_METHOD.PASSWORD);
        setFormData((previous) => ({
          ...previous,
          telegramOtp: '',
          newPassword: '',
          password: '',
        }));
      } else {
        toast.error(resetResult.error);
      }
      setLoading(false);
      return;
    }

    if (isLogin) {
      if (loginMethod === LOGIN_METHOD.PASSWORD) {
        const result = await login(formData.username, formData.password);
        if (result.success) {
          setTelegramBotLink('');
          toast.success('Welcome back');
          navigate('/dashboard');
        } else {
          toast.error(result.error);
        }
        setLoading(false);
        return;
      }

      const telegramUsername = normalizeTelegramUsername(formData.telegramIdentifier);
      if (isPhoneLikeIdentifier(formData.telegramIdentifier)) {
        toast.error('Use Telegram username only (phone numbers are not supported).');
        setLoading(false);
        return;
      }

      if (!telegramOtpSent) {
        const result = await sendTelegramOtp(telegramUsername);
        if (result.success) {
          setTelegramOtpSent(true);
          setTelegramBotLink('');
          toast.success('OTP sent to your Telegram');
        } else {
          setTelegramBotLink(result.botLink || '');
          toast.error(result.error);
        }
        setLoading(false);
        return;
      }

      const result = await loginWithTelegram(telegramUsername, formData.telegramOtp);
      if (result.success) {
        toast.success('Welcome back');
        navigate('/dashboard');
      } else {
        toast.error(result.error);
      }
      setLoading(false);
      return;
    }

    let result;
    if (registerMethod === REGISTER_METHOD.TELEGRAM) {
      const telegramUsername = normalizeTelegramUsername(formData.telegramIdentifier);
      if (isPhoneLikeIdentifier(formData.telegramIdentifier)) {
        toast.error('Telegram registration requires Telegram username (phone not supported).');
        setLoading(false);
        return;
      }
      if (!telegramUsername) {
        toast.error('Telegram username is required.');
        setLoading(false);
        return;
      }
      const payload = {
        auth_type: 'telegram',
        telegram_username: telegramUsername,
      };
      if (formData.username?.trim()) {
        payload.username = formData.username.trim();
      }
      if (formData.email?.trim()) {
        payload.email = formData.email.trim();
      }
      result = await register(payload);
    } else {
      const securityQuestions = [
        {
          question: formData.securityQuestion1,
          answer: formData.securityAnswer1,
        },
        {
          question: formData.securityQuestion2,
          answer: formData.securityAnswer2,
        },
      ];
      if (formData.securityQuestion3 || formData.securityAnswer3) {
        securityQuestions.push({
          question: formData.securityQuestion3,
          answer: formData.securityAnswer3,
        });
      }
      result = await register({
        auth_type: 'username',
        username: formData.username,
        email: formData.email,
        password: formData.password,
        security_questions: securityQuestions,
      });
    }
    if (result.success) {
      toast.success('Account created. Please login.');
      setIsLogin(true);
      setRegisterMethod(REGISTER_METHOD.USERNAME);
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
            onClick={() => {
              setIsLogin(true);
              setForgotPasswordMode(false);
              setResetOtpSent(false);
            }}
          >
            Login
          </button>
          <button
            type="button"
            className={!isLogin ? 'active' : ''}
            onClick={() => {
              setIsLogin(false);
              setLoginMethod(LOGIN_METHOD.PASSWORD);
              setTelegramOtpSent(false);
              setForgotPasswordMode(false);
              setResetOtpSent(false);
              setRegisterMethod(REGISTER_METHOD.USERNAME);
            }}
          >
            Register
          </button>
        </div>

        {isLogin && !forgotPasswordMode ? (
          <div className="auth-method-toggle">
            <button
              type="button"
              className={loginMethod === LOGIN_METHOD.PASSWORD ? 'active' : ''}
              onClick={() => {
                setLoginMethod(LOGIN_METHOD.PASSWORD);
                setTelegramOtpSent(false);
                setFormData((previous) => ({ ...previous, telegramOtp: '' }));
              }}
            >
              Login with Username
            </button>
            <button
              type="button"
              className={loginMethod === LOGIN_METHOD.TELEGRAM ? 'active' : ''}
              onClick={() => {
                setLoginMethod(LOGIN_METHOD.TELEGRAM);
                setTelegramOtpSent(false);
                setFormData((previous) => ({ ...previous, telegramOtp: '' }));
              }}
            >
              Login with Telegram
            </button>
          </div>
        ) : null}
        {!isLogin && !forgotPasswordMode ? (
          <div className="auth-method-toggle">
            <button
              type="button"
              className={registerMethod === REGISTER_METHOD.USERNAME ? 'active' : ''}
              onClick={() => setRegisterMethod(REGISTER_METHOD.USERNAME)}
            >
              Register with Username
            </button>
            <button
              type="button"
              className={registerMethod === REGISTER_METHOD.TELEGRAM ? 'active' : ''}
              onClick={() => setRegisterMethod(REGISTER_METHOD.TELEGRAM)}
            >
              Register with Telegram
            </button>
          </div>
        ) : null}

        <form className="auth-form" onSubmit={onSubmit}>
          {forgotPasswordMode ? (
            <>
              <div className="auth-field">
                <label htmlFor="telegramIdentifier">Telegram Username (not phone)</label>
                <input
                  id="telegramIdentifier"
                  name="telegramIdentifier"
                  placeholder="@your_telegram_username"
                  value={formData.telegramIdentifier}
                  onChange={onInputChange}
                  required
                />
              </div>
              <p className="auth-telegram-note">Open our bot and send /start before requesting OTP.</p>
              {resetOtpSent ? (
                <>
                  <div className="auth-field">
                    <label htmlFor="telegramOtp">OTP</label>
                    <input
                      id="telegramOtp"
                      name="telegramOtp"
                      placeholder="Enter 6-digit OTP"
                      value={formData.telegramOtp}
                      onChange={onInputChange}
                      required
                    />
                  </div>
                  <div className="auth-field">
                    <label htmlFor="newPassword">New Password</label>
                    <input
                      id="newPassword"
                      name="newPassword"
                      type="password"
                      value={formData.newPassword}
                      onChange={onInputChange}
                      required
                    />
                  </div>
                  <button
                    type="button"
                    className="auth-link-button"
                    onClick={async () => {
                      setLoading(true);
                      if (isPhoneLikeIdentifier(formData.telegramIdentifier)) {
                        toast.error('Use Telegram username only (phone numbers are not supported).');
                        setLoading(false);
                        return;
                      }
                      const resendResult = await sendTelegramOtp(
                        normalizeTelegramUsername(formData.telegramIdentifier),
                        'reset_password'
                      );
                    if (resendResult.success) {
                      setTelegramBotLink('');
                      toast.success('Reset OTP re-sent to Telegram');
                    } else {
                      setTelegramBotLink(resendResult.botLink || '');
                      toast.error(resendResult.error);
                    }
                      setLoading(false);
                    }}
                    disabled={loading}
                  >
                    Resend OTP
                  </button>
                </>
              ) : null}
            </>
          ) : null}

          {isLogin && !forgotPasswordMode && loginMethod === LOGIN_METHOD.PASSWORD ? (
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
          ) : null}

          {!isLogin && !forgotPasswordMode && registerMethod === REGISTER_METHOD.USERNAME ? (
            <>
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
              <div className="auth-field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={onInputChange}
                />
              </div>
              <div className="security-grid">
                <div className="auth-field">
                  <label htmlFor="securityQuestion1">Security Question 1</label>
                  <input
                    id="securityQuestion1"
                    name="securityQuestion1"
                    value={formData.securityQuestion1}
                    onChange={onInputChange}
                    placeholder="What is your pet name?"
                    required
                  />
                </div>
                <div className="auth-field">
                  <label htmlFor="securityAnswer1">Answer 1</label>
                  <input
                    id="securityAnswer1"
                    name="securityAnswer1"
                    value={formData.securityAnswer1}
                    onChange={onInputChange}
                    required
                  />
                </div>
                <div className="auth-field">
                  <label htmlFor="securityQuestion2">Security Question 2</label>
                  <input
                    id="securityQuestion2"
                    name="securityQuestion2"
                    value={formData.securityQuestion2}
                    onChange={onInputChange}
                    placeholder="Who was your favorite teacher?"
                    required
                  />
                </div>
                <div className="auth-field">
                  <label htmlFor="securityAnswer2">Answer 2</label>
                  <input
                    id="securityAnswer2"
                    name="securityAnswer2"
                    value={formData.securityAnswer2}
                    onChange={onInputChange}
                    required
                  />
                </div>
                <div className="auth-field">
                  <label htmlFor="securityQuestion3">Security Question 3 (Optional)</label>
                  <input
                    id="securityQuestion3"
                    name="securityQuestion3"
                    value={formData.securityQuestion3}
                    onChange={onInputChange}
                    placeholder="In what city were you born?"
                  />
                </div>
                <div className="auth-field">
                  <label htmlFor="securityAnswer3">Answer 3 (Optional)</label>
                  <input
                    id="securityAnswer3"
                    name="securityAnswer3"
                    value={formData.securityAnswer3}
                    onChange={onInputChange}
                  />
                </div>
              </div>
            </>
          ) : null}

          {!isLogin && !forgotPasswordMode && registerMethod === REGISTER_METHOD.TELEGRAM ? (
            <>
              <div className="auth-field">
                <label htmlFor="telegramIdentifier">Telegram Username (not phone)</label>
                <input
                  id="telegramIdentifier"
                  name="telegramIdentifier"
                  placeholder="@your_telegram_username"
                  value={formData.telegramIdentifier}
                  onChange={onInputChange}
                  required
                />
              </div>
              <p className="auth-telegram-note">Use your Telegram username exactly and send /start to the bot first.</p>
              <div className="auth-field">
                <label htmlFor="username">Username (Optional)</label>
                <input
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={onInputChange}
                  placeholder="Leave blank for auto-generated username"
                />
              </div>
              <div className="auth-field">
                <label htmlFor="email">Email (Optional)</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={onInputChange}
                />
              </div>
            </>
          ) : null}

          {isLogin && !forgotPasswordMode && loginMethod === LOGIN_METHOD.TELEGRAM ? (
            <>
              <div className="auth-field">
                <label htmlFor="telegramIdentifier">Telegram Username (not phone)</label>
                <input
                  id="telegramIdentifier"
                  name="telegramIdentifier"
                  placeholder="@your_telegram_username"
                  value={formData.telegramIdentifier}
                  onChange={onInputChange}
                  required
                />
              </div>
              <p className="auth-telegram-note">Use your Telegram username and make sure you sent /start to the bot.</p>
              {telegramOtpSent ? (
                <div className="auth-field">
                  <label htmlFor="telegramOtp">OTP</label>
                  <input
                    id="telegramOtp"
                    name="telegramOtp"
                    placeholder="Enter 6-digit OTP"
                    value={formData.telegramOtp}
                    onChange={onInputChange}
                    required
                  />
                </div>
              ) : null}
              {telegramOtpSent ? (
                <button
                  type="button"
                  className="auth-link-button"
                  onClick={async () => {
                    setLoading(true);
                    const resendResult = await sendTelegramOtp(
                      normalizeTelegramUsername(formData.telegramIdentifier)
                    );
                    if (resendResult.success) {
                      setTelegramBotLink('');
                      toast.success('OTP re-sent to Telegram');
                    } else {
                      setTelegramBotLink(resendResult.botLink || '');
                      toast.error(resendResult.error);
                    }
                    setLoading(false);
                  }}
                  disabled={loading}
                >
                  Resend OTP
                </button>
              ) : null}
              {telegramBotLink ? (
                <p className="auth-telegram-hint">
                  Please open bot and send <code>/start</code> first:{' '}
                  <a href={telegramBotLink} target="_blank" rel="noreferrer">
                    Open Telegram Bot
                  </a>
                </p>
              ) : null}
            </>
          ) : null}

          {(isLogin && !forgotPasswordMode && loginMethod === LOGIN_METHOD.PASSWORD) ||
          (!isLogin &&
            !forgotPasswordMode &&
            registerMethod === REGISTER_METHOD.USERNAME) ? (
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
          ) : null}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading
              ? 'Please wait...'
              : !isLogin
              ? 'Create Account'
              : forgotPasswordMode
              ? resetOtpSent
                ? 'Reset Password'
                : 'Send Reset OTP'
              : loginMethod === LOGIN_METHOD.PASSWORD
              ? 'Sign In'
              : telegramOtpSent
              ? 'Verify OTP & Sign In'
              : 'Send OTP on Telegram'}
          </button>
        </form>

        {isLogin && !forgotPasswordMode ? (
          <p className="auth-forgot">
            <button
              type="button"
              onClick={() => {
                navigate('/forgot-password');
              }}
            >
              Forgot Password?
            </button>
          </p>
        ) : null}

        <p className="auth-switch">
          {forgotPasswordMode ? (
            <button
              type="button"
              onClick={() => {
                setForgotPasswordMode(false);
                setResetOtpSent(false);
                setFormData((previous) => ({
                  ...previous,
                  telegramOtp: '',
                  newPassword: '',
                }));
              }}
            >
              Back to Login
            </button>
          ) : (
            <>
              {isLogin ? 'Need an account?' : 'Already registered?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setIsLogin((value) => !value);
                  setLoginMethod(LOGIN_METHOD.PASSWORD);
                  setTelegramOtpSent(false);
                  setForgotPasswordMode(false);
                  setResetOtpSent(false);
                  setRegisterMethod(REGISTER_METHOD.USERNAME);
                }}
              >
                {isLogin ? 'Register' : 'Login'}
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
