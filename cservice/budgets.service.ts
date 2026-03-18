import mongoose from 'mongoose';
import Budgets from '../models/Budgets.js';
import Transactions from '../models/Transactions.js';
import type { BudgetServiceResponse } from '../ctypes/budgets.types.js';
import { pageOptions } from '../utils/paginate.js';

export const create = async (
  userId: string,
  name: string,
  amount: number,
  period: 'daily' | 'weekly' | 'monthly' | 'yearly',
  startDate: string,
  categoryId?: string,
  endDate?: string,
  alertThreshold?: number
): Promise<BudgetServiceResponse> => {
  try {
    const start = new Date(startDate);
    let end: Date;

    if (endDate) {
      end = new Date(endDate);
    } else {
      // Auto-calculate end date based on period
      end = new Date(start);
      switch (period) {
        case 'daily':
          end.setDate(end.getDate() + 1);
          break;
        case 'weekly':
          end.setDate(end.getDate() + 7);
          break;
        case 'monthly':
          end.setMonth(end.getMonth() + 1);
          break;
        case 'yearly':
          end.setFullYear(end.getFullYear() + 1);
          break;
      }
    }

    const budget = await Budgets.create({
      owner: new mongoose.Types.ObjectId(userId),
      category: categoryId && /^[0-9a-fA-F]{24}$/.test(categoryId) ? new mongoose.Types.ObjectId(categoryId) : undefined,
      name: name,
      amount: amount,
      spent: 0,
      period: period,
      startDate: start,
      endDate: end,
      alertThreshold: alertThreshold || 80,
      status: 'active'
    });

    return {
      error: false,
      message: 'Budget created successfully',
      data: { id: budget._id, ...budget.toObject() }
    };
  } catch (err) {
    console.log(`Error creating budget: ${err}`);
    return {
      error: true,
      message: 'Failed to create budget. Please contact support.',
      statusCode: 400
    };
  }
};

