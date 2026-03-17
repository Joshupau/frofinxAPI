import mongoose from 'mongoose';
import Transactions from '../models/Transactions.js';
import Wallets from '../models/Wallets.js';
import Bills from '../models/Bills.js';
import Categories from '../models/Categories.js';
import FinanceAgent from '../models/Finance-agent.js';
import type { TransactionServiceResponse, DashboardServiceResponse, QuickStatsResponse } from '../ctypes/transactions.types.js';
import { pageOptions } from '../utils/paginate.js';
import { getMonthDateRange, calculateNetCashFlow, roundAmount } from '../utils/dashboard.utils.js';
import { getDateFilter, getDateRange } from '../utils/dateFilters.utils.js';
import { generateAIInsight } from '../utils/ai-insight.js';
import { getMonthAbbreviation } from '../utils/datetimetools.js';
import * as financeAgentCtrl from './finance-agent.service.js';

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
  billId?: string,
  serviceFee?: number,
  createBillForFee?: boolean
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

    // Check sufficient balance for expense or transfer (including service fee)
    // Fee is only immediately deducted when createBillForFee is false
    const immediateFeeCost = (!createBillForFee && serviceFee) ? serviceFee : 0;
    const totalDeduction = type === 'transfer' ? (amount + immediateFeeCost) : amount;
    if ((type === 'expense' || type === 'transfer') && wallet.balance < totalDeduction) {
      return {
        error: true,
        message: 'Insufficient wallet balance for transaction' + (immediateFeeCost ? ' and service fee' : '') + '.',
        statusCode: 400
      };
    }

    // Create transaction
    const feeDeducted = type === 'transfer' && !!serviceFee && serviceFee > 0 && !createBillForFee;
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
      serviceFee: serviceFee || 0,
      serviceFeeDeducted: feeDeducted,
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
      wallet.balance -= (amount + (feeDeducted ? (serviceFee || 0) : 0));
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

    // If createBillForFee is true and there's a service fee, create a bill + linked pending transaction for it
    if (createBillForFee && serviceFee && serviceFee > 0) {
      const feeDueDate = new Date(transaction.date);
      feeDueDate.setDate(feeDueDate.getDate() + 1);

      const pendingFeeTransaction = await Transactions.create({
        owner: new mongoose.Types.ObjectId(userId),
        wallet: new mongoose.Types.ObjectId(walletId),
        amount: serviceFee,
        type: 'expense',
        description: `Service fee for transfer of ${amount}`,
        date: feeDueDate,
        attachments: [],
        tags: [],
        status: 'pending'
      });

      await Bills.create({
        owner: new mongoose.Types.ObjectId(userId),
        name: `Transfer Service Fee`,
        amount: serviceFee,
        dueDate: feeDueDate,
        isRecurring: false,
        wallet: new mongoose.Types.ObjectId(walletId),
        reminder: false,
        paymentStatus: 'unpaid',
        notes: `Service fee for transfer transaction ID: ${transaction._id}`,
        status: 'active',
        transaction: pendingFeeTransaction._id
      });
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
    tags?: string[];
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

    if (filters?.tags && filters.tags.length > 0) {
      filter.tags = { $in: filters.tags };
    }


    const [transactions, totalDocuments] = await Promise.all([
      Transactions.find(filter)
        .populate('wallet', 'name type currency')
        .populate('category', 'name type icon color')
        .populate('toWallet', 'name type currency')
        .lean()
        .sort({ date: -1, createdAt: -1 })
        .skip(options.skip)
        .limit(options.limit),
      Transactions.countDocuments(filter)
    ]);


    const totalPages = Math.ceil(totalDocuments / options.limit);

    return {
      error: false,
      data: {
        items: transactions.map(tx => ({ 
          id: tx._id, 
          ...tx
        })),
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
          const feeToRevert = transaction.serviceFeeDeducted ? (transaction.serviceFee || 0) : 0;
          wallet.balance += transaction.amount + feeToRevert;
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

// ─── CSV Import Helpers ───────────────────────────────────────────────────────

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function findField(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const norm = normalizeKey(key);
    if (row[norm] !== undefined) return row[norm];
    // fuzzy: strip underscores and compare
    const plain = norm.replace(/_/g, '');
    const match = Object.keys(row).find(k => k.replace(/_/g, '') === plain);
    if (match !== undefined) return row[match];
  }
  return '';
}

function parseCSV(content: string): Record<string, string>[] {
  const cleaned = content.replace(/^\uFEFF/, '');
  const lines = cleaned.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const header = lines[0];
  const sep = header.includes('\t') ? '\t' : header.includes(';') ? ';' : ',';

  const parseLine = (line: string): string[] => {
    const fields: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === sep && !inQ) {
        fields.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    fields.push(cur.trim());
    return fields;
  };

  const headers = parseLine(header).map(h => normalizeKey(h));
  return lines.slice(1).map(line => {
    const vals = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = vals[i] ?? ''; });
    return row;
  });
}

