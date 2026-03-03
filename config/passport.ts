import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import type { Profile } from 'passport';
import Users from '../models/Users.js';
import * as authService from '../cservice/auth.service.js';

// Validate OAuth environment variables
const validateOAuthConfig = () => {
    const googleEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    const facebookEnabled = !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET);
    const baseUrl = process.env.OAUTH_CALLBACK_BASE_URL || 'http://localhost:3000/api/v1/auth';
    
    if (googleEnabled) {
        console.log('✓ Google OAuth enabled');
    }
    if (facebookEnabled) {
        console.log('✓ Facebook OAuth enabled');
    }
    
    return { googleEnabled, facebookEnabled, baseUrl };
};

const config = validateOAuthConfig();

// Local Strategy with validation
passport.use('local',
    new LocalStrategy(
        {
            usernameField: 'username',
            passwordField: 'password'
        },
        async (username: string, password: string, done) => {
            try {
                // Input validation
                if (!username || !password) {
                    return done(null, false, { message: 'Username/email and password are required.' });
                }

                if (username.trim().length === 0) {
                    return done(null, false, { message: 'Username/email cannot be empty.' });
                }

                if (password.length < 6) {
                    return done(null, false, { message: 'Invalid credentials.' });
                }

                const identifierRegex = new RegExp('^' + username + '$', 'i');
                // Find user with local provider
                const user = await Users.findOne({ 
                    $or: [
                        { username: { $regex: identifierRegex } },
                        { email: { $regex: identifierRegex } }
                    ],
                    provider: 'local'
                });

                if (!user) {
                    return done(null, false, { message: 'Incorrect username or email.' });
                }

                // Check user status
                if (user.status === 'banned') {
                    return done(null, false, { message: 'Account banned.' });
                }

                if (user.status !== 'active') {
                    return done(null, false, { message: `Account ${user.status}.` });
                }

                // Verify password
                const isMatch = await user.matchPassword(password);
                if (!isMatch) {
                    return done(null, false, { message: 'Incorrect password.' });
                }

                return done(null, user);
            } catch (error) {
                console.error('Local auth error:', error);
                return done(error as Error);
            }
        }
    )
);

// Google Strategy
if (config.googleEnabled) {
    passport.use(new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
            callbackURL: `${config.baseUrl}/google/callback`,
            scope: ['profile', 'email']
        },
        async (accessToken: string, refreshToken: string, profile: Profile, done) => {
            try {
                // Validate profile data
                if (!profile.id) {
                    return done(new Error('No profile ID from Google'));
                }

                const email = profile.emails?.[0]?.value;
                const name = profile.displayName;

                if (!email) {
                    return done(new Error('No email provided by Google. Please ensure email permission is granted.'));
                }

                // Call service to handle user creation/login
                const result = await authService.socialLogin('google', profile.id, email, name);

                if (result.error) {
                    return done(new Error(result.message || 'OAuth login failed'));
                }

                // Return token data for controller
                return done(null, result.data);
            } catch (error) {
                console.error('Google auth error:', error);
                return done(error as Error);
            }
        }
    ));
} else {
    console.log('⚠ Google OAuth disabled - missing credentials');
}

// Facebook Strategy
if (config.facebookEnabled) {
    passport.use(new FacebookStrategy(
        {
            clientID: process.env.FACEBOOK_APP_ID as string,
            clientSecret: process.env.FACEBOOK_APP_SECRET as string,
            callbackURL: `${config.baseUrl}/facebook/callback`,
            profileFields: ['id', 'displayName', 'emails', 'name'],
            scope: ['email']
        },
        async (accessToken: string, refreshToken: string, profile: Profile, done) => {
            try {
                // Validate profile data
                if (!profile.id) {
                    return done(new Error('No profile ID from Facebook'));
                }

                const email = profile.emails?.[0]?.value;
                const name = profile.displayName;

                if (!email) {
                    return done(new Error('No email provided by Facebook. Please ensure email permission is granted.'));
                }

                // Call service to handle user creation/login
                const result = await authService.socialLogin('facebook', profile.id, email, name);

                if (result.error) {
                    return done(new Error(result.message || 'OAuth login failed'));
                }

                // Return token data for controller
                return done(null, result.data);
            } catch (error) {
                console.error('Facebook auth error:', error);
                return done(error as Error);
            }
        }
    ));
} else {
    console.log('⚠ Facebook OAuth disabled - missing credentials');
}

export default passport;