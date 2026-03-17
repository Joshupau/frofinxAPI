import mongoose from 'mongoose';

/**
 * Generate MongoDB $match stage filters for specific time periods
 * These filters ensure strict period boundaries (not including adjacent periods)
 */

/**
 * Filter transactions by current day only
 * Returns transactions from 00:00:00 UTC to 23:59:59 UTC of today
 * @param userId - user ObjectId
 * @returns MongoDB $match stage
 */
export const getDateFilterForDay = (userId: string | mongoose.Types.ObjectId) => {
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

  return {
    owner: new mongoose.Types.ObjectId(userId),
    date: { $gte: startOfDay, $lte: endOfDay },
    status: 'completed'
  };
};

/**
 * Filter transactions by current week only (Sunday to Saturday)
 * Returns transactions for the current week only
 * @param userId - user ObjectId
 * @returns MongoDB $match stage
 */
export const getDateFilterForWeek = (userId: string | mongoose.Types.ObjectId) => {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  
  // Calculate start of week (Sunday)
  const startOfWeek = new Date(now);
  startOfWeek.setUTCDate(now.getUTCDate() - dayOfWeek);
  startOfWeek.setUTCHours(0, 0, 0, 0);
  
  // Calculate end of week (Saturday, 23:59:59)
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6);
  endOfWeek.setUTCHours(23, 59, 59, 999);

  return {
    owner: new mongoose.Types.ObjectId(userId),
    date: { $gte: startOfWeek, $lte: endOfWeek },
    status: 'completed'
  };
};

/**
 * Filter transactions by current month only
 * Returns transactions for the current month only (not previous or next month)
 * @param userId - user ObjectId
 * @returns MongoDB $match stage
 */
export const getDateFilterForMonth = (userId: string | mongoose.Types.ObjectId) => {
  const now = new Date();
  
  // Start of month
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  
  // End of month
  const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

  return {
    owner: new mongoose.Types.ObjectId(userId),
    date: { $gte: startOfMonth, $lte: endOfMonth },
    status: 'completed'
  };
};

/**
 * Filter transactions by current year only
 * Returns transactions for the current year only (Jan 1 - Dec 31)
 * @param userId - user ObjectId
 * @returns MongoDB $match stage
 */
export const getDateFilterForYear = (userId: string | mongoose.Types.ObjectId) => {
  const now = new Date();
  
  // Start of year (January 1, 00:00:00 UTC)
  const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
  
  // End of year (December 31, 23:59:59 UTC)
  const endOfYear = new Date(Date.UTC(now.getUTCFullYear(), 11, 31, 23, 59, 59, 999));

  return {
    owner: new mongoose.Types.ObjectId(userId),
    date: { $gte: startOfYear, $lte: endOfYear },
    status: 'completed'
  };
};

/**
 * Generic date filter for custom period
 * @param userId - user ObjectId
 * @param period - 'day' | 'week' | 'month' | 'year'
 * @returns MongoDB $match stage
 */
export const getDateFilter = (
  userId: string | mongoose.Types.ObjectId,
  period: 'day' | 'week' | 'month' | 'year'
) => {
  switch (period) {
    case 'day':
      return getDateFilterForDay(userId);
    case 'week':
      return getDateFilterForWeek(userId);
    case 'month':
      return getDateFilterForMonth(userId);
    case 'year':
      return getDateFilterForYear(userId);
    default:
      return getDateFilterForMonth(userId); // default to month
  }
};

/**
 * Get date range for a period (useful for returning to frontend)
 * @param period - 'day' | 'week' | 'month' | 'year'
 * @returns { startDate, endDate }
 */
export const getDateRange = (period: 'day' | 'week' | 'month' | 'year') => {
  const now = new Date();

  switch (period) {
    case 'day': {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
      return { startDate: start, endDate: end };
    }

    case 'week': {
      const dayOfWeek = now.getUTCDay();
      const start = new Date(now);
      start.setUTCDate(now.getUTCDate() - dayOfWeek);
      start.setUTCHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setUTCDate(start.getUTCDate() + 6);
      end.setUTCHours(23, 59, 59, 999);

      return { startDate: start, endDate: end };
    }

    case 'month': {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
      return { startDate: start, endDate: end };
    }

    case 'year': {
      const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(now.getUTCFullYear(), 11, 31, 23, 59, 59, 999));
      return { startDate: start, endDate: end };
    }
  }
};
