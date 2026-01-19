import { z } from 'zod';
import { optionalString } from './validation.utils.js';

export const getUserDetailsSuperadminQuerySchema = z.object({
    userid: z.string().min(1, 'User ID is required')
});

export const changePasswordUserBodySchema = z.object({
    password: z.string()
    .min(1, 'Password is required')
    .regex(/^[a-zA-Z0-9]+$/, "Please don't use special characters for username! Please try again."),

});

export const changePasswordUserForAdminBodySchema = z.object({
    playerid: z.string().min(1, 'Player ID is required'),
    password: z.string()
    .min(1, 'Password is required')
    .regex(/^[a-zA-Z0-9]+$/, "Please don't use special characters for username! Please try again."),
});


export const updateUserProfileBodySchema = z.object({
    phonenumber: optionalString,
    firstname: optionalString,
    lastname: optionalString,
    address: optionalString,
    city: optionalString,
    country: optionalString,
    postalcode: optionalString,
    paymentmethod: optionalString,
    accountnumber: optionalString
});

export const searchPlayerListQuerySchema = z.object({
    playerusername: optionalString,
    page: optionalString,
    limit: optionalString
});

export const getPlayerListQuerySchema = z.object({
    page: optionalString,
    limit: optionalString,
    search: optionalString
});

export const banUnbanUserBodySchema = z.object({
    status: z.string().min(1, 'Status is required'),
    userid: z.string().min(1, 'User ID is required')
});

export const multipleBanUsersBodySchema = z.object({
    userlist: z.array(z.string()).min(1, 'User list is required'),
    status: z.string().min(1, 'Status is required')
});
