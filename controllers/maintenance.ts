import { NextFunction, Request, Response } from "express";
import type { ChangeMaintenanceBody, GetEventMainteQuery } from '../ctypes/maintenance.types.js';
import * as maintenanceService from '../cservice/maintenance.service.js';

export const getmaintenance = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await maintenanceService.getMaintenance();

        if (result.error) {
            const statusCode = result.statusCode || 400;
            return res.status(statusCode).json({ message: "failed", data: result.message });
        }

        return res.status(200).json({ message: "success", data: result.data });
    } catch (error) {
        next(error);
    }
};

export const changemaintenance = async (req: Request, res: Response, next: NextFunction) => {
    const { username } = req.user!;
    const { type, value } = req.validatedBody as ChangeMaintenanceBody;

    try {
        const result = await maintenanceService.changeMaintenance(type, value, username);

        if (result.error) {
            const statusCode = result.statusCode || 400;
            return res.status(statusCode).json({ message: "failed", data: result.message });
        }

        return res.json({ message: "success" });
    } catch (err) {
        next(err);
    }
};

export const geteventmainte = async (req: Request, res: Response, next: NextFunction) => {
    const { username } = req.user!;
    const { maintenancetype } = req.validatedQuery as GetEventMainteQuery;

    try {
        const result = await maintenanceService.getEventMainte(maintenancetype, username);

        if (result.error) {
            const statusCode = result.statusCode || 400;
            return res.status(statusCode).json({ message: "failed", data: result.message });
        }

        return res.json({ message: "success", data: result.data });
    } catch (err) {
        next(err);
    }
};