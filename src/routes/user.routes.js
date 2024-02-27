import { Router } from "express";
import { changeCurrentPassword, getCurrentUser, loginUser, logoutUser, refreshAccessToken, registerUser, updateAccountDetails, updateUserAvatar } from "../controllers/user.controller.js";
import {upload} from"../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";
const router = Router()


router.route("/register").post(
    upload.fields([
        {
            name: "avatar", //name should be similar to frontend field name
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser
)

//since user is sending only text data we are using upload.none()
//If data is passed in just a json format and not using form data then no need of this middleware
router.route("/login").post(upload.none(), loginUser)

//secured routes 
router.route("/logout").post(verifyJWT, logoutUser)
router.route("/refresh-token").post(refreshAccessToken)
router.route("/change-password").post(verifyJWT, upload.none(), changeCurrentPassword)
router.route("/get-user").get(verifyJWT, getCurrentUser)
router.route("/update-user-details").post(verifyJWT, upload.none(), updateAccountDetails)
router.route("/update-user-avatar").post(verifyJWT, upload.fields([
    {
        name: "avatar", //name should be similar to frontend field name
        maxCount: 1
    }
]), updateUserAvatar)

export default router 