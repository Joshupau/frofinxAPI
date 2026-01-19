export interface AuthLoginBody {
  username: string;
  password: string;
  ipAddress: string;
}

export interface AuthServiceResponse {
  error: boolean;
  message: string;
  data: {
    token: string;
    auth: string;
    fullname?: string;
    username?: string;
    userid?: string;
  };
  statusCode?: number;
}

export interface AuthRegisterBody {
  username: string;
  password: string;
  referral: string;
  phonenumber: string;
}

export interface AuthRegisterStaffBody {
  username: string;
  password: string;
}

export interface SimpleServiceResponse {
  error: boolean;
  message?: string;
  data?: any;
  statusCode?: number;
}

export interface GetReferralUsernameQuery {
  id: string;
}

export interface GetReferralUsernameResponse {
  error: boolean;
  message?: string;
  data?: string;
  statusCode?: number;
}