function parseImportDate(s: string): Date | null {
  if (!s?.trim()) return null;
  const t = s.trim();
  if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(t)) {
    const d = new Date(t.replace(/\//g, '-'));
    return isNaN(d.getTime()) ? null : d;
  }
  if (/^\d{8}$/.test(t)) {
    const d = new Date(`${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`);
    return isNaN(d.getTime()) ? null : d;
  }
  if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(t)) {
    const [day, month, year] = t.split(/[-/]/);
    const d = new Date(`${year}-${month}-${day}`);
    return isNaN(d.getTime()) ? null : d;
  }
  const fallback = new Date(t);
  return isNaN(fallback.getTime()) ? null : fallback;
}

function parseImportAmount(s: string): number | null {
  if (!s?.trim()) return null;
  const c = s.trim().replace(/[€$£¥\s]/g, '');
  // European format: 1.234,56 → 1234.56
  const norm = c.includes(',') && c.includes('.')
    ? c.replace(/\./g, '').replace(',', '.')
    : c.includes(',') && !c.includes('.')
    ? c.replace(',', '.')
    : c;
  const v = parseFloat(norm);
  return isNaN(v) ? null : Math.abs(v);
}

function mapIndicator(s: string): 'income' | 'expense' | null {
  const u = s.trim().toUpperCase();
  if (['CRDT', 'CREDIT', 'C', 'CR'].includes(u)) return 'income';
  if (['DBIT', 'DEBIT', 'D', 'DR'].includes(u)) return 'expense';
  return null;
}

// ─── Import Transactions ──────────────────────────────────────────────────────

