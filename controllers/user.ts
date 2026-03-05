import type { Request, Response, NextFunction } from 'express';
import type {
    GetUserDetailsSuperadminQuery,
    ChangePasswordUserBody,
    ChangePasswordUserForAdminBody,
    UpdateUserProfileBody,
    SearchPlayerListQuery,
    GetPlayerListQuery,
    BanUnbanUserBody,
    MultipleBanUsersBody
} from '../ctypes/user.types.js';
import * as userService from '../cservice/user.service.js';


export const getuserdetails = async (req: Request, res: Response, next: NextFunction) => {
    const { id, username } = req.user!;

    try {
        const result = await userService.getUserDetails(id, username);

        if (result.error) {
            const statusCode = result.statusCode || 400;
            return res.status(statusCode).json({ message: "failed", data: result.message });
        }

        return res.json({ message: "success", data: result.data });
    } catch (err) {
        next(err);
    }
};

export const getuserdetailssuperadmin = async (req: Request, res: Response, next: NextFunction) => {
    const { userid } = req.validatedQuery as GetUserDetailsSuperadminQuery;

    try {
        const result = await userService.getUserDetailsSuperadmin(userid);

        if (result.error) {
            const statusCode = result.statusCode || 400;
            return res.status(statusCode).json({ message: "failed", data: result.message });
        }

        return res.json({ message: "success", data: result.data });
    } catch (err) {
        next(err);
    }
};

export const changepassworduser = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.user!;
    const { password } = req.validatedBody as ChangePasswordUserBody;

    try {
        const result = await userService.changePasswordUser(id, password);

        if (result.error) {
            const statusCode = result.statusCode || 400;
            return res.status(statusCode).json({ message: "failed", data: result.message });
        }

        return res.json({ message: "success" });
    } catch (err) {
        next(err);
    }
};

export const changepassworduserforadmin = async (req: Request, res: Response, next: NextFunction) => {
    const { playerid, password } = req.validatedBody as ChangePasswordUserForAdminBody;

    try {
        const result = await userService.changePasswordUserForAdmin(playerid, password);

        if (result.error) {
            const statusCode = result.statusCode || 400;
            return res.status(statusCode).json({ message: "failed", data: result.message });
        }

        return res.json({ message: "success" });
    } catch (err) {
        next(err);
    }
};

export const updateuserprofile = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.user!;
    const {
        phonenumber,
        firstname,
        lastname,
        address,
        city,
        country,
        postalcode,
        paymentmethod,
        accountnumber
    } = req.validatedBody as UpdateUserProfileBody;

    const updateData: UpdateUserProfileBody = {
        phonenumber,
        firstname,
        lastname,
        address,
        city,
        country,
        postalcode,
        paymentmethod,
        accountnumber
    };
    try {
        const result = await userService.updateUserProfile(
            id,
            updateData.phonenumber,
            updateData.firstname,
            updateData.lastname,
            updateData.address,
            updateData.city,
            updateData.country,
            updateData.postalcode,
            updateData.paymentmethod,
            updateData.accountnumber
        );

        if (result.error) {
            const statusCode = result.statusCode || 400;
            return res.status(statusCode).json({ message: "failed", data: result.message });
        }

        return res.json({ message: "success" });
    } catch (err) {
        next(err);
    }
};

export const searchplayerlist = async (req: Request, res: Response, next: NextFunction) => {
    const { playerusername, page, limit } = req.validatedQuery as SearchPlayerListQuery;

    try {
        const result = await userService.searchPlayerList(
            playerusername,
            page || '0',
            limit || '100'
        );

        if (result.error) {
            const statusCode = result.statusCode || 400;
            return res.status(statusCode).json({ message: "failed", data: result.message });
        }

        return res.json({ message: "success", data: result.data });
    } catch (err) {
        next(err);
    }
};

export const getplayerlist = async (req: Request, res: Response, next: NextFunction) => {
    const { page, limit, search } = req.validatedQuery as GetPlayerListQuery;

    try {
        const result = await userService.getPlayerList(
            page || '0',
            limit || '10',
            search
        );

        if (result.error) {
            const statusCode = result.statusCode || 400;
            return res.status(statusCode).json({ message: "failed", data: result.message });
        }

        return res.json({ message: "success", data: result.data });
    } catch (err) {
        next(err);
    }
};

export const banunbanuser = async (req: Request, res: Response, next: NextFunction) => {
    const { status, userid } = req.validatedBody as BanUnbanUserBody;

    try {
        const result = await userService.banUnbanUser(status, userid);

        if (result.error) {
            const statusCode = result.statusCode || 400;
            return res.status(statusCode).json({ message: "failed", data: result.message });
        }

        return res.json({ message: "success" });
    } catch (err) {
        next(err);
    }
};

export const multiplebanusers = async (req: Request, res: Response, next: NextFunction) => {
    const { userlist, status } = req.validatedBody as MultipleBanUsersBody;

    try {
        const result = await userService.multipleBanUsers(userlist, status);

        if (result.error) {
            const statusCode = result.statusCode || 400;
            return res.status(statusCode).json({ message: "failed", data: result.message });
        }

        return res.json({ message: "success" });
    } catch (err) {
        next(err);
    }
};

