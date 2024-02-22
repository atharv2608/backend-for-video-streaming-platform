import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connection = async()=>{
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`)
        console.log(`\nMOONGODB CONNECTED !!\nDB HOST: ${connectionInstance.connection.host}`);
    } catch (error) {
        console.error("MONGODB FAILED TO CONNECT: ", error)
        process.exit(1)
    }
}

export default connection;