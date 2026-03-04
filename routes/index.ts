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
import passport from 'passport';

interface AppInterface {
  use: (_path: string, ..._middlewares: any[]) => any;
}

type Routers = (_app: AppInterface) => void;
const routers: Routers = (_app: AppInterface) => {
  console.log('Routers are all available');

  _app.use('/auth', authRouter);
  _app.use('/global-password', passport.authenticate('jwt', { session: false }), globalPassRouter);
  _app.use('/user', passport.authenticate('jwt', { session: false }), userRouter);
  _app.use('/maintenance', maintenanceRouter);
  _app.use('/staffuser', passport.authenticate('jwt', { session: false }), staffUserRouter);
  
  // Finance tracker routes
  _app.use('/category', passport.authenticate('jwt', { session: false }), categoriesRouter);
  _app.use('/wallet', passport.authenticate('jwt', { session: false }), walletsRouter);
  _app.use('/transaction', passport.authenticate('jwt', { session: false }), transactionsRouter);
  _app.use('/bill', passport.authenticate('jwt', { session: false }), billsRouter);
  _app.use('/budget', passport.authenticate('jwt', { session: false }), budgetsRouter);

};

export default routers;

