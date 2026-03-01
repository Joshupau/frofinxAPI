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

export interface BudgetServiceResponse {
  error: boolean;
  message?: string;
  data?: any;
  statusCode?: number;
}
