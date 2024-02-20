import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js";
import {
  changeCurrentPassword,
  getCurrentUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
  updateAccountDetails,
  updateAvatarImage,
  updateCoverImage,
} from "../controllers/user.controller.js";
import { verifyJWt } from "../middlewares/auth.middleware.js";
const router = Router();

router.route("/register").post(
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]),
  registerUser
);
router.route("/login").post(loginUser);

// secure routes
router.route("/current-user").get(verifyJWt, getCurrentUser);
router.route("/change-password").post(verifyJWt, changeCurrentPassword);
router.route("/logout").post(verifyJWt, logoutUser);
router.route("/refresh-token").post(verifyJWt, refreshAccessToken);
router.route("/update-account-details").patch(verifyJWt, updateAccountDetails);
router
  .route("/update-avatar")
  .patch(verifyJWt, upload.single("avatar"), updateAvatarImage);
router
  .route("/update-cover-image")
  .patch(verifyJWt, upload.single("coverImage"), updateCoverImage);

export default router;
