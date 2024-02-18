import express from "express"
import cookieParser from "cookie-parser"
import cors from "cors"

const app = express()

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
}))

app.use(express.json({limit: "16kb"})) //to accept json data
app.use(express.urlencoded({extended: true, limit: "16kb"})) // to accept different urls
app.use(express.static("public"))  // to make files public
app.use(cookieParser()) // for cookies CRUD operation


export { app }