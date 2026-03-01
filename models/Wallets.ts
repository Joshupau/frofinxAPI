import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IWallet extends Document {
  _id: mongoose.Types.ObjectId;
  owner: mongoose.Types.ObjectId;
  name: string;
  type: 'bank' | 'cash' | 'ewallet' | 'credit_card' | 'other';
  balance: number;
  currency: string;
  icon?: string;
  color?: string;
  description?: string;
  accountNumber?: string; // for bank accounts
  status: 'active' | 'archived';
  createdAt?: Date;
  updatedAt?: Date;
}

const WalletSchema = new Schema<IWallet>(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true, index: true },
    name: { type: String, required: true, index: true },
    type: { type: String, required: true, enum: ['bank', 'cash', 'ewallet', 'credit_card', 'other'], default: 'cash' },
    balance: { type: Number, required: true, default: 0 },
    currency: { type: String, required: true, default: 'PHP', index: true },
    icon: { type: String },
    color: { type: String },
    description: { type: String },
    accountNumber: { type: String },
    status: { type: String, required: true, default: 'active', enum: ['active', 'archived'], index: true }
  },
  {
    timestamps: true,
    strict: true
  }
);

// Compound index for user wallet lookups
WalletSchema.index({ owner: 1, status: 1 });

const Wallets: Model<IWallet> = mongoose.models.Wallets || mongoose.model<IWallet>('Wallets', WalletSchema);
export default Wallets;