export const importTransactions = async (
  userId: string,
  walletId: string,
  csvBuffer: Buffer,
  options?: {
    categoryId?: string;
    preview?: boolean;
  }
): Promise<TransactionServiceResponse> => {
  try {
    const wallet = await Wallets.findOne({
      _id: new mongoose.Types.ObjectId(walletId),
      owner: new mongoose.Types.ObjectId(userId),
      status: 'active'
    });
    if (!wallet) {
      return { error: true, message: 'Wallet not found or inactive.', statusCode: 404 };
    }

    const rows = parseCSV(csvBuffer.toString('utf-8'));
    const allCategories = await Categories.find({}, '_id name').lean();

    const valid: any[] = [];
    const skipped: { row: number; reason: string }[] = [];

    rows.forEach((row, idx) => {
      const rowNum = idx + 2;

      // Try combined date/time first, then separate date/time, then fallback patterns
      let bookDate = findField(row, 'Date and Time', 'date and time', 'datetime');
      if (!bookDate) {
        const dateField = findField(row, 'Date', 'date', 'book date', 'booking date', 'value date');
        const timeField = findField(row, 'Time', 'time', 'hour', 'hours');
        bookDate = timeField ? `${dateField} ${timeField}` : dateField;
      }

      // Handle separate Debit/Credit columns (GCash format)
      const debitStr     = findField(row, 'Debit', 'debit');
      const creditStr    = findField(row, 'Credit', 'credit');
      
      // If we have Debit/Credit split, derive amount and indicator
      let amountStr = '';
      let indicator = '';
      if (debitStr?.trim() || creditStr?.trim()) {
        if (debitStr?.trim()) {
          amountStr = debitStr;
          indicator = 'DEBIT';
        } else if (creditStr?.trim()) {
          amountStr = creditStr;
          indicator = 'CREDIT';
        }
      } else {
        // Fallback to traditional Amount + Indicator columns
        amountStr = findField(row, 'Amount', 'amount');
        indicator = findField(row, 'Credit/debit indicator', 'credit debit indicator', 'indicator');
      }

      const description   = findField(row, 'Description', 'description', 'memo', 'narration');
      const counterParty  = findField(row, 'Counter party name', 'counterparty name', 'beneficiary', 'payee', 'merchant');
      const txRef         = findField(row, 'Transaction reference', 'transaction reference', 'reference', 'ref', 'reference no');
      const txType        = findField(row, 'Transaction type', 'transaction type');
      const txGroup       = findField(row, 'Transaction group', 'transaction group');
      const csvCategory   = findField(row, 'Category', 'category');
      const currency      = findField(row, 'Currency', 'currency');
      const instructedAmt = findField(row, 'Instructed amount', 'instructed amount');
      const exchangeRate  = findField(row, 'Currency exchange rate', 'exchange rate');
      const instructedCur = findField(row, 'Instructed currency', 'instructed currency');

      // Hard filter: no date
      const parsedDate = parseImportDate(bookDate);
      if (!parsedDate) {
        skipped.push({ row: rowNum, reason: 'missing_date' });
        return;
      }

      // Hard filter: no amount or zero
      const parsedAmount = parseImportAmount(amountStr);
      if (parsedAmount === null || parsedAmount === 0) {
        skipped.push({ row: rowNum, reason: 'invalid_amount' });
        return;
      }

      // Hard filter: no credit/debit indicator
      const type = mapIndicator(indicator);
      if (!type) {
        skipped.push({ row: rowNum, reason: 'missing_indicator' });
        return;
      }

      // Hard filter: completely unidentifiable — system internal booking
      if (!description.trim() && !counterParty.trim() && !txRef.trim()) {
        skipped.push({ row: rowNum, reason: 'unidentifiable_system_payment' });
        return;
      }

      // Build description
      let finalDesc = description.trim() || counterParty.trim() || txRef.trim();
      if (counterParty.trim() && description.trim() && description.trim() !== counterParty.trim()) {
        finalDesc = `${description.trim()} · ${counterParty.trim()}`;
      }
      // Append foreign currency note if applicable
      if (instructedAmt.trim() && instructedCur.trim() && instructedCur.trim() !== currency.trim()) {
        finalDesc += ` [${instructedCur.trim()} ${instructedAmt.trim()}${exchangeRate.trim() ? ` @ ${exchangeRate.trim()}` : ''}]`;
      }

      // Build tags
      const tags: string[] = [];
      if (txType.trim()) tags.push(txType.trim());
      if (txGroup.trim() && txGroup.trim() !== txType.trim()) tags.push(txGroup.trim());

      // Match category by name (case-insensitive)
      let matchedCategoryId: mongoose.Types.ObjectId | undefined;
      if (csvCategory.trim()) {
        const cat = allCategories.find(
          c => (c as any).name?.toLowerCase() === csvCategory.trim().toLowerCase()
        );
        if (cat) matchedCategoryId = (cat as any)._id;
      }
      if (!matchedCategoryId && options?.categoryId) {
        matchedCategoryId = new mongoose.Types.ObjectId(options.categoryId);
      }

      valid.push({
        date: parsedDate,
        amount: parsedAmount,
        type,
        description: finalDesc,
        tags,
        categoryId: matchedCategoryId,
        csvCategory: csvCategory.trim() || undefined
      });
    });

    if (options?.preview) {
      return {
        error: false,
        data: {
          totalRows: rows.length,
          willImport: valid.length,
          willSkip: skipped.length,
          skippedRows: skipped,
          preview: valid
        }
      };
    }

    if (valid.length === 0) {
      return {
        error: false,
        message: 'No valid transactions found to import.',
        data: { totalRows: rows.length, imported: 0, skipped: skipped.length, skippedRows: skipped }
      };
    }

    await Transactions.insertMany(valid.map(r => ({
      owner: new mongoose.Types.ObjectId(userId),
      wallet: new mongoose.Types.ObjectId(walletId),
      amount: r.amount,
      type: r.type,
      description: r.description,
      date: r.date,
      tags: r.tags,
      category: r.categoryId,
      attachments: [],
      status: 'completed'
    })));

    // Update wallet balance with the net effect of all imported transactions
    const incomeTotal  = valid.filter(r => r.type === 'income').reduce((s: number, r: any) => s + r.amount, 0);
    const expenseTotal = valid.filter(r => r.type === 'expense').reduce((s: number, r: any) => s + r.amount, 0);
    wallet.balance += incomeTotal - expenseTotal;
    await wallet.save();

    return {
      error: false,
      message: `Successfully imported ${valid.length} transaction${valid.length !== 1 ? 's' : ''}.`,
      data: {
        totalRows: rows.length,
        imported: valid.length,
        skipped: skipped.length,
        skippedRows: skipped
      }
    };
  } catch (err) {
    console.log(`Error importing transactions: ${err}`);
    return { error: true, message: 'Failed to import transactions.', statusCode: 400 };
  }
};


