import dotenv from "dotenv"
import connection from "./db/connectToDB.js"
dotenv.config({
    path: './env'
})


connection()