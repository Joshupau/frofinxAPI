import mongoose from 'mongoose';
import Categories from '../models/Categories.js';
import type { CategoryServiceResponse } from '../ctypes/categories.types.js';
import { pageOptions } from '../utils/paginate.js';

export const create = async (
  userId: string,
  name: string,
  type: 'income' | 'expense',
  icon?: string,
  color?: string
): Promise<CategoryServiceResponse> => {
  try {
    // Check if category already exists for this user
    const existing = await Categories.findOne({
      owner: new mongoose.Types.ObjectId(userId),
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      type: type,
      status: 'active'
    });

    if (existing) {
      return {
        error: true,
        message: 'Category with this name already exists.',
        statusCode: 400
      };
    }

    const category = await Categories.create({
      owner: new mongoose.Types.ObjectId(userId),
      name: name,
      type: type,
      icon: icon,
      color: color,
      isDefault: false,
      status: 'active'
    });

    return {
      error: false,
      message: 'Category created successfully',
      data: { id: category._id, ...category.toObject() }
    };
  } catch (err) {
    console.log(`Error creating category: ${err}`);
    return {
      error: true,
      message: 'Failed to create category. Please contact support.',
      statusCode: 400
    };
  }
};

export const list = async (
  userId: string,
  page: string,
  limit: string,
  type?: string,
  search?: string,
  includeDefault?: string
): Promise<CategoryServiceResponse> => {
  try {
    const options = pageOptions(page || '0', limit || '50');
    
    // Build filter
    const filter: any = {
      status: 'active'
    };

    // Include both user's categories and default categories
    if (includeDefault === 'true' || includeDefault === undefined) {
      filter.$or = [
        { owner: new mongoose.Types.ObjectId(userId) },
        { isDefault: true, owner: null }
      ];
    } else {
      filter.owner = new mongoose.Types.ObjectId(userId);
    }

    if (type) {
      filter.type = type;
    }

    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    const [categories, totalDocuments] = await Promise.all([
      Categories.find(filter)
        .sort({ isDefault: -1, name: 1 }) // Default categories first, then alphabetical
        .skip(options.skip)
        .limit(options.limit),
      Categories.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalDocuments / options.limit);

    return {
      error: false,
      data: {
        items: categories.map(cat => ({ id: cat._id, ...cat.toObject() })),
        totalPages,
        currentPage: options.page,
        totalItems: totalDocuments
      }
    };
  } catch (err) {
    console.log(`Error listing categories: ${err}`);
    return {
      error: true,
      message: 'Failed to retrieve categories.',
      statusCode: 400
    };
  }
};

export const update = async (
  userId: string,
  id: string,
  updates: { name?: string; icon?: string; color?: string; status?: string }
): Promise<CategoryServiceResponse> => {
  try {
    const category = await Categories.findOne({
      _id: new mongoose.Types.ObjectId(id),
      owner: new mongoose.Types.ObjectId(userId)
    });

    if (!category) {
      return {
        error: true,
        message: 'Category not found or you do not have permission.',
        statusCode: 404
      };
    }

    if (category.isDefault) {
      return {
        error: true,
        message: 'Cannot modify default categories.',
        statusCode: 403
      };
    }

    await Categories.findByIdAndUpdate(
      new mongoose.Types.ObjectId(id),
      { $set: updates }
    );

    return {
      error: false,
      message: 'Category updated successfully'
    };
  } catch (err) {
    console.log(`Error updating category: ${err}`);
    return {
      error: true,
      message: 'Failed to update category.',
      statusCode: 400
    };
  }
};

export const archive = async (userId: string, id: string): Promise<CategoryServiceResponse> => {
  try {
    const category = await Categories.findOne({
      _id: new mongoose.Types.ObjectId(id),
      owner: new mongoose.Types.ObjectId(userId)
    });

    if (!category) {
      return {
        error: true,
        message: 'Category not found or you do not have permission.',
        statusCode: 404
      };
    }

    if (category.isDefault) {
      return {
        error: true,
        message: 'Cannot archive default categories.',
        statusCode: 403
      };
    }

    await Categories.findByIdAndUpdate(
      new mongoose.Types.ObjectId(id),
      { status: 'archived' }
    );

    return {
      error: false,
      message: 'Category archived successfully'
    };
  } catch (err) {
    console.log(`Error archiving category: ${err}`);
    return {
      error: true,
      message: 'Failed to archive category.',
      statusCode: 400
    };
  }
};

export const getSummary = async (userId: string): Promise<CategoryServiceResponse> => {
  try {
    const [incomeCount, expenseCount, userCategories, defaultCategories] = await Promise.all([
      Categories.countDocuments({
        $or: [
          { owner: new mongoose.Types.ObjectId(userId) },
          { isDefault: true, owner: null }
        ],
        type: 'income',
        status: 'active'
      }),
      Categories.countDocuments({
        $or: [
          { owner: new mongoose.Types.ObjectId(userId) },
          { isDefault: true, owner: null }
        ],
        type: 'expense',
        status: 'active'
      }),
      Categories.countDocuments({
        owner: new mongoose.Types.ObjectId(userId),
        status: 'active'
      }),
      Categories.countDocuments({
        isDefault: true,
        owner: null,
        status: 'active'
      })
    ]);

    return {
      error: false,
      data: {
        totalIncome: incomeCount,
        totalExpense: expenseCount,
        userCreated: userCategories,
        defaultCategories: defaultCategories
      }
    };
  } catch (err) {
    console.log(`Error getting category summary: ${err}`);
    return {
      error: true,
      message: 'Failed to get category summary.',
      statusCode: 400
    };
  }
};
