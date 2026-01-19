import { z } from 'zod';
import { optionalString } from './validation.utils.js';

export const banUnbanUserBodySchema = z.object({
    status: z.string().min(1, 'Status is required'),
    staffusername: z.string().min(1, 'Staff username is required')
});

export const multipleBanStaffUsersBodySchema = z.object({
    staffuserlist: z.array(z.string()).min(1, 'Staff user list is required'),
    status: z.string().min(1, 'Status is required')
});

export const getAdminListQuerySchema = z.object({
    page: optionalString,
    limit: optionalString,
    search: optionalString
});

export const updateAdminBodySchema = z.object({
    staffusername: z.string().min(1, 'Staff username is required'),
    password: z.string().min(1, 'Please complete the form first before saving!')
});

export const changePassBodySchema = z.object({
    password: z.string().min(1, 'Please complete the form first before saving!')
});

export const searchAdminListQuerySchema = z.object({
    adminusername: optionalString,
    page: optionalString,
    limit: optionalString
});
