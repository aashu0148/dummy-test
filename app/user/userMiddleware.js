import userSchema from "./userSchema.js";

const authenticateUserMiddleware = async (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    res.status(400).json({
      status: false,
      message: "Token not found",
    });
    return;
  }

  const user = await userSchema
    .findOne({
      token: token,
    })
    .select("-token -password")
    .lean();

  if (!user) {
    res.status(422).json({
      status: false,
      message: "Invalid Token",
    });
    return;
  }

  req.user = { ...user, _id: user._id.toString() };
  next();
};

const authenticateAdminMiddleware = async (req, res, next) => {
  const pass = req.headers.password;

  if (!pass) {
    res.status(400).json({
      status: false,
      message: "Admin password needed",
    });
    return;
  }

  if (pass !== "trade@assistant") {
    res.status(422).json({
      status: false,
      message: "Invalid password",
    });
    return;
  }

  next();
};

export { authenticateUserMiddleware, authenticateAdminMiddleware };
