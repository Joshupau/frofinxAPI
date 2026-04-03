import mongoose from 'mongoose';
import Obligations from '../models/Obligations.js';
import Bills from '../models/Bills.js';
import Transactions from '../models/Transactions.js';
import Wallets from '../models/Wallets.js';
import type { ObligationServiceResponse } from '../ctypes/obligations.types.js';
import { pageOptions } from '../utils/paginate.js';

/**
 * Calculate interest and return totalWithInterest.
 * Simple: P * (1 + r * t), Compound: P * (1 + r)^t
 * t = years between startDate and dueDate, or 1 if no dueDate.
 */
const computeTotalWithInterest = (
  principal: number,
  rate: number,
  type: 'simple' | 'compound',
  startDate: Date,
  dueDate?: Date
): number => {
  const msPerYear = 1000 * 60 * 60 * 24 * 365.25;
  const end = dueDate || new Date(startDate.getTime() + msPerYear);
  const t = Math.max((end.getTime() - startDate.getTime()) / msPerYear, 0);
  const r = rate / 100;

  if (type === 'compound') {
    return parseFloat((principal * Math.pow(1 + r, t)).toFixed(2));
  }
  return parseFloat((principal * (1 + r * t)).toFixed(2));
};

/**
 * Generate installment due dates, offset from startDate.
 */
const buildInstallmentDates = (startDate: Date, frequency: 'weekly' | 'monthly' | 'yearly', count: number): Date[] => {
  const dates: Date[] = [];
  const cursor = new Date(startDate);

  for (let i = 0; i < count; i++) {
    switch (frequency) {
      case 'weekly':
        cursor.setDate(cursor.getDate() + 7);
        break;
      case 'monthly':
        cursor.setMonth(cursor.getMonth() + 1);
        break;
      case 'yearly':
        cursor.setFullYear(cursor.getFullYear() + 1);
        break;
    }
    dates.push(new Date(cursor));
  }

  return dates;
};

