import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IBill extends Document {
  _id: mongoose.Types.ObjectId;
  owner: mongoose.Types.ObjectId;
  name: string;
  amount: number;
  category?: mongoose.Types.ObjectId;
  dueDate: Date;
  isRecurring: boolean;
  recurringFrequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  paymentStatus: 'paid' | 'unpaid' | 'overdue' | 'partial';
  paidAmount?: number;
  wallet?: mongoose.Types.ObjectId;
  reminder: boolean;
  reminderDays?: number; // days before due date
  notes?: string;
  status: 'active' | 'archived';
  lastPaidDate?: Date;
  nextDueDate?: Date; // for recurring bills
  parentBillId?: mongoose.Types.ObjectId; // for recurring bills, reference to the original recurring bill
  transaction?: mongoose.Types.ObjectId; // linked pending transaction
  createdAt?: Date;
  updatedAt?: Date;
}

const BillSchema = new Schema<IBill>(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true, index: true },
    name: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Categories', index: true },
    dueDate: { type: Date, required: true, index: true },
    isRecurring: { type: Boolean, required: true, default: false, index: true },
    recurringFrequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'] },
    paymentStatus: { type: String, required: true, default: 'unpaid', enum: ['paid', 'unpaid', 'overdue', 'partial'], index: true },
    paidAmount: { type: Number, default: 0 },
    wallet: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallets', index: true },
    reminder: { type: Boolean, default: true },
    reminderDays: { type: Number, default: 3 },
    notes: { type: String },
    status: { type: String, required: true, default: 'active', enum: ['active', 'archived'], index: true },
    lastPaidDate: { type: Date },
    nextDueDate: { type: Date },
    parentBillId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bills', index: true },
    transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transactions' }
  },
  {
    timestamps: true,
    strict: true
  }
);

// Compound indexes for common queries
BillSchema.index({ owner: 1, dueDate: 1, paymentStatus: 1 });
BillSchema.index({ owner: 1, isRecurring: 1, status: 1 });
BillSchema.index({ owner: 1, status: 1, paymentStatus: 1 });

const Bills: Model<IBill> = mongoose.models.Bills || mongoose.model<IBill>('Bills', BillSchema);
export default Bills;
