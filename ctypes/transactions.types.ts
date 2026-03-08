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
  serviceFee?: number; // service fee for transfers (deducted from source wallet)
  createBillForFee?: boolean; // create a bill for the service fee
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

export interface TransactionImportBody {
  walletId: string;          // required: wallet to import into
  categoryId?: string;       // optional fallback category for rows that can't be matched
  preview?: string | boolean; // if 'true', return parsed rows without saving
}

// Dashboard type definitions

export interface DashboardSummaryQuery {
  month?: string; // MM (1-12)
  year?: string;  // YYYY
  walletId?: string;
}

export interface DashboardSummary {
  totalIncome: number;
  incomeCount: number;
  totalExpenses: number;
  expenseCount: number;
  totalTransfers: number;
  transferCount: number;
  totalTransactions: number;
  netCashFlow: number;
  month: number;
  year: number;
}

export interface DashboardServiceResponse {
  error: boolean;
  message?: string;
  data?: DashboardSummary;
  statusCode?: number;
}

export interface DashboardQuickStatsQuery {
  period?: 'today' | 'week' | 'month' | 'year' | 'all';
  walletId?: string;
}

export interface QuickStats {
  period: string;
  income: number;
  expenses: number;
  transfers: number;
  transactions: number;
  startDate: string;
  endDate: string;
}

export interface QuickStatsResponse {
  error: boolean;
  message?: string;
  data?: QuickStats;
  statusCode?: number;
}
