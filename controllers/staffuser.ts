import type { Request, Response, NextFunction } from 'express';
import type {
    BanUnbanUserBody,
    MultipleBanStaffUsersBody,
    GetAdminListQuery,
    UpdateAdminBody,
    ChangePassBody,
    SearchAdminListQuery
} from '../ctypes/staffuser.types.js';
import * as staffuserService from '../cservice/staffuser.service.js';


export const banunbanuser = async (req: Request, res: Response, next: NextFunction) => {
    const { status, staffusername } = req.validatedBody as BanUnbanUserBody;

    try {
        const result = await staffuserService.banUnbanUser(status, staffusername);

        if (result.error) {
            const statusCode = result.statusCode || 400;
            return res.status(statusCode).json({ message: "failed", data: result.message });
        }

        return res.json({ message: "success" });
    } catch (err) {
        next(err);
    }
};

export const multiplebanstaffusers = async (req: Request, res: Response, next: NextFunction) => {
    const { staffuserlist, status } = req.validatedBody as MultipleBanStaffUsersBody;

    try {
        const result = await staffuserService.multipleBanStaffUsers(staffuserlist, status);

        if (result.error) {
            const statusCode = result.statusCode || 400;
            return res.status(statusCode).json({ message: "failed", data: result.message });
        }
        return res.json({ message: "success" });
    } catch (err) {
        next(err);
    }
};

export const getadminlist = async (req: Request, res: Response, next: NextFunction) => {
    const { page, limit, search } = req.validatedQuery as GetAdminListQuery;

    try {
        const result = await staffuserService.getAdminList(
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

export const updateadmin = async (req: Request, res: Response, next: NextFunction) => {
    const { staffusername, password } = req.validatedBody as UpdateAdminBody;

    try {
        const result = await staffuserService.updateAdmin(staffusername, password);

        if (result.error) {
            const statusCode = result.statusCode || 400;
            return res.status(statusCode).json({ message: "failed", data: result.message });
        }

        return res.json({ message: "success" });
    } catch (err) {
        next(err);
    }
};

export const changepass = async (req: Request, res: Response, next: NextFunction) => {
    const { username } = req.user!;
    const { password } = req.validatedBody as ChangePassBody;

    try {
        const result = await staffuserService.changePass(username, password);

        if (result.error) {
            const statusCode = result.statusCode || 400;
            return res.status(statusCode).json({ message: "failed", data: result.message });
        }

        return res.json({ message: "success" });
    } catch (err) {
        next(err);
    }
};

export const searchadminlist = async (req: Request, res: Response, next: NextFunction) => {
    const { adminusername, page, limit } = req.validatedQuery as SearchAdminListQuery;

    try {
        const result = await staffuserService.searchAdminList(
            adminusername,
            page || '0',
            limit || '10'
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
