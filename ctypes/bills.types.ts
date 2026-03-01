// Bill type definitions

export interface BillCreateBody {
  name: string;
  amount: number;
  categoryId?: string;
  dueDate: string; // ISO date
  isRecurring: boolean;
  recurringFrequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  walletId?: string;
  reminder?: boolean;
  reminderDays?: number;
  notes?: string;
}

export interface BillUpdateBody {
  id: string;
  name?: string;
  amount?: number;
  categoryId?: string;
  dueDate?: string;
  isRecurring?: boolean;
  recurringFrequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  walletId?: string;
  reminder?: boolean;
  reminderDays?: number;
  notes?: string;
  status?: 'active' | 'archived';
}

export interface BillMarkPaidBody {
  id: string;
  paidAmount?: number;
  paidDate?: string; // ISO date
  walletId?: string; // which wallet was used to pay
  createTransaction?: boolean; // auto-create transaction
}

export interface BillListQuery {
  page?: string;
  limit?: string;
  paymentStatus?: 'paid' | 'unpaid' | 'overdue' | 'partial';
  isRecurring?: string; // 'true' | 'false'
  startDate?: string;
  endDate?: string;
  status?: 'active' | 'archived';
}

export interface BillUpcomingQuery {
  days?: string; // upcoming bills in next X days
}

export interface BillServiceResponse {
  error: boolean;
  message?: string;
  data?: any;
  statusCode?: number;
}
