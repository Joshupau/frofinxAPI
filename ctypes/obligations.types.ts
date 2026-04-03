// Obligation type definitions

export interface ObligationCreateBody {
  direction: 'debt' | 'lending';
  name: string;
  counterparty: string;
  counterpartyContact?: string;
  principalAmount: number;
  currency?: string;
  interestRate?: number;
  interestType?: 'simple' | 'compound';
  startDate: string; // ISO date
  dueDate?: string; // ISO date
  walletId?: string;
  categoryId?: string;
  notes?: string;
  tags?: string[];
  isInstallment?: boolean;
  installmentAmount?: number;
  totalInstallments?: number;
  installmentFrequency?: 'weekly' | 'monthly' | 'yearly';
}

export interface ObligationUpdateBody {
  id: string;
  name?: string;
  counterparty?: string;
  counterpartyContact?: string;
  dueDate?: string;
  interestRate?: number;
  interestType?: 'simple' | 'compound';
  walletId?: string;
  categoryId?: string;
  notes?: string;
  tags?: string[];
  status?: 'active' | 'partially_paid' | 'settled' | 'defaulted' | 'archived';
}

export interface ObligationRecordPaymentBody {
  id: string;
  amount: number;
  walletId: string;
  date?: string; // ISO date
  notes?: string;
  idempotencyKey?: string;
}

export interface ObligationListQuery {
  page?: string;
  limit?: string;
  direction?: 'debt' | 'lending';
  status?: 'active' | 'partially_paid' | 'settled' | 'defaulted' | 'archived';
  isInstallment?: string; // 'true' | 'false'
}

export interface ObligationServiceResponse {
  error: boolean;
  message?: string;
  data?: any;
  statusCode?: number;
}
