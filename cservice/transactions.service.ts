import mongoose from 'mongoose';
import Transactions from '../models/Transactions.js';
import Wallets from '../models/Wallets.js';
import Bills from '../models/Bills.js';
import type { TransactionServiceResponse } from '../ctypes/transactions.types.js';
import { pageOptions } from '../utils/paginate.js';

export const create = async (
  userId: string,
  walletId: string,
  amount: number,
  type: 'income' | 'expense' | 'transfer',
  categoryId?: string,
  description?: string,
  date?: string,
  attachments?: string[],
  tags?: string[],
  toWalletId?: string,
  billId?: string
): Promise<TransactionServiceResponse> => {
  try {
    // Validate wallet ownership
    const wallet = await Wallets.findOne({
      _id: new mongoose.Types.ObjectId(walletId),
      owner: new mongoose.Types.ObjectId(userId),
      status: 'active'
    });

    if (!wallet) {
      return {
        error: true,
        message: 'Wallet not found or inactive.',
        statusCode: 404
      };
    }

    // For transfers, validate toWallet
    let toWallet = null;
    if (type === 'transfer') {
      if (!toWalletId) {
        return {
          error: true,
          message: 'Destination wallet required for transfers.',
          statusCode: 400
        };
      }

      toWallet = await Wallets.findOne({
        _id: new mongoose.Types.ObjectId(toWalletId),
        owner: new mongoose.Types.ObjectId(userId),
        status: 'active'
      });

      if (!toWallet) {
        return {
          error: true,
          message: 'Destination wallet not found or inactive.',
          statusCode: 404
        };
      }

      if (walletId === toWalletId) {
        return {
          error: true,
          message: 'Cannot transfer to the same wallet.',
          statusCode: 400
        };
      }
    }

    // Check sufficient balance for expense or transfer
    if ((type === 'expense' || type === 'transfer') && wallet.balance < amount) {
      return {
        error: true,
        message: 'Insufficient wallet balance.',
        statusCode: 400
      };
    }

    // Create transaction
    const transaction = await Transactions.create({
      owner: new mongoose.Types.ObjectId(userId),
      wallet: new mongoose.Types.ObjectId(walletId),
      category: categoryId ? new mongoose.Types.ObjectId(categoryId) : undefined,
      amount: amount,
      type: type,
      description: description,
      date: date ? new Date(date) : new Date(),
      attachments: attachments || [],
      tags: tags || [],
      toWallet: toWalletId ? new mongoose.Types.ObjectId(toWalletId) : undefined,
      bill: billId ? new mongoose.Types.ObjectId(billId) : undefined,
      status: 'completed'
    });

    // Update wallet balances
    if (type === 'income') {
      wallet.balance += amount;
      await wallet.save();
    } else if (type === 'expense') {
      wallet.balance -= amount;
      await wallet.save();
    } else if (type === 'transfer' && toWallet) {
      wallet.balance -= amount;
      toWallet.balance += amount;
      await Promise.all([wallet.save(), toWallet.save()]);
    }

    // If linked to a bill, update bill payment status
    if (billId) {
      await Bills.findByIdAndUpdate(
        new mongoose.Types.ObjectId(billId),
        {
          paymentStatus: 'paid',
          paidAmount: amount,
          lastPaidDate: transaction.date
        }
      );
    }

    return {
      error: false,
      message: 'Transaction created successfully',
      data: { id: transaction._id, ...transaction.toObject() }
    };
  } catch (err) {
    console.log(`Error creating transaction: ${err}`);
    return {
      error: true,
      message: 'Failed to create transaction. Please contact support.',
      statusCode: 400
    };
  }
};