export const create = async (
  userId: string,
  body: {
    direction: 'debt' | 'lending';
    name: string;
    counterparty: string;
    counterpartyContact?: string;
    principalAmount: number;
    currency?: string;
    interestRate?: number;
    interestType?: 'simple' | 'compound';
    startDate: string;
    dueDate?: string;
    walletId?: string;
    categoryId?: string;
    notes?: string;
    tags?: string[];
    isInstallment?: boolean;
    installmentAmount?: number;
    totalInstallments?: number;
    installmentFrequency?: 'weekly' | 'monthly' | 'yearly';
  }
): Promise<ObligationServiceResponse> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      direction, name, counterparty, counterpartyContact, principalAmount, currency,
      interestRate, interestType, startDate, dueDate, walletId, categoryId,
      notes, tags, isInstallment, installmentAmount, totalInstallments, installmentFrequency
    } = body;

    if (isInstallment && (!installmentAmount || !totalInstallments || !installmentFrequency)) {
      await session.abortTransaction();
      return {
        error: true,
        message: 'installmentAmount, totalInstallments, and installmentFrequency are required for installment obligations.',
        statusCode: 400
      };
    }

    const start = new Date(startDate);
    const due = dueDate ? new Date(dueDate) : undefined;

    const totalWithInterest =
      interestRate && interestType
        ? computeTotalWithInterest(principalAmount, interestRate, interestType, start, due)
        : undefined;

    // Create the obligation document
    const [obligation] = await Obligations.create(
      [
        {
          owner: new mongoose.Types.ObjectId(userId),
          direction,
          name,
          counterparty,
          counterpartyContact,
          principalAmount,
          remainingBalance: totalWithInterest ?? principalAmount,
          currency: currency || 'PHP',
          interestRate,
          interestType,
          totalWithInterest,
          startDate: start,
          dueDate: due,
          wallet: walletId ? new mongoose.Types.ObjectId(walletId) : undefined,
          category: categoryId ? new mongoose.Types.ObjectId(categoryId) : undefined,
          notes,
          tags: tags || [],
          status: 'active',
          isInstallment: isInstallment || false,
          installmentAmount,
          totalInstallments,
          paidInstallments: 0,
          installmentFrequency,
          bills: []
        }
      ],
      { session }
    );

    // Create disbursement transaction: debt = I received money (income), lending = I paid out money (expense)
    if (walletId) {
      const transactionType = direction === 'debt' ? 'income' : 'expense';

      const wallet = await Wallets.findByIdAndUpdate(
        new mongoose.Types.ObjectId(walletId),
        { $inc: { balance: direction === 'debt' ? principalAmount : -principalAmount } },
        { new: true, session }
      );

      if (!wallet) {
        await session.abortTransaction();
        return { error: true, message: 'Wallet not found.', statusCode: 404 };
      }

      if (wallet.balance < 0 && direction !== 'debt') {
        await session.abortTransaction();
        return { error: true, message: 'Insufficient wallet balance to lend this amount.', statusCode: 400 };
      }

      const [disbursementTx] = await Transactions.create(
        [
          {
            owner: new mongoose.Types.ObjectId(userId),
            wallet: new mongoose.Types.ObjectId(walletId),
            category: categoryId ? new mongoose.Types.ObjectId(categoryId) : undefined,
            amount: principalAmount,
            type: transactionType,
            description: `${direction === 'debt' ? 'Borrowed from' : 'Lent to'} ${counterparty}: ${name}`,
            date: start,
            attachments: [],
            tags: tags || [],
            status: 'completed'
          }
        ],
        { session }
      );

      await Obligations.findByIdAndUpdate(
        obligation._id,
        { disbursementTransaction: disbursementTx._id },
        { session }
      );
    }

    // Auto-generate installment bills
    if (isInstallment && installmentFrequency && installmentAmount && totalInstallments) {
      const dueDates = buildInstallmentDates(start, installmentFrequency, totalInstallments);

      const billDocs = dueDates.map(date => ({
        owner: new mongoose.Types.ObjectId(userId),
        name: `${name} — Installment`,
        amount: installmentAmount,
        category: categoryId ? new mongoose.Types.ObjectId(categoryId) : undefined,
        dueDate: date,
        isRecurring: false,
        type: direction === 'debt' ? 'bill' : 'income',
        wallet: walletId ? new mongoose.Types.ObjectId(walletId) : undefined,
        reminder: true,
        reminderDays: 3,
        paymentStatus: 'unpaid',
        status: 'active',
        obligation: obligation._id
      }));

      const createdBills = await Bills.insertMany(billDocs, { session });
      const billIds = createdBills.map(b => b._id);

      // Create a pending transaction for each installment bill that has a wallet
      if (walletId) {
        const pendingTxDocs = createdBills.map(b => ({
          owner: new mongoose.Types.ObjectId(userId),
          wallet: new mongoose.Types.ObjectId(walletId),
          category: categoryId ? new mongoose.Types.ObjectId(categoryId) : undefined,
          amount: installmentAmount,
          type: direction === 'debt' ? 'expense' : 'income',
          description: `${name} — Installment`,
          date: b.dueDate,
          attachments: [],
          tags: tags || [],
          bill: b._id,
          status: 'pending'
        }));

        const pendingTxs = await Transactions.insertMany(pendingTxDocs, { session });

        // Link each pending transaction back to its bill
        await Promise.all(
          createdBills.map((b, i) =>
            Bills.findByIdAndUpdate(b._id, { transaction: pendingTxs[i]._id }, { session })
          )
        );
      }

      await Obligations.findByIdAndUpdate(
        obligation._id,
        { bills: billIds },
        { session }
      );
    }

    await session.commitTransaction();

    const populated = await Obligations.findById(obligation._id)
      .populate('wallet', 'name type')
      .populate('category', 'name icon color');

    return {
      error: false,
      message: 'Obligation created successfully',
      data: { id: obligation._id, ...populated!.toObject() }
    };
  } catch (err) {
    await session.abortTransaction();
    console.log(`Error creating obligation: ${err}`);
    return { error: true, message: 'Failed to create obligation.', statusCode: 400 };
  } finally {
    await session.endSession();
  }
};

export const list = async (
  userId: string,
  page: string,
  limit: string,
  filters?: {
    direction?: string;
    status?: string;
    isInstallment?: string;
  }
): Promise<ObligationServiceResponse> => {
  try {
    const options = pageOptions(page || '0', limit || '20');

    const filter: any = {
      owner: new mongoose.Types.ObjectId(userId)
    };

    if (filters?.direction) filter.direction = filters.direction;

    if (filters?.status) {
      filter.status = filters.status;
    } else {
      filter.status = { $ne: 'archived' };
    }

    if (filters?.isInstallment !== undefined) {
      filter.isInstallment = filters.isInstallment === 'true';
    }

    const [obligations, total] = await Promise.all([
      Obligations.find(filter)
        .populate('wallet', 'name type')
        .populate('category', 'name icon color')
        .sort({ createdAt: -1 })
        .skip(options.skip)
        .limit(options.limit),
      Obligations.countDocuments(filter)
    ]);

    return {
      error: false,
      data: {
        items: obligations.map(o => ({ id: o._id, ...o.toObject() })),
        totalPages: Math.ceil(total / options.limit),
        currentPage: options.page,
        totalItems: total
      }
    };
  } catch (err) {
    console.log(`Error listing obligations: ${err}`);
    return { error: true, message: 'Failed to retrieve obligations.', statusCode: 400 };
  }
};

