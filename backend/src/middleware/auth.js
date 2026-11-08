const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError, asyncHandler } = require('../utils/helpers');

const getToken = (req) => {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
};

const loadUser = async (token) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  return User.findById(decoded.id);
};

// Bắt buộc đăng nhập
const protect = asyncHandler(async (req, res, next) => {
  const token = getToken(req);
  if (!token) throw new AppError('Vui lòng đăng nhập', 401);
  let user;
  try {
    user = await loadUser(token);
  } catch {
    throw new AppError('Phiên đăng nhập không hợp lệ hoặc đã hết hạn', 401);
  }
  if (!user) throw new AppError('Tài khoản không tồn tại', 401);
  if (!user.status) throw new AppError('Tài khoản đã bị khoá', 403);
  req.user = user;
  next();
});

// Không bắt buộc đăng nhập, nhưng nếu có token thì gắn req.user
const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = getToken(req);
  if (token) {
    try {
      const user = await loadUser(token);
      if (user && user.status) req.user = user;
    } catch {
      /* bỏ qua token sai */
    }
  }
  next();
});

// Chỉ admin
const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') return next(new AppError('Bạn không có quyền quản trị', 403));
  next();
};

module.exports = { protect, optionalAuth, adminOnly };
