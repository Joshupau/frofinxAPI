// Transaction type definitions

export interface TransactionCreateBody {
  walletId: string;
  categoryId?: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  description?: string;
  date?: string; // ISO date string
  attachments?: string[];
  tags?: string[];
  toWalletId?: string; // for transfers
  billId?: string; // if paying a bill
}

export interface TransactionUpdateBody {
  id: string;
  walletId?: string;
  categoryId?: string;
  amount?: number;
  type?: 'income' | 'expense' | 'transfer';
  description?: string;
  date?: string;
  attachments?: string[];
  tags?: string[];
  status?: 'completed' | 'pending' | 'cancelled';
}

export interface TransactionDeleteBody {
  id: string;
}

export interface TransactionListQuery {
  page?: string;
  limit?: string;
  walletId?: string;
  categoryId?: string;
  type?: 'income' | 'expense' | 'transfer';
  startDate?: string; // ISO date
  endDate?: string;   // ISO date
  minAmount?: string;
  maxAmount?: string;
  search?: string;
  status?: 'completed' | 'pending' | 'cancelled';
}

export interface TransactionReportQuery {
  month?: string; // YYYY-MM
  year?: string;  // YYYY
  walletId?: string;
  categoryId?: string;
}

export interface TransactionServiceResponse {
  error: boolean;
  message?: string;
  data?: any;
  statusCode?: number;
}
