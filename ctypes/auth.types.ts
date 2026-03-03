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
    banreason?: string;
    bandate?: string;
  };
  statusCode?: number;
}

export interface AuthRegisterBody {
  username: string;
  password: string;
  phonenumber?: string;
  firstname?: string;
  lastname?: string;
  address?: string;
  city?: string;
  country?: string;
  postalcode?: string;
  profilepicture?: string;
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

export interface OAuthProfile {
  id: string;
  providerId: string;
  email?: string;
  name?: string;
  provider: 'google' | 'facebook';
}

export interface OAuthServiceResponse {
  error: boolean;
  message?: string;
  data?: {
    token: string;
    auth: string;
    username?: string;
    userid?: string;
  };
  statusCode?: number;
}

// Referral utilities removed
