// Category type definitions

export interface CategoryCreateBody {
  name: string;
  type: 'income' | 'expense';
  icon?: string;
  color?: string;
}

export interface CategoryUpdateBody {
  id: string;
  name?: string;
  icon?: string;
  color?: string;
  status?: 'active' | 'archived';
}

export interface CategoryListQuery {
  page?: string;
  limit?: string;
  type?: 'income' | 'expense';
  search?: string;
  includeDefault?: string; // 'true' | 'false'
}

export interface CategoryServiceResponse {
  error: boolean;
  message?: string;
  data?: any;
  statusCode?: number;
}
