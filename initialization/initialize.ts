import mongoose from "mongoose"
import Users from "../models/Users.js"
import Userdetails from "../models/Userdetails.js";
import Staffusers from "../models/Staffusers.js";
import StaffUserwallets from "../models/Staffuserwallets.js";
import { GlobalPassword } from "../models/Globalpass.js";
import Maintenance from "../models/Maintenance.js";
import { encrypt } from "../utils/password.js";

export const initialize = async () => {

    // const superadmin: any[] = await Staffusers.find().catch(err => {
    //     console.log(`There's a problem getting the superadmin data for init. Error ${err}`);
    //     return [];
    // });

    // if (superadmin.length <= 0){
    //     await Staffusers.create({ _id: new mongoose.Types.ObjectId(process.env.ADMIN_ID), username: "", password: "", webtoken: "", status: "active", auth: "superadmin"});

    //     try {
    //         await StaffUserwallets.create({ owner: new mongoose.Types.ObjectId(process.env.ADMIN_ID), type: "adminfee", amount: 0 });
    //     } catch (err) {
    //         console.log(`There's a problem creating user details for superadmin. Error ${err}`);
    //         await Staffusers.deleteOne({ _id: new mongoose.Types.ObjectId(process.env.ADMIN_ID) });
    //         return;
    //     }
    //     console.log("Superadmin account created");
    // }


    const users: any[] = await Users.find().catch(err => {
        console.log(`There's a problem getting the user data for init. Error ${err}`)
        return []
    })

    if (users.length <= 0) {
        const user = await Users.create({ _id: new mongoose.Types.ObjectId(process.env.ADMIN_ID), username: "Frofinx", password: "SND9KLAS011SA", webtoken: "", status: "active", auth: "user"})
        try { 
            if(!user || !user._id) {
                console.log("User creation failed during initialization.");
                return;
            }
            await Userdetails.create({ owner: new mongoose.Types.ObjectId(user._id.toString()), firstname: "Frofinx", lastname: "User", address: "", contactnumber: "", email: "", country: "", city: "", postalcode: "", paymentmethod: "", accountnumber: "", profilepicture: "" });
        } catch (err) {
            console.log(`There's a problem creating user details for init. Error ${err}`)
            await Users.deleteOne({ _id: new mongoose.Types.ObjectId(process.env.ADMIN_ID) });
            return;
        }

        console.log("Default user account created");
    }


    const gpw: any[] = await GlobalPassword.find()
    .catch((err: unknown) => {
        console.log(`There's a problem getting the global password data for init. Error ${err}`)

        return []
    })

    if (gpw.length <= 0) {
        const hashedSecretKey = await encrypt('dev123');
        
        await GlobalPassword.create({ owner: new mongoose.Types.ObjectId(process.env.ADMIN_ID), secretkey: hashedSecretKey, status: true })
        .catch((err: unknown) => {
            console.log(`There's a problem creating global password for init. Error ${err}`);
            return
        })
    }

    const maintenancelist = await Maintenance.find()
    .catch((err: unknown) => {
        console.log("there's a problem getting maintenance list. Error:", err)
        return
    })

    const maintenanancelength = maintenancelist ? maintenancelist.length : 0
    if (maintenanancelength <= 0){
        const maintenancelistdata = ["payout", "premium", "full"]

        maintenancelistdata.forEach(async maintenancedata => {
            await Maintenance.create({type: maintenancedata, value: "0"})
            .catch((err: unknown) => {
                console.log(`there's a problem creating maintenance list ${err}`)

                return
            })
        })
        console.log("Maintenance initalized")
    }

    console.log("SERVER DATA INITIALIZED")
}
