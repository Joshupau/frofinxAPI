import mongoose from 'mongoose';
import Bills from '../models/Bills.js';
import Transactions from '../models/Transactions.js';
import Wallets from '../models/Wallets.js';
import type { BillServiceResponse } from '../ctypes/bills.types.js';
import { pageOptions } from '../utils/paginate.js';

export const create = async (
  userId: string,
  name: string,
  amount: number,
  dueDate: string,
  isRecurring: boolean,
  categoryId?: string,
  recurringFrequency?: 'daily' | 'weekly' | 'monthly' | 'yearly',
  walletId?: string,
  reminder?: boolean,
  reminderDays?: number,
  notes?: string
): Promise<BillServiceResponse> => {
  try {
    if (isRecurring && !recurringFrequency) {
      return {
        error: true,
        message: 'Recurring frequency required for recurring bills.',
        statusCode: 400
      };
    }

    const bill = await Bills.create({
      owner: new mongoose.Types.ObjectId(userId),
      name: name,
      amount: amount,
      category: categoryId ? new mongoose.Types.ObjectId(categoryId) : undefined,
      dueDate: new Date(dueDate),
      isRecurring: isRecurring,
      recurringFrequency: recurringFrequency,
      wallet: walletId ? new mongoose.Types.ObjectId(walletId) : undefined,
      reminder: reminder !== undefined ? reminder : true,
      reminderDays: reminderDays || 3,
      notes: notes,
      paymentStatus: 'unpaid',
      status: 'active'
    });

    // Auto-create a pending transaction representing this unpaid bill
    if (walletId) {
      const pendingTransaction = await Transactions.create({
        owner: new mongoose.Types.ObjectId(userId),
        wallet: new mongoose.Types.ObjectId(walletId),
        category: categoryId ? new mongoose.Types.ObjectId(categoryId) : undefined,
        amount: amount,
        type: 'expense',
        description: `Bill: ${name}`,
        date: new Date(dueDate),
        attachments: [],
        tags: [],
        bill: bill._id,
        status: 'pending'
      });

      await Bills.findByIdAndUpdate(bill._id, { transaction: pendingTransaction._id });
    }

    return {
      error: false,
      message: 'Bill created successfully',
      data: { id: bill._id, ...bill.toObject() }
    };
  } catch (err) {
    console.log(`Error creating bill: ${err}`);
    return {
      error: true,
      message: 'Failed to create bill. Please contact support.',
      statusCode: 400
    };
  }
};

export const list = async (
  userId: string,
  page: string,
  limit: string,
  filters?: {
    paymentStatus?: string;
    isRecurring?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
  }
): Promise<BillServiceResponse> => {
  try {
    const options = pageOptions(page || '0', limit || '20');
    
    const filter: any = {
      owner: new mongoose.Types.ObjectId(userId)
    };

    if (filters?.paymentStatus) {
      filter.paymentStatus = filters.paymentStatus;
    }

    if (filters?.isRecurring) {
      filter.isRecurring = filters.isRecurring === 'true';
    }

    if (filters?.status) {
      filter.status = filters.status;
    } else {
      filter.status = 'active';
    }

    if (filters?.startDate || filters?.endDate) {
      filter.dueDate = {};
      if (filters.startDate) {
        filter.dueDate.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        filter.dueDate.$lte = new Date(filters.endDate);
      }
    }

    const [bills, totalDocuments] = await Promise.all([
      Bills.find(filter)
        .populate('category', 'name type icon color')
        .populate('wallet', 'name type')
        .sort({ dueDate: 1 })
        .skip(options.skip)
        .limit(options.limit),
      Bills.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalDocuments / options.limit);

    return {
      error: false,
      data: {
        items: bills.map(bill => ({ id: bill._id, ...bill.toObject() })),
        totalPages,
        currentPage: options.page,
        totalItems: totalDocuments
      }
    };
  } catch (err) {
    console.log(`Error listing bills: ${err}`);
    return {
      error: true,
      message: 'Failed to retrieve bills.',
      statusCode: 400
    };
  }
};

export const update = async (
  userId: string,
  id: string,
  updates: {
    name?: string;
    amount?: number;
    categoryId?: string;
    dueDate?: string;
    isRecurring?: boolean;
    recurringFrequency?: string;
    walletId?: string;
    reminder?: boolean;
    reminderDays?: number;
    notes?: string;
    status?: string;
  }
): Promise<BillServiceResponse> => {
  try {
    const bill = await Bills.findOne({
      _id: new mongoose.Types.ObjectId(id),
      owner: new mongoose.Types.ObjectId(userId)
    });

    if (!bill) {
      return {
        error: true,
        message: 'Bill not found or you do not have permission.',
        statusCode: 404
      };
    }

    const updateData: any = {};
    if (updates.name) updateData.name = updates.name;
    if (updates.amount) updateData.amount = updates.amount;
    if (updates.categoryId) updateData.category = new mongoose.Types.ObjectId(updates.categoryId);
    if (updates.dueDate) updateData.dueDate = new Date(updates.dueDate);
    if (updates.isRecurring !== undefined) updateData.isRecurring = updates.isRecurring;
    if (updates.recurringFrequency) updateData.recurringFrequency = updates.recurringFrequency;
    if (updates.walletId) updateData.wallet = new mongoose.Types.ObjectId(updates.walletId);
    if (updates.reminder !== undefined) updateData.reminder = updates.reminder;
    if (updates.reminderDays) updateData.reminderDays = updates.reminderDays;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.status) updateData.status = updates.status;

    await Bills.findByIdAndUpdate(
      new mongoose.Types.ObjectId(id),
      { $set: updateData }
    );

    return {
      error: false,
      message: 'Bill updated successfully'
    };
  } catch (err) {
    console.log(`Error updating bill: ${err}`);
    return {
      error: true,
      message: 'Failed to update bill.',
      statusCode: 400
    };
  }
};

