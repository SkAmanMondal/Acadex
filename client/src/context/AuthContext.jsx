import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('acadex_user') || localStorage.getItem('campus360_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCurrentSession = async () => {
      const token = localStorage.getItem('acadex_token') || localStorage.getItem('campus360_token');
      if (token) {
        try {
          const res = await api.get('/auth/me');
          if (res.data?.success) {
            setUser(res.data.data.user);
            localStorage.setItem('acadex_user', JSON.stringify(res.data.data.user));
            localStorage.setItem('campus360_user', JSON.stringify(res.data.data.user));
          }
        } catch (err) {
          console.error('Session validation error:', err);
          logout();
        }
      }
      setLoading(false);
    };

    fetchCurrentSession();
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    if (res.data?.success) {
      const { user: userData, accessToken } = res.data.data;
      setUser(userData);
      localStorage.setItem('acadex_token', accessToken);
      localStorage.setItem('acadex_user', JSON.stringify(userData));
      localStorage.setItem('campus360_token', accessToken);
      localStorage.setItem('campus360_user', JSON.stringify(userData));
      return userData;
    }
    throw new Error(res.data?.message || 'Login failed');
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('acadex_token');
    localStorage.removeItem('acadex_user');
    localStorage.removeItem('campus360_token');
    localStorage.removeItem('campus360_user');
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
        role: user?.role,
        isHod: user?.role === 'hod',
        isTeacher: user?.role === 'teacher' || user?.role === 'hod',
        isMentor: Boolean(user?.isMentor || user?.profile?.isMentor),
        isAdmin: ['college_admin', 'super_admin'].includes(user?.role),
        isStudent: user?.role === 'student',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
