import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IBudget extends Document {
  _id: mongoose.Types.ObjectId;
  owner: mongoose.Types.ObjectId;
  category?: mongoose.Types.ObjectId;
  name: string; // "Monthly Food Budget" or category name
  amount: number; // budget limit
  spent: number; // amount spent so far
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate: Date;
  endDate: Date;
  status: 'active' | 'exceeded' | 'archived';
  alertThreshold?: number; // percentage (e.g., 80 = alert at 80%)
  createdAt?: Date;
  updatedAt?: Date;
}

const BudgetSchema = new Schema<IBudget>(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true, index: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Categories', index: true },
    name: { type: String, required: true },
    amount: { type: Number, required: true },
    spent: { type: Number, default: 0 },
    period: { type: String, required: true, enum: ['daily', 'weekly', 'monthly', 'yearly'], default: 'monthly' },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    status: { type: String, required: true, default: 'active', enum: ['active', 'exceeded', 'archived'], index: true },
    alertThreshold: { type: Number, default: 80 }
  },
  {
    timestamps: true,
    strict: true
  }
);

// Virtual field for remaining budget
BudgetSchema.virtual('remaining').get(function() {
  return this.amount - this.spent;
});

// Virtual field for percentage spent
BudgetSchema.virtual('percentageSpent').get(function() {
  return this.amount > 0 ? (this.spent / this.amount) * 100 : 0;
});

// Ensure virtuals are included in JSON and object output
BudgetSchema.set('toJSON', { virtuals: true });
BudgetSchema.set('toObject', { virtuals: true });

// Compound indexes for common queries
BudgetSchema.index({ owner: 1, startDate: 1, endDate: 1 });
BudgetSchema.index({ owner: 1, category: 1, status: 1 });

const Budgets: Model<IBudget> = mongoose.models.Budgets || mongoose.model<IBudget>('Budgets', BudgetSchema);
export default Budgets;