export const update = async (
  userId: string,
  id: string,
  updates: {
    name?: string;
    counterparty?: string;
    counterpartyContact?: string;
    dueDate?: string;
    interestRate?: number;
    interestType?: 'simple' | 'compound';
    walletId?: string;
    categoryId?: string;
    notes?: string;
    tags?: string[];
    status?: string;
  }
): Promise<ObligationServiceResponse> => {
  try {
    const obligation = await Obligations.findOne({
      _id: new mongoose.Types.ObjectId(id),
      owner: new mongoose.Types.ObjectId(userId)
    });

    if (!obligation) {
      return { error: true, message: 'Obligation not found or you do not have permission.', statusCode: 404 };
    }

    const updateData: any = {};
    if (updates.name) updateData.name = updates.name;
    if (updates.counterparty) updateData.counterparty = updates.counterparty;
    if (updates.counterpartyContact !== undefined) updateData.counterpartyContact = updates.counterpartyContact;
    if (updates.dueDate) updateData.dueDate = new Date(updates.dueDate);
    if (updates.interestRate !== undefined) updateData.interestRate = updates.interestRate;
    if (updates.interestType) updateData.interestType = updates.interestType;
    if (updates.walletId) updateData.wallet = new mongoose.Types.ObjectId(updates.walletId);
    if (updates.categoryId) updateData.category = new mongoose.Types.ObjectId(updates.categoryId);
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.tags) updateData.tags = updates.tags;
    if (updates.status) updateData.status = updates.status;

    // Recompute totalWithInterest if interest-related fields changed
    if ((updates.interestRate !== undefined || updates.interestType) && updateData.interestRate && updateData.interestType) {
      const due = updates.dueDate ? new Date(updates.dueDate) : obligation.dueDate;
      updateData.totalWithInterest = computeTotalWithInterest(
        obligation.principalAmount,
        updateData.interestRate ?? obligation.interestRate!,
        updateData.interestType ?? obligation.interestType!,
        obligation.startDate,
        due
      );
    }

    await Obligations.findByIdAndUpdate(id, { $set: updateData });

    return { error: false, message: 'Obligation updated successfully' };
  } catch (err) {
    console.log(`Error updating obligation: ${err}`);
    return { error: true, message: 'Failed to update obligation.', statusCode: 400 };
  }
};

export const deleteObligation = async (userId: string, id: string): Promise<ObligationServiceResponse> => {
  try {
    const obligation = await Obligations.findOne({
      _id: new mongoose.Types.ObjectId(id),
      owner: new mongoose.Types.ObjectId(userId)
    });

    if (!obligation) {
      return { error: true, message: 'Obligation not found or you do not have permission.', statusCode: 404 };
    }

    await Obligations.findByIdAndUpdate(id, { status: 'archived' });

    return { error: false, message: 'Obligation deleted successfully' };
  } catch (err) {
    console.log(`Error deleting obligation: ${err}`);
    return { error: true, message: 'Failed to delete obligation.', statusCode: 400 };
  }
};

