## Node.js + TypeScript best practices (for pair programming with the assistant)

This document lists concise, actionable coding practices that the assistant and maintainers should follow when editing this repository. It's designed to match the existing codebase patterns.

### Contract (inputs / outputs / error modes)
- Inputs: well-typed objects (use TypeScript interfaces), validated external data (requests, env vars, config files).
- Outputs: Controllers return consistent JSON shape `{ message: "success"|"failed"|"error", data: any }`. Services return `{ error: boolean, message?: string, data?: any, statusCode?: number }`.
- Error modes: Services return error objects `{ error: true, message: string, statusCode?: number }`. Controllers check `result.error` and respond accordingly, or pass exceptions to `next(err)` for global error handler. Error handler responds with `{ status: "error", message: string, details?: any }`.

### Top-level rules
- **TypeScript migration in progress**: New files should use `.ts` extension with proper interfaces and type safety.
- Keep changes minimal and focused: modify only files required by a change.
- Follow existing repository style (ESLint in repo). Run lint and tests locally before committing.
- Never commit secrets or private keys. Use environment variables and validate them at startup.

### Project structure (actual)
- `/controllers` - express route handlers (thin; delegate to services, catch errors with next(err))
- `/cservice` - business logic and database operations
- `/cvalidator` - request validation middleware (validate before controller)
- `/ctypes` - TypeScript type definitions and interfaces (shared types, request/response interfaces)
- `/models` - Mongoose models with TypeScript interfaces (use Document, Model, Schema from mongoose)
- `/routes` - express route definitions (import controller + validation + middleware)
- `/middleware` - auth middleware (protectsuperadmin, protectadmin, protectuser) and global error handler
- `/utils` - reusable helpers (error.ts, paginate.ts, password.ts)
- `/keys` - RSA keys for JWT signing/verification

### TypeScript patterns (CRITICAL - follow these exactly)

**Types** (shared interfaces in `/ctypes`):
```typescript
// ctypes/auth.types.ts - request/response types
export interface AuthLoginBody {
    username: string;
    password: string;
    ipAddress?: string;
}

export interface AuthServiceResponse {
    error: boolean;
    message?: string;
    data?: {
        token: string;
        auth: string;
    };
    statusCode?: number;
}
```

**Models** (use TypeScript always):
```typescript
import mongoose, { Document, Model, Schema } from 'mongoose';
import bcrypt from 'bcrypt';

// 1. Define interface extending Document
export interface IModelName extends Document {
  fieldName: string;
  optionalField?: string;
  referenceField?: mongoose.Types.ObjectId;
  matchPassword?(candidate: string): Promise<boolean>; // for auth models
}

// 2. Create schema with generic
const ModelSchema = new Schema<IModelName>(
  {
    fieldName: { type: String, required: true, index: true },
    optionalField: { type: String },
    referenceField: { type: mongoose.Schema.Types.ObjectId, ref: 'OtherModel', index: true }
  },
  {         timestamps: true,
        strict: true }
);

// 3. Add methods if needed
ModelSchema.methods.matchPassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

// 4. Pre-save hooks (for password hashing, etc)
ModelSchema.pre<IModelName>('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    this.password = await bcrypt.hash(this.password, 10);
    return next();
  } catch (err) {
    return next(err as Error);
  }
});

// 5. Export with proper typing (prevents dual model registration)
const ModelName: Model<IModelName> = mongoose.models.ModelName || mongoose.model<IModelName>('ModelName', ModelSchema);
export default ModelName;
```

**Utils** (reusable functions in TypeScript):
```typescript
// utils/password.ts - password helpers
import bcrypt from 'bcrypt';
export const encrypt = async (password: string): Promise<string> => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
}

// utils/paginate.ts - pagination helper
export const pageOptions = (page: string, limit: string) => {
    return {
        limit: parseInt(limit) || 10,
        page: parseInt(page) || 0,
        skip: (parseInt(page) || 0) * (parseInt(limit) || 10)
    };
};

// utils/error.ts - error type guards and converters
export interface AppError {
    message: string;
    status?: number;
    code?: string;
}
export function isError(err: unknown): err is Error {
    return typeof err === 'object' && err !== null && 'message' in err;
}
export function toAppError(err: unknown): AppError {
    if (isError(err)) return { message: err.message, status: (err as any).status ?? 500 };
    if (typeof err === 'string') return { message: err, status: 500 };
    return { message: 'Unknown error', status: 500 };
}
```

