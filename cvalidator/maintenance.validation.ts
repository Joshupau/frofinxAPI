import { z } from 'zod';

export const changeMaintenanceBodySchema = z.object({
    type: z.string().min(1, 'Type is required'),
    value: z.string().min(1, 'Value is required')
});

export const getEventMainteQuerySchema = z.object({
    maintenancetype: z.string().min(1, 'Maintenance type is required')
});
