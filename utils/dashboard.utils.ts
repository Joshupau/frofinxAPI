// Dashboard utility functions for calculations and date handling

/**
 * Get date range for a given period
 * @param period - 'today' | 'week' | 'month' | 'year' | 'all'
 * @returns { startDate, endDate }
 */
export const getDateRangeForPeriod = (
  period: 'today' | 'week' | 'month' | 'year' | 'all'
): { startDate: Date; endDate: Date } => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  switch (period) {
    case 'today':
      return { startDate: today, endDate: tomorrow };

    case 'week': {
      const start = new Date(today);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return { startDate: start, endDate: end };
    }

    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return { startDate: start, endDate: end };
    }

    case 'year': {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear() + 1, 0, 1);
      return { startDate: start, endDate: end };
    }

    case 'all':
    default:
      return { startDate: new Date(2000, 0, 1), endDate: tomorrow };
  }
};

/**
 * Get start and end dates for a specific month/year
 * @param month - 1-12
 * @param year - 4-digit year
 * @returns { startDate, endDate }
 */
export const getMonthDateRange = (month: number, year: number) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  return { startDate, endDate };
};

/**
 * Calculate net cash flow
 * @param income - total income
 * @param expenses - total expenses
 * @returns net cash flow (income - expenses)
 */
export const calculateNetCashFlow = (income: number, expenses: number): number => {
  return income - expenses;
};

/**
 * Format currency for display
 * @param amount - amount to format
 * @param currency - currency code (default: 'PHP')
 * @returns formatted string
 */
export const formatCurrency = (amount: number, currency: string = 'PHP'): string => {
  const formatter = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  });
  return formatter.format(amount);
};

/**
 * Round amount to 2 decimal places
 * @param amount - amount to round
 * @returns rounded amount
 */
export const roundAmount = (amount: number): number => {
  return Math.round(amount * 100) / 100;
};
