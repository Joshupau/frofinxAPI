import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ITransaction extends Document {
  _id: mongoose.Types.ObjectId;
  owner: mongoose.Types.ObjectId;
  wallet: mongoose.Types.ObjectId;
  category?: mongoose.Types.ObjectId;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  description?: string;
  date: Date;
  attachments: string[]; // file paths or URLs
  bill?: mongoose.Types.ObjectId; // linked bill if this is a bill payment
  tags: string[];
  toWallet?: mongoose.Types.ObjectId; // for transfer type
  serviceFee?: number; // service fee for transfers
  serviceFeeDeducted?: boolean; // whether the service fee was immediately deducted from the wallet
  status: 'completed' | 'pending' | 'cancelled';
  createdAt?: Date;
  updatedAt?: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true, index: true },
    wallet: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallets', required: true, index: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Categories', index: true },
    amount: { type: Number, required: true },
    type: { type: String, required: true, enum: ['income', 'expense', 'transfer'], index: true },
    description: { type: String },
    date: { type: Date, required: true, index: true },
    attachments: [{ type: String }],
    bill: { type: mongoose.Schema.Types.ObjectId, ref: 'Bills', index: true },
    tags: [{ type: String }],
    toWallet: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallets' },
    serviceFee: { type: Number, default: 0 },
    serviceFeeDeducted: { type: Boolean, default: false },
    status: { type: String, required: true, default: 'completed', enum: ['completed', 'pending', 'cancelled'], index: true }
  },
  {
    timestamps: true,
    strict: true
  }
);

// Compound indexes for common queries
TransactionSchema.index({ owner: 1, date: -1 });
TransactionSchema.index({ owner: 1, wallet: 1, status: 1 });
TransactionSchema.index({ owner: 1, category: 1, date: -1 });
TransactionSchema.index({ owner: 1, type: 1, date: -1 });

const Transactions: Model<ITransaction> = mongoose.models.Transactions || mongoose.model<ITransaction>('Transactions', TransactionSchema);
export default Transactions;
