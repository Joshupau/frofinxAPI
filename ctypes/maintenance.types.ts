
export interface ChangeMaintenanceBody {
    type: string;
    value: string;
}

export interface GetEventMainteQuery {
    maintenancetype: string;
}

export interface MaintenanceServiceResponse {
    error: boolean;
    message?: string;
    data?: any;
    statusCode?: number;
}