export const getDashboardSummary = async (
  userId: string,
  month?: string,
  year?: string,
  walletId?: string
): Promise<DashboardServiceResponse> => {
  try {
    const now = new Date();
    const targetMonth = month ? parseInt(month) : now.getMonth() + 1;
    const targetYear = year ? parseInt(year) : now.getFullYear();

    // Validate month
    if (targetMonth < 1 || targetMonth > 12) {
      return {
        error: true,
        message: 'Invalid month. Please provide a month between 1 and 12.',
        statusCode: 400
      };
    }

    const { startDate, endDate } = getMonthDateRange(targetMonth, targetYear);

    const matchStage: any = {
      owner: new mongoose.Types.ObjectId(userId),
      // date: { $gte: startDate, $lte: endDate },
      status: 'completed'
    };

    if (walletId) {
      matchStage.wallet = new mongoose.Types.ObjectId(walletId);
    }

    // Aggregate to get all necessary metrics
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

    // Initialize result object
    const result: any = {
      totalIncome: 0,
      incomeCount: 0,
      totalExpenses: 0,
      expenseCount: 0,
      totalTransfers: 0,
      transferCount: 0,
      totalTransactions: 0,
      netCashFlow: 0,
      month: targetMonth,
      year: targetYear
    };

    // Process aggregation results
    summary.forEach(item => {
      if (item._id === 'income') {
        result.totalIncome = roundAmount(item.total);
        result.incomeCount = item.count;
      } else if (item._id === 'expense') {
        result.totalExpenses = roundAmount(item.total);
        result.expenseCount = item.count;
      } else if (item._id === 'transfer') {
        result.totalTransfers = roundAmount(item.total);
        result.transferCount = item.count;
      }
    });

    // Calculate derived metrics
    result.totalTransactions = result.incomeCount + result.expenseCount + result.transferCount;
    result.netCashFlow = roundAmount(calculateNetCashFlow(result.totalIncome, result.totalExpenses));

    return {
      error: false,
      data: result
    };
  } catch (err) {
    console.log(`Error getting dashboard summary: ${err}`);
    return {
      error: true,
      message: 'Failed to retrieve dashboard summary.',
      statusCode: 400
    };
  }
};

/**
 * Get quick stats for a specific period (today, week, month, year, all)
 * Shows: income, expenses, transfers, transaction count
 */
