// Extend Express Request to include user property from JWT middleware
declare namespace Express {
  export interface Request {
    user?: {
      id: string;
      username: string;
      auth: string;
      token: string;
    };
    validatedQuery?: any;
    validatedBody?: any;
  }
}
