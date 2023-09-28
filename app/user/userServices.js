import bcrypt from "bcrypt";

import userSchema from "./userSchema.js";
import { createError, createResponse, validateEmail } from "../../util/util.js";

const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email) return createError(res, "Email required");
  if (!password) return createError(res, "Password required");
  if (!validateEmail(email)) return createError(res, "Invalid email", 422);

  const user = await userSchema.findOne({ email: email.toLowerCase() });

  if (!user) return createError(res, `No user found with: ${email}`);

  const encryptedPass = user.password;

  const isPasswordSame = bcrypt.compareSync(password, encryptedPass);

  if (!isPasswordSame)
    return createError(res, "Credentials do not match!", 401);

  const token = `${user.name}_${email}`;
  const newTokenHash = bcrypt.hashSync(token, 5);

  // user.token = newTokenHash;

  user
    .save()
    .then((u) => {
      createResponse(res, u, 200);
    })
    .catch((err) => createError(res, "Something went wrong", 500, err));
};

const signupUser = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name) return createError(res, "Name required");
  if (!email) return createError(res, "Email required");
  if (!password) return createError(res, "Password required");
  if (!validateEmail(email)) return createError(res, "Invalid email", 422);
  if (password.length < 6)
    return createError(res, "Password is too short", 422);

  const user = await userSchema.findOne({ email });

  if (user) return createError(res, "User already exist, please login");

  const passHash = bcrypt.hashSync(password, 5);

  const token = `${name}_${email}`;
  const tokenHash = bcrypt.hashSync(token, 5);

  const newUser = new userSchema({
    name,
    email: email.toLowerCase(),
    password: passHash,
    token: tokenHash,
  });

  newUser
    .save()
    .then((user) => {
      createResponse(res, user, 201);
    })
    .catch((err) => createError(res, "Something went wrong", 500, err));
};

const getCurrentUser = (req, res) => {
  createResponse(res, req.user, 200);
};

export { loginUser, signupUser, getCurrentUser };