export const getQuickStats = async (
  userId: string,
  period: 'today' | 'week' | 'month' | 'year' | 'all' = 'month',
  walletId?: string
): Promise<QuickStatsResponse> => {
  try {
    // Get date range and match stage based on period
    let daterange: { startDate: Date; endDate: Date };
    let matchStage: any;

    if (period === 'all') {
      const now = new Date();
      daterange = { startDate: new Date(2000, 0, 1), endDate: now };
      matchStage = {
        owner: new mongoose.Types.ObjectId(userId),
        date: { $gte: daterange.startDate, $lte: daterange.endDate },
        status: 'completed'
      };
    } else if (period === 'today') {
      matchStage = getDateFilter(userId, 'day');
      daterange = getDateRange('day');
    } else if (period === 'week') {
      matchStage = getDateFilter(userId, 'week');
      daterange = getDateRange('week');
    } else {
      // month or year
      matchStage = getDateFilter(userId, period as 'month' | 'year');
      daterange = getDateRange(period as 'month' | 'year');
    }

    if (walletId) {
      matchStage.wallet = new mongoose.Types.ObjectId(walletId);
    }

    const stats = await Transactions.aggregate([
      { $match: matchStage },
      {
        $facet: {
          byType: [
            {
              $group: {
                _id: '$type',
                total: { $sum: '$amount' },
                count: { $sum: 1 }
              }
            }
          ],
          totalCount: [
            {
              $group: {
                _id: null,
                count: { $sum: 1 }
              }
            }
          ]
        }
      }
    ]);

    const byType = stats[0].byType;
    const totalCount = stats[0].totalCount[0]?.count || 0;

    const result: any = {
      period: period,
      income: 0,
      expenses: 0,
      transfers: 0,
      transactions: totalCount,
      startDate: daterange.startDate.toISOString(),
      endDate: daterange.endDate.toISOString()
    };

    byType.forEach((item: any) => {
      if (item._id === 'income') {
        result.income = roundAmount(item.total);
      } else if (item._id === 'expense') {
        result.expenses = roundAmount(item.total);
      } else if (item._id === 'transfer') {
        result.transfers = roundAmount(item.total);
      }
    });

    return {
      error: false,
      data: result
    };
  } catch (err) {
    console.log(`Error getting quick stats: ${err}`);
    return {
      error: true,
      message: 'Failed to retrieve quick stats.',
      statusCode: 400
    };
  }
};

export const getAllUserTags = async (userId: string): Promise<TransactionServiceResponse> => {
  try {
    const tags = await Transactions.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(userId),
          status: 'completed'
        }
      },
      {
        $unwind: '$tags'
      },
      {
        $group: {
          _id: '$tags',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $project: {
          tag: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]);

    return {
      error: false,
      data: {
        tags: tags.map(item => item.tag),
        tagStats: tags  // [{tag: "Transfer", count: 156}, {tag: "Payment", count: 295}, ...]
      }
    };
  } catch (err) {
    console.log(`Error getting user tags: ${err}`);
    return {
      error: true,
      message: 'Failed to retrieve user tags.',
      statusCode: 400
    };
  }
};

export const getSpentToday = async (userId: string, walletId?: string): Promise<TransactionServiceResponse> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const matchStage: any = {
      owner: new mongoose.Types.ObjectId(userId),
      type: 'expense',
      status: 'completed',
      date: {
        $gte: today,
        $lt: tomorrow
      }
    };

    if (walletId) {
      matchStage.wallet = new mongoose.Types.ObjectId(walletId);
    }

    const result = await Transactions.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const data = result.length > 0 ? result[0] : { totalSpent: 0, count: 0 };

    return {
      error: false,
      data: {
        totalSpent: roundAmount(data.totalSpent),
        transactionCount: data.count,
        date: today.toISOString().split('T')[0]
      }
    };
  } catch (err) {
    console.log(`Error getting spent today: ${err}`);
    return {
      error: true,
      message: 'Failed to retrieve spending for today.',
      statusCode: 400
    };
  }
};

