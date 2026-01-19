import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IMaintenance extends Document {
    _id: mongoose.Types.ObjectId;
    type: string;
    value: string;
}

const MaintenanceSchema = new Schema<IMaintenance>(
    {
        type: {
            type: String,
            index: true // Automatically creates an index on 'amount'
        },
        value: {
            type: String,
        },
    },
    {
        timestamps: true,
        strict: true
    }
)

const Maintenance: Model<IMaintenance> = mongoose.model<IMaintenance>("Maintenance", MaintenanceSchema);
export default Maintenance