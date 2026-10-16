module.exports = function authorize(...roles) {
  const allowed = roles.flat();
  // ye authorize() kahan se call hua, wo jagah yaad rakhta hai
  const where = (new Error().stack || "").split("\n")[2]?.trim() || "unknown";

  return (req, res, next) => {
    if (!req.user || !allowed.includes(req.user.role)) {
      console.warn(
        `[403] ${req.method} ${req.originalUrl} | role: ${req.user?.role} | allowed: ${allowed.join(", ")} | ${where}`,
      );
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };
};