**Controllers** (TypeScript - delegate to services, handle errors):
```typescript
import type { Request, Response, NextFunction } from 'express';
import type { AuthLoginBody, AuthServiceResponse } from '../ctypes/auth.types';
import * as serviceName from '../cservice/serviceName.service';

exports.controllerName = async (req: Request<{}, {}, AuthLoginBody, {}>, res: Response, next: NextFunction) => {
    const { field1, field2 } = req.body; // or req.query for GET
    const { id, username } = req.user; // from auth middleware
    
    try {
        const data = await serviceName.methodName(id, field1, field2);
        return res.status(200).json({ message: "success", data });
    } catch (err) {
        next(err); // pass to global error handler
    }
};
```

**Services** (TypeScript - business logic, return { error, message, data } format):
```typescript
import mongoose from 'mongoose';
import ModelName from '../models/ModelName';
import type { ServiceResponse } from '../ctypes/service.types';
import { pageOptions } from '../utils/paginate';
import { encrypt } from '../utils/password';

exports.methodName = async (id: string, field1: string, field2: string): Promise<ServiceResponse> => {
    // Business logic with proper error handling
    const data = await ModelName.create({
        owner: new mongoose.Types.ObjectId(id),
        field1: field1
    });
    
    return {
        error: false,
        message: "Created successfully",
        data: data
    };
};

exports.listWithPagination = async (page: string, limit: string) => {
    const options = pageOptions(page, limit);
    
    const items = await ModelName.aggregate([
        { $lookup: { from: "othercollection", localField: "field", foreignField: "_id", as: "joined" } },
        { $sort: { createdAt: -1 } },
        { $skip: options.skip },
        { $limit: options.limit }
    ]);
    
    const total = await ModelName.countDocuments({});
    const totalPages = Math.ceil(total / options.limit);
    
    return {
        error: false,
        data: {
            totalPages,
            items: items.map(item => ({ id: item._id, ...item }))
        }
    };
};
```

**Controllers handle service responses**:
```typescript
exports.controllerName = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await serviceName.methodName(id, field1, field2);
        
        if (result.error) {
            const statusCode = result.statusCode || 400;
            return res.status(statusCode).json({ message: "failed", data: result.message });
        }
        
        return res.status(200).json({ message: "success", data: result.data });
    } catch (err) {
        next(err);
    }
};
```

**Validators** (TypeScript - basic validation before controller):
```typescript
import type { Request, Response, NextFunction } from 'express';

exports.validatorName = async (req: Request, res: Response, next: NextFunction) => {
    const { id, username } = req.user;
    const { field1 } = req.body;
    
    if (!id) return res.status(400).json({ message: "Unauthorized", data: "You are not authorized." });
    if (!field1) return res.status(400).json({ message: "failed", data: "Please input field1." });
    
    next(); // continue to controller
};
```

### Routing patterns (CRITICAL - follow exactly)

**Route definition** (in `/routes` folder):
```javascript
const { protectsuperadmin, protectadmin, protectuser } = require("../middleware/middleware");
const ctrl = require("../controllers/controllerName");
const validation = require("../cvalidator/validationName.validation");

const router = require('express').Router();

const routeName = router
    .post("/create", protectsuperadmin, validation.create, ctrl.create)
    .get("/", protectsuperadmin, ctrl.list) // for list or single by ?id=
    .post("/update", protectsuperadmin, validation.update, ctrl.update)
    .post("/delete", protectsuperadmin, ctrl.delete);

const adminRouteName = router
		.get("/admin/mydata", protectadmin, ctrl.getMyData)
		.post("/admin/changepassword", protectadmin, validation.changePassword, ctrl.changePassword);

const userRouteName = router
		.get("/user/mydata", protectuser, ctrl.getMyData)
		.post("/user/changepassword", protectuser, validation.changePassword, ctrl.changePassword);

	
module.exports = routeName;
```