export const getAnalytics = async (
  userId: string,
  period: 'daily' | 'weekly' | 'yearly',
  walletId?: string,
  _startDate?: string,
  _endDate?: string
): Promise<TransactionServiceResponse> => {
  try {
    const matchStage: any = {
      owner: new mongoose.Types.ObjectId(userId),
      status: 'completed',
      type: { $in: ['income', 'expense'] }
    };

    if (walletId) {
      matchStage.wallet = new mongoose.Types.ObjectId(walletId);
    }

    // Set date range based on period
    let start: Date;
    const end = new Date();

    if (period === 'daily') {
      // Default to last 30 days for daily
      start = new Date();
      start.setDate(start.getDate() - 30);
    } else if (period === 'weekly') {
      // Last 52 weeks
      start = new Date();
      start.setDate(start.getDate() - 364);
    } else {
      // period === 'yearly' - Last 5 years
      start = new Date();
      start.setFullYear(start.getFullYear() - 5);
    }

    matchStage.date = {
      $gte: start,
      $lte: end
    };

    let groupStage: any = {};

    if (period === 'daily') {
      groupStage = {
        _id: {
          year: { $year: '$date' },
          month: { $month: '$date' },
          day: { $dayOfMonth: '$date' }
        },
        totalIncome: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
        totalExpenses: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
        count: { $sum: 1 }
      };
    } else if (period === 'weekly') {
      groupStage = {
        _id: {
          year: { $year: '$date' },
          week: { $week: '$date' },
          month: { $month: '$date' }
        },
        totalIncome: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
        totalExpenses: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
        count: { $sum: 1 }
      };
    } else if (period === 'yearly') {
      groupStage = {
        _id: { $year: '$date' },
        totalIncome: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
        totalExpenses: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
        count: { $sum: 1 }
      };
    }

    const results = await Transactions.aggregate([
      { $match: matchStage },
      { $group: groupStage },
      { $sort: { _id: -1 } }
    ]);

    const data = results.map((item: any) => {
      const baseData: any = {
        expenses: roundAmount(item.totalExpenses),
        income: roundAmount(item.totalIncome),
        net: roundAmount(item.totalIncome - item.totalExpenses),
        transactionCount: item.count
      };

      if (period === 'daily') {
        baseData.date = `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`;
      } else if (period === 'weekly') {
        baseData.week = item._id.week;
        baseData.month = item._id.month;
        baseData.year = item._id.year;
      } else if (period === 'yearly') {
        baseData.year = item._id;
      }

      return baseData;
    });

    const summary = {
      totalIncome: roundAmount(data.reduce((sum: number, item: any) => sum + item.income, 0)),
      totalExpenses: roundAmount(data.reduce((sum: number, item: any) => sum + item.expenses, 0)),
      totalNet: roundAmount(data.reduce((sum: number, item: any) => sum + item.net, 0)),
      transactionCount: data.reduce((sum: number, item: any) => sum + item.transactionCount, 0)
    };

    return {
      error: false,
      data: {
        period,
        walletId,
        data,
        summary
      }
    };
  } catch (err) {
    console.log(`Error getting analytics: ${err}`);
    return {
      error: true,
      message: 'Failed to retrieve analytics data.',
      statusCode: 400
    };
  }
};

export const getTopCategoryToday = async (userId: string, walletId?: string): Promise<TransactionServiceResponse> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const matchStage: any = {
      owner: new mongoose.Types.ObjectId(userId),
      type: 'expense',
      status: 'completed',
      date: {
        $gte: today,
        $lt: tomorrow
      }
    };

    if (walletId) {
      matchStage.wallet = new mongoose.Types.ObjectId(walletId);
    }

    // Get total spent today
    const todayTotal = await Transactions.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    const totalSpentToday = todayTotal.length > 0 ? todayTotal[0].total : 0;

    if (totalSpentToday === 0) {
      return {
        error: false,
        data: {
          categoryId: '',
          categoryName: 'No expenses',
          totalSpent: 0,
          transactionCount: 0,
          percentageOfDay: 0,
          insight: '💚 Great job! You haven\'t spent anything today – financial discipline unlocked!'
        }
      };
    }

    // Get top category
    const topCategory = await Transactions.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryData'
        }
      },
      {
        $lookup: {
          from: 'wallets',
          localField: 'wallet',
          foreignField: '_id',
          as: 'walletData'
        }
      },
      {
        $group: {
          _id: '$category',
          categoryName: { $first: { $arrayElemAt: ['$categoryData.name', 0] } },
          categoryIcon: { $first: { $arrayElemAt: ['$categoryData.icon', 0] } },
          categoryColor: { $first: { $arrayElemAt: ['$categoryData.color', 0] } },
          totalSpent: { $sum: '$amount' },
          count: { $sum: 1 },
          descriptions: { $push: '$description' }
        }
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 1 }
    ]);

    if (topCategory.length === 0) {
      return {
        error: false,
        data: {
          categoryId: '',
          categoryName: 'Uncategorized',
          totalSpent: totalSpentToday,
          transactionCount: 0,
          percentageOfDay: 100,
          insight: `📋 All your spending today is uncategorized. ${totalSpentToday} spent with no label!`
        }
      };
    }

    const top = topCategory[0];
    const percentageOfDay = (top.totalSpent / totalSpentToday) * 100;

    // Check if finance agent for this category already exists today FIRST
    const existingAgent = await FinanceAgent.findOne({
      owner: new mongoose.Types.ObjectId(userId),
      category: top._id?.toString() || '',
      createdAt: { $gte: today, $lt: tomorrow }
    });

    let insight: string;

    // create new if the category is different or if no agent exists yet for today, otherwise reuse existing agent's insight
    if (existingAgent) {
      // Reuse existing insight from the description field
      insight = existingAgent.description;
    } else {
      // Only generate AI insight if we need to create a new agent
      const aiInsight = await generateAIInsight(
        top.categoryName || 'Unknown',
        top.totalSpent,
        top.count,
        percentageOfDay,
        top.descriptions
      );
      insight = aiInsight;

      // Create new finance agent with the generated insight
      await financeAgentCtrl.create(
        userId,
        top.walletId?.toString() || '',
        top._id?.toString() || '',
        `Top category today: ${top.categoryName || 'Uncategorized'} with ${roundAmount(top.totalSpent)} spent across ${top.count} transactions, making up ${percentageOfDay.toFixed(1)}% of today's expenses. Insight: ${insight}`
      );
    }

    return {
      error: false,
      data: {
        categoryId: top._id?.toString() || '',
        categoryName: top.categoryName || 'Uncategorized',
        categoryIcon: top.categoryIcon,
        categoryColor: top.categoryColor,
        totalSpent: roundAmount(top.totalSpent),
        transactionCount: top.count,
        percentageOfDay: parseFloat(percentageOfDay.toFixed(1)),
        insight
      }
    };
  } catch (err) {
    console.log(`Error getting top category today: ${err}`);
    return {
      error: true,
      message: 'Failed to retrieve top category.',
      statusCode: 400
    };
  }
};


