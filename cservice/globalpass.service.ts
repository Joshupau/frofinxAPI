import mongoose from 'mongoose';
import { GlobalPassword, Globalpassusage } from '../models/Globalpass.js';
import type { IGlobalPassword } from '../models/Globalpass.js';
import { encrypt } from '../utils/password.js';
import { pageOptions } from '../utils/paginate.js';
import type { UsageHistoryResponse } from '../ctypes/globalpass.types.js';

export const create = async (id: string, secretkey: string): Promise<IGlobalPassword> => {
  const hashedSecretKey = await encrypt(secretkey);
  await GlobalPassword.updateMany({ status: true }, { status: false });
  const data = await GlobalPassword.create({
    owner: new mongoose.Types.ObjectId(id),
    secretkey: hashedSecretKey
  });
  return data;
};

export const get_usage_history = async (page: string | undefined, limit: string | undefined): Promise<UsageHistoryResponse> => {
  const options = pageOptions(page || '0', limit || '10');

  const matchCondition: mongoose.PipelineStage[] = [
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'userDetails'
      }
    },
    {
      $lookup: {
        from: 'staffusers',
        localField: 'user',
        foreignField: '_id',
        as: 'staffUserDetails'
      }
    },
    {
      $addFields: {
        user: {
          $cond: {
            if: { $eq: ['$userType', 'Staffusers'] },
            then: { $arrayElemAt: ['$staffUserDetails.username', 0] },
            else: { $arrayElemAt: ['$userDetails.username', 0] }
          }
        }
      }
    },
    {
      $project: {
        ipAddress: 1,
        date: 1,
        user: 1,
        userType: 1,
        createdAt: 1
      }
    },
    {
      $sort: { createdAt: -1 }
    },
    {
      $skip: options.skip
    },
    {
      $limit: options.limit
    }
  ];

  const usageHistory = await Globalpassusage.aggregate(matchCondition);
  const totalUsageHistory = await Globalpassusage.countDocuments({});
  const totalPages = Math.ceil(totalUsageHistory / options.limit);

  const finaldata: UsageHistoryResponse = {
    totalPages,
    usageHistory: usageHistory.map((temp: any) => ({
      id: temp._id,
      ipAddress: temp.ipAddress,
      user: temp.user,
      userType: temp.userType,
      dateused: temp.createdAt
    }))
  };

  return finaldata;
};
