import mongoose, { Document, Model, Schema } from 'mongoose';
import bcrypt from 'bcrypt';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  username: string;
  password: string;
  status: string;
  webtoken?: string;
  gameid?: string;
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



const Users: Model<IUser> = mongoose.models.Users || mongoose.model<IUser>('Users', UserSchema);
export default Users;

