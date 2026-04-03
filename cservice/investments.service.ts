import mongoose from 'mongoose';
import Investments from '../models/Investments.js';
import Transactions from '../models/Transactions.js';
import Wallets from '../models/Wallets.js';
import type { InvestmentServiceResponse } from '../ctypes/investments.types.js';
import { pageOptions } from '../utils/paginate.js';

export const create = async (
  userId: string,
  body: {
    name: string;
    type: 'stocks' | 'bonds' | 'mutual_funds' | 'crypto' | 'real_estate' | 'savings' | 'other';
    principalAmount: number;
    currency?: string;
    platform?: string;
    walletId?: string;
    categoryId?: string;
    startDate: string;
    maturityDate?: string;
    expectedReturnRate?: number;
    notes?: string;
    tags?: string[];
  }
): Promise<InvestmentServiceResponse> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { name, type, principalAmount, currency, platform, walletId, categoryId, startDate, maturityDate, expectedReturnRate, notes, tags } = body;

    const start = new Date(startDate);
    const maturity = maturityDate ? new Date(maturityDate) : undefined;
    const initialSnapshot = { value: principalAmount, date: start };

    const [investment] = await Investments.create(
      [
        {
          owner: new mongoose.Types.ObjectId(userId),
          name,
          type,
          principalAmount,
          currentValue: principalAmount,
          currency: currency || 'PHP',
          platform,
          wallet: walletId ? new mongoose.Types.ObjectId(walletId) : undefined,
          category: categoryId ? new mongoose.Types.ObjectId(categoryId) : undefined,
          startDate: start,
          maturityDate: maturity,
          expectedReturnRate,
          dividendsReceived: 0,
          notes,
          tags: tags || [],
          status: 'active',
          valueHistory: [initialSnapshot]
        }
      ],
      { session }
    );

    // Create expense transaction from wallet representing initial funding
    if (walletId) {
      const wallet = await Wallets.findByIdAndUpdate(
        new mongoose.Types.ObjectId(walletId),
        { $inc: { balance: -principalAmount } },
        { new: true, session }
      );

      if (!wallet) {
        await session.abortTransaction();
        return { error: true, message: 'Wallet not found.', statusCode: 404 };
      }

      if (wallet.balance < 0) {
        await session.abortTransaction();
        return { error: true, message: 'Insufficient wallet balance to fund this investment.', statusCode: 400 };
      }

      const [fundingTx] = await Transactions.create(
        [
          {
            owner: new mongoose.Types.ObjectId(userId),
            wallet: new mongoose.Types.ObjectId(walletId),
            category: categoryId ? new mongoose.Types.ObjectId(categoryId) : undefined,
            amount: principalAmount,
            type: 'expense',
            description: `Investment: ${name} (${type})`,
            date: start,
            attachments: [],
            tags: tags || [],
            status: 'completed'
          }
        ],
        { session }
      );

      await Investments.findByIdAndUpdate(
        investment._id,
        { fundingTransaction: fundingTx._id },
        { session }
      );
    }

    await session.commitTransaction();

    const populated = await Investments.findById(investment._id)
      .populate('wallet', 'name type')
      .populate('category', 'name icon color');

    return {
      error: false,
      message: 'Investment created successfully',
      data: { id: investment._id, ...populated!.toObject() }
    };
  } catch (err) {
    await session.abortTransaction();
    console.log(`Error creating investment: ${err}`);
    return { error: true, message: 'Failed to create investment.', statusCode: 400 };
  } finally {
    await session.endSession();
  }
};

export const list = async (
  userId: string,
  page: string,
  limit: string,
  filters?: {
    type?: string;
    status?: string;
  }
): Promise<InvestmentServiceResponse> => {
  try {
    const options = pageOptions(page || '0', limit || '20');

    const filter: any = { owner: new mongoose.Types.ObjectId(userId) };

    if (filters?.type) filter.type = filters.type;

    if (filters?.status) {
      filter.status = filters.status;
    } else {
      filter.status = { $ne: 'archived' };
    }

    const [investments, total] = await Promise.all([
      Investments.find(filter)
        .populate('wallet', 'name type')
        .populate('category', 'name icon color')
        .sort({ startDate: -1 })
        .skip(options.skip)
        .limit(options.limit),
      Investments.countDocuments(filter)
    ]);

    return {
      error: false,
      data: {
        items: investments.map(inv => ({ id: inv._id, ...inv.toObject() })),
        totalPages: Math.ceil(total / options.limit),
        currentPage: options.page,
        totalItems: total
      }
    };
  } catch (err) {
    console.log(`Error listing investments: ${err}`);
    return { error: true, message: 'Failed to retrieve investments.', statusCode: 400 };
  }
};

