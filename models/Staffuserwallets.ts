import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IStaffUserwallet extends Document {
  _id: mongoose.Types.ObjectId;
  owner: mongoose.Types.ObjectId;
  type: string;
  amount: number;
}

const StaffUserwalletsSchema = new Schema<IStaffUserwallet>(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      index: true
    },
    type: {
      type: String,
      index: true
    },
    amount: {
      type: Number
    }
  },
  {
    timestamps: true,
    strict: true
  }
);

const StaffUserwallets: Model<IStaffUserwallet> = mongoose.model<IStaffUserwallet>('StaffUserwallets', StaffUserwalletsSchema);
export default StaffUserwallets;
