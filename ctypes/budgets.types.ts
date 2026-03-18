// Budget type definitions

export interface BudgetCreateBody {
  categoryId?: string;
  name: string;
  amount: number;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate: string; // ISO date
  endDate?: string;   // ISO date (auto-calculated if not provided)
  alertThreshold?: number;
}

export interface BudgetUpdateBody {
  id: string;
  categoryId?: string;
  name?: string;
  amount?: number;
  period?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate?: string;
  endDate?: string;
  alertThreshold?: number;
  status?: 'active' | 'exceeded' | 'archived';
}

export interface BudgetListQuery {
  page?: string;
  limit?: string;
  categoryId?: string;
  period?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  status?: 'active' | 'exceeded' | 'archived';
  startDate?: string;
  endDate?: string;
}

export interface BudgetCurrentQuery {
  period?: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

export interface BudgetRolloverBody {
  id: string; // Budget ID to rollover
}

export interface BudgetPerformanceMetric {
  budgetId: string;
  name: string;
  categoryName: string;
  amount: number;
  spent: number;
  remaining: number;
  percentageUsed: number;
  burnRate: number; // percentage of expected spend at this point in period
  daysElapsed: number;
  daysRemaining: number;
  status: 'OverBudget' | 'OnTrack' | 'UnderBudget';
  warning: string | null;
}

export interface BudgetPerformanceResponse extends BudgetServiceResponse {
  data?: {
    budgets: BudgetPerformanceMetric[];
    overallBurnRate: number;
    totalBudgeted: number;
    totalSpent: number;
    totalRemaining: number;
    daysElapsed: number;
    daysRemaining: number;
    message: string;
  };
}

export interface BudgetRolloverResponse extends BudgetServiceResponse {
  data?: {
    previousBudgetId: string;
    newBudgetId: string;
    rolledOverAmount: number;
    newBudgetAmount: number;
    previousPeriod: {
      startDate: Date;
      endDate: Date;
      spent: number;
      remaining: number;
    };
    newPeriod: {
      startDate: Date;
      endDate: Date;
      budgetAmount: number;
    };
  };
}

export interface BudgetSuggestion {
  categoryId: string;
  categoryName: string;
  categoryIcon?: string;
  categoryColor?: string;
  averageMonthlySpend: number;
  totalSpentIn30Days: number;
  transactionCount: number;
  suggestedBudget: number;
}

export interface BudgetSuggestionsResponse extends BudgetServiceResponse {
  data?: {
    suggestions: BudgetSuggestion[];
    message: string;
    period: {
      startDate: Date;
      endDate: Date;
      days: number;
    };
  };
}

export interface BudgetServiceResponse {
  error: boolean;
  message?: string;
  data?: any;
  statusCode?: number;
}
