import express from "express"
import connection from "./db/connectToDB.js"
import dotenv from "dotenv"
dotenv.config({
    path: './env'
})

const app = express()

connection()
.then(()=>{
    app.listen(process.env.PORT || 3000, ()=>{
        console.log(`App is running on ${process.env.PORT}`);
    })  
})
.catch((error)=>{
    console.log(`MONGODB FAILED TO CONNECT\nError: ${error}`);
})