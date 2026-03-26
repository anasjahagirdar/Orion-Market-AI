import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import '../styles/pages/forgot-password-page.css';

const RECOVERY_METHOD = {
  TELEGRAM: 'telegram',
  USERNAME: 'username',
};

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const {
    sendTelegramOtp,
    resetPasswordWithTelegram,
    getSecurityQuestions,
    verifySecurityAnswers,
    resetPasswordWithSecurityToken,
  } = useAuth();
  const [recoveryMethod, setRecoveryMethod] = useState(RECOVERY_METHOD.TELEGRAM);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [telegramBotLink, setTelegramBotLink] = useState('');
  const [securityQuestions, setSecurityQuestions] = useState([]);
  const [securityAnswers, setSecurityAnswers] = useState([]);
  const [securityResetToken, setSecurityResetToken] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    telegramIdentifier: '',
    otp: '',
    newPassword: '',
  });
  const normalizeTelegramUsername = (value) => String(value || '').trim().replace(/^@/, '');
  const isPhoneLikeIdentifier = (value) => /^\+?\d+$/.test(String(value || '').trim());

  const onInputChange = (event) => {
    setFormData((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
  };

  const onSecurityAnswerChange = (index, value) => {
    setSecurityAnswers((previous) => {
      const next = [...previous];
      next[index] = value;
      return next;
    });
  };

  const resetAllRecoveryState = () => {
    setOtpSent(false);
    setSecurityQuestions([]);
    setSecurityAnswers([]);
    setSecurityResetToken('');
    setTelegramBotLink('');
    setFormData((previous) => ({
      ...previous,
      otp: '',
      newPassword: '',
    }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);

    if (recoveryMethod === RECOVERY_METHOD.TELEGRAM) {
      const telegramUsername = normalizeTelegramUsername(formData.telegramIdentifier);
      if (isPhoneLikeIdentifier(formData.telegramIdentifier)) {
        toast.error('Use Telegram username only (phone numbers are not supported).');
        setLoading(false);
        return;
      }

      if (!otpSent) {
        const sendResult = await sendTelegramOtp(telegramUsername, 'reset_password');
        if (sendResult.success) {
          setOtpSent(true);
          setTelegramBotLink('');
          toast.success('Reset OTP sent to Telegram');
        } else {
          setTelegramBotLink(sendResult.botLink || '');
          toast.error(sendResult.error);
        }
        setLoading(false);
        return;
      }

      const resetResult = await resetPasswordWithTelegram(
        telegramUsername,
        formData.otp,
        formData.newPassword
      );
      if (resetResult.success) {
        toast.success('Password reset successful. Please login.');
        navigate('/login');
      } else {
        toast.error(resetResult.error);
      }
      setLoading(false);
      return;
    }

    if (!securityQuestions.length) {
      const questionResult = await getSecurityQuestions(formData.username);
      if (questionResult.success) {
        const questions = questionResult.data?.security_questions || [];
        setSecurityQuestions(questions);
        setSecurityAnswers(Array(questions.length).fill(''));
        toast.success('Security questions loaded');
      } else {
        toast.error(questionResult.error);
      }
      setLoading(false);
      return;
    }

    if (!securityResetToken) {
      const verifyResult = await verifySecurityAnswers(formData.username, securityAnswers);
      if (verifyResult.success) {
        setSecurityResetToken(verifyResult.data?.reset_token || '');
        toast.success('Security answers verified');
      } else {
        toast.error(verifyResult.error);
      }
      setLoading(false);
      return;
    }

    const resetResult = await resetPasswordWithSecurityToken(
      formData.username,
      securityResetToken,
      formData.newPassword
    );
    if (resetResult.success) {
      toast.success('Password reset successful. Please login.');
      navigate('/login');
    } else {
      toast.error(resetResult.error);
    }
    setLoading(false);
  };

  return (
    <div className="forgot-page">
      <div className="forgot-card">
        <div className="forgot-brand">
          <h1>Reset Password</h1>
          <p>Recover with Telegram OTP or security questions</p>
        </div>

        <div className="forgot-method-toggle">
          <button
            type="button"
            className={recoveryMethod === RECOVERY_METHOD.TELEGRAM ? 'active' : ''}
            onClick={() => {
              setRecoveryMethod(RECOVERY_METHOD.TELEGRAM);
              resetAllRecoveryState();
            }}
          >
            Telegram Recovery
          </button>
          <button
            type="button"
            className={recoveryMethod === RECOVERY_METHOD.USERNAME ? 'active' : ''}
            onClick={() => {
              setRecoveryMethod(RECOVERY_METHOD.USERNAME);
              resetAllRecoveryState();
            }}
          >
            Username Recovery
          </button>
        </div>

        <form className="forgot-form" onSubmit={onSubmit}>
          {recoveryMethod === RECOVERY_METHOD.TELEGRAM ? (
            <>
              <div className="forgot-field">
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
              <p className="forgot-telegram-note">
                Open our bot and send <code>/start</code> before requesting OTP.
              </p>
              {otpSent ? (
                <>
                  <div className="forgot-field">
                    <label htmlFor="otp">OTP</label>
                    <input
                      id="otp"
                      name="otp"
                      placeholder="Enter 6-digit OTP"
                      value={formData.otp}
                      onChange={onInputChange}
                      required
                    />
                  </div>

                  <div className="forgot-field">
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
                    className="forgot-link-button"
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
              {telegramBotLink ? (
                <p className="forgot-telegram-hint">
                  Please open bot and send <code>/start</code> first:{' '}
                  <a href={telegramBotLink} target="_blank" rel="noreferrer">
                    Open Telegram Bot
                  </a>
                </p>
              ) : null}
            </>
          ) : (
            <>
              <div className="forgot-field">
                <label htmlFor="username">Username</label>
                <input
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={onInputChange}
                  required
                />
              </div>
              {securityQuestions.map((item, index) => (
                <div className="forgot-field" key={`${item.index}-${item.question}`}>
                  <label htmlFor={`securityAnswer${index}`}>{item.question}</label>
                  <input
                    id={`securityAnswer${index}`}
                    name={`securityAnswer${index}`}
                    value={securityAnswers[index] || ''}
                    onChange={(event) => onSecurityAnswerChange(index, event.target.value)}
                    required
                    disabled={Boolean(securityResetToken)}
                  />
                </div>
              ))}
              {securityResetToken ? (
                <div className="forgot-field">
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
              ) : null}
            </>
          )}

          <button type="submit" className="forgot-submit" disabled={loading}>
            {loading
              ? 'Please wait...'
              : recoveryMethod === RECOVERY_METHOD.TELEGRAM
              ? otpSent
                ? 'Reset Password'
                : 'Send Reset OTP'
              : !securityQuestions.length
              ? 'Load Security Questions'
              : !securityResetToken
              ? 'Verify Answers'
              : 'Reset Password'}
          </button>
        </form>

        <p className="forgot-switch">
          <button type="button" onClick={() => navigate('/login')}>
            Back to Login
          </button>
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