**Key routing rules**:
- Use query parameters for GET requests: `/api/v1/resource?id=123&page=1&limit=10`
- Use body for POST requests: `/api/v1/resource/create` with `{ field1: "value" }`
- **Never use params** like `/resource/:id` - always use query `?id=` or body
- Middleware order: `protectsuperadmin/protectadmin/protectuser` → `validation` → `controller`
- Controllers are thin - delegate to services

### Middleware patterns

**Auth middleware** (JWT verification with RSA keys):
```javascript
const fs = require('fs');
const path = require("path");
const publicKey = fs.readFileSync(path.resolve(__dirname, "../keys/public-key.pem"), 'utf-8');
const jsonwebtokenPromisified = require('jsonwebtoken-promisified');

const verifyJWT = async (token) => {
    const decoded = await jsonwebtokenPromisified.verify(token, publicKey, { algorithms: ['RS256'] });
    return decoded;
};

exports.protectsuperadmin = async (req, res, next) => {
    const token = req.headers.cookie?.split('; ').find(row => row.startsWith('sessionToken='))?.split('=')[1];
    
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized', data: "You are not authorized to view this page." });
    }
    
    try {
        const decodedToken = await verifyJWT(token);
        
        if (decodedToken.auth != "superadmin") {
            return res.status(401).json({ message: 'Unauthorized', data: "You are not authorized." });
        }
        
        const user = await Staffusers.findOne({ username: decodedToken.username });
        
        if (!user || user.status != "active") {
            res.clearCookie('sessionToken', { path: '/' });
            return res.status(401).json({ message: 'failed', data: `Account ${user?.status || 'not found'}.` });
        }
        
        if (decodedToken.token != user.webtoken) {
            res.clearCookie('sessionToken', { path: '/' });
            return res.status(401).json({ message: 'duallogin', data: 'Opened on another device.' });
        }
        
        req.user = decodedToken;
        next();
    } catch (ex) {
        return res.status(401).json({ message: 'Unauthorized', data: "Not authorized." });
    }
};
```

**Global error handler**:
```javascript
const globalErrorHandler = (err, req, res, next) => {
  console.error('Global error handler:', err);
  if (res.headersSent) return next(err);

  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';
  let details = err.details || undefined;
  let data = undefined;

  if (err.name === 'ValidationError' || err.name === 'BadRequestError') {
    statusCode = 400;
    message = 'Validation Error';
    details = err.errors || err.details || err.message;
  }

  if (err.isOperational) {
    statusCode = err.statusCode || 400;
    message = err.message;
  }

  if (statusCode === 500) {
    data = 'bad-request';
    message = "There's a problem with the server! Please contact support.";
    details = undefined;
  }

  const response = { status: 'error', message };
  if (data) response.data = data;
  if (details) response.details = details;
  if (process.env.NODE_ENV === 'development' && err.stack) response.stack = err.stack;

  res.status(statusCode).json(response);
};
module.exports = globalErrorHandler;
```

### JSON Response patterns (CRITICAL)

**Always use these exact message values**:
- `{ message: "success", data: any }` - for successful operations
- `{ message: "failed", data: string }` - for client errors (validation, auth)
- `{ message: "error", data: string, details?: any }` - for server errors (from global handler)
- `{ message: "Unauthorized", data: string }` - for auth failures
- `{ message: "duallogin", data: string }` - for dual login detection

**Never use** `{ success: true/false }` - use `message` field instead.

### Import patterns

**TypeScript files** (models, utils, controllers, services, validators):
```typescript
import mongoose, { Document, Model, Schema } from 'mongoose';
import bcrypt from 'bcrypt';
import type { Request, Response, NextFunction } from 'express';
import ModelName from '../models/ModelName';
import * as serviceName from '../cservice/serviceName.service';
import { encrypt } from '../utils/password';
import { pageOptions } from '../utils/paginate';
import type { AuthServiceResponse } from '../ctypes/auth.types';
```

**JavaScript files** (routes, legacy middleware):
```javascript
const { ModelName } = require("../models/ModelName");
const serviceName = require("../cservice/serviceName.service");
const { protectsuperadmin } = require("../middleware/middleware");
```

