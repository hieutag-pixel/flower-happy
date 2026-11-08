const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Discount = require('../models/Discount');
const { AppError, asyncHandler, escapeRegex, getPaging } = require('../utils/helpers');

// ===== Quản lý người dùng: xem, khoá, tìm kiếm, phân trang =====
exports.listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaging(req.query, 15);
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.q) {
    const r = { $regex: escapeRegex(req.query.q), $options: 'i' };
    filter.$or = [{ fullName: r }, { email: r }, { phone: r }];
  }
  const [data, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({ success: true, data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

exports.toggleUserStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('Không tìm thấy người dùng', 404);
  if (user._id.toString() === req.user._id.toString()) throw new AppError('Không thể tự khoá tài khoản của mình');
  user.status = req.body.status !== undefined ? !!req.body.status : !user.status;
  await user.save();
  res.json({ success: true, message: user.status ? 'Đã mở khoá' : 'Đã khoá tài khoản', data: user });
});

// ===== Báo cáo & thống kê =====
// GET /api/admin/stats?period=day|month|year&from=YYYY-MM-DD&to=YYYY-MM-DD
exports.stats = asyncHandler(async (req, res) => {
  const period = ['day', 'month', 'year'].includes(req.query.period) ? req.query.period : 'day';
  const to = req.query.to ? new Date(`${req.query.to}T23:59:59`) : new Date();
  const from = req.query.from
    ? new Date(`${req.query.from}T00:00:00`)
    : new Date(to.getTime() - (period === 'day' ? 30 : period === 'month' ? 365 : 365 * 5) * 864e5);

  const fmt = { day: '%Y-%m-%d', month: '%Y-%m', year: '%Y' }[period];

  const [revenue, summaryArr, statusCount, bestSellers, lowStock, totalUsers, totalProducts, activeDiscounts] = await Promise.all([
    // Doanh thu theo ngày/tháng/năm (chỉ đơn hoàn thành)
    Order.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: { $dateToString: { format: fmt, date: '$createdAt', timezone: '+07:00' } },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: null, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
    ]),
    Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Product.find({ deleted: false }).sort({ sold: -1 }).limit(5).select('name thumbnail sold stock'),
    Product.find({ deleted: false, stock: { $lte: 5 } }).sort({ stock: 1 }).limit(10).select('name thumbnail stock sold'),
    User.countDocuments({ role: 'client' }),
    Product.countDocuments({ deleted: false }),
    Discount.countDocuments({ status: true, endDate: { $gte: new Date() } }),
  ]);

  res.json({
    success: true,
    data: {
      range: { from, to, period },
      summary: {
        revenue: summaryArr[0]?.revenue || 0,
        completedOrders: summaryArr[0]?.orders || 0,
        totalUsers,
        totalProducts,
        activeDiscounts,
      },
      revenue,
      statusCount: Object.fromEntries(statusCount.map((s) => [s._id, s.count])),
      bestSellers,
      lowStock,
    },
  });
});
