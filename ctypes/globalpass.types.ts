export interface GlobalPassCreateBody {
  secretkey: string;
}

export interface GlobalPassQuery {
  page?: string;
  limit?: string;
}

export interface GlobalPassServiceResponse {
  error: boolean;
  message?: string;
  data?: any;
  statusCode?: number;
}

export interface UsageHistoryItem {
  id: string;
  ipAddress: string;
  user: string;
  userType: string;
  dateused: Date;
}

export interface UsageHistoryResponse {
  totalPages: number;
  usageHistory: UsageHistoryItem[];
}
