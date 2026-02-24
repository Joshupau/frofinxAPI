import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import Users from '../models/Users.js';
import Userdetails from '../models/Userdetails.js';
import type { UserServiceResponse } from '../ctypes/user.types.js';

export const getUserDetails = async (id: string, username: string): Promise<UserServiceResponse> => {
    try {
        const details = await Userdetails.findOne({ owner: new mongoose.Types.ObjectId(id) })
            .populate("owner", "gameid");

        if (!details) {
            return {
                error: true,
                message: "User details not found.",
                statusCode: 404
            };
        }

        const data = {
            username: username,
            phonenumber: details.phonenumber,
            fistname: details.firstname,
            lastname: details.lastname,
            address: details.address,
            city: details.city,
            country: details.country,
            postalcode: details.postalcode,
            paymentmethod: details.paymentmethod,
            accountnumber: details.accountnumber,
            profilepicture: details.profilepicture,
        };

        return {
            error: false,
            data: data
        };
    } catch (err) {
        console.log(`There's a problem getting user details for ${username} Error: ${err}`);
        return {
            error: true,
            message: "There's a problem getting your user details. Please contact customer support.",
            statusCode: 400
        };
    }
};

export const getUserDetailsSuperadmin = async (userid: string): Promise<UserServiceResponse> => {
    try {
        const details = await Users.findOne({ _id: new mongoose.Types.ObjectId(userid) })
            .populate("referral", "username");

        if (!details) {
            return {
                error: true,
                message: "User not found.",
                statusCode: 404
            };
        }

        const data = {
            username: details.username,
            status: details.status,
        };

        return {
            error: false,
            data: data
        };
    } catch (err) {
        console.log(`There's a problem getting user details for superadmin. Error: ${err}`);
        return {
            error: true,
            message: "There's a problem getting user details. Please contact customer support.",
            statusCode: 400
        };
    }
};

export const changePasswordUser = async (id: string, password: string): Promise<UserServiceResponse> => {
    try {
        const hashPassword = bcrypt.hashSync(password, 10);

        await Users.findOneAndUpdate(
            { _id: new mongoose.Types.ObjectId(id) },
            { password: hashPassword }
        );

        return {
            error: false,
            message: "Password changed successfully"
        };
    } catch (err) {
        console.log(`There's a problem changing password. Error: ${err}`);
        return {
            error: true,
            message: "There's a problem changing your password. Please contact customer support.",
            statusCode: 400
        };
    }
};

export const changePasswordUserForAdmin = async (playerid: string, password: string): Promise<UserServiceResponse> => {
    try {
        const hashPassword = bcrypt.hashSync(password, 10);

        await Users.findOneAndUpdate(
            { _id: new mongoose.Types.ObjectId(playerid) },
            { password: hashPassword }
        );

        return {
            error: false,
            message: "Password changed successfully"
        };
    } catch (err) {
        console.log(`There's a problem changing password for admin. Error: ${err}`);
        return {
            error: true,
            message: "There's a problem changing the password. Please contact customer support.",
            statusCode: 400
        };
    }
};

export const updateUserProfile = async (
    id: string,
    phonenumber?: string,
    firstname?: string,
    lastname?: string,
    address?: string,
    city?: string,
    country?: string,
    postalcode?: string,
    paymentmethod?: string,
    accountnumber?: string
): Promise<UserServiceResponse> => {
    try {
        await Userdetails.findOneAndUpdate(
            { owner: new mongoose.Types.ObjectId(id) },
            {
                firstname: firstname,
                lastname: lastname,
                address: address,
                city: city,
                country: country,
                postalcode: postalcode,
                paymentmethod: paymentmethod,
                accountnumber: accountnumber,
                phonenumber: phonenumber
            }
        );

        return {
            error: false,
            message: "Profile updated successfully"
        };
    } catch (err) {
        console.log(`There's a problem updating user profile. Error: ${err}`);
        return {
            error: true,
            message: "There's a problem updating your profile. Please contact customer support.",
            statusCode: 400
        };
    }
};

