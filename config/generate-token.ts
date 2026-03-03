import jwt from 'jsonwebtoken';
import { IUser } from '../models/Users.js';

export const generateAccess = (user: IUser) => {
    const secret = process.env.JWT_SECRET_KEY;
    
    if (!secret) {
        throw new Error('JWT_SECRET_KEY environment variable is not set. Ensure you have a .env file with JWT_SECRET_KEY defined.');
    }
    
    const duration = 7 * 24 * 60 * 60; // 7 days in seconds
    const expiration = Math.floor(Date.now() / 1000) + duration;

    return {
        access: jwt.sign(
        {
            _id: user._id,
            username: user.username,
            email: user.email,
            status: user.status,
            provider: user.provider
        },
        secret,
        {
            algorithm: 'HS256',
            expiresIn: duration,
        }
    ),
        expiration: new Date(expiration * 1000) // Convert to milliseconds
    }
}