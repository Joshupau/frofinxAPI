// Investment type definitions

export interface InvestmentCreateBody {
  name: string;
  type: 'stocks' | 'bonds' | 'mutual_funds' | 'crypto' | 'real_estate' | 'savings' | 'other';
  principalAmount: number;
  currency?: string;
  platform?: string;
  walletId?: string;
  categoryId?: string;
  startDate: string; // ISO date
  maturityDate?: string; // ISO date
  expectedReturnRate?: number;
  notes?: string;
  tags?: string[];
}

export interface InvestmentUpdateBody {
  id: string;
  name?: string;
  platform?: string;
  maturityDate?: string;
  expectedReturnRate?: number;
  walletId?: string;
  categoryId?: string;
  notes?: string;
  tags?: string[];
  status?: 'active' | 'matured' | 'sold' | 'archived';
}

export interface InvestmentUpdateValueBody {
  id: string;
  value: number;
  date?: string; // ISO date
  notes?: string;
}

export interface InvestmentRecordReturnBody {
  id: string;
  amount: number;
  walletId: string;
  date?: string; // ISO date
  notes?: string;
}

export interface InvestmentSellBody {
  id: string;
  saleAmount: number;
  walletId: string;
  date?: string; // ISO date
  notes?: string;
}

export interface InvestmentListQuery {
  page?: string;
  limit?: string;
  type?: 'stocks' | 'bonds' | 'mutual_funds' | 'crypto' | 'real_estate' | 'savings' | 'other';
  status?: 'active' | 'matured' | 'sold' | 'archived';
}

export interface InvestmentServiceResponse {
  error: boolean;
  message?: string;
  data?: any;
  statusCode?: number;
}
