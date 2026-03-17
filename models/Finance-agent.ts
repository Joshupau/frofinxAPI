import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IFinanceAgent extends Document {
    _id: mongoose.Types.ObjectId;
    owner: mongoose.Types.ObjectId;
    walletId: mongoose.Types.ObjectId;
    category: string;
    description: string;
    createdAt: Date;
    updatedAt: Date;
}

const FinanceAgentSchema = new Schema<IFinanceAgent>(
    {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    walletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', required: true },
    category: { type: String, required: true },
    description: { type: String, required: true }
    },  
    { timestamps: true }
);

const FinanceAgent: Model<IFinanceAgent> = mongoose.model<IFinanceAgent>('FinanceAgent', FinanceAgentSchema);

export default FinanceAgent;