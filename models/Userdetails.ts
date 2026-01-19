import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IUserdetail extends Document {
  _id: mongoose.Types.ObjectId;
  owner: mongoose.Types.ObjectId;
  phonenumber?: string;
  firstname?: string;
  lastname?: string;
  address?: string;
  city?: string;
  country?: string;
  postalcode?: string;
  paymentmethod?: string;
  accountnumber?: string;
  profilepicture?: string;
}

const UserdetailsSchema = new Schema<IUserdetail>(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      index: true
    },
    phonenumber: {
      type: String,
      index: true
    },
    firstname: {
      type: String
    },
    lastname: {
      type: String
    },
    address: {
      type: String
    },
    city: {
      type: String
    },
    country: {
      type: String
    },
    postalcode: {
      type: String
    },
    paymentmethod: {
      type: String,
      default: ''
    },
    accountnumber: {
      type: String,
      default: ''
    },
    profilepicture: {
      type: String,
      default: '',
      index: true
    }
  },
  {
    timestamps: true,
    strict: true
  }
);

const Userdetails: Model<IUserdetail> = mongoose.model<IUserdetail>('Userdetails', UserdetailsSchema);
export default Userdetails;