export const list = async (
  userId: string,
  page: string,
  limit: string,
  filters?: {
    categoryId?: string;
    period?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<BudgetServiceResponse> => {
  try {
    const options = pageOptions(page || '0', limit || '20');
    
    const filter: any = {
      owner: new mongoose.Types.ObjectId(userId)
    };

    if (filters?.categoryId && /^[0-9a-fA-F]{24}$/.test(filters.categoryId)) {
      filter.category = new mongoose.Types.ObjectId(filters.categoryId);
    }

    if (filters?.period) {
      filter.period = filters.period;
    }

    if (filters?.status) {
      filter.status = filters.status;
    } else {
      filter.status = 'active';
    }

    if (filters?.startDate || filters?.endDate) {
      filter.$and = [];
      if (filters.startDate) {
        filter.$and.push({ startDate: { $gte: new Date(filters.startDate) } });
      }
      if (filters.endDate) {
        filter.$and.push({ endDate: { $lte: new Date(filters.endDate) } });
      }
    }

    console.log('Budget List Filter:', filter, 'Options:', options);

    const [budgets, totalDocuments] = await Promise.all([
      Budgets.find(filter)
        .populate('category', 'name type icon color')
        .sort({ startDate: -1 })
        .skip(options.skip)
        .limit(options.limit),
      Budgets.countDocuments(filter)
    ]);

    // Calculate spent for each budget from transactions
    const budgetsWithSpent = await Promise.all(
      budgets.map(async (budget) => {
        const spent = await calculateSpent(
          userId,
          budget.category ? budget.category.toString() : undefined,
          budget.startDate,
          budget.endDate
        );

        budget.spent = spent;
        
        // Update status if exceeded
        if (spent >= budget.amount) {
          budget.status = 'exceeded';
          await budget.save();
        }

        return { id: budget._id, ...budget.toObject() };
      })
    );

    const totalPages = Math.ceil(totalDocuments / options.limit);

    return {
      error: false,
      data: {
        items: budgetsWithSpent,
        totalPages,
        currentPage: options.page,
        totalItems: totalDocuments
      }
    };
  } catch (err) {
    console.log(`Error listing budgets: ${err}`);
    return {
      error: true,
      message: 'Failed to retrieve budgets.',
      statusCode: 400
    };
  }
};

export const update = async (
  userId: string,
  id: string,
  updates: {
    categoryId?: string;
    name?: string;
    amount?: number;
    period?: string;
    startDate?: string;
    endDate?: string;
    alertThreshold?: number;
    status?: string;
  }
): Promise<BudgetServiceResponse> => {
  try {
    const budget = await Budgets.findOne({
      _id: new mongoose.Types.ObjectId(id),
      owner: new mongoose.Types.ObjectId(userId)
    });

    if (!budget) {
      return {
        error: true,
        message: 'Budget not found or you do not have permission.',
        statusCode: 404
      };
    }

    const updateData: any = {};
    if (updates.categoryId && /^[0-9a-fA-F]{24}$/.test(updates.categoryId)) updateData.category = new mongoose.Types.ObjectId(updates.categoryId);
    if (updates.name) updateData.name = updates.name;
    if (updates.amount) updateData.amount = updates.amount;
    if (updates.period) updateData.period = updates.period;
    if (updates.startDate) updateData.startDate = new Date(updates.startDate);
    if (updates.endDate) updateData.endDate = new Date(updates.endDate);
    if (updates.alertThreshold) updateData.alertThreshold = updates.alertThreshold;
    if (updates.status) updateData.status = updates.status;

    await Budgets.findByIdAndUpdate(
      new mongoose.Types.ObjectId(id),
      { $set: updateData }
    );

    return {
      error: false,
      message: 'Budget updated successfully'
    };
  } catch (err) {
    console.log(`Error updating budget: ${err}`);
    return {
      error: true,
      message: 'Failed to update budget.',
      statusCode: 400
    };
  }
};

export const getCurrent = async (
  userId: string,
  period?: string
): Promise<BudgetServiceResponse> => {
  try {
    const now = new Date();
    
    const filter: any = {
      owner: new mongoose.Types.ObjectId(userId),
      status: { $in: ['active', 'exceeded'] },
      startDate: { $lte: now },
      endDate: { $gte: now }
    };

    if (period) {
      filter.period = period;
    }

    const budgets = await Budgets.find(filter)
      .populate('category', 'name type icon color')
      .sort({ startDate: -1 });

    // Calculate spent for each budget
    const budgetsWithSpent = await Promise.all(
      budgets.map(async (budget) => {
        const spent = await calculateSpent(
          userId,
          budget.category ? budget.category.toString() : undefined,
          budget.startDate,
          budget.endDate
        );

        budget.spent = spent;
        
        // Update status if exceeded
        if (spent >= budget.amount && budget.status !== 'exceeded') {
          budget.status = 'exceeded';
          await budget.save();
        }

        return { id: budget._id, ...budget.toObject() };
      })
    );

    return {
      error: false,
      data: {
        items: budgetsWithSpent,
        totalBudgets: budgetsWithSpent.length
      }
    };
  } catch (err) {
    console.log(`Error getting current budgets: ${err}`);
    return {
      error: true,
      message: 'Failed to retrieve current budgets.',
      statusCode: 400
    };
  }
};

export const checkStatus = async (userId: string, id: string): Promise<BudgetServiceResponse> => {
  try {
    const budget = await Budgets.findOne({
      _id: new mongoose.Types.ObjectId(id),
      owner: new mongoose.Types.ObjectId(userId)
    }).populate('category', 'name type icon color');

    if (!budget) {
      return {
        error: true,
        message: 'Budget not found or you do not have permission.',
        statusCode: 404
      };
    }

    const spent = await calculateSpent(
      userId,
      budget.category ? budget.category.toString() : undefined,
      budget.startDate,
      budget.endDate
    );

    budget.spent = spent;

    const remaining = budget.amount - spent;
    const percentageUsed = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
    const isOverBudget = spent >= budget.amount;
    const isNearThreshold = percentageUsed >= (budget.alertThreshold || 80);

    // Update status
    if (isOverBudget && budget.status !== 'exceeded') {
      budget.status = 'exceeded';
      await budget.save();
    }

    return {
      error: false,
      data: {
        budget: { id: budget._id, ...budget.toObject() },
        spent: spent,
        remaining: remaining,
        percentageUsed: percentageUsed.toFixed(2),
        isOverBudget: isOverBudget,
        isNearThreshold: isNearThreshold
      }
    };
  } catch (err) {
    console.log(`Error checking budget status: ${err}`);
    return {
      error: true,
      message: 'Failed to check budget status.',
      statusCode: 400
    };
  }
};

/**
 * Sync budget spent amount atomically using $inc operator
 * Called when transactions are added or deleted
 * Returns alert flag if threshold is crossed
 */
async function syncBudgetSpent(
  budgetId: string,
  amountDelta: number
): Promise<{ alertTriggered: boolean; percentageUsed: number }> {
  const budget = await Budgets.findByIdAndUpdate(
    new mongoose.Types.ObjectId(budgetId),
    { $inc: { spent: amountDelta } },
    { new: true }
  );

  if (!budget) {
    return { alertTriggered: false, percentageUsed: 0 };
  }

  const percentageUsed = budget.amount > 0 ? (budget.spent / budget.amount) * 100 : 0;
  const alertThreshold = budget.alertThreshold || 80;

  if (percentageUsed >= alertThreshold && percentageUsed - Math.abs(amountDelta / budget.amount * 100) < alertThreshold) {
    // Crossed the threshold
    return { alertTriggered: true, percentageUsed };
  }

  return { alertTriggered: false, percentageUsed };
}

/**
 * Helper function to calculate spent amount from transactions
 * Used for initial data load and verification
 */
async function calculateSpent(
  userId: string,
  categoryId: string | undefined,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const filter: any = {
    owner: new mongoose.Types.ObjectId(userId),
    type: 'expense',
    status: 'completed',
    date: { $gte: startDate, $lte: endDate }
  };

  if (categoryId && /^[0-9a-fA-F]{24}$/.test(categoryId)) {
    filter.category = new mongoose.Types.ObjectId(categoryId);
  }

  const result = await Transactions.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' }
      }
    }
  ]);

  return result[0]?.total || 0;
}

