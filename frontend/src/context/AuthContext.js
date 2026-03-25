import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const savedUser = localStorage.getItem('orion_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    try {
      const response = await authAPI.login({ username, password });
      const userData = response.data;
      setUser(userData);
      localStorage.setItem('orion_user', JSON.stringify(userData));
      // Save the token separately so the Axios interceptor can read it
      if (userData.token) {
        localStorage.setItem('orion_token', userData.token);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed'
      };
    }
  };

  const sendTelegramOtp = async (identifier, purpose = 'login') => {
    try {
      const response = await authAPI.sendTelegramOtp(identifier, purpose);
      return { success: true, data: response.data };
    } catch (error) {
      const payload = error.response?.data || {};
      const message = payload.error || 'Failed to send Telegram OTP';
      const botLink = payload.bot_link || null;
      const looksNotLinked = String(message).toLowerCase().includes('not linked');

      if (looksNotLinked && identifier) {
        try {
          const syncResponse = await authAPI.syncTelegramChat(identifier);
          if (syncResponse?.data?.linked) {
            const retryResponse = await authAPI.sendTelegramOtp(identifier, purpose);
            return { success: true, data: retryResponse.data, synced: true };
          }
          return {
            success: false,
            error: message,
            botLink: syncResponse?.data?.bot_link || botLink,
          };
        } catch (syncError) {
          const syncPayload = syncError.response?.data || {};
          return {
            success: false,
            error: syncPayload.error || message,
            botLink: syncPayload.bot_link || botLink,
          };
        }
      }

      return {
        success: false,
        error: message,
        botLink,
      };
    }
  };

  const syncTelegramChat = async (identifier) => {
    try {
      const response = await authAPI.syncTelegramChat(identifier);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to sync Telegram chat',
        botLink: error.response?.data?.bot_link || null,
      };
    }
  };

  const loginWithTelegram = async (identifier, otp) => {
    try {
      const response = await authAPI.verifyTelegramOtp(identifier, otp, 'login');
      const userData = response.data;
      setUser(userData);
      localStorage.setItem('orion_user', JSON.stringify(userData));
      if (userData.token) {
        localStorage.setItem('orion_token', userData.token);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Telegram OTP login failed',
      };
    }
  };

  const resetPasswordWithTelegram = async (identifier, otp, newPassword) => {
    try {
      const response = await authAPI.resetPassword(identifier, otp, newPassword);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Password reset failed',
      };
    }
  };

  const getSecurityQuestions = async (username) => {
    try {
      const response = await authAPI.getSecurityQuestions(username);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to load security questions',
      };
    }
  };

  const verifySecurityAnswers = async (username, answers) => {
    try {
      const response = await authAPI.verifySecurityAnswers(username, answers);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Security answer verification failed',
      };
    }
  };

  const resetPasswordWithSecurityToken = async (username, securityToken, newPassword) => {
    try {
      const response = await authAPI.resetPasswordWithSecurityToken(
        username,
        securityToken,
        newPassword
      );
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Password reset failed',
      };
    }
  };

  const register = async (payloadOrUsername, email, password) => {
    try {
      const payload =
        typeof payloadOrUsername === 'object' && payloadOrUsername !== null
          ? payloadOrUsername
          : {
              username: payloadOrUsername,
              email,
              password,
            };
      await authAPI.register(payload);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Registration failed'
      };
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.log('Logout error:', error);
    }
    setUser(null);
    localStorage.removeItem('orion_user');
    localStorage.removeItem('orion_token');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        logout,
        loading,
        sendTelegramOtp,
        syncTelegramChat,
        loginWithTelegram,
        resetPasswordWithTelegram,
        getSecurityQuestions,
        verifySecurityAnswers,
        resetPasswordWithSecurityToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export default AuthContext;
