import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IObligation extends Document {
  _id: mongoose.Types.ObjectId;
  owner: mongoose.Types.ObjectId;
  direction: 'debt' | 'lending';
  name: string;
  counterparty: string;
  counterpartyContact?: string;
  principalAmount: number;
  remainingBalance: number;
  currency: string;
  interestRate?: number;
  interestType?: 'simple' | 'compound';
  totalWithInterest?: number;
  startDate: Date;
  dueDate?: Date;
  wallet?: mongoose.Types.ObjectId;
  category?: mongoose.Types.ObjectId;
  notes?: string;
  tags: string[];
  status: 'active' | 'partially_paid' | 'settled' | 'defaulted' | 'archived';
  isInstallment: boolean;
  installmentAmount?: number;
  totalInstallments?: number;
  paidInstallments: number;
  installmentFrequency?: 'weekly' | 'monthly' | 'yearly';
  bills: mongoose.Types.ObjectId[];
  disbursementTransaction?: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const ObligationSchema = new Schema<IObligation>(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true, index: true },
    direction: { type: String, required: true, enum: ['debt', 'lending'], index: true },
    name: { type: String, required: true, index: true },
    counterparty: { type: String, required: true },
    counterpartyContact: { type: String },
    principalAmount: { type: Number, required: true },
    remainingBalance: { type: Number, required: true },
    currency: { type: String, default: 'PHP' },
    interestRate: { type: Number },
    interestType: { type: String, enum: ['simple', 'compound'] },
    totalWithInterest: { type: Number },
    startDate: { type: Date, required: true },
    dueDate: { type: Date, index: true },
    wallet: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallets', index: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Categories', index: true },
    notes: { type: String },
    tags: [{ type: String }],
    status: {
      type: String,
      required: true,
      default: 'active',
      enum: ['active', 'partially_paid', 'settled', 'defaulted', 'archived'],
      index: true
    },
    isInstallment: { type: Boolean, required: true, default: false, index: true },
    installmentAmount: { type: Number },
    totalInstallments: { type: Number },
    paidInstallments: { type: Number, default: 0 },
    installmentFrequency: { type: String, enum: ['weekly', 'monthly', 'yearly'] },
    bills: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Bills' }],
    disbursementTransaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transactions' }
  },
  {
    timestamps: true,
    strict: true
  }
);

ObligationSchema.index({ owner: 1, direction: 1, status: 1 });
ObligationSchema.index({ owner: 1, isInstallment: 1, status: 1 });
ObligationSchema.index({ owner: 1, dueDate: 1, status: 1 });

const Obligations: Model<IObligation> = mongoose.models.Obligations || mongoose.model<IObligation>('Obligations', ObligationSchema);
export default Obligations;
