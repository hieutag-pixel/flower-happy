const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Review = require('../models/Review');
const Order = require('../models/Order');
const { AppError, asyncHandler, slugify, escapeRegex, getPaging } = require('../utils/helpers');

const isAdmin = (req) => req.user && req.user.role === 'admin';

// Tạo slug không trùng
const uniqueSlug = async (name, excludeId) => {
  const base = slugify(name) || 'san-pham';
  let slug = base;
  let i = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await Product.exists({ slug, _id: { $ne: excludeId } })) slug = `${base}-${i++}`;
  return slug;
};

// GET /api/products
// Query: q (tìm kiếm), category (slug), minPrice, maxPrice, sort (newest|price_asc|price_desc|best), page, limit
// Admin thêm: status=all|active|hidden
exports.list = asyncHandler(async (req, res) => {
  const { q, category, minPrice, maxPrice, sort = 'newest', status } = req.query;
  const { page, limit, skip } = getPaging(req.query, 12);

  const filter = { deleted: false };
  if (!isAdmin(req) || !status) filter.status = true;
  if (isAdmin(req) && status === 'hidden') filter.status = false;
  if (isAdmin(req) && status === 'all') delete filter.status;

  if (q) filter.name = { $regex: escapeRegex(q), $options: 'i' };
  if (category) {
    const cat = await Category.findOne({ slug: category });
    filter.categories = cat ? cat._id : null;
  }

  // Lọc theo giá bán thực tế (salePrice nếu có, ngược lại originalPrice)
  const priceExpr = { $ifNull: ['$salePrice', '$originalPrice'] };
  const priceCond = [];
  if (minPrice) priceCond.push({ $gte: [priceExpr, Number(minPrice)] });
  if (maxPrice) priceCond.push({ $lte: [priceExpr, Number(maxPrice)] });
  if (priceCond.length) filter.$expr = { $and: priceCond };

  const sortMap = {
    newest: { createdAt: -1 },
    best: { sold: -1 },
    price_asc: { effectivePrice: 1 },
    price_desc: { effectivePrice: -1 },
  };

  const pipeline = [
    { $match: filter },
    { $addFields: { effectivePrice: priceExpr } },
    { $sort: sortMap[sort] || sortMap.newest },
    { $facet: { items: [{ $skip: skip }, { $limit: limit }], total: [{ $count: 'n' }] } },
  ];
  const [result] = await Product.aggregate(pipeline);
  const total = result.total[0]?.n || 0;
  const items = await Product.populate(result.items, { path: 'categories', select: 'name slug type' });
  const data = items.map((p) => ({ ...p, price: p.effectivePrice }));

  res.json({ success: true, data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

// GET /api/products/compare?ids=id1,id2,id3 - So sánh sản phẩm
exports.compare = asyncHandler(async (req, res) => {
  const ids = String(req.query.ids || '')
    .split(',')
    .filter((id) => mongoose.isValidObjectId(id))
    .slice(0, 4);
  const data = await Product.find({ _id: { $in: ids }, deleted: false })
    .populate('categories', 'name slug type')
    .populate('components.flowerType', 'name color');
  res.json({ success: true, data });
});

// GET /api/products/:slugOrId - Chi tiết sản phẩm
exports.detail = asyncHandler(async (req, res) => {
  const key = req.params.slug;
  const cond = mongoose.isValidObjectId(key) ? { _id: key } : { slug: key };
  const product = await Product.findOne({ ...cond, deleted: false })
    .populate('categories', 'name slug type')
    .populate('components.flowerType', 'name color image pricePerStem');
  if (!product || (!product.status && !isAdmin(req))) throw new AppError('Không tìm thấy sản phẩm', 404);

  const stats = await Review.aggregate([
    { $match: { product: product._id, status: true } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const related = await Product.find({
    _id: { $ne: product._id },
    categories: { $in: product.categories.map((c) => c._id) },
    status: true,
    deleted: false,
  })
    .limit(4)
    .select('name slug thumbnail originalPrice salePrice stock sold');

  res.json({
    success: true,
    data: product,
    rating: { average: stats[0] ? Number(stats[0].avg.toFixed(1)) : 0, count: stats[0]?.count || 0 },
    related,
  });
});

// Chuẩn hoá dữ liệu admin gửi lên
const pickBody = (body) => {
  const fields = ['name', 'description', 'originalPrice', 'salePrice', 'stock', 'thumbnail', 'images', 'categories', 'components', 'status'];
  const data = {};
  fields.forEach((f) => {
    if (body[f] !== undefined) data[f] = body[f];
  });
  if (data.salePrice === '' || data.salePrice === 0) data.salePrice = null;
  if (Array.isArray(data.images)) {
    data.images = data.images.filter(Boolean).map((img, i) => (typeof img === 'string' ? { url: img, isMain: i === 0 } : img));
    if (!data.thumbnail && data.images[0]) data.thumbnail = data.images[0].url;
  }
  // Thành phần: số cành mặc định + min/max + cho tăng giảm. Bỏ trống min/max thì dùng giá trị mặc định của model
  if (Array.isArray(data.components)) {
    data.components = data.components
      .filter((c) => c && c.flowerType)
      .map((c) => {
        const comp = { flowerType: c.flowerType, stems: Number(c.stems) || 0, adjustable: !!c.adjustable };
        if (c.minStems !== undefined && c.minStems !== '' && c.minStems !== null) comp.minStems = Number(c.minStems);
        if (c.maxStems !== undefined && c.maxStems !== '' && c.maxStems !== null) comp.maxStems = Number(c.maxStems);
        return comp;
      });
  }
  return data;
};

// POST /api/products - Thêm sản phẩm (admin)
exports.create = asyncHandler(async (req, res) => {
  const data = pickBody(req.body);
  if (!data.name) throw new AppError('Thiếu tên sản phẩm');
  data.slug = await uniqueSlug(data.name);
  const product = await Product.create(data);
  res.status(201).json({ success: true, message: 'Thêm sản phẩm thành công', data: product });
});

// PUT /api/products/:id - Sửa sản phẩm (admin)
exports.update = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, deleted: false });
  if (!product) throw new AppError('Không tìm thấy sản phẩm', 404);
  const data = pickBody(req.body);
  if (data.name && data.name !== product.name) data.slug = await uniqueSlug(data.name, product._id);
  product.set(data);
  await product.save();
  res.json({ success: true, message: 'Cập nhật sản phẩm thành công', data: product });
});

// DELETE /api/products/:id - Xoá mềm (admin)
exports.remove = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, { deleted: true, status: false }, { new: true });
  if (!product) throw new AppError('Không tìm thấy sản phẩm', 404);
  res.json({ success: true, message: 'Đã xoá sản phẩm (xoá mềm)' });
});

// ===== Đánh giá / bình luận =====
// GET /api/products/:id/reviews
exports.listReviews = asyncHandler(async (req, res) => {
  const data = await Review.find({ product: req.params.id, status: true })
    .populate('user', 'fullName')
    .sort({ createdAt: -1 })
    .limit(50);
  res.json({ success: true, data });
});

// POST /api/products/:id/reviews - chỉ khách đã mua & đơn đã hoàn thành mới được đánh giá
exports.createReview = asyncHandler(async (req, res) => {
  const productId = req.params.id;
  const bought = await Order.exists({ user: req.user._id, status: 'completed', 'items.product': productId });
  if (!bought) throw new AppError('Bạn cần mua và nhận hàng thành công trước khi đánh giá sản phẩm này');
  const { rating, comment } = req.body;
  const review = await Review.findOneAndUpdate(
    { user: req.user._id, product: productId },
    { rating, comment, status: true },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  res.status(201).json({ success: true, message: 'Cảm ơn bạn đã đánh giá!', data: review });
});