export const update = async (
  userId: string,
  id: string,
  updates: {
    name?: string;
    platform?: string;
    maturityDate?: string;
    expectedReturnRate?: number;
    walletId?: string;
    categoryId?: string;
    notes?: string;
    tags?: string[];
    status?: string;
  }
): Promise<InvestmentServiceResponse> => {
  try {
    const investment = await Investments.findOne({
      _id: new mongoose.Types.ObjectId(id),
      owner: new mongoose.Types.ObjectId(userId)
    });

    if (!investment) {
      return { error: true, message: 'Investment not found or you do not have permission.', statusCode: 404 };
    }

    const updateData: any = {};
    if (updates.name) updateData.name = updates.name;
    if (updates.platform !== undefined) updateData.platform = updates.platform;
    if (updates.maturityDate) updateData.maturityDate = new Date(updates.maturityDate);
    if (updates.expectedReturnRate !== undefined) updateData.expectedReturnRate = updates.expectedReturnRate;
    if (updates.walletId) updateData.wallet = new mongoose.Types.ObjectId(updates.walletId);
    if (updates.categoryId) updateData.category = new mongoose.Types.ObjectId(updates.categoryId);
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.tags) updateData.tags = updates.tags;
    if (updates.status) updateData.status = updates.status;

    await Investments.findByIdAndUpdate(id, { $set: updateData });

    return { error: false, message: 'Investment updated successfully' };
  } catch (err) {
    console.log(`Error updating investment: ${err}`);
    return { error: true, message: 'Failed to update investment.', statusCode: 400 };
  }
};

export const deleteInvestment = async (userId: string, id: string): Promise<InvestmentServiceResponse> => {
  try {
    const investment = await Investments.findOne({
      _id: new mongoose.Types.ObjectId(id),
      owner: new mongoose.Types.ObjectId(userId)
    });

    if (!investment) {
      return { error: true, message: 'Investment not found or you do not have permission.', statusCode: 404 };
    }

    await Investments.findByIdAndUpdate(id, { status: 'archived' });

    return { error: false, message: 'Investment deleted successfully' };
  } catch (err) {
    console.log(`Error deleting investment: ${err}`);
    return { error: true, message: 'Failed to delete investment.', statusCode: 400 };
  }
};

export const updateValue = async (
  userId: string,
  id: string,
  value: number,
  date?: string,
  notes?: string
): Promise<InvestmentServiceResponse> => {
  try {
    const investment = await Investments.findOne({
      _id: new mongoose.Types.ObjectId(id),
      owner: new mongoose.Types.ObjectId(userId)
    });

    if (!investment) {
      return { error: true, message: 'Investment not found or you do not have permission.', statusCode: 404 };
    }

    const snapshotDate = date ? new Date(date) : new Date();
    const snapshot = { value, date: snapshotDate, ...(notes && { notes }) };

    await Investments.findByIdAndUpdate(id, {
      $set: { currentValue: value },
      $push: { valueHistory: snapshot }
    });

    return {
      error: false,
      message: 'Investment value updated successfully',
      data: { currentValue: value, snapshot }
    };
  } catch (err) {
    console.log(`Error updating investment value: ${err}`);
    return { error: true, message: 'Failed to update investment value.', statusCode: 400 };
  }
};

export const recordReturn = async (
  userId: string,
  id: string,
  amount: number,
  walletId: string,
  date?: string,
  notes?: string
): Promise<InvestmentServiceResponse> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const investment = await Investments.findOne(
      { _id: new mongoose.Types.ObjectId(id), owner: new mongoose.Types.ObjectId(userId) },
      null,
      { session }
    );

    if (!investment) {
      await session.abortTransaction();
      return { error: true, message: 'Investment not found or you do not have permission.', statusCode: 404 };
    }

    const returnDate = date ? new Date(date) : new Date();

    await Wallets.findByIdAndUpdate(
      new mongoose.Types.ObjectId(walletId),
      { $inc: { balance: amount } },
      { session }
    );

    await Transactions.create(
      [
        {
          owner: new mongoose.Types.ObjectId(userId),
          wallet: new mongoose.Types.ObjectId(walletId),
          category: investment.category,
          amount,
          type: 'income',
          description: notes || `Investment return: ${investment.name}`,
          date: returnDate,
          attachments: [],
          tags: investment.tags,
          status: 'completed'
        }
      ],
      { session }
    );

    await Investments.findByIdAndUpdate(
      id,
      { $inc: { dividendsReceived: amount } },
      { session }
    );

    await session.commitTransaction();

    return {
      error: false,
      message: 'Investment return recorded successfully',
      data: { amount, dividendsReceived: investment.dividendsReceived + amount }
    };
  } catch (err) {
    await session.abortTransaction();
    console.log(`Error recording investment return: ${err}`);
    return { error: true, message: 'Failed to record investment return.', statusCode: 400 };
  } finally {
    await session.endSession();
  }
};