export const markPaid = async (
  userId: string,
  id: string,
  paidAmount?: number,
  paidDate?: string
): Promise<BillServiceResponse> => {
  try {
    const bill = await Bills.findOne({
      _id: new mongoose.Types.ObjectId(id),
      owner: new mongoose.Types.ObjectId(userId)
    });

    if (!bill) {
      return {
        error: true,
        message: 'Bill not found or you do not have permission.',
        statusCode: 404
      };
    }

    const amountPaid = paidAmount || bill.amount;
    const paymentDate = paidDate ? new Date(paidDate) : new Date();

    const updateData: any = {
      paidAmount: amountPaid,
      lastPaidDate: paymentDate
    };

    if (amountPaid >= bill.amount) {
      updateData.paymentStatus = 'paid';
    } else {
      updateData.paymentStatus = 'partial';
    }

    // Complete the linked pending transaction and deduct from wallet
    if (bill.transaction && bill.wallet) {
      const wallet = await Wallets.findOne({
        _id: bill.wallet,
        owner: new mongoose.Types.ObjectId(userId),
        status: 'active'
      });

      if (!wallet) {
        return {
          error: true,
          message: 'Linked wallet not found or inactive.',
          statusCode: 404
        };
      }

      if (wallet.balance < amountPaid) {
        return {
          error: true,
          message: 'Insufficient wallet balance to pay this bill.',
          statusCode: 400
        };
      }

      wallet.balance -= amountPaid;
      await Promise.all([
        wallet.save(),
        Transactions.findByIdAndUpdate(bill.transaction, {
          status: 'completed',
          amount: amountPaid,
          date: paymentDate
        })
      ]);
    }

    // If recurring, calculate next due date
    if (bill.isRecurring && bill.recurringFrequency) {
      const nextDue = new Date(bill.dueDate);
      
      switch (bill.recurringFrequency) {
        case 'daily':
          nextDue.setDate(nextDue.getDate() + 1);
          break;
        case 'weekly':
          nextDue.setDate(nextDue.getDate() + 7);
          break;
        case 'monthly':
          nextDue.setMonth(nextDue.getMonth() + 1);
          break;
        case 'yearly':
          nextDue.setFullYear(nextDue.getFullYear() + 1);
          break;
      }

      updateData.nextDueDate = nextDue;
      updateData.dueDate = nextDue;
      updateData.paymentStatus = 'unpaid'; // Reset for next period
    }

    await Bills.findByIdAndUpdate(
      new mongoose.Types.ObjectId(id),
      { $set: updateData }
    );

    return {
      error: false,
      message: 'Bill marked as paid successfully',
      data: { nextDueDate: updateData.nextDueDate }
    };
  } catch (err) {
    console.log(`Error marking bill as paid: ${err}`);
    return {
      error: true,
      message: 'Failed to mark bill as paid.',
      statusCode: 400
    };
  }
};

