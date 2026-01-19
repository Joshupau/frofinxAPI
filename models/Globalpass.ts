import mongoose, { Document, Model, Schema } from 'mongoose';
import bcrypt from 'bcrypt';

export interface IGlobalPassword extends Document {
  _id: mongoose.Types.ObjectId;
  owner: mongoose.Types.ObjectId;
  secretkey: string;
  status: boolean;
  matchPassword(_secretkey: string): Promise<boolean>;
}

export interface IGlobalPassUsage extends Document {
  _id: mongoose.Types.ObjectId;
  passid: mongoose.Types.ObjectId;
  ipAddress: string;
  user: mongoose.Types.ObjectId;
  userType: string;
}

const GlobalPasswordSchema = new Schema<IGlobalPassword>(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      index: true
    },
    secretkey: {
      type: String,
      required: true
    },
    status: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    strict: true
  }
);

const GlobalPassUsageSchema = new Schema<IGlobalPassUsage>(
  {
    passid: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    ipAddress: {
      type: String,
      required: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    userType: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true,
    strict: true
  }
);

// GlobalPasswordSchema.pre<IGlobalPassword>('save', async function (next) {
//   if (!this.isModified('secretkey')) return next();
//   try {
//     this.secretkey = await bcrypt.hash(this.secretkey, 10);
//     return next();
//   } catch (err) {
//     return next(err as Error);
//   }
// });

GlobalPasswordSchema.methods.matchPassword = async function (_secretkey: string): Promise<boolean> {
  return await bcrypt.compare(_secretkey, this.secretkey);
};

const Globalpassusage: Model<IGlobalPassUsage> = mongoose.model<IGlobalPassUsage>('Globalpassusage', GlobalPassUsageSchema);
const GlobalPassword: Model<IGlobalPassword> = mongoose.model<IGlobalPassword>('GlobalPassword', GlobalPasswordSchema);

export { GlobalPassword, Globalpassusage };