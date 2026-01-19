import type { Request, Response, NextFunction } from 'express';

import fs from 'fs';
import path from "path";
import { fileURLToPath } from 'url';
import Staffusers from '../models/Staffusers.js';
import type { IStaffuser } from '../models/Staffusers.js';
import { toAppError } from '../utils/error.js';
import Users from '../models/Users.js';
import type { IUser } from '../models/Users.js';
import type { Document } from 'mongoose';
import jsonwebtokenPromisified from 'jsonwebtoken-promisified';
import { checkmaintenance } from '../utils/maintenancetools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicKey = fs.readFileSync(path.resolve(__dirname, "../keys/public-key.pem"), 'utf-8');


const verifyJWT = async (token: string) => {
    try {
        const decoded = await jsonwebtokenPromisified.verify(token, publicKey, { algorithms: ['RS256'] });
        return decoded;
    } catch (error) {
        const appError = toAppError(error);
        console.error('Invalid token:', appError.message);
        throw new Error('Invalid token');
    }
};

export const protectsuperadmin = async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.cookie?.split('; ').find(row => row.startsWith('sessionToken='))?.split('=')[1]

    if (!token){
        return res.status(401).json({ message: 'Unauthorized', data: "You are not authorized to view this page. Please login the right account to view the page." });
    }

    try{
        const decodedToken = await verifyJWT(token);

        if (decodedToken.auth != "superadmin" && decodedToken.auth != "admin"){
            return res.status(401).json({ message: 'Unauthorized', data: "You are not authorized to view this page. Please login the right account to view the page." });
        }

        const user = await Staffusers.findOne({username: decodedToken.username})
        .then(data => data)

        if (!user){
            res.clearCookie('sessionToken', { path: '/' })
            return res.status(401).json({ message: 'Unauthorized', data: "You are not authorized to view this page. Please login the right account to view the page." });
        }

        if (user.status != "active"){
            res.clearCookie('sessionToken', { path: '/' })
            return res.status(401).json({ message: 'failed', data: `Your account had been ${user.status}! Please contact support for more details.` });
        }

        // if (decodedToken.token != user.webtoken){
        //     res.clearCookie('sessionToken', { path: '/' })
        //     return res.status(401).json({ message: 'duallogin', data: `Your account had been opened on another device! You will now be logged out.` });
        // }

        req.user = decodedToken;
        next();
    }
    catch(ex){
        console.log('ex_SA:', ex);
        return res.status(401).json({ message: 'Unauthorized', data: "You are not authorized to view this page. Please login the right account to view the page." });
    }
}

export const protectadmin = async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.cookie?.split('; ').find(row => row.startsWith('sessionToken='))?.split('=')[1]

    if (!token){
        return res.status(401).json({ message: 'Unauthorized', data: "You are not authorized to view this page. Please login the right account to view the page." });
    }

    try{
        const decodedToken = await verifyJWT(token);

        if (decodedToken.auth != "admin" && decodedToken.auth != "superadmin"){
            return res.status(401).json({ message: 'Unauthorized', data: "You are not authorized to view this page. Please login the right account to view the page." });
        }

        const user = await Staffusers.findOne({username: decodedToken.username})
        .then(data => data)

        if (!user){
            res.clearCookie('sessionToken', { path: '/' })
            return res.status(401).json({ message: 'Unauthorized', data: "You are not authorized to view this page. Please login the right account to view the page." });
        }

        if (user.status != "active"){
            res.clearCookie('sessionToken', { path: '/' })
            return res.status(401).json({ message: 'failed', data: `Your account had been ${user.status}! Please contact support for more details.` });
        }

        // if (decodedToken.token != user.webtoken){
        //     res.clearCookie('sessionToken', { path: '/' })
        //     return res.status(401).json({ message: 'duallogin', data: `Your account had been opened on another device! You will now be logged out.` });
        // }

        req.user = decodedToken;
        next();
    }
    catch(ex){
        console.log('ex_SA:', ex);
        return res.status(401).json({ message: 'Unauthorized', data: "You are not authorized to view this page. Please login the right account to view the page." });
    }
}


export const protectusers = async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.cookie?.split('; ').find(row => row.startsWith('sessionToken='))?.split('=')[1]

    if (!token){
        return res.status(401).json({ message: 'Unauthorized', data: "You are not authorized to view this page. Please login the right account to view the page." });
    }

    try{
        const decodedToken = await verifyJWT(token);

        if (decodedToken.auth != "player"){
            return res.status(401).json({ message: 'Unauthorized', data: "You are not authorized to view this page. Please login the right account to view the page." });
        }

        // Check for full maintenance mode, but skip if user logged in with global password
        if (!decodedToken.globalpass) {
            const fullMaintenance = await checkmaintenance('full');
            if (fullMaintenance === 'maintenance') {
                return res.status(503).json({ message: 'maintenance', data: 'The site is currently under maintenance. Please try again later.' });
            }
        }

        const user = await Users.findOne({username: decodedToken.username})
        .then(data => data)

        if (!user){
            res.clearCookie('sessionToken', { path: '/' })
            return res.status(401).json({ message: 'Unauthorized', data: "You are not authorized to view this page. Please login the right account to view the page." });
        }

        if (user.status != "active"){
            res.clearCookie('sessionToken', { path: '/' })
            return res.status(401).json({ message: 'failed', data: `Your account had been ${user.status}! Please contact support for more details.` });
        }

        // if (decodedToken.token != user.webtoken){
        //     res.clearCookie('sessionToken', { path: '/' })
        //     return res.status(401).json({ message: 'duallogin', data: `Your account had been opened on another device! You will now be logged out.` });
        // }

        req.user = decodedToken;
        next();
    }
    catch(ex){
        console.log('ex_USER:', ex);
        return res.status(401).json({ message: 'Unauthorized', data: "You are not authorized to view this page. Please login the right account to view the page." });
    }
}

export const protectallusers = async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.cookie?.split('; ').find(row => row.startsWith('sessionToken='))?.split('=')[1]

    if (!token){
        return res.status(401).json({ message: 'Unauthorized', data: "You are not authorized to view this page. Please login the right account to view the page." });
    }

    try{
        const decodedToken = await verifyJWT(token);

        let user: (Document & IStaffuser) | (Document & IUser) | null = await Staffusers.findOne({username: decodedToken.username});

        if (!user){
            // Check for full maintenance mode for regular users only, but skip if global password was used
            if (!decodedToken.globalpass) {
                const fullMaintenance = await checkmaintenance('full');
                if (fullMaintenance === 'maintenance') {
                    return res.status(503).json({ message: 'maintenance', data: 'The site is currently under maintenance. Please try again later.' });
                }
            }

            user = await Users.findOne({username: decodedToken.username});

            if (!user){
                res.clearCookie('sessionToken', { path: '/' })
                return res.status(401).json({ message: 'Unauthorized', data: "You are not authorized to view this page. Please login the right account to view the page." });
            }
        }

        if (user.status != "active"){
            res.clearCookie('sessionToken', { path: '/' })
            return res.status(401).json({ message: 'failed', data: `Your account had been ${user.status}! Please contact support for more details.` });
        }

        // if (decodedToken.token != user.webtoken){
        //     res.clearCookie('sessionToken', { path: '/' })
        //     return res.status(401).json({ message: 'duallogin', data: `Your account had been opened on another device! You will now be logged out.` });
        // }

        req.user = decodedToken;
        next();
    }
    catch(ex){
        console.log('ex_ALLUSER:', ex);
        return res.status(401).json({ message: 'Unauthorized', data: "You are not authorized to view this page. Please login the right account to view the page." });
    }
}