export const sell = async (
  userId: string,
  id: string,
  saleAmount: number,
  walletId: string,
  date?: string,
  notes?: string
): Promise<InvestmentServiceResponse> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const investment = await Investments.findOne(
      { _id: new mongoose.Types.ObjectId(id), owner: new mongoose.Types.ObjectId(userId) },
      null,
      { session }
    );

    if (!investment) {
      await session.abortTransaction();
      return { error: true, message: 'Investment not found or you do not have permission.', statusCode: 404 };
    }

    if (investment.status === 'sold' || investment.status === 'archived') {
      await session.abortTransaction();
      return { error: true, message: `Cannot sell a ${investment.status} investment.`, statusCode: 400 };
    }

    const saleDate = date ? new Date(date) : new Date();
    const gainLoss = parseFloat((saleAmount - investment.principalAmount).toFixed(2));

    await Wallets.findByIdAndUpdate(
      new mongoose.Types.ObjectId(walletId),
      { $inc: { balance: saleAmount } },
      { session }
    );

    await Transactions.create(
      [
        {
          owner: new mongoose.Types.ObjectId(userId),
          wallet: new mongoose.Types.ObjectId(walletId),
          category: investment.category,
          amount: saleAmount,
          type: 'income',
          description: notes || `Sale of investment: ${investment.name}`,
          date: saleDate,
          attachments: [],
          tags: investment.tags,
          status: 'completed'
        }
      ],
      { session }
    );

    const closeSnapshot = { value: saleAmount, date: saleDate, notes: notes || 'Sold' };

    await Investments.findByIdAndUpdate(
      id,
      {
        $set: { status: 'sold', currentValue: saleAmount },
        $push: { valueHistory: closeSnapshot }
      },
      { session }
    );

    await session.commitTransaction();

    return {
      error: false,
      message: 'Investment sold successfully',
      data: { saleAmount, gainLoss }
    };
  } catch (err) {
    await session.abortTransaction();
    console.log(`Error selling investment: ${err}`);
    return { error: true, message: 'Failed to sell investment.', statusCode: 400 };
  } finally {
    await session.endSession();
  }
};

export const summary = async (userId: string): Promise<InvestmentServiceResponse> => {
  try {
    const uid = new mongoose.Types.ObjectId(userId);

    const [stats] = await Investments.aggregate([
      { $match: { owner: uid, status: { $ne: 'archived' } } },
      {
        $group: {
          _id: null,
          totalInvested: { $sum: '$principalAmount' },
          totalCurrentValue: { $sum: '$currentValue' },
          totalDividends: { $sum: '$dividendsReceived' },
          count: { $sum: 1 },
          activeCount: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } }
        }
      }
    ]);

    const byType = await Investments.aggregate([
      { $match: { owner: uid, status: { $ne: 'archived' } } },
      {
        $group: {
          _id: '$type',
          totalInvested: { $sum: '$principalAmount' },
          totalCurrentValue: { $sum: '$currentValue' },
          count: { $sum: 1 }
        }
      }
    ]);

    const totals = stats || { totalInvested: 0, totalCurrentValue: 0, totalDividends: 0, count: 0, activeCount: 0 };
    const totalGainLoss = parseFloat((totals.totalCurrentValue - totals.totalInvested + totals.totalDividends).toFixed(2));
    const returnRate = totals.totalInvested > 0
      ? parseFloat(((totalGainLoss / totals.totalInvested) * 100).toFixed(2))
      : 0;

    return {
      error: false,
      data: {
        totalInvested: totals.totalInvested,
        totalCurrentValue: totals.totalCurrentValue,
        totalDividends: totals.totalDividends,
        totalGainLoss,
        returnRate,
        count: totals.count,
        activeCount: totals.activeCount,
        byType: byType.map(b => ({
          type: b._id,
          totalInvested: b.totalInvested,
          totalCurrentValue: b.totalCurrentValue,
          count: b.count,
          gainLoss: parseFloat((b.totalCurrentValue - b.totalInvested).toFixed(2))
        }))
      }
    };
  } catch (err) {
    console.log(`Error fetching investment summary: ${err}`);
    return { error: true, message: 'Failed to fetch summary.', statusCode: 400 };
  }
};
