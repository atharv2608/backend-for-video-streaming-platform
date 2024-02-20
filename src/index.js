import express from "express"
import connection from "./db/connectToDB.js"
import dotenv from "dotenv"
import { app } from "./app.js"
dotenv.config({
    path: './env'
})

connection()
.then(()=>{
    app.listen(process.env.PORT || 3000, ()=>{
        console.log(`App is running on ${process.env.PORT}`);
    })  
})
.catch((error)=>{
    console.log(`MONGODB FAILED TO CONNECT\nError: ${error}`);
})