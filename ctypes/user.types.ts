export interface GetUserDetailsSuperadminQuery {
    userid: string;
}

export interface ChangePasswordUserBody {
    password: string;
}

export interface ChangePasswordUserForAdminBody {
    playerid: string;
    password: string;
}

export interface UpdateUserProfileBody {
    phonenumber?: string;
    firstname?: string;
    lastname?: string;
    address?: string;
    city?: string;
    country?: string;
    postalcode?: string;
    paymentmethod?: string;
    accountnumber?: string;
}

export interface SearchPlayerListQuery {
    playerusername: string;
    page?: string;
    limit?: string;
}

export interface GetPlayerListQuery {
    page?: string;
    limit?: string;
    search?: string;
}

export interface BanUnbanUserBody {
    status: string;
    userid: string;
}

export interface MultipleBanUsersBody {
    userlist: string[];
    status: string;
}

export interface UserServiceResponse {
    error: boolean;
    message?: string;
    data?: any;
    statusCode?: number;
}