export const list = async (
  userId: string,
  page: string,
  limit: string,
  filters?: {
    walletId?: string;
    categoryId?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
    minAmount?: string;
    maxAmount?: string;
    search?: string;
    status?: string;
  }
): Promise<TransactionServiceResponse> => {
  try {
    const options = pageOptions(page || '0', limit || '20');
    
    const filter: any = {
      owner: new mongoose.Types.ObjectId(userId)
    };

    if (filters?.walletId) {
      filter.wallet = new mongoose.Types.ObjectId(filters.walletId);
    }

    if (filters?.categoryId) {
      filter.category = new mongoose.Types.ObjectId(filters.categoryId);
    }

    if (filters?.type) {
      filter.type = filters.type;
    }

    if (filters?.status) {
      filter.status = filters.status;
    } else {
      filter.status = 'completed';
    }

    if (filters?.startDate || filters?.endDate) {
      filter.date = {};
      if (filters.startDate) {
        filter.date.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        filter.date.$lte = new Date(filters.endDate);
      }
    }

    if (filters?.minAmount || filters?.maxAmount) {
      filter.amount = {};
      if (filters.minAmount) {
        filter.amount.$gte = parseFloat(filters.minAmount);
      }
      if (filters.maxAmount) {
        filter.amount.$lte = parseFloat(filters.maxAmount);
      }
    }

    if (filters?.search) {
      filter.description = { $regex: filters.search, $options: 'i' };
    }

    const [transactions, totalDocuments] = await Promise.all([
      Transactions.find(filter)
        .populate('wallet', 'name type currency')
        .populate('category', 'name type icon color')
        .populate('toWallet', 'name type')
        .sort({ date: -1, createdAt: -1 })
        .skip(options.skip)
        .limit(options.limit),
      Transactions.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalDocuments / options.limit);

    return {
      error: false,
      data: {
        items: transactions.map(tx => ({ id: tx._id, ...tx.toObject() })),
        totalPages,
        currentPage: options.page,
        totalItems: totalDocuments
      }
    };
  } catch (err) {
    console.log(`Error listing transactions: ${err}`);
    return {
      error: true,
      message: 'Failed to retrieve transactions.',
      statusCode: 400
    };
  }
};

export const update = async (
  userId: string,
  id: string,
  updates: {
    walletId?: string;
    categoryId?: string;
    amount?: number;
    type?: string;
    description?: string;
    date?: string;
    attachments?: string[];
    tags?: string[];
    status?: string;
  }
): Promise<TransactionServiceResponse> => {
  try {
    const transaction = await Transactions.findOne({
      _id: new mongoose.Types.ObjectId(id),
      owner: new mongoose.Types.ObjectId(userId)
    });

    if (!transaction) {
      return {
        error: true,
        message: 'Transaction not found or you do not have permission.',
        statusCode: 404
      };
    }

    // If amount or type changed, need to revert old balance changes and apply new ones
    if (updates.amount || updates.type || updates.walletId) {
      return {
        error: true,
        message: 'Cannot change transaction amount, type, or wallet. Please delete and create a new transaction.',
        statusCode: 400
      };
    }

    const updateData: any = {};
    if (updates.categoryId) updateData.category = new mongoose.Types.ObjectId(updates.categoryId);
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.date) updateData.date = new Date(updates.date);
    if (updates.attachments) updateData.attachments = updates.attachments;
    if (updates.tags) updateData.tags = updates.tags;
    if (updates.status) updateData.status = updates.status;

    await Transactions.findByIdAndUpdate(
      new mongoose.Types.ObjectId(id),
      { $set: updateData }
    );

    return {
      error: false,
      message: 'Transaction updated successfully'
    };
  } catch (err) {
    console.log(`Error updating transaction: ${err}`);
    return {
      error: true,
      message: 'Failed to update transaction.',
      statusCode: 400
    };
  }
};

export const deleteTransaction = async (userId: string, id: string): Promise<TransactionServiceResponse> => {
  try {
    const transaction = await Transactions.findOne({
      _id: new mongoose.Types.ObjectId(id),
      owner: new mongoose.Types.ObjectId(userId)
    });

    if (!transaction) {
      return {
        error: true,
        message: 'Transaction not found or you do not have permission.',
        statusCode: 404
      };
    }

    if (transaction.status !== 'completed') {
      return {
        error: true,
        message: 'Can only delete completed transactions.',
        statusCode: 400
      };
    }

    // Revert wallet balance changes
    const wallet = await Wallets.findById(transaction.wallet);
    if (wallet) {
      if (transaction.type === 'income') {
        wallet.balance -= transaction.amount;
      } else if (transaction.type === 'expense') {
        wallet.balance += transaction.amount;
      } else if (transaction.type === 'transfer' && transaction.toWallet) {
        const toWallet = await Wallets.findById(transaction.toWallet);
        if (toWallet) {
          wallet.balance += transaction.amount;
          toWallet.balance -= transaction.amount;
          await Promise.all([wallet.save(), toWallet.save()]);
        }
      }
      await wallet.save();
    }

    await Transactions.findByIdAndDelete(new mongoose.Types.ObjectId(id));

    return {
      error: false,
      message: 'Transaction deleted successfully'
    };
  } catch (err) {
    console.log(`Error deleting transaction: ${err}`);
    return {
      error: true,
      message: 'Failed to delete transaction.',
      statusCode: 400
    };
  }
};

