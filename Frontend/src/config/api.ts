export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  ENDPOINTS: {
    AUTH: {
      NONCE: '/auth/nonce',
      VERIFY: '/auth/verify',
      ME: '/auth/me',
      LOGOUT: '/auth/logout',
      WALLET_INFO: '/auth/wallet-info',
    },
  },
  TIMEOUT: 30000,
};

export const getAuthHeaders = (token?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};
