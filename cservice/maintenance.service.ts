import Maintenance from '../models/Maintenance.js';
import type { MaintenanceServiceResponse } from '../ctypes/maintenance.types.js';

export const getMaintenance = async (): Promise<MaintenanceServiceResponse> => {
    try {
        const maintenance = await Maintenance.find({});

        return {
            error: false,
            data: maintenance
        };
    } catch (err) {
        console.log(`There's a problem getting maintenance data. Error: ${err}`);
        return {
            error: true,
            message: "There's a problem getting maintenance data. Please contact customer support.",
            statusCode: 400
        };
    }
};

export const changeMaintenance = async (type: string, value: string, username: string): Promise<MaintenanceServiceResponse> => {
    try {
        await Maintenance.findOneAndUpdate({ type: type }, { value: value });

        return {
            error: false,
            message: "Maintenance updated successfully"
        };
    } catch (err) {
        console.log(`There's a problem updating maintenance data for ${username} Error: ${err}`);
        return {
            error: true,
            message: "There's a problem updating maintenance data. Please contact customer support.",
            statusCode: 400
        };
    }
};

export const getEventMainte = async (maintenancetype: string, username: string): Promise<MaintenanceServiceResponse> => {
    try {
        const mainte = await Maintenance.findOne({ type: maintenancetype });

        if (!mainte) {
            return {
                error: true,
                message: "Maintenance type not found.",
                statusCode: 400
            };
        }

        const data = {
            type: mainte.type,
            value: mainte.value
        };

        return {
            error: false,
            data: data
        };
    } catch (err) {
        console.log(`There's a problem getting maintenance data for ${username} Error: ${err}`);
        return {
            error: true,
            message: "There's a problem getting maintenance data. Please contact customer support.",
            statusCode: 400
        };
    }
};