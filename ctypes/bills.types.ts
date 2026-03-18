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

export interface BillCalendarQuery {
  month?: string; // YYYY-MM format, defaults to current month
  year?: string; // YYYY format
  startDate?: string; // ISO date
  endDate?: string; // ISO date
}

export interface BillCalendarEvent {
  id: string;
  name: string;
  amount: number;
  dueDate: string; // ISO date
  paymentStatus: 'paid' | 'unpaid' | 'overdue' | 'partial';
  isRecurring: boolean;
  recurringFrequency?: string;
  categoryName?: string;
  categoryColor?: string;
  reminder: boolean;
  reminderDays?: number;
  notes?: string;
  statusColor: string; // for UI: #FF6B6B (unpaid), #4ECDC4 (paid), #FFE66D (overdue), #95E1D3 (partial)
  statusLabel: string; // for UI display
}

export interface BillCalendarResponse {
  error: boolean;
  message?: string;
  data?: {
    month?: string;
    year?: string;
    startDate: string;
    endDate: string;
    calendarEvents: {
      [date: string]: BillCalendarEvent[]; // e.g., "2026-03-18": [...]
    };
    statistics: {
      totalBillsInRange: number;
      unpaidCount: number;
      paidCount: number;
      overdueCount: number;
      totalAmountDue: number;
      totalAmountPaid: number;
    };
    datesWithBills: string[]; // ISO dates of all days with bills
  };
  statusCode?: number;
}

export interface BillServiceResponse {
  error: boolean;
  message?: string;
  data?: any;
  statusCode?: number;
}
