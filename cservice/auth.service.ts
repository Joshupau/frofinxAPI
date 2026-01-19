import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Users from '../models/Users.js';
import Staffusers from '../models/Staffusers.js';
import Userdetails from '../models/Userdetails.js';
import StaffUserwallets from '../models/Staffuserwallets.js';
import type { AuthServiceResponse, SimpleServiceResponse, GetReferralUsernameResponse } from '../ctypes/auth.types.js';
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

const generateUniqueGameId = async (): Promise<string> => {
  let gameid = '';
  let isUnique = false;
  
  while (!isUnique) {
    gameid = Math.floor(100000 + Math.random() * 900000).toString();
    const existing = await Users.findOne({ gameid });
    if (!existing) isUnique = true;
  }
  
  return gameid;
};

export const register = async (
  username: string,
  password: string,
  referral: string,
  phonenumber: string
): Promise<SimpleServiceResponse> => {
  try {
    const searchreferral = await Users.findOne({ _id: new mongoose.Types.ObjectId(referral) });
    
    if (!searchreferral) {
      return {
        error: true,
        message: "Referral does not exist! Please don't tamper with the url.",
        statusCode: 400
      };
    }

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
      referral: new mongoose.Types.ObjectId(referral),
      gametoken: '',
      webtoken: '',
      bandate: 'none',
      banreason: '',
      status: 'active',
      gameid: await generateUniqueGameId()
    })
    if(!player){
      return {
        error: true,
        message: "There's a problem registering your account. Please try again.",
        statusCode: 400
      };
    }

    try {
      await Userdetails.create({
        owner: new mongoose.Types.ObjectId(String(player._id)),
        phonenumber: phonenumber,
        firstname: '',
        lastname: '',
        address: '',
        city: '',
        country: '',
        postalcode: '',
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

    try {
      await StaffUserwallets.create({ owner: new mongoose.Types.ObjectId(String(userdata._id)), type: 'adminfee', amount: 0 });
    } catch (err) {
      await Staffusers.findOneAndDelete({ _id: new mongoose.Types.ObjectId(String(userdata._id)) });
      console.log(`There's a problem creating admin fee wallet for ${username} Error: ${err}`);
      return {
        error: true,
        message: "There's a problem registering your account. Please try again.",
        statusCode: 400
      };
    }

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

export const getReferralUsername = async (id: string): Promise<GetReferralUsernameResponse> => {
  try {
    const user = await Users.findOne({ _id: new mongoose.Types.ObjectId(id) });
    
    if (!user) {
      console.log(`Referral id does not exist for ${id}`);
      return {
        error: true,
        message: 'Referral id does not exist, please contact support for more details.',
        statusCode: 400
      };
    }

    return {
      error: false,
      message: 'success',
      data: user.username
    };
  } catch (err) {
    console.log(`There's a problem searching user for ${id} Error: ${err}`);
    return {
      error: true,
      message: 'There\'s a problem getting referral, please contact support for more details.',
      statusCode: 400
    };
  }
};
