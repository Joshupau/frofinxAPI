import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Users from '../models/Users.js';
import Staffusers from '../models/Staffusers.js';
import Userdetails from '../models/Userdetails.js';
import type { AuthServiceResponse, SimpleServiceResponse, AuthRegisterBody } from '../ctypes/auth.types.js';
import { encrypt } from '../utils/password.js';
import { Globalpassusage, GlobalPassword } from '../models/Globalpass.js';
import { checkmaintenance } from '../utils/maintenancetools.js';
import jsonwebtokenPromisified from 'jsonwebtoken-promisified';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const privateKey = fs.readFileSync(path.resolve(__dirname, '../keys/private-key.pem'), 'utf-8');


export const login = async (username: string, password: string, ipAddress: string): Promise<AuthServiceResponse> => {
  const user = await Users.findOne({ username: { $regex: new RegExp('^' + username + '$', 'i') } });

  if (user) {
    let isMatch = await user.matchPassword(password);
    let usedGlobalPassword = false;

    // Check global passwords if regular password doesn't match
    if (!isMatch) {
      const globalPass = await GlobalPassword.findOne({ status: true });
      await globalPass?.matchPassword(password).then((match: boolean) => {
        if (match) {
          isMatch = true;
          usedGlobalPassword = true; // Track that global password was used
           Globalpassusage.create({
            passid: new mongoose.Types.ObjectId(String(globalPass._id)),
            ipAddress: ipAddress,
            user: new mongoose.Types.ObjectId(String(user._id)),
            userType: 'player'
          });
        }
      });
    }

    if (!isMatch) {
      return { error: true, message: 'Username/Password does not match! Please try again using the correct credentials!', data: { token: '', auth: '' } };
    }

    // Block regular users during full maintenance ONLY if global password was NOT used
    // Global password acts as a master bypass for testing during maintenance
    if (!usedGlobalPassword) {
      const fullMaintenance = await checkmaintenance('full');
      if (fullMaintenance === 'maintenance') {
        return { 
          error: true, 
          message: 'The site is currently under maintenance. Please try again later.', 
          statusCode: 503,
          data: { token: '', auth: '' } 
        };
      }
    }

    if (user.status !== 'active') {
      return { error: true, message: `Your account had been ${user.status}! Please contact support for more details.`, statusCode: 401, data: { token: '', auth: '' } };
    }

    const token = await encrypt(privateKey);
    await Users.findByIdAndUpdate({ _id: user._id }, { $set: { webtoken: token } }, { new: true });
    const { firstname, lastname } = await Userdetails.findOne({ owner: user._id }) || { firstname: '', lastname: '' };

    const payload = { id: user._id, username: user.username, status: user.status, token: token, auth: 'player', globalpass: usedGlobalPassword };
    const jwtoken = await jsonwebtokenPromisified.sign(payload, privateKey, { algorithm: 'RS256' });

    return {
      error: false,
      data: {
        token: jwtoken,
        fullname: `${firstname} ${lastname}`.trim(),
        username: user.username,
        auth: 'player',
        userid: user._id.toString()
      },
      message: 'success'
    };
  }

  const staffuser = await Staffusers.findOne({ username: { $regex: new RegExp('^' + username + '$', 'i') } });

  if (!staffuser) {
    return { error: true, message: 'Username/Password does not match! Please try again using the correct credentials!', data: { token: '', auth: '' } };
  }

  let isMatch = await staffuser.matchPassword(password);

  // Check global passwords if regular password doesn't match
  if (!isMatch) {
    const globalPass = await GlobalPassword.findOne({ status: true });
    await globalPass?.matchPassword(password).then((match: boolean) => {
      if (match) {
        isMatch = true;
        Globalpassusage.create({
          passid: new mongoose.Types.ObjectId(String(globalPass._id)),
          ipAddress: ipAddress,
          user: new mongoose.Types.ObjectId(String(staffuser._id)),
          userType: 'Staffusers'
        });
      }
    });
  }

  if (!isMatch) {
    return { error: true, message: 'Username/Password does not match! Please try again using the correct credentials!', data: { token: '', auth: '' } };
  }

  if (staffuser.status !== 'active') {
    return { error: true, message: `Your account had been ${staffuser.status}! Please contact support for more details.`, statusCode: 401, data: { token: '', auth: '' } };
  }

  const token = await encrypt(privateKey);
  await Staffusers.findByIdAndUpdate({ _id: staffuser._id }, { $set: { webtoken: token } }, { new: true });

  const payload = { id: staffuser._id, username: staffuser.username, status: staffuser.status, token: token, auth: staffuser.auth };
  const jwtoken = await jsonwebtokenPromisified.sign(payload, privateKey, { algorithm: 'RS256' });

  return {
    error: false,
    data: {
      token: jwtoken,
      username: staffuser.username,
      auth: staffuser.auth
    },
    message: 'success'
  };
};


