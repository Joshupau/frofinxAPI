import mongoose from 'mongoose';
import Wallets from '../models/Wallets.js';
import type { WalletServiceResponse } from '../ctypes/wallets.types.js';
import { pageOptions } from '../utils/paginate.js';

export const create = async (
  userId: string,
  name: string,
  type: 'bank' | 'cash' | 'ewallet' | 'credit_card' | 'other',
  balance?: number,
  currency?: string,
  icon?: string,
  color?: string,
  description?: string,
  accountNumber?: string
): Promise<WalletServiceResponse> => {
  try {
    const wallet = await Wallets.create({
      owner: new mongoose.Types.ObjectId(userId),
      name: name,
      type: type,
      balance: balance || 0,
      currency: currency || 'PHP',
      icon: icon,
      color: color,
      description: description,
      accountNumber: accountNumber,
      status: 'active'
    });

    return {
      error: false,
      message: 'Wallet created successfully',
      data: { id: wallet._id, ...wallet.toObject() }
    };
  } catch (err) {
    console.log(`Error creating wallet: ${err}`);
    return {
      error: true,
      message: 'Failed to create wallet. Please contact support.',
      statusCode: 400
    };
  }
};

export const list = async (
  userId: string,
  page: string,
  limit: string,
  type?: string,
  currency?: string,
  status?: string
): Promise<WalletServiceResponse> => {
  try {
    const options = pageOptions(page || '0', limit || '20');
    
    const filter: any = {
      owner: new mongoose.Types.ObjectId(userId)
    };

    if (type) {
      filter.type = type;
    }

    if (currency) {
      filter.currency = currency;
    }

    if (status) {
      filter.status = status;
    } else {
      filter.status = 'active'; // Default to active only
    }

    const [wallets, totalDocuments] = await Promise.all([
      Wallets.find(filter)
        .sort({ createdAt: -1 })
        .skip(options.skip)
        .limit(options.limit),
      Wallets.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalDocuments / options.limit);

    return {
      error: false,
      data: {
        items: wallets.map(wallet => ({ id: wallet._id, ...wallet.toObject() })),
        totalPages,
        currentPage: options.page,
        totalItems: totalDocuments
      }
    };
  } catch (err) {
    console.log(`Error listing wallets: ${err}`);
    return {
      error: true,
      message: 'Failed to retrieve wallets.',
      statusCode: 400
    };
  }
};

export const getById = async (userId: string, walletId: string): Promise<WalletServiceResponse> => {
  try {
    const wallet = await Wallets.findOne({
      _id: new mongoose.Types.ObjectId(walletId),
      owner: new mongoose.Types.ObjectId(userId)
    });

    if (!wallet) {
      return {
        error: true,
        message: 'Wallet not found.',
        statusCode: 404
      };
    }

    return {
      error: false,
      data: { id: wallet._id, ...wallet.toObject() }
    };
  } catch (err) {
    console.log(`Error getting wallet: ${err}`);
    return {
      error: true,
      message: 'Failed to retrieve wallet.',
      statusCode: 400
    };
  }
};

export const update = async (
  userId: string,
  id: string,
  updates: {
    name?: string;
    type?: string;
    icon?: string;
    color?: string;
    description?: string;
    accountNumber?: string;
    status?: string;
  }
): Promise<WalletServiceResponse> => {
  try {
    const wallet = await Wallets.findOne({
      _id: new mongoose.Types.ObjectId(id),
      owner: new mongoose.Types.ObjectId(userId)
    });

    if (!wallet) {
      return {
        error: true,
        message: 'Wallet not found or you do not have permission.',
        statusCode: 404
      };
    }

    await Wallets.findByIdAndUpdate(
      new mongoose.Types.ObjectId(id),
      { $set: updates }
    );

    return {
      error: false,
      message: 'Wallet updated successfully'
    };
  } catch (err) {
    console.log(`Error updating wallet: ${err}`);
    return {
      error: true,
      message: 'Failed to update wallet.',
      statusCode: 400
    };
  }
};

export const adjustBalance = async (
  userId: string,
  walletId: string,
  amount: number
): Promise<WalletServiceResponse> => {
  try {
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

    wallet.balance += amount;
    await wallet.save();

    return {
      error: false,
      message: 'Wallet balance adjusted',
      data: { newBalance: wallet.balance }
    };
  } catch (err) {
    console.log(`Error adjusting wallet balance: ${err}`);
    return {
      error: true,
      message: 'Failed to adjust wallet balance.',
      statusCode: 400
    };
  }
};

export const archive = async (userId: string, id: string): Promise<WalletServiceResponse> => {
  try {
    const wallet = await Wallets.findOne({
      _id: new mongoose.Types.ObjectId(id),
      owner: new mongoose.Types.ObjectId(userId)
    });

    if (!wallet) {
      return {
        error: true,
        message: 'Wallet not found or you do not have permission.',
        statusCode: 404
      };
    }

    await Wallets.findByIdAndUpdate(
      new mongoose.Types.ObjectId(id),
      { status: 'archived' }
    );

    return {
      error: false,
      message: 'Wallet archived successfully'
    };
  } catch (err) {
    console.log(`Error archiving wallet: ${err}`);
    return {
      error: true,
      message: 'Failed to archive wallet.',
      statusCode: 400
    };
  }
};

export const getTotalBalance = async (
  userId: string,
  currency?: string
): Promise<WalletServiceResponse> => {
  try {
    const filter: any = {
      owner: new mongoose.Types.ObjectId(userId),
      status: 'active'
    };

    if (currency) {
      filter.currency = currency;
    }

    const wallets = await Wallets.find(filter);

    // Group by currency
    const balancesByCurrency: { [key: string]: number } = {};
    for (const wallet of wallets) {
      if (!balancesByCurrency[wallet.currency]) {
        balancesByCurrency[wallet.currency] = 0;
      }
      balancesByCurrency[wallet.currency] += wallet.balance;
    }

    return {
      error: false,
      data: {
        balancesByCurrency,
        walletCount: wallets.length
      }
    };
  } catch (err) {
    console.log(`Error getting total balance: ${err}`);
    return {
      error: true,
      message: 'Failed to calculate total balance.',
      statusCode: 400
    };
  }
};
