export interface BanUnbanUserBody {
    status: string;
    staffusername: string;
}

export interface MultipleBanStaffUsersBody {
    staffuserlist: string[];
    status: string;
}

export interface GetAdminListQuery {
    page?: string;
    limit?: string;
    search?: string;
}

export interface UpdateAdminBody {
    staffusername: string;
    password: string;
}

export interface ChangePassBody {
    password: string;
}

export interface SearchAdminListQuery {
    adminusername: string;
    page?: string;
    limit?: string;
}

export interface StaffUserServiceResponse {
    error: boolean;
    message?: string;
    data?: any;
    statusCode?: number;
}
