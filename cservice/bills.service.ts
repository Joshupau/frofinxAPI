import mongoose from 'mongoose';
import Bills from '../models/Bills.js';
import Transactions from '../models/Transactions.js';
import Wallets from '../models/Wallets.js';
import type { BillServiceResponse } from '../ctypes/bills.types.js';
import { pageOptions } from '../utils/paginate.js';
import { getDateRange, getDateFilter } from '../utils/dateFilters.utils.js';

/**
 * Helper: Calculate next due date based on recurring frequency
 */
const calculateNextDueDate = (currentDate: Date, frequency: string): Date => {
  const nextDate = new Date(currentDate);
  
  switch (frequency) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case 'yearly':
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
  }
  
  return nextDate;
};

/**
 * Helper: Check if idempotency key was already processed in last 24 hours
 */
const checkIdempotency = async (
  userId: string,
  idempotencyKey: string,
  session?: mongoose.ClientSession
): Promise<mongoose.Document | null> => {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const result = await Transactions.findOne(
    {
      owner: new mongoose.Types.ObjectId(userId),
      idempotencyKey: idempotencyKey,
      createdAt: { $gte: oneDayAgo },
      status: 'completed'
    },
    null,
    { session }
  );
  
  return result;
};

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
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (isRecurring && !recurringFrequency) {
      await session.abortTransaction();
      return {
        error: true,
        message: 'Recurring frequency required for recurring bills.',
        statusCode: 400
      };
    }

    const bill = await Bills.create(
      [
        {
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
        }
      ],
      { session }
    );

    // Auto-create a pending transaction representing this unpaid bill
    if (walletId) {
      const pendingTransaction = await Transactions.create(
        [
          {
            owner: new mongoose.Types.ObjectId(userId),
            wallet: new mongoose.Types.ObjectId(walletId),
            category: categoryId ? new mongoose.Types.ObjectId(categoryId) : undefined,
            amount: amount,
            type: 'expense',
            description: `Bill: ${name}`,
            date: new Date(dueDate),
            attachments: [],
            tags: [],
            bill: bill[0]._id,
            status: 'pending'
          }
        ],
        { session }
      );

      await Bills.findByIdAndUpdate(
        bill[0]._id,
        { transaction: pendingTransaction[0]._id },
        { session }
      );
    }

    await session.commitTransaction();

    return {
      error: false,
      message: 'Bill created successfully',
      data: { id: bill[0]._id, ...bill[0].toObject() }
    };
  } catch (err) {
    await session.abortTransaction();
    console.log(`Error creating bill: ${err}`);
    return {
      error: true,
      message: 'Failed to create bill. Please contact support.',
      statusCode: 400
    };
  } finally {
    await session.endSession();
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
  paidDate?: string,
  idempotencyKey?: string
): Promise<BillServiceResponse> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 4. Idempotency Check: Prevent double-click charges
    if (idempotencyKey) {
      const existingTransaction = await checkIdempotency(userId, idempotencyKey, session);
      if (existingTransaction) {
        await session.abortTransaction();
        return {
          error: false,
          message: 'Bill marked as paid successfully (cached)',
          data: {
            id: id,
            message: 'Duplicate payment request detected. Original payment processed.'
          }
        };
      }
    }

    const bill = await Bills.findOne(
      {
        _id: new mongoose.Types.ObjectId(id),
        owner: new mongoose.Types.ObjectId(userId)
      },
      null,
      { session }
    );

    if (!bill) {
      await session.abortTransaction();
      return {
        error: true,
        message: 'Bill not found or you do not have permission.',
        statusCode: 404
      };
    }

    const amountPaid = paidAmount || bill.amount;
    const paymentDate = paidDate ? new Date(paidDate) : new Date();

    // 3. Atomic Balance Update: Use $inc operator to prevent race conditions
    let walletUpdateResult = null;
    if (bill.wallet) {
      walletUpdateResult = await Wallets.findByIdAndUpdate(
        bill.wallet,
        {
          $inc: { balance: -amountPaid } // Atomic operation - prevents lost updates
        },
        { new: true, session }
      );

      if (!walletUpdateResult) {
        await session.abortTransaction();
        return {
          error: true,
          message: 'Linked wallet not found or inactive.',
          statusCode: 404
        };
      }

      if (walletUpdateResult.balance < 0) {
        await session.abortTransaction();
        return {
          error: true,
          message: 'Insufficient wallet balance to pay this bill.',
          statusCode: 400
        };
      }
    }

    const updateData: any = {
      paidAmount: amountPaid,
      lastPaidDate: paymentDate
    };

    if (amountPaid >= bill.amount) {
      updateData.paymentStatus = 'paid';
    } else {
      updateData.paymentStatus = 'partial';
    }

    // Update the linked transaction to completed
    if (bill.transaction) {
      await Transactions.findByIdAndUpdate(
        bill.transaction,
        {
          status: 'completed',
          amount: amountPaid,
          date: paymentDate,
          ...(idempotencyKey && { idempotencyKey: idempotencyKey })
        },
        { session }
      );
    }

    // 2. Non-Destructive Recurring Logic: Create new bill instead of overwriting
    let nextDueDate = null;
    if (bill.isRecurring && bill.recurringFrequency) {
      nextDueDate = calculateNextDueDate(bill.dueDate, bill.recurringFrequency);

      // Create a NEW bill document for the next occurrence
      const nextBill = await Bills.create(
        [
          {
            owner: bill.owner,
            name: bill.name,
            amount: bill.amount,
            category: bill.category,
            dueDate: nextDueDate,
            isRecurring: bill.isRecurring,
            recurringFrequency: bill.recurringFrequency,
            wallet: bill.wallet,
            reminder: bill.reminder,
            reminderDays: bill.reminderDays,
            notes: bill.notes,
            paymentStatus: 'unpaid',
            status: 'active',
            parentBillId: bill.parentBillId || bill._id // Track recurring series
          }
        ],
        { session }
      );

      // Create a pending transaction for the next bill
      if (bill.wallet) {
        const nextPendingTransaction = await Transactions.create(
          [
            {
              owner: bill.owner,
              wallet: bill.wallet,
              category: bill.category,
              amount: bill.amount,
              type: 'expense',
              description: `Bill: ${bill.name}`,
              date: nextDueDate,
              attachments: [],
              tags: [],
              bill: nextBill[0]._id,
              status: 'pending'
            }
          ],
          { session }
        );

        await Bills.findByIdAndUpdate(
          nextBill[0]._id,
          { transaction: nextPendingTransaction[0]._id },
          { session }
        );
      }
    }

    // Mark current bill as paid (final update)
    await Bills.findByIdAndUpdate(
      new mongoose.Types.ObjectId(id),
      { $set: updateData },
      { session }
    );

    await session.commitTransaction();

    return {
      error: false,
      message: 'Bill marked as paid successfully',
      data: {
        billId: id,
        amountPaid: amountPaid,
        nextDueDate: nextDueDate,
        isRecurring: bill.isRecurring
      }
    };
  } catch (err) {
    await session.abortTransaction();
    console.log(`Error marking bill as paid: ${err}`);
    return {
      error: true,
      message: 'Failed to mark bill as paid.',
      statusCode: 400
    };
  } finally {
    await session.endSession();
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
    // 5. Summary Aggregation: Single pipeline with $facet for better performance
    const aggregationResult = await Bills.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(userId),
          status: 'active'
        }
      },
      {
        $facet: {
          // Count different bill statuses
          billCounts: [
            {
              $group: {
                _id: null,
                totalBills: { $sum: 1 },
                paidBills: {
                  $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] }
                },
                unpaidBills: {
                  $sum: { $cond: [{ $eq: ['$paymentStatus', 'unpaid'] }, 1, 0] }
                },
                overdueBills: {
                  $sum: { $cond: [{ $eq: ['$paymentStatus', 'overdue'] }, 1, 0] }
                },
                partialBills: {
                  $sum: { $cond: [{ $eq: ['$paymentStatus', 'partial'] }, 1, 0] }
                },
                recurringBills: {
                  $sum: { $cond: [{ $eq: ['$isRecurring', true] }, 1, 0] }
                }
              }
            }
          ],
          // Calculate total amounts
          amountDues: [
            {
              $match: {
                paymentStatus: { $in: ['unpaid', 'overdue', 'partial'] }
              }
            },
            {
              $group: {
                _id: null,
                totalAmountDue: { $sum: '$amount' },
                upcomingAmount: {
                  $sum: {
                    $cond: [
                      { $gt: ['$dueDate', new Date()] },
                      '$amount',
                      0
                    ]
                  }
                },
                overdueAmount: {
                  $sum: {
                    $cond: [
                      { $lt: ['$dueDate', new Date()] },
                      '$amount',
                      0
                    ]
                  }
                }
              }
            }
          ]
        }
      }
    ]);

    const billStats = aggregationResult[0]?.billCounts[0] || {
      totalBills: 0,
      paidBills: 0,
      unpaidBills: 0,
      overdueBills: 0,
      partialBills: 0,
      recurringBills: 0
    };

    const amountStats = aggregationResult[0]?.amountDues[0] || {
      totalAmountDue: 0,
      upcomingAmount: 0,
      overdueAmount: 0
    };

    // Get total wallet balance for disposable income calculation
    const walletStats = await Wallets.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(userId),
          status: 'active'
        }
      },
      {
        $group: {
          _id: null,
          totalWalletBalance: { $sum: '$balance' }
        }
      }
    ]);

    const totalWalletBalance = walletStats[0]?.totalWalletBalance || 0;
    const disposableIncome = totalWalletBalance - amountStats.totalAmountDue;

    return {
      error: false,
      data: {
        ...billStats,
        ...amountStats,
        totalWalletBalance,
        disposableIncome,
        summary: {
          message: `You have ${billStats.unpaidBills + billStats.overdueBills} unpaid bills totaling ₱${amountStats.totalAmountDue.toFixed(2)}`
        }
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

/**
 * Calendar API: Get bills grouped by date for calendar visualization
 * Supports both month/year and date range queries
 */
export const getCalendar = async (
  userId: string,
  month?: string,
  year?: string,
  startDate?: string,
  endDate?: string
): Promise<BillServiceResponse> => {
  try {
    let dateStart: Date;
    let dateEnd: Date;

    // Determine date range and build query filter
    let filter: any = { owner: new mongoose.Types.ObjectId(userId), status: 'active' };

    if (startDate && endDate) {
      dateStart = new Date(startDate);
      dateEnd = new Date(endDate);
      // Ensure end date includes the entire last day
      dateEnd.setHours(23, 59, 59, 999);
      filter.dueDate = { $gte: dateStart, $lte: dateEnd };
    } else if (month && year) {
      // month is 1-indexed (1-12)
      const monthNum = parseInt(month) - 1; // Convert to 0-indexed
      const yearNum = parseInt(year);
      dateStart = new Date(yearNum, monthNum, 1); // First day of month
      dateEnd = new Date(yearNum, monthNum + 1, 0); // Last day of month
      dateEnd.setHours(23, 59, 59, 999);
      filter.dueDate = { $gte: dateStart, $lte: dateEnd };
    } else {
      // Default to current month using shared utilities
      const range = getDateRange('month');
      dateStart = range.startDate;
      dateEnd = range.endDate;
      // getDateFilter returns owner and a `date` range for transactions; adapt it for bills (dueDate)
      const monthFilter = getDateFilter(userId, 'month') as any;
      filter.owner = monthFilter.owner;
      filter.status = monthFilter.status || 'active';
      // monthFilter.date is { $gte, $lte }
      filter.dueDate = monthFilter.date;
    }

    // Fetch all bills in date range with populated categories
    const bills = await Bills.find(filter)
      .populate('category', 'name color type')
      .lean();

    // Group bills by date and build calendar response
    const calendarEvents: { [date: string]: any[] } = {};
    const datesWithBills: Set<string> = new Set();
    let stats = {
      totalBillsInRange: 0,
      unpaidCount: 0,
      paidCount: 0,
      overdueCount: 0,
      totalAmountDue: 0,
      totalAmountPaid: 0
    };

    bills.forEach((bill) => {
      // Format date as YYYY-MM-DD
      const billDate = bill.dueDate;
      const dateKey = billDate.toISOString().split('T')[0];
      datesWithBills.add(dateKey);

      // Determine color based on status
      let statusColor = '#FFE66D'; // Default: unpaid yellow
      let statusLabel = bill.paymentStatus.charAt(0).toUpperCase() + bill.paymentStatus.slice(1);

      if (bill.paymentStatus === 'unpaid') {
        statusColor = '#FF6B6B'; // Red
        stats.unpaidCount++;
        stats.totalAmountDue += bill.amount || 0;
      } else if (bill.paymentStatus === 'paid') {
        statusColor = '#4ECDC4'; // Teal
        stats.paidCount++;
        stats.totalAmountPaid += bill.amount || 0;
      } else if (bill.paymentStatus === 'overdue') {
        statusColor = '#FF5252'; // Bright Red
        stats.overdueCount++;
        stats.totalAmountDue += bill.amount || 0;
        statusLabel = 'Overdue';
      } else if (bill.paymentStatus === 'partial') {
        statusColor = '#95E1D3'; // Light Teal
        stats.unpaidCount++;
        const remaining = (bill.amount || 0) - (bill.paidAmount || 0);
        stats.totalAmountDue += remaining;
      }

      stats.totalBillsInRange++;

      const categoryData = bill.category as any;
      const event = {
        id: bill._id.toString(),
        name: bill.name,
        amount: bill.amount,
        dueDate: dateKey,
        paymentStatus: bill.paymentStatus,
        isRecurring: bill.isRecurring,
        recurringFrequency: bill.recurringFrequency,
        categoryName: categoryData?.name,
        categoryColor: categoryData?.color,
        reminder: bill.reminder,
        reminderDays: bill.reminderDays,
        notes: bill.notes,
        statusColor: statusColor,
        statusLabel: statusLabel
      };

      if (!calendarEvents[dateKey]) {
        calendarEvents[dateKey] = [];
      }
      calendarEvents[dateKey].push(event);
    });

    // Sort bills within each date by name
    Object.keys(calendarEvents).forEach((date) => {
      calendarEvents[date].sort((a, b) => a.name.localeCompare(b.name));
    });

    return {
      error: false,
      data: {
        month: month,
        year: year,
        startDate: dateStart.toISOString().split('T')[0],
        endDate: dateEnd.toISOString().split('T')[0],
        calendarEvents: calendarEvents,
        statistics: stats,
        datesWithBills: Array.from(datesWithBills).sort()
      }
    };
  } catch (err) {
    console.log(`Error getting bill calendar: ${err}`);
    return {
      error: true,
      message: 'Failed to retrieve bill calendar.',
      statusCode: 400
    };
  }
};