export const searchPlayerList = async (playerusername = "", page: string, limit: string): Promise<UserServiceResponse> => {
    try {
        console.log('playerusername:', playerusername);
        const userlistpipeline = [
            {
                $match: {
                    username: { $regex: playerusername, $options: "i" }
                }
            },
            {
                $limit: parseInt(limit) || 100
            },
            {
                $facet: {
                    data: [
                        {
                            $lookup: {
                                from: "userdetails",
                                localField: "_id",
                                foreignField: "owner",
                                as: "userDetails"
                            }
                        },
                        {
                            $lookup: {
                                from: "users",
                                localField: "referral",
                                foreignField: "_id",
                                as: "referredUser"
                            }
                        },
                        {
                            $project: {
                                username: 1,
                                email: { $arrayElemAt: ["$userDetails.email", 0] },
                                referralUsername: { $arrayElemAt: ["$referredUser.username", 0] },
                                createdAt: 1,
                                status: 1
                            }
                        }
                    ]
                }
            }
        ];

        const userlist = await Users.aggregate(userlistpipeline);

        const data = {
            totalPages: 0,
            userlist: userlist[0].data.map((value: any) => ({
                id: value._id,
                username: value.username,
                email: value.email,
                referredBy: value.referralUsername,
                createdAt: value.createdAt,
                status: value.status
            }))
        };

        return {
            error: false,
            data: data
        };
    } catch (err) {
        console.log(`There's a problem searching player list. Error: ${err}`);
        return {
            error: true,
            message: "There's a problem searching player list.",
            statusCode: 400
        };
    }
};

export const getPlayerList = async (page: string, limit: string, search?: string): Promise<UserServiceResponse> => {
    try {
        const pageOptions = {
            page: parseInt(page) || 0,
            limit: parseInt(limit) || 10
        };

        const userlistpipeline: any[] = [];

        if (search) {
            userlistpipeline.push({
                $match: {
                    username: { $regex: search, $options: "i" }
                }
            });
        }

        userlistpipeline.push(
            {
                $facet: {
                    totalCount: [
                        {
                            $count: "total"
                        }
                    ],
                    data: [
                        {
                            $lookup: {
                                from: "userdetails",
                                localField: "_id",
                                foreignField: "owner",
                                as: "userDetails"
                            }
                        },
                        {
                            $lookup: {
                                from: "users",
                                localField: "referral",
                                foreignField: "_id",
                                as: "referredUser"
                            }
                        },
                        {
                            $project: {
                                username: 1,
                                phonenumber: { $arrayElemAt: ["$userDetails.phonenumber", 0] },
                                referralUsername: { $arrayElemAt: ["$referredUser.username", 0] },
                                createdAt: 1,
                                status: 1
                            }
                        },
                        {
                            $skip: pageOptions.page * pageOptions.limit
                        },
                        {
                            $limit: pageOptions.limit
                        }
                    ]
                }
            }
        );

        const userlist = await Users.aggregate(userlistpipeline);

        const totalCount = userlist[0].totalCount[0]?.total || 0;
        const data = {
            totalPages: Math.ceil(totalCount / pageOptions.limit),
            userlist: userlist[0].data.map((value: any) => ({
                id: value._id,
                username: value.username,
                phonenumber: value.phonenumber,
                referredBy: value.referralUsername,
                createdAt: value.createdAt,
                status: value.status
            }))
        };

        return {
            error: false,
            data: data
        };
    } catch (err) {
        console.log(`There's a problem getting player list. Error: ${err}`);
        return {
            error: true,
            message: "There's a problem getting player list.",
            statusCode: 400
        };
    }
};

export const banUnbanUser = async (status: string, userid: string): Promise<UserServiceResponse> => {
    try {
        await Users.findOneAndUpdate(
            { _id: new mongoose.Types.ObjectId(userid) },
            { status: status }
        );

        return {
            error: false,
            message: "User status updated successfully"
        };
    } catch (err) {
        console.log(`There's a problem updating user status. Error: ${err}`);
        return {
            error: true,
            message: "There's a problem updating user status. Please contact customer support.",
            statusCode: 400
        };
    }
};

export const multipleBanUsers = async (userlist: string[], status: string): Promise<UserServiceResponse> => {
    try {
        const data: any[] = [];

        userlist.forEach(tempdata => {
            data.push({
                updateOne: {
                    filter: { _id: new mongoose.Types.ObjectId(tempdata) },
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

        await Users.bulkWrite(data);

        return {
            error: false,
            message: "Users status updated successfully"
        };
    } catch (err) {
        console.log(`There's a problem updating multiple users status. Error: ${err}`);
        return {
            error: true,
            message: "There's a problem updating users status.",
            statusCode: 400
        };
    }
};
