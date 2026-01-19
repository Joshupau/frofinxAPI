import mongoose, { Document, Model, Schema } from 'mongoose';
import bcrypt from 'bcrypt';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  username: string;
  password: string;
  status: string;
  webtoken?: string;
  referral?: mongoose.Types.ObjectId;
  gametoken?: string;
  bandate?: string;
  banreason?: string;
  matchPassword(_candidate: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
   {
    username: { type: String, required: true, index: true },
    password: { type: String, required: true },
    status: { type: String, required: true, default: 'active', index: true },
    webtoken: { type: String, index: true },
    referral: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', index: true },
    gametoken: { type: String },
    bandate: { type: String },
    banreason: { type: String }
  },
  {         
    timestamps: true,
    strict: true 
  }
);

UserSchema.pre<IUser>('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    this.password = await bcrypt.hash(this.password, 10);
    return next();
  } catch (err) {
    return next(err as Error);
  }
});

UserSchema.methods.matchPassword = async function (_candidate: string): Promise<boolean> {
  return bcrypt.compare(_candidate, this.password);
};

const Users: Model<IUser> = mongoose.models.Users || mongoose.model<IUser>('Users', UserSchema);
export default Users;
