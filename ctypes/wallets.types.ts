// Wallet type definitions

export interface WalletCreateBody {
  name: string;
  type: 'bank' | 'cash' | 'ewallet' | 'credit_card' | 'other';
  balance?: number;
  currency?: string;
  icon?: string;
  color?: string;
  description?: string;
  accountNumber?: string;
}

export interface WalletUpdateBody {
  id: string;
  name?: string;
  type?: 'bank' | 'cash' | 'ewallet' | 'credit_card' | 'other';
  icon?: string;
  color?: string;
  description?: string;
  accountNumber?: string;
  status?: 'active' | 'archived';
}

export interface WalletAdjustBalanceBody {
  id: string;
  amount: number;
  description?: string;
}

export interface WalletListQuery {
  page?: string;
  limit?: string;
  type?: string;
  currency?: string;
  status?: 'active' | 'archived';
}

export interface WalletServiceResponse {
  error: boolean;
  message?: string;
  data?: any;
  statusCode?: number;
}
