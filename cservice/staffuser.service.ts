import bcrypt from 'bcrypt';
import Staffusers from '../models/Staffusers.js';
import type { StaffUserServiceResponse } from '../ctypes/staffuser.types.js';
import { pageOptions } from '../utils/paginate.js';

export const banUnbanUser = async (status: string, staffusername: string): Promise<StaffUserServiceResponse> => {
    try {
        await Staffusers.findOneAndUpdate({ username: staffusername }, { status: status });

        return {
            error: false,
            message: "User status updated successfully"
        };
    } catch (err) {
        console.log(`Failed to update staff user status for ${staffusername}, error: ${err}`);
        return {
            error: true,
            message: "There's a problem getting your user details. Please contact customer support.",
            statusCode: 400
        };
    }
};

export const multipleBanStaffUsers = async (staffuserlist: string[], status: string): Promise<StaffUserServiceResponse> => {
    try {
        const data: any[] = [];

        staffuserlist.forEach(username => {
            data.push({
                updateOne: {
                    filter: { username: username },
                    update: { $set: { status: status } }
                }
            });
        });

        if (data.length <= 0) {
            return {
                error: true,
                message: "No users to update.",
                statusCode: 400
            };
        }

        await Staffusers.bulkWrite(data);

        return {
            error: false,
            message: "Users status updated successfully"
        };
    } catch (err) {
        console.log(`Failed to bulk update staff users status, error: ${err}`);
        return {
            error: true,
            message: "Failed to bulk update user status.",
            statusCode: 400
        };
    }
};

export const getAdminList = async (page: string, limit: string, search?: string): Promise<StaffUserServiceResponse> => {
    try {
        const options = pageOptions(page, limit);
        const searchOptions = search ? { username: { $regex: search, $options: "i" } } : {};

        const [adminlist, totalDocuments] = await Promise.all([
            Staffusers.find({ auth: { $ne: "superadmin" }, ...searchOptions })
                .skip(options.skip)
                .limit(options.limit)
                .sort({ createdAt: -1 }),
            Staffusers.countDocuments({ auth: { $ne: "superadmin" }, ...searchOptions })
        ]);

        const pages = Math.ceil(totalDocuments / options.limit);

        const data = {
            users: adminlist.map(({ _id, username, status, createdAt }) => ({
                userid: _id,
                username: username,
                status: status,
                createdAt: createdAt
            })),
            totalPages: pages
        };

        return {
            error: false,
            data
        };
    } catch (err) {
        console.log(`Failed to get admin list data, error: ${err}`);
        return {
            error: true,
            message: "There's a problem with your account. Please contact customer support for more details",
            statusCode: 401
        };
    }
};

export const updateAdmin = async (staffusername: string, password: string): Promise<StaffUserServiceResponse> => {
    try {
        const hashPassword = bcrypt.hashSync(password, 10);

        await Staffusers.findOneAndUpdate({ username: staffusername }, { password: hashPassword });

        return {
            error: false,
            message: "Password updated successfully"
        };
    } catch (err) {
        console.log(`There's a problem updating user data for ${staffusername}, error: ${err}`);
        return {
            error: true,
            message: "There's a problem getting your user details. Please contact customer support.",
            statusCode: 400
        };
    }
};

export const changePass = async (username: string, password: string): Promise<StaffUserServiceResponse> => {
    try {
        const hashPassword = bcrypt.hashSync(password, 10);

        await Staffusers.findOneAndUpdate({ username: username }, { password: hashPassword });

        return {
            error: false,
            message: "Password changed successfully"
        };
    } catch (err) {
        console.log(`There's a problem updating user data for ${username}, error: ${err}`);
        return {
            error: true,
            message: "There's a problem getting your user details. Please contact customer support.",
            statusCode: 400
        };
    }
};

export const searchAdminList = async (adminusername: string, page: string, limit: string): Promise<StaffUserServiceResponse> => {
    try {
        const options = pageOptions(page, limit);

        const adminlist = await Staffusers.find({
            username: { $regex: new RegExp(adminusername, 'i') },
            auth: { $ne: "superadmin" }
        })
            .skip(options.skip)
            .limit(options.limit)
            .sort({ createdAt: -1 });

        const totalPages = await Staffusers.countDocuments({ auth: { $ne: "superadmin" } });
        const pages = Math.ceil(totalPages / options.limit);

        const data = {
            users: adminlist.map(value => {
                const { _id, username, status, createdAt } = value;
                return {
                    userid: _id,
                    username: username,
                    status: status,
                    createdAt: createdAt
                };
            }),
            totalPages: pages
        };

        return {
            error: false,
            data
        };
    } catch (err) {
        console.log(`Failed to search admin list data, error: ${err}`);
        return {
            error: true,
            message: "There's a problem with your account. Please contact customer support for more details",
            statusCode: 401
        };
    }
};