export const getMonthlyReport = async (
  userId: string,
  month?: string,
  year?: string,
  walletId?: string
): Promise<TransactionServiceResponse> => {
  try {
    const now = new Date();
    const targetMonth = month ? parseInt(month) : now.getMonth() + 1;
    const targetYear = year ? parseInt(year) : now.getFullYear();

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

    const matchStage: any = {
      owner: new mongoose.Types.ObjectId(userId),
      date: { $gte: startDate, $lte: endDate },
      status: 'completed'
    };

    if (walletId) {
      matchStage.wallet = new mongoose.Types.ObjectId(walletId);
    }

    const summary = await Transactions.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const result: any = {
      month: targetMonth,
      year: targetYear,
      income: 0,
      expense: 0,
      transfers: 0,
      incomeCount: 0,
      expenseCount: 0,
      transferCount: 0,
      netCashFlow: 0
    };

    summary.forEach(item => {
      if (item._id === 'income') {
        result.income = item.total;
        result.incomeCount = item.count;
      } else if (item._id === 'expense') {
        result.expense = item.total;
        result.expenseCount = item.count;
      } else if (item._id === 'transfer') {
        result.transfers = item.total;
        result.transferCount = item.count;
      }
    });

    result.netCashFlow = result.income - result.expense;

    return {
      error: false,
      data: result
    };
  } catch (err) {
    console.log(`Error generating monthly report: ${err}`);
    return {
      error: true,
      message: 'Failed to generate monthly report.',
      statusCode: 400
    };
  }
};

export const getCategoryBreakdown = async (
  userId: string,
  type: 'income' | 'expense',
  startDate?: string,
  endDate?: string,
  walletId?: string
): Promise<TransactionServiceResponse> => {
  try {
    const matchStage: any = {
      owner: new mongoose.Types.ObjectId(userId),
      type: type,
      status: 'completed'
    };

    if (startDate || endDate) {
      matchStage.date = {};
      if (startDate) matchStage.date.$gte = new Date(startDate);
      if (endDate) matchStage.date.$lte = new Date(endDate);
    }

    if (walletId) {
      matchStage.wallet = new mongoose.Types.ObjectId(walletId);
    }

    const breakdown = await Transactions.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'categoryDetails'
        }
      },
      {
        $addFields: {
          categoryName: { $arrayElemAt: ['$categoryDetails.name', 0] },
          categoryIcon: { $arrayElemAt: ['$categoryDetails.icon', 0] },
          categoryColor: { $arrayElemAt: ['$categoryDetails.color', 0] }
        }
      },
      {
        $project: {
          categoryDetails: 0
        }
      },
      { $sort: { total: -1 } }
    ]);

    const totalAmount = breakdown.reduce((sum, item) => sum + item.total, 0);

    return {
      error: false,
      data: {
        breakdown: breakdown.map(item => ({
          categoryId: item._id,
          categoryName: item.categoryName || 'Uncategorized',
          categoryIcon: item.categoryIcon,
          categoryColor: item.categoryColor,
          total: item.total,
          count: item.count,
          percentage: totalAmount > 0 ? ((item.total / totalAmount) * 100).toFixed(2) : 0
        })),
        totalAmount,
        transactionCount: breakdown.reduce((sum, item) => sum + item.count, 0)
      }
    };
  } catch (err) {
    console.log(`Error generating category breakdown: ${err}`);
    return {
      error: true,
      message: 'Failed to generate category breakdown.',
      statusCode: 400
    };
  }
};