**Organize imports**:
1. External libraries (express, mongoose, bcrypt, etc)
2. Local models
3. Local services
4. Local middleware/utils
5. Keep at top of file

### Additional patterns from your codebase

**Aggregation queries** (use for complex joins):
```typescript
const items = await ModelName.aggregate([
    { $lookup: { from: "users", localField: "user", foreignField: "_id", as: "userDetails" } },
    { $lookup: { from: "staffusers", localField: "user", foreignField: "_id", as: "staffUserDetails" } },
    { $addFields: { 
        user: { 
            $cond: { 
                if: { $eq: ["$userType", "Staffusers"] },
                then: { $arrayElemAt: ["$staffUserDetails.username", 0] },
                else: { $arrayElemAt: ["$userDetails.username", 0] }
            }
        }
    }},
    { $project: { field1: 1, field2: 1, createdAt: 1 } },
    { $sort: { createdAt: -1 } },
    { $skip: options.skip },
    { $limit: options.limit }
]);
```

**Pagination response format**:
```typescript
return {
    totalPages,
    items: items.map(item => ({ id: item._id, ...item }))
};
```

**Password operations**:
- Use `encrypt()` from utils/password.ts for hashing passwords before storing
- Use `model.matchPassword(candidate)` method for comparing passwords
- Never store plain text passwords

**ObjectId creation**:
```typescript
new mongoose.Types.ObjectId(id) // when creating references
```

**Status updates** (disable old, enable new):
```typescript
await ModelName.updateMany({ status: true }, { status: false }); // disable all
await ModelName.create({ ...data, status: true }); // create new as active
```

**Cookie handling**:
```typescript
// Extract token from cookie
const token = req.headers.cookie?.split('; ').find(row => row.startsWith('sessionToken='))?.split('=')[1];

// Clear cookie on logout/error
res.clearCookie('sessionToken', { path: '/' });

// Set cookie
res.cookie('sessionToken', jwtoken, { secure: true, sameSite: 'None' });
```

**Error handling in controllers**:
- Always wrap service calls in try-catch
- Pass errors to `next(err)` to reach global error handler
- Never throw errors directly in controllers

**Type safety for unknown errors**:
```typescript
import { toAppError } from '../utils/error';

catch (err) {
    const appErr = toAppError(err);
    console.error('Error:', appErr.message);
    next(err);
}
```

### Coding style
- Use async/await for asynchronous code; avoid mixing with callbacks.
- Prefer small pure functions and single-responsibility modules.
- Use descriptive names; keep functions < ~200 lines and modules focused.
- Add JSDoc comments to exported functions (brief param/return notes) when not self-evident.

### Linting, formatting, and commits
- Use ESLint (repo contains config). Fix lint errors before push.
- Use Prettier or a consistent formatter configured in editor. Format automatically on save or via pre-commit hook.
- Write small commits with clear messages and reference issue/ticket IDs when applicable.

### Security
- Load secrets from env vars (process.env) and validate them at startup. Fail fast if a required secret is missing.
- Sanitize and validate all user input (use `validator`, `joi`, or `zod`).
- Use `helmet` for HTTP headers and `express-rate-limit` to mitigate brute force.
- Hash passwords with a proven algorithm (bcrypt / argon2) and use a per-user salt.
- Keep dependencies up to date and run periodic dependency checks (npm audit, Snyk).

### Dependency and environment management
- Commit lockfile (package-lock.json / pnpm-lock.yaml) and use a single package manager across the team.
- Document required env variables in `.env.example` and validate them at startup.

### Pull request checklist (for the assistant and maintainers)
1. Code compiles and passes linting.
2. Tests added/updated and pass.
3. No secrets checked in.
4. API changes documented (README or route comments).
5. Small, focused commits and clear PR description.

### How the assistant should behave when making changes
- Create small, focused edits and run lint/tests locally (or state if unable).
- Include or update tests when changing behavior.
- Explain the intent and list files changed in the PR description.
- Don't reorder or reformat unrelated files unless requested.

### Edge cases to watch for
- Missing or invalid env vars at startup.
- Long-running requests or unbounded memory use.
- Partial failures when multiple async operations occur concurrently.

---
Generated as a concise reference to follow when editing this repository.
