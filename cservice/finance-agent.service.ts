import mongoose from "mongoose";
import FinanceAgent from "../models/Finance-agent.js";



export const create = async (
    userId: string,
    walletId: string,
    category: string,
    description: string
): Promise<any> => {
    try {
        const newAgent = new FinanceAgent({
            owner: new mongoose.Types.ObjectId(userId),
            walletId: new mongoose.Types.ObjectId(walletId),
            category,
            description
        });

        await newAgent.save();

        return {
            error: false,
            message: 'Finance agent created successfully',
            data: newAgent
        };
    } catch (err) {
        console.log(`Error creating finance agent: ${err}`);
        return {
            error: true,
            message: 'Failed to create finance agent. Please contact support.',
            statusCode: 400
        };
    }
};

export const list = async (
    userId: string
): Promise<any> => {
    try {
        const agents = await FinanceAgent.find({ owner: new mongoose.Types.ObjectId(userId) }).populate('walletId', 'name');
        return {
            error: false,
            data: agents
        };
    } catch (err) {
        console.log(`Error listing finance agents: ${err}`);
        return {
            error: true,
            message: 'Failed to list finance agents. Please contact support.',
            statusCode: 400
        };
    }
};
