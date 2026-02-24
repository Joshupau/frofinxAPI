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
        profilepicture: payload.profilepicture || ''
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