export const recordPayment = async (
  userId: string,
  id: string,
  amount: number,
  walletId: string,
  date?: string,
  notes?: string,
  idempotencyKey?: string
): Promise<ObligationServiceResponse> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Idempotency check
    if (idempotencyKey) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const existing = await Transactions.findOne(
        {
          owner: new mongoose.Types.ObjectId(userId),
          idempotencyKey,
          createdAt: { $gte: oneDayAgo },
          status: 'completed'
        },
        null,
        { session }
      );
      if (existing) {
        await session.abortTransaction();
        return { error: false, message: 'Payment already recorded (cached).', data: { id } };
      }
    }

    const obligation = await Obligations.findOne(
      { _id: new mongoose.Types.ObjectId(id), owner: new mongoose.Types.ObjectId(userId) },
      null,
      { session }
    );

    if (!obligation) {
      await session.abortTransaction();
      return { error: true, message: 'Obligation not found or you do not have permission.', statusCode: 404 };
    }

    if (obligation.status === 'settled' || obligation.status === 'archived') {
      await session.abortTransaction();
      return { error: true, message: `Cannot record payment on a ${obligation.status} obligation.`, statusCode: 400 };
    }

    // debt repayment = expense (I pay someone back), lending received = income (they pay me back)
    const transactionType = obligation.direction === 'debt' ? 'expense' : 'income';
    const balanceDelta = obligation.direction === 'debt' ? -amount : amount;

    const wallet = await Wallets.findByIdAndUpdate(
      new mongoose.Types.ObjectId(walletId),
      { $inc: { balance: balanceDelta } },
      { new: true, session }
    );

    if (!wallet) {
      await session.abortTransaction();
      return { error: true, message: 'Wallet not found.', statusCode: 404 };
    }

    if (wallet.balance < 0 && obligation.direction === 'debt') {
      await session.abortTransaction();
      return { error: true, message: 'Insufficient wallet balance.', statusCode: 400 };
    }

    const paymentDate = date ? new Date(date) : new Date();

    await Transactions.create(
      [
        {
          owner: new mongoose.Types.ObjectId(userId),
          wallet: new mongoose.Types.ObjectId(walletId),
          amount,
          type: transactionType,
          description: notes || `${obligation.direction === 'debt' ? 'Repayment to' : 'Received from'} ${obligation.counterparty}: ${obligation.name}`,
          date: paymentDate,
          attachments: [],
          tags: [],
          status: 'completed',
          ...(idempotencyKey && { idempotencyKey })
        }
      ],
      { session }
    );

    const newRemainingBalance = parseFloat(Math.max(0, obligation.remainingBalance - amount).toFixed(2));
    const newStatus =
      newRemainingBalance <= 0
        ? 'settled'
        : obligation.paidInstallments > 0 || newRemainingBalance < obligation.remainingBalance
          ? 'partially_paid'
          : 'active';

    await Obligations.findByIdAndUpdate(
      obligation._id,
      { $set: { remainingBalance: newRemainingBalance, status: newStatus } },
      { session }
    );

    // If installment: find the oldest unpaid installment bill and mark it paid
    if (obligation.isInstallment && obligation.bills.length > 0) {
      const unpaidBill = await Bills.findOne(
        {
          _id: { $in: obligation.bills },
          paymentStatus: 'unpaid',
          status: 'active'
        },
        null,
        { session }
      ).sort({ dueDate: 1 });

      if (unpaidBill) {
        await Bills.findByIdAndUpdate(
          unpaidBill._id,
          {
            $set: {
              paymentStatus: amount >= unpaidBill.amount ? 'paid' : 'partial',
              paidAmount: amount,
              lastPaidDate: paymentDate
            }
          },
          { session }
        );

        if (unpaidBill.transaction) {
          await Transactions.findByIdAndUpdate(
            unpaidBill.transaction,
            { $set: { status: 'completed', amount, date: paymentDate } },
            { session }
          );
        }

        await Obligations.findByIdAndUpdate(
          obligation._id,
          { $inc: { paidInstallments: 1 } },
          { session }
        );
      }
    }

    await session.commitTransaction();

    return {
      error: false,
      message: 'Payment recorded successfully',
      data: { remainingBalance: newRemainingBalance, status: newStatus }
    };
  } catch (err) {
    await session.abortTransaction();
    console.log(`Error recording obligation payment: ${err}`);
    return { error: true, message: 'Failed to record payment.', statusCode: 400 };
  } finally {
    await session.endSession();
  }
};

export const summary = async (userId: string): Promise<ObligationServiceResponse> => {
  try {
    const uid = new mongoose.Types.ObjectId(userId);

    const [debtStats, lendingStats] = await Promise.all([
      Obligations.aggregate([
        { $match: { owner: uid, direction: 'debt', status: { $ne: 'archived' } } },
        {
          $group: {
            _id: null,
            totalPrincipal: { $sum: '$principalAmount' },
            totalRemaining: { $sum: '$remainingBalance' },
            count: { $sum: 1 },
            activeCount: { $sum: { $cond: [{ $in: ['$status', ['active', 'partially_paid']] }, 1, 0] } }
          }
        }
      ]),
      Obligations.aggregate([
        { $match: { owner: uid, direction: 'lending', status: { $ne: 'archived' } } },
        {
          $group: {
            _id: null,
            totalPrincipal: { $sum: '$principalAmount' },
            totalRemaining: { $sum: '$remainingBalance' },
            count: { $sum: 1 },
            activeCount: { $sum: { $cond: [{ $in: ['$status', ['active', 'partially_paid']] }, 1, 0] } }
          }
        }
      ])
    ]);

    const debt = debtStats[0] || { totalPrincipal: 0, totalRemaining: 0, count: 0, activeCount: 0 };
    const lending = lendingStats[0] || { totalPrincipal: 0, totalRemaining: 0, count: 0, activeCount: 0 };

    return {
      error: false,
      data: {
        debt: {
          totalPrincipal: debt.totalPrincipal,
          totalRemaining: debt.totalRemaining,
          count: debt.count,
          activeCount: debt.activeCount
        },
        lending: {
          totalPrincipal: lending.totalPrincipal,
          totalRemaining: lending.totalRemaining,
          count: lending.count,
          activeCount: lending.activeCount
        },
        netPosition: parseFloat((lending.totalRemaining - debt.totalRemaining).toFixed(2))
      }
    };
  } catch (err) {
    console.log(`Error fetching obligation summary: ${err}`);
    return { error: true, message: 'Failed to fetch summary.', statusCode: 400 };
  }
};
