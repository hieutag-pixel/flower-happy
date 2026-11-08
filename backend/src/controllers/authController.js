const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Address = require('../models/Address');
const { AppError, asyncHandler } = require('../utils/helpers');

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// POST /api/auth/register - Đăng ký
exports.register = asyncHandler(async (req, res) => {
  const { fullName, email, password, phone } = req.body;
  if (!fullName || !email || !password) throw new AppError('Vui lòng nhập đủ họ tên, email, mật khẩu');
  const exists = await User.findOne({ email: String(email).toLowerCase() });
  if (exists) throw new AppError('Email đã được sử dụng');
  const user = await User.create({ fullName, email, password, phone, role: 'client' });
  res.status(201).json({ success: true, message: 'Đăng ký thành công', token: signToken(user), data: user });
});

// POST /api/auth/login - Đăng nhập
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new AppError('Vui lòng nhập email và mật khẩu');
  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(password))) throw new AppError('Email hoặc mật khẩu không đúng', 401);
  if (!user.status) throw new AppError('Tài khoản đã bị khoá, vui lòng liên hệ cửa hàng', 403);
  res.json({ success: true, message: 'Đăng nhập thành công', token: signToken(user), data: user });
});

// GET /api/auth/me - Thông tin tài khoản
exports.me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.user });
});

// PUT /api/auth/me - Cập nhật thông tin
exports.updateMe = asyncHandler(async (req, res) => {
  const { fullName, phone } = req.body;
  if (fullName !== undefined) req.user.fullName = fullName;
  if (phone !== undefined) req.user.phone = phone;
  await req.user.save();
  res.json({ success: true, message: 'Cập nhật thông tin thành công', data: req.user });
});

// PUT /api/auth/password - Đổi mật khẩu
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) throw new AppError('Vui lòng nhập mật khẩu cũ và mới');
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(currentPassword))) throw new AppError('Mật khẩu hiện tại không đúng');
  user.password = newPassword;
  await user.save();
  res.json({ success: true, message: 'Đổi mật khẩu thành công' });
});

// ===== Sổ địa chỉ =====
exports.listAddresses = asyncHandler(async (req, res) => {
  const data = await Address.find({ user: req.user._id }).sort({ isDefault: -1, createdAt: -1 });
  res.json({ success: true, data });
});

exports.createAddress = asyncHandler(async (req, res) => {
  const count = await Address.countDocuments({ user: req.user._id });
  const isDefault = count === 0 || !!req.body.isDefault;
  if (isDefault) await Address.updateMany({ user: req.user._id }, { isDefault: false });
  const data = await Address.create({ ...req.body, user: req.user._id, isDefault });
  res.status(201).json({ success: true, data });
});

exports.updateAddress = asyncHandler(async (req, res) => {
  const addr = await Address.findOne({ _id: req.params.id, user: req.user._id });
  if (!addr) throw new AppError('Không tìm thấy địa chỉ', 404);
  if (req.body.isDefault) await Address.updateMany({ user: req.user._id }, { isDefault: false });
  ['receiverName', 'receiverPhone', 'province', 'ward', 'detail', 'isDefault'].forEach((k) => {
    if (req.body[k] !== undefined) addr[k] = req.body[k];
  });
  await addr.save();
  res.json({ success: true, data: addr });
});

exports.deleteAddress = asyncHandler(async (req, res) => {
  const addr = await Address.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!addr) throw new AppError('Không tìm thấy địa chỉ', 404);
  res.json({ success: true, message: 'Đã xoá địa chỉ' });
});
