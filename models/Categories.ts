import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ICategory extends Document {
  _id: mongoose.Types.ObjectId;
  owner?: mongoose.Types.ObjectId; // null for global/default categories
  name: string;
  type: 'income' | 'expense';
  icon?: string;
  color?: string;
  isDefault: boolean; // true for system-provided categories
  status: 'active' | 'archived';
  createdAt?: Date;
  updatedAt?: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', index: true },
    name: { type: String, required: true, index: true },
    type: { type: String, required: true, enum: ['income', 'expense'], index: true },
    icon: { type: String },
    color: { type: String },
    isDefault: { type: Boolean, default: false, index: true },
    status: { type: String, required: true, default: 'active', enum: ['active', 'archived'], index: true }
  },
  {
    timestamps: true,
    strict: true
  }
);

// Compound index for user-specific category lookups
CategorySchema.index({ owner: 1, type: 1, status: 1 });

const Categories: Model<ICategory> = mongoose.models.Categories || mongoose.model<ICategory>('Categories', CategorySchema);
export default Categories;
