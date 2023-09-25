import express from "express";

import { getCurrentUser, loginUser, signupUser } from "./userServices.js";
import {
  authenticateAdminMiddleware,
  authenticateUserMiddleware,
} from "./userMiddleware.js";

const router = express.Router();

router.post("/user/login", loginUser);
router.post("/user/signup", authenticateAdminMiddleware, signupUser);
router.get("/user/me", authenticateUserMiddleware, getCurrentUser);

export default router;
