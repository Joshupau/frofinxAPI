import authRouter from './auth.js';
import globalPassRouter from './globalpass.js';
import userRouter from './user.js';
import maintenanceRouter from './maintenance.js';
import staffUserRouter from './staffuser.js';
import categoriesRouter from './categories.js';
import walletsRouter from './wallets.js';
import transactionsRouter from './transactions.js';
import billsRouter from './bills.js';
import budgetsRouter from './budgets.js';

interface AppInterface {
  use: (_path: string, _router: any) => any;
}

type Routers = (_app: AppInterface) => void;

const routers: Routers = (_app: AppInterface) => {
  console.log('Routers are all available');

  _app.use('/auth', authRouter);
  _app.use('/global-password', globalPassRouter);
  _app.use('/user', userRouter);
  _app.use('/maintenance', maintenanceRouter);
  _app.use('/staffuser', staffUserRouter);
  
  // Finance tracker routes
  _app.use('/category', categoriesRouter);
  _app.use('/wallet', walletsRouter);
  _app.use('/transaction', transactionsRouter);
  _app.use('/bill', billsRouter);
  _app.use('/budget', budgetsRouter);

};

export default routers;