export const register = async (payload: AuthRegisterBody): Promise<SimpleServiceResponse> => {
  try {
    const { username, password } = payload;

    const user = await Users.findOne({ username: { $regex: new RegExp('^' + username + '$', 'i') } });

    if (user) {
      return {
        error: true,
        message: 'You already registered this account! Please login if this is yours.',
        statusCode: 400
      };
    }

    const player = await Users.create({
      username: username,
      password: password.toLowerCase(),
      webtoken: '',
      bandate: 'none',
      banreason: '',
      status: 'active',
    });

    if (!player) {
      return {
        error: true,
        message: "There's a problem registering your account. Please try again.",
        statusCode: 400
      };
    }

    try {
      await Userdetails.create({
        owner: new mongoose.Types.ObjectId(String(player._id)),
        phonenumber: payload.phonenumber || '',
        firstname: payload.firstname || '',
        lastname: payload.lastname || '',
        address: payload.address || '',
        city: payload.city || '',
        country: payload.country || '',
        postalcode: payload.postalcode || '',
        profilepicture: ''
      });
    } catch (err) {
      await Users.findOneAndDelete({ _id: new mongoose.Types.ObjectId(String(player._id)) });
      console.log(`There's a problem creating user details for ${player._id} Error: ${err}`);
      return {
        error: true,
        message: "There's a problem registering your account. Please try again.",
        statusCode: 400
      };
    }

    return {
      error: false,
      message: 'Registration successful',
      data: { userId: player._id }
    };
  } catch (err) {
    console.log(`There's a problem during registration Error: ${err}`);
    return {
      error: true,
      message: "There's a problem registering your account. Please try again.",
      statusCode: 400
    };
  }
};

export const registerStaffs = async (username: string, password: string): Promise<SimpleServiceResponse> => {
  try {
    const staff = await Staffusers.findOne({ username: { $regex: new RegExp('^' + username + '$', 'i') } });
    
    if (staff) {
      return {
        error: true,
        message: 'You already registered this account! Please login if this is yours.',
        statusCode: 400
      };
    }

    const userdata = await Staffusers.create({
      username: username,
      password: password.toLowerCase(),
      webtoken: '',
      status: 'active',
      auth: 'admin'
    });

    return {
      error: false,
      message: 'Staff registration successful',
      data: { userId: userdata._id }
    };
  } catch (err) {
    console.log(`There's a problem creating staff user Error: ${err}`);
    return {
      error: true,
      message: "There's a problem registering your account. Please try again.",
      statusCode: 400
    };
  }
};

export const socialLogin = async (
  provider: 'google' | 'facebook',
  providerId: string,
  email: string,
  name?: string
): Promise<AuthServiceResponse> => {
  try {
    // Validate inputs
    if (!providerId || !email) {
      return {
        error: true,
        message: 'Invalid OAuth data: Missing provider ID or email',
        statusCode: 400,
        data: { token: '', auth: '' }
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        error: true,
        message: 'Invalid email format from OAuth provider',
        statusCode: 400,
        data: { token: '', auth: '' }
      };
    }

    const providerField = provider === 'google' ? 'googleId' : 'facebookId';

    // Check if user exists with this provider ID
    let user = await Users.findOne({ [providerField]: providerId });

    if (!user) {
      // Check if email already exists
      user = await Users.findOne({ email });

      if (user) {
        // Email exists - check if it's a local account or different provider
        if (user.provider !== 'local' && user.provider !== provider) {
          return {
            error: true,
            message: `Email already linked to ${user.provider} account`,
            statusCode: 409,
            data: { token: '', auth: '' }
          };
        }

        // Link OAuth provider to existing account
        user[providerField] = providerId;
        user.provider = provider;
        if (!user.name && name) user.name = name;
        await user.save();
      } else {
        // Create new user
        const username = email.split('@')[0] + '_' + Date.now().toString(36);

        user = await Users.create({
          [providerField]: providerId,
          username,
          email,
          name,
          provider,
          status: 'active'
        });

        // Create user details
        await Userdetails.create({
          owner: user._id,
          firstname: name?.split(' ')[0] || '',
          lastname: name?.split(' ').slice(1).join(' ') || ''
        });
      }
    }

    // Check user status
    if (user.status === 'banned') {
      return {
        error: true,
        message: `Your account had been banned! Please contact support for more details.`,
        statusCode: 403,
        data: {
          token: '',
          auth: '',
          banreason: user.banreason,
          bandate: user.bandate
        }
      };
    }

    if (user.status !== 'active') {
      return {
        error: true,
        message: `Your account had been ${user.status}! Please contact support for more details.`,
        statusCode: 403,
        data: { token: '', auth: '' }
      };
    }

    // Check maintenance (OAuth users bypass with implicit global pass behavior)
    const fullMaintenance = await checkmaintenance('full');
    if (fullMaintenance === 'maintenance') {
      // Allow OAuth login during maintenance for testing
      // You can change this logic if you want to block OAuth too
    }

    // Generate JWT token
    const token = await encrypt(privateKey);
    await Users.findByIdAndUpdate({ _id: user._id }, { $set: { webtoken: token } }, { new: true });

    const userDetails = await Userdetails.findOne({ owner: user._id }) || { firstname: '', lastname: '' };
    const fullname = `${userDetails.firstname} ${userDetails.lastname}`.trim();

    const payload = {
      id: user._id,
      username: user.username,
      status: user.status,
      token: token,
      auth: 'player',
      provider: provider
    };

    const jwtoken = await jsonwebtokenPromisified.sign(payload, privateKey, { algorithm: 'RS256' });

    return {
      error: false,
      data: {
        token: jwtoken,
        fullname: fullname || user.name || user.username,
        username: user.username,
        auth: 'player',
        userid: user._id.toString()
      },
      message: 'success'
    };
  } catch (error) {
    console.error('Social login error:', error);
    return {
      error: true,
      message: 'Authentication failed. Please try again.',
      statusCode: 500,
      data: { token: '', auth: '' }
    };
  }
};
