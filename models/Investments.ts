import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IValueSnapshot {
  value: number;
  date: Date;
  notes?: string;
}

export interface IInvestment extends Document {
  _id: mongoose.Types.ObjectId;
  owner: mongoose.Types.ObjectId;
  name: string;
  type: 'stocks' | 'bonds' | 'mutual_funds' | 'crypto' | 'real_estate' | 'savings' | 'other';
  principalAmount: number;
  currentValue: number;
  currency: string;
  platform?: string;
  wallet?: mongoose.Types.ObjectId;
  category?: mongoose.Types.ObjectId;
  startDate: Date;
  maturityDate?: Date;
  expectedReturnRate?: number;
  dividendsReceived: number;
  notes?: string;
  tags: string[];
  status: 'active' | 'matured' | 'sold' | 'archived';
  valueHistory: IValueSnapshot[];
  fundingTransaction?: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const ValueSnapshotSchema = new Schema<IValueSnapshot>(
  {
    value: { type: Number, required: true },
    date: { type: Date, required: true },
    notes: { type: String }
  },
  { _id: false }
);

const InvestmentSchema = new Schema<IInvestment>(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true, index: true },
    name: { type: String, required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: ['stocks', 'bonds', 'mutual_funds', 'crypto', 'real_estate', 'savings', 'other'],
      index: true
    },
    principalAmount: { type: Number, required: true },
    currentValue: { type: Number, required: true },
    currency: { type: String, default: 'PHP' },
    platform: { type: String },
    wallet: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallets', index: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Categories', index: true },
    startDate: { type: Date, required: true },
    maturityDate: { type: Date },
    expectedReturnRate: { type: Number },
    dividendsReceived: { type: Number, default: 0 },
    notes: { type: String },
    tags: [{ type: String }],
    status: {
      type: String,
      required: true,
      default: 'active',
      enum: ['active', 'matured', 'sold', 'archived'],
      index: true
    },
    valueHistory: [ValueSnapshotSchema],
    fundingTransaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transactions' }
  },
  {
    timestamps: true,
    strict: true
  }
);

InvestmentSchema.index({ owner: 1, type: 1, status: 1 });
InvestmentSchema.index({ owner: 1, status: 1, startDate: -1 });

const Investments: Model<IInvestment> = mongoose.models.Investments || mongoose.model<IInvestment>('Investments', InvestmentSchema);
export default Investments;
