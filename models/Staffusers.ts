import mongoose, { Document, Model, Schema } from 'mongoose';
import bcrypt from 'bcrypt';

export interface IStaffuser extends Document {
  _id: mongoose.Types.ObjectId;
  username: string;
  password: string;
  status: string;
  webtoken?: string;
  auth: string;
  matchPassword(_candidate: string): Promise<boolean>;
  createdAt: Date;
  updatedAt: Date;
}

const StaffUsersSchema = new Schema<IStaffuser>(
    {
        username: {
            type: String
        },
        password: {
            type: String
        },
        webtoken: {
            type: String
        },
        status: {
            type: String,
            default: "active"
        },
        auth: {
            type: String
        }
    },
    {
        timestamps: true,
        strict: true
    }
)

StaffUsersSchema.pre<IStaffuser>('save', async function (next) {
    if (!this.isModified('password')) return next();
    try {
        this.password = await bcrypt.hash(this.password, 10);
        return next();
    } catch (err) {
        return next(err as Error);
    }
});

StaffUsersSchema.methods.matchPassword = async function (_password: string): Promise<boolean> {
    return await bcrypt.compare(_password, this.password);
};

const Staffusers: Model<IStaffuser> = mongoose.model<IStaffuser>("Staffusers", StaffUsersSchema)
export default Staffusers