export const getChartData = async (
  userId: string,
  period: 'today' | 'week' | 'month' | 'year' | 'all' = 'month',
  walletId?: string
): Promise<any> => {
  try {
    const now = new Date();
    let dateRange: { startDate: Date; endDate: Date };
    let matchStage: any;
    let groupStage: any;
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    if (period === 'today') {
      // Group by hour (0-23)
      dateRange = getDateRange('day');
      matchStage = getDateFilter(userId, 'day');

      groupStage = {
        _id: { $hour: '$date' },
        income: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
        expenses: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
        transfers: { $sum: { $cond: [{ $eq: ['$type', 'transfer'] }, '$amount', 0] } }
      };
    } else if (period === 'week') {
      // Group by day of week (0-6, where 0 is Sunday)
      dateRange = getDateRange('week');
      matchStage = getDateFilter(userId, 'week');

      groupStage = {
        _id: { $dayOfWeek: '$date' },
        income: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
        expenses: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
        transfers: { $sum: { $cond: [{ $eq: ['$type', 'transfer'] }, '$amount', 0] } }
      };
    } else if (period === 'month') {
      // Group by date (1-31)
      dateRange = getDateRange('month');
      matchStage = getDateFilter(userId, 'month');

      groupStage = {
        _id: { $dayOfMonth: '$date' },
        income: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
        expenses: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
        transfers: { $sum: { $cond: [{ $eq: ['$type', 'transfer'] }, '$amount', 0] } }
      };
    } else if (period === 'year') {
      // period === 'year' - Group by month (1-12)
      dateRange = getDateRange('year');
      matchStage = getDateFilter(userId, 'year');

      groupStage = {
        _id: { $month: '$date' },
        income: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
        expenses: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
        transfers: { $sum: { $cond: [{ $eq: ['$type', 'transfer'] }, '$amount', 0] } }
      };
    } else {
      // period === 'all' - Group by year across all time
      matchStage = {
        owner: new mongoose.Types.ObjectId(userId),
        status: 'completed'
      };

      if (walletId) {
        matchStage.wallet = new mongoose.Types.ObjectId(walletId);
      }

      groupStage = {
        _id: { $year: '$date' },
        income: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
        expenses: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
        transfers: { $sum: { $cond: [{ $eq: ['$type', 'transfer'] }, '$amount', 0] } }
      };

      // Initialize default date range for 'all' period
      dateRange = {
        startDate: new Date(2000, 0, 1),
        endDate: now
      };
    } 

    // Add wallet filter if provided (only for non-'all' periods, as 'all' already handles it)
    if (period !== 'all') {
      if (walletId) {
        matchStage.wallet = new mongoose.Types.ObjectId(walletId);
      }

      // Add status filter
      matchStage.status = 'completed';
    }

    // Aggregation
    const results = await Transactions.aggregate([
      { $match: matchStage },
      { $group: groupStage },
      { $sort: { _id: 1 } }
    ]);

    // Transform results based on period
    let dataPoints: any[] = [];
    let totalIncome = 0;
    let totalExpenses = 0;
    let totalTransfers = 0;

    if (period === 'today') {
      // Create 24 hours of data (0-23)
      for (let hour = 0; hour < 24; hour++) {
        const found = results.find(r => r._id === hour);
        const income = found ? roundAmount(found.income) : 0;
        const expenses = found ? roundAmount(found.expenses) : 0;
        const transfers = found ? roundAmount(found.transfers) : 0;

        dataPoints.push({
          hour,
          income,
          expenses,
          transfers
        });

        totalIncome += income;
        totalExpenses += expenses;
        totalTransfers += transfers;
      }
    } else if (period === 'week') {
      // Create 7 days of week data
      for (let dayOfWeek = 1; dayOfWeek <= 7; dayOfWeek++) {
        const found = results.find(r => r._id === dayOfWeek);
        const income = found ? roundAmount(found.income) : 0;
        const expenses = found ? roundAmount(found.expenses) : 0;
        const transfers = found ? roundAmount(found.transfers) : 0;

        dataPoints.push({
          day: dayNames[dayOfWeek === 1 ? 0 : dayOfWeek - 1], // MongoDB $dayOfWeek: Sunday=1, Monday=2, etc
          income,
          expenses,
          transfers
        });

        totalIncome += income;
        totalExpenses += expenses;
        totalTransfers += transfers;
      }
    } else if (period === 'month') {
      // Get days in current month
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const monthAbbr = getMonthAbbreviation(now.getMonth());

      for (let date = 1; date <= daysInMonth; date++) {
        const found = results.find(r => r._id === date);
        const income = found ? roundAmount(found.income) : 0;
        const expenses = found ? roundAmount(found.expenses) : 0;
        const transfers = found ? roundAmount(found.transfers) : 0;

        dataPoints.push({
          date: `${monthAbbr}.${date}`,
          income,
          expenses,
          transfers
        });

        totalIncome += income;
        totalExpenses += expenses;
        totalTransfers += transfers;
      }
    } else if (period === 'year') {
      // period === 'year' - 12 months
      for (let month = 1; month <= 12; month++) {
        const found = results.find(r => r._id === month);
        const income = found ? roundAmount(found.income) : 0;
        const expenses = found ? roundAmount(found.expenses) : 0;
        const transfers = found ? roundAmount(found.transfers) : 0;

        dataPoints.push({
          month: monthNames[month - 1],
          income,
          expenses,
          transfers
        });

        totalIncome += income;
        totalExpenses += expenses;
        totalTransfers += transfers;
      }
    } else {
      // period === 'all' - All years
      // Sort results to get year range
      const sortedResults = results.sort((a: any, b: any) => a._id - b._id);
      const minYear = sortedResults.length > 0 ? sortedResults[0]._id : now.getFullYear();
      const maxYear = sortedResults.length > 0 ? sortedResults[sortedResults.length - 1]._id : now.getFullYear();

      // Create from minYear to current year
      for (let year = minYear; year <= maxYear; year++) {
        const found = results.find(r => r._id === year);
        const income = found ? roundAmount(found.income) : 0;
        const expenses = found ? roundAmount(found.expenses) : 0;
        const transfers = found ? roundAmount(found.transfers) : 0;

        dataPoints.push({
          year,
          income,
          expenses,
          transfers
        });

        totalIncome += income;
        totalExpenses += expenses;
        totalTransfers += transfers;
      }

      // Set date range for 'all'
      dateRange = {
        startDate: new Date(minYear, 0, 1),
        endDate: new Date(maxYear, 11, 31, 23, 59, 59)
      };
    }

    return {
      error: false,
      data: {
        period,
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        dataPoints,
        totals: {
          income: roundAmount(totalIncome),
          expenses: roundAmount(totalExpenses),
          transfers: roundAmount(totalTransfers)
        }
      }
    };
  } catch (err) {
    console.log(`Error getting chart data: ${err}`);
    return {
      error: true,
      message: 'Failed to retrieve chart data.',
      statusCode: 400
    };
  }
};
