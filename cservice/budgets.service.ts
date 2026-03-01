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
      category: categoryId ? new mongoose.Types.ObjectId(categoryId) : undefined,
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

    if (filters?.categoryId) {
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
    if (updates.categoryId) updateData.category = new mongoose.Types.ObjectId(updates.categoryId);
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

// Helper function to calculate spent amount from transactions
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

  if (categoryId) {
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