export const markUnpaid = async (userId: string, id: string): Promise<BillServiceResponse> => {
  try {
    const bill = await Bills.findOne({
      _id: new mongoose.Types.ObjectId(id),
      owner: new mongoose.Types.ObjectId(userId)
    });

    if (!bill) {
      return {
        error: true,
        message: 'Bill not found or you do not have permission.',
        statusCode: 404
      };
    }

    await Bills.findByIdAndUpdate(
      new mongoose.Types.ObjectId(id),
      {
        paymentStatus: 'unpaid',
        paidAmount: 0,
        lastPaidDate: null
      }
    );

    return {
      error: false,
      message: 'Bill marked as unpaid successfully'
    };
  } catch (err) {
    console.log(`Error marking bill as unpaid: ${err}`);
    return {
      error: true,
      message: 'Failed to mark bill as unpaid.',
      statusCode: 400
    };
  }
};

export const getUpcoming = async (
  userId: string,
  days?: string
): Promise<BillServiceResponse> => {
  try {
    const daysAhead = days ? parseInt(days) : 7;
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + daysAhead);

    const bills = await Bills.find({
      owner: new mongoose.Types.ObjectId(userId),
      status: 'active',
      paymentStatus: { $in: ['unpaid', 'partial'] },
      dueDate: { $gte: today, $lte: futureDate }
    })
      .populate('category', 'name type icon color')
      .populate('wallet', 'name type')
      .sort({ dueDate: 1 });

    return {
      error: false,
      data: {
        items: bills.map(bill => ({ id: bill._id, ...bill.toObject() })),
        totalUpcoming: bills.length,
        daysAhead: daysAhead
      }
    };
  } catch (err) {
    console.log(`Error getting upcoming bills: ${err}`);
    return {
      error: true,
      message: 'Failed to retrieve upcoming bills.',
      statusCode: 400
    };
  }
};

export const getOverdue = async (userId: string): Promise<BillServiceResponse> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const bills = await Bills.find({
      owner: new mongoose.Types.ObjectId(userId),
      status: 'active',
      paymentStatus: { $in: ['unpaid', 'partial'] },
      dueDate: { $lt: today }
    })
      .populate('category', 'name type icon color')
      .populate('wallet', 'name type')
      .sort({ dueDate: 1 });

    // Update status to overdue
    const billIds = bills.map(b => b._id);
    if (billIds.length > 0) {
      await Bills.updateMany(
        { _id: { $in: billIds } },
        { paymentStatus: 'overdue' }
      );
    }

    return {
      error: false,
      data: {
        items: bills.map(bill => ({ id: bill._id, ...bill.toObject(), paymentStatus: 'overdue' })),
        totalOverdue: bills.length
      }
    };
  } catch (err) {
    console.log(`Error getting overdue bills: ${err}`);
    return {
      error: true,
      message: 'Failed to retrieve overdue bills.',
      statusCode: 400
    };
  }
};

export const getSummary = async (userId: string): Promise<BillServiceResponse> => {
  try {
    const [total, paid, unpaid, overdue, recurring, totalAmount] = await Promise.all([
      Bills.countDocuments({ owner: new mongoose.Types.ObjectId(userId), status: 'active' }),
      Bills.countDocuments({
        owner: new mongoose.Types.ObjectId(userId),
        status: 'active',
        paymentStatus: 'paid'
      }),
      Bills.countDocuments({
        owner: new mongoose.Types.ObjectId(userId),
        status: 'active',
        paymentStatus: 'unpaid'
      }),
      Bills.countDocuments({
        owner: new mongoose.Types.ObjectId(userId),
        status: 'active',
        paymentStatus: 'overdue'
      }),
      Bills.countDocuments({
        owner: new mongoose.Types.ObjectId(userId),
        status: 'active',
        isRecurring: true
      }),
      Bills.aggregate([
        {
          $match: {
            owner: new mongoose.Types.ObjectId(userId),
            status: 'active',
            paymentStatus: { $in: ['unpaid', 'overdue', 'partial'] }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ])
    ]);

    return {
      error: false,
      data: {
        totalBills: total,
        paidBills: paid,
        unpaidBills: unpaid,
        overdueBills: overdue,
        recurringBills: recurring,
        totalAmountDue: totalAmount[0]?.total || 0
      }
    };
  } catch (err) {
    console.log(`Error getting bill summary: ${err}`);
    return {
      error: true,
      message: 'Failed to retrieve bill summary.',
      statusCode: 400
    };
  }
};
