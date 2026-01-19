import Maintenance from "../models/Maintenance.js"

export const checkmaintenance = async (type: string): Promise<"success" | "maintenance"> => {
    try {
        const mainte = await Maintenance.findOne({ type: type });

        if (!mainte) {
            return "success";
        }

        const val = (mainte as any)?.value;
        if (val === "1") {
            return "maintenance";
        }

        return "success";
    } catch (err) {
        console.log(`There's a problem getting maintenance data for ${type} Error: ${err}`);
        return "success";
    }
}