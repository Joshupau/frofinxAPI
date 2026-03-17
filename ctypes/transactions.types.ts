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
  tags?: string[]; // array of tags to filter by
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

// Analytics type definitions

export interface SpentTodayQuery {
  walletId?: string;
}

export interface SpentTodayData {
  totalSpent: number;
  transactionCount: number;
  date: string;
}

export interface SpentTodayResponse {
  error: boolean;
  message?: string;
  data?: SpentTodayData;
  statusCode?: number;
}

// Chart data types for grouped transactions by time period

export interface ChartDataQuery {
  period: 'day' | 'week' | 'month' | 'year';
  walletId?: string;
}

export interface ChartDataPoint {
  // For 'day': hour (0-23)
  hour?: number;
  // For 'week': day name ('Monday', 'Tuesday', etc)
  day?: string;
  // For 'month': date (1-31)
  date?: number;
  // For 'year': month name ('January', 'February', etc)
  month?: string;
  // Transaction data
  income: number;
  expenses: number;
  transfers: number;
  total?: number; // income + expenses + transfers (with sign consideration)
}

export interface ChartDataResponse {
  error: boolean;
  message?: string;
  data?: {
    period: string;
    startDate: string;
    endDate: string;
    dataPoints: ChartDataPoint[];
    totals: {
      income: number;
      expenses: number;
      transfers: number;
    };
  };
  statusCode?: number;
}

export interface AnalyticsQuery {
  period: 'daily' | 'weekly' | 'yearly';
  walletId?: string;
  startDate?: string; // ISO date for custom range (only for daily)
  endDate?: string;   // ISO date for custom range (only for daily)
}

export interface AnalyticsDataPoint {
  date?: string;         // for daily period: YYYY-MM-DD
  week?: number;         // for weekly period: week number
  month?: number;        // for weekly period: month number
  year?: number;         // for yearly period: YYYY
  expenses: number;
  income: number;
  net: number;
  transactionCount?: number;
}

export interface AnalyticsData {
  period: 'daily' | 'weekly' | 'yearly';
  walletId?: string;
  data: AnalyticsDataPoint[];
  summary?: {
    totalIncome: number;
    totalExpenses: number;
    totalNet: number;
    transactionCount: number;
  };
}

export interface AnalyticsResponse {
  error: boolean;
  message?: string;
  data?: AnalyticsData;
  statusCode?: number;
}

// Top Category Today

export interface TopCategoryTodayQuery {
  walletId?: string;
}

export interface TopCategoryTodayData {
  categoryId: string;
  categoryName: string;
  categoryIcon?: string;
  categoryColor?: string;
  totalSpent: number;
  transactionCount: number;
  percentageOfDay: number;
  insight: string;
}

export interface TopCategoryTodayResponse {
  error: boolean;
  message?: string;
  data?: TopCategoryTodayData;
  statusCode?: number;
}