/**
 * Get performance metrics across all budgets
 * Shows burn rate and progress for current budgets
 */
export const getPerformance = async (userId: string): Promise<BudgetServiceResponse> => {
  try {
    const now = new Date();

    const currentBudgets = await Budgets.find({
      owner: new mongoose.Types.ObjectId(userId),
      status: { $in: ['active', 'exceeded'] },
      startDate: { $lte: now },
      endDate: { $gte: now }
    }).populate('category', 'name type icon color');

    if (currentBudgets.length === 0) {
      return {
        error: false,
        data: {
          message: 'No active budgets for this period',
          budgets: [],
          overallBurnRate: 0,
          totalBudgeted: 0,
          totalSpent: 0,
          daysElapsed: 0,
          daysRemaining: 0
        }
      };
    }

    // Calculate burn rates for each budget
    const budgetMetrics = await Promise.all(
      currentBudgets.map(async (budget) => {
        const spent = await calculateSpent(
          userId,
          budget.category ? budget.category.toString() : undefined,
          budget.startDate,
          budget.endDate
        );

        const totalDays = Math.ceil(
          (budget.endDate.getTime() - budget.startDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const daysElapsed = Math.ceil(
          (now.getTime() - budget.startDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const daysRemaining = totalDays - daysElapsed;

        const expectedSpend = (budget.amount / totalDays) * daysElapsed;
        const burnRate = expectedSpend > 0 ? (spent / expectedSpend) * 100 : 0;
        const remaining = budget.amount - spent;

        const categoryName = budget.category && typeof budget.category === 'object' 
          ? (budget.category as any).name 
          : 'Uncategorized';

        return {
          budgetId: budget._id.toString(),
          name: budget.name,
          categoryName: categoryName,
          amount: budget.amount,
          spent: spent,
          remaining: remaining,
          percentageUsed: (spent / budget.amount) * 100,
          burnRate: parseFloat(burnRate.toFixed(2)),
          daysElapsed: daysElapsed,
          daysRemaining: daysRemaining,
          status: burnRate > 100 ? 'OverBudget' : burnRate < 100 ? 'UnderBudget' : 'OnTrack',
          warning: burnRate > 100 ? `You've spent ${burnRate.toFixed(0)}% of expected for this point in the period` : null
        };
      })
    );

    const totalBudgeted = budgetMetrics.reduce((sum, b) => sum + b.amount, 0);
    const totalSpent = budgetMetrics.reduce((sum, b) => sum + b.spent, 0);
    const overallBurnRate = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;

    const firstBudget = currentBudgets[0];
    const totalDays = Math.ceil(
      (firstBudget.endDate.getTime() - firstBudget.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysElapsed = Math.ceil(
      (now.getTime() - firstBudget.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      error: false,
      data: {
        budgets: budgetMetrics,
        overallBurnRate: parseFloat(overallBurnRate.toFixed(2)),
        totalBudgeted: totalBudgeted,
        totalSpent: totalSpent,
        totalRemaining: totalBudgeted - totalSpent,
        daysElapsed: daysElapsed,
        daysRemaining: totalDays - daysElapsed,
        message: overallBurnRate > 100 
          ? `⚠️ You are ${overallBurnRate.toFixed(0)}% through your budgets. Slow down!`
          : `✓ You are ${overallBurnRate.toFixed(0)}% through your budgets. On track!`
      }
    };
  } catch (err) {
    console.log(`Error getting budget performance: ${err}`);
    return {
      error: true,
      message: 'Failed to retrieve budget performance.',
      statusCode: 400
    };
  }
};

/**
 * Rollover unused budget to next period
 */
export const rolloverBudget = async (userId: string, budgetId: string): Promise<BudgetServiceResponse> => {
  try {
    const budget = await Budgets.findOne({
      _id: new mongoose.Types.ObjectId(budgetId),
      owner: new mongoose.Types.ObjectId(userId)
    });

    if (!budget) {
      return {
        error: true,
        message: 'Budget not found or you do not have permission.',
        statusCode: 404
      };
    }

    const remaining = budget.amount - (budget.spent || 0);

    if (remaining <= 0) {
      return {
        error: true,
        message: 'No remaining budget to rollover.',
        statusCode: 400
      };
    }

    // Calculate next period start and end dates
    const nextStartDate = new Date(budget.endDate);
    nextStartDate.setDate(nextStartDate.getDate() + 1);

    const nextEndDate = new Date(nextStartDate);
    switch (budget.period) {
      case 'daily':
        nextEndDate.setDate(nextEndDate.getDate() + 1);
        break;
      case 'weekly':
        nextEndDate.setDate(nextEndDate.getDate() + 7);
        break;
      case 'monthly':
        nextEndDate.setMonth(nextEndDate.getMonth() + 1);
        break;
      case 'yearly':
        nextEndDate.setFullYear(nextEndDate.getFullYear() + 1);
        break;
    }

    // Create new budget with original amount + remaining
    const newBudget = await Budgets.create({
      owner: budget.owner,
      category: budget.category,
      name: `${budget.name} (Rolled Over)`,
      amount: budget.amount + remaining, // Original + rollover
      spent: 0,
      period: budget.period,
      startDate: nextStartDate,
      endDate: nextEndDate,
      alertThreshold: budget.alertThreshold,
      status: 'active'
    });

    return {
      error: false,
      message: 'Budget rolled over successfully',
      data: {
        previousBudgetId: budget._id,
        newBudgetId: newBudget._id,
        rolledOverAmount: remaining,
        newBudgetAmount: newBudget.amount,
        previousPeriod: {
          startDate: budget.startDate,
          endDate: budget.endDate,
          spent: budget.spent,
          remaining: remaining
        },
        newPeriod: {
          startDate: nextStartDate,
          endDate: nextEndDate,
          budgetAmount: newBudget.amount
        }
      }
    };
  } catch (err) {
    console.log(`Error rolling over budget: ${err}`);
    return {
      error: true,
      message: 'Failed to rollover budget.',
      statusCode: 400
    };
  }
};

/**
 * Get budget suggestions based on average spending in categories without budgets
 */
export const getSuggestions = async (userId: string): Promise<BudgetServiceResponse> => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get all categories user has budgets for
    const budgetedCategories = await Budgets.find({
      owner: new mongoose.Types.ObjectId(userId)
    }).select('category');

    const budgetedCategoryIds = budgetedCategories
      .filter(b => b.category)
      .map(b => (b.category as mongoose.Types.ObjectId).toString());

    // Find all transactions in last 30 days
    const transactions = await Transactions.find({
      owner: new mongoose.Types.ObjectId(userId),
      type: 'expense',
      status: 'completed',
      date: { $gte: thirtyDaysAgo, $lte: now },
      category: { $ne: null }
    }).populate('category', 'name icon color');

    // Group by category and calculate averages
    const categorySpending: { [key: string]: { name: string; icon?: string; color?: string; total: number; count: number } } = {};

    transactions.forEach((tx: any) => {
      if (!tx.category) return;

      const categoryId = tx.category._id.toString();

      // Skip if already has a budget
      if (budgetedCategoryIds.includes(categoryId)) return;

      if (!categorySpending[categoryId]) {
        categorySpending[categoryId] = {
          name: tx.category.name,
          icon: tx.category.icon,
          color: tx.category.color,
          total: 0,
          count: 0
        };
      }

      categorySpending[categoryId].total += tx.amount;
      categorySpending[categoryId].count += 1;
    });

    // Convert to array and calculate averages
    const suggestions = Object.entries(categorySpending)
      .map(([categoryId, data]) => ({
        categoryId: categoryId,
        categoryName: data.name,
        categoryIcon: data.icon,
        categoryColor: data.color,
        averageMonthlySpend: parseFloat((data.total / 30).toFixed(2)),
        totalSpentIn30Days: data.total,
        transactionCount: data.count,
        suggestedBudget: Math.ceil(data.total / 30 * 1.2) // Add 20% buffer
      }))
      .sort((a, b) => b.averageMonthlySpend - a.averageMonthlySpend)
      .slice(0, 5); // Top 5 suggestions

    return {
      error: false,
      data: {
        suggestions: suggestions,
        message: suggestions.length > 0
          ? `We found ${suggestions.length} categories you spend on frequently. Create budgets to track them better!`
          : 'No unbudgeted spending found in the last 30 days.',
        period: {
          startDate: thirtyDaysAgo,
          endDate: now,
          days: 30
        }
      }
    };
  } catch (err) {
    console.log(`Error getting budget suggestions: ${err}`);
    return {
      error: true,
      message: 'Failed to retrieve budget suggestions.',
      statusCode: 400
    };
  }
};

export const getSummary = async (userId: string): Promise<BudgetServiceResponse> => {
  try {
    const now = new Date();

    const [total, active, exceeded, currentBudgets] = await Promise.all([
      Budgets.countDocuments({ owner: new mongoose.Types.ObjectId(userId) }),
      Budgets.countDocuments({
        owner: new mongoose.Types.ObjectId(userId),
        status: 'active'
      }),
      Budgets.countDocuments({
        owner: new mongoose.Types.ObjectId(userId),
        status: 'exceeded'
      }),
      Budgets.find({
        owner: new mongoose.Types.ObjectId(userId),
        status: { $in: ['active', 'exceeded'] },
        startDate: { $lte: now },
        endDate: { $gte: now }
      })
    ]);

    // Calculate total budgeted vs total spent for current budgets
    let totalBudgeted = 0;
    let totalSpent = 0;

    for (const budget of currentBudgets) {
      totalBudgeted += budget.amount;
      const spent = await calculateSpent(
        userId,
        budget.category ? budget.category.toString() : undefined,
        budget.startDate,
        budget.endDate
      );
      totalSpent += spent;
    }

    return {
      error: false,
      data: {
        totalBudgets: total,
        activeBudgets: active,
        exceededBudgets: exceeded,
        currentBudgetsCount: currentBudgets.length,
        totalBudgeted: totalBudgeted,
        totalSpent: totalSpent,
        totalRemaining: totalBudgeted - totalSpent
      }
    };
  } catch (err) {
    console.log(`Error getting budget summary: ${err}`);
    return {
      error: true,
      message: 'Failed to retrieve budget summary.',
      statusCode: 400
    };
  }
};
