import mongoose from "mongoose";

const connect = async() => {
    try {
        await mongoose.connect(process.env.MONGO_DB_URL)
        console.log("Mongodb connected successfully")
    } catch (err) {
        console.error("Error connecting mongodb");
        console.error("Message:", err.message);
        console.error("Stack:", err.stack);
        process.exit(1)
    }
}

export default connect