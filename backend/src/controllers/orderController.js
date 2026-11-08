const Order = require('../models/Order');
const Product = require('../models/Product');
const Discount = require('../models/Discount');
const Cart = require('../models/Cart');
const { getOrCreateCart, buildCartResponse } = require('./cartController');
const { AppError, asyncHandler, getPaging, escapeRegex } = require('../utils/helpers');

const calcShipping = (subTotal) => {
  const fee = Number(process.env.SHIPPING_FEE || 30000);
  const freeFrom = Number(process.env.FREE_SHIP_FROM || 500000);
  return subTotal >= freeFrom ? 0 : fee;
};

// Áp dụng mã giảm giá, trả về { discount, amount }
const applyDiscount = async (code, subTotal) => {
  if (!code) return { discount: null, amount: 0 };
  const discount = await Discount.findOne({ code: String(code).trim().toUpperCase() });
  if (!discount) throw new AppError('Mã giảm giá không tồn tại');
  try {
    return { discount, amount: discount.calculate(subTotal) };
  } catch (e) {
    throw new AppError(e.message);
  }
};

const genCode = () => {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `FH${ymd}${Math.floor(1000 + Math.random() * 9000)}`;
};

// Tính lại tổng tiền đơn: chỉ cộng phụ thu của những yêu cầu khách ĐÃ ĐỒNG Ý
const recalcTotal = (order) => {
  order.requestFeeTotal = order.items.reduce((s, i) => s + (i.requestStatus === 'accepted' ? i.requestFee : 0), 0);
  order.total = Math.max(order.subTotal + order.shippingFee - order.discountAmount, 0) + order.requestFeeTotal;
};

// Hoàn lại tồn kho khi huỷ đơn
const restock = async (order) => {
  for (const it of order.items) {
    // eslint-disable-next-line no-await-in-loop
    await Product.updateOne({ _id: it.product }, { $inc: { stock: it.quantity, sold: -it.quantity } });
  }
  if (order.discount) await Discount.updateOne({ _id: order.discount }, { $inc: { usedCount: -1 } });
};

// POST /api/orders/preview  { discountCode } - Xem trước tổng tiền ở trang thanh toán
exports.preview = asyncHandler(async (req, res) => {
  const cart = await buildCartResponse(await getOrCreateCart(req.user._id));
  const { discount, amount } = await applyDiscount(req.body.discountCode, cart.subTotal);
  const shippingFee = calcShipping(cart.subTotal);
  res.json({
    success: true,
    data: {
      subTotal: cart.subTotal,
      shippingFee,
      discountAmount: amount,
      discountCode: discount ? discount.code : '',
      total: Math.max(cart.subTotal + shippingFee - amount, 0),
    },
  });
});

// POST /api/orders - Đặt hàng từ giỏ
exports.create = asyncHandler(async (req, res) => {
  const { receiverName, receiverPhone, shippingAddress, deliveryDate, deliveryTimeSlot, cardMessage, note, discountCode } = req.body;
  const paymentMethod = req.body.paymentMethod || 'COD';
  if (!receiverName || !receiverPhone || !shippingAddress) throw new AppError('Vui lòng nhập đủ thông tin người nhận');
  if (!/^0\d{9}$/.test(String(receiverPhone).trim())) throw new AppError('Số điện thoại người nhận không hợp lệ (10 số, bắt đầu bằng 0)');

  const cartDoc = await getOrCreateCart(req.user._id);
  const cart = await buildCartResponse(cartDoc);
  if (!cart.items.length) throw new AppError('Giỏ hàng đang trống');
  const bad = cart.items.find((i) => !i.available);
  if (bad) throw new AppError(bad.warning ? `"${bad.product.name}": ${bad.warning}` : `Sản phẩm "${bad.product.name}" không đủ hàng hoặc đã ngừng bán`);

  const { discount, amount } = await applyDiscount(discountCode, cart.subTotal);
  const shippingFee = calcShipping(cart.subTotal);

  // Trừ tồn kho (có điều kiện stock >= số lượng để tránh bán âm kho)
  const done = [];
  for (const i of cart.items) {
    // eslint-disable-next-line no-await-in-loop
    const r = await Product.updateOne(
      { _id: i.product._id, stock: { $gte: i.quantity } },
      { $inc: { stock: -i.quantity, sold: i.quantity } }
    );
    if (!r.modifiedCount) {
      for (const d of done) {
        // eslint-disable-next-line no-await-in-loop
        await Product.updateOne({ _id: d.product._id }, { $inc: { stock: d.quantity, sold: -d.quantity } });
      }
      throw new AppError(`Sản phẩm "${i.product.name}" vừa hết hàng, vui lòng kiểm tra lại giỏ`);
    }
    done.push(i);
  }

  const order = await Order.create({
    code: genCode(),
    user: req.user._id,
    discount: discount ? discount._id : null,
    discountCode: discount ? discount.code : '',
    receiverName,
    receiverPhone,
    shippingAddress,
    deliveryDate: deliveryDate || undefined,
    deliveryTimeSlot,
    cardMessage,
    note,
    // Giá, số cành, giá mỗi cành đều lấy từ buildCartResponse (đã tính lại từ database)
    items: cart.items.map((i) => ({
      product: i.product._id,
      name: i.product.name,
      thumbnail: i.product.thumbnail,
      price: i.price,
      stemChanges: i.stemChanges,
      adjustAmount: i.adjustAmount,
      quantity: i.quantity,
      customerRequest: i.customerRequest,
      requestStatus: i.customerRequest ? 'waiting_quote' : 'none', // có yêu cầu thì chờ cửa hàng báo giá
    })),
    subTotal: cart.subTotal,
    shippingFee,
    discountAmount: amount,
    total: Math.max(cart.subTotal + shippingFee - amount, 0),
    paymentMethod,
  });

  if (discount) await Discount.updateOne({ _id: discount._id }, { $inc: { usedCount: 1 } });
  await Cart.updateOne({ user: req.user._id }, { items: [] });

  res.status(201).json({ success: true, message: 'Đặt hàng thành công!', data: order });
});

// GET /api/orders/my - Lịch sử đơn hàng của tôi
exports.myOrders = asyncHandler(async (req, res) => {
  const filter = { user: req.user._id };
  if (req.query.status) filter.status = req.query.status;
  const data = await Order.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, data });
});

// GET /api/orders/my/quote-count - Số đơn đã được báo giá, đang chờ khách trả lời (hiện chấm đỏ trên header)
exports.myQuoteCount = asyncHandler(async (req, res) => {
  const count = await Order.countDocuments({ user: req.user._id, status: 'pending', 'items.requestStatus': 'quoted' });
  res.json({ success: true, data: { count } });
});

// PUT /api/orders/:id/items/:itemId/quote-response  { accept: true|false } - Khách trả lời báo giá (chỉ chủ đơn)
exports.respondQuote = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
  if (order.status !== 'pending') throw new AppError('Đơn hàng đã được xử lý, không thể thay đổi');
  const item = order.items.id(req.params.itemId);
  if (!item) throw new AppError('Không tìm thấy sản phẩm trong đơn', 404);
  if (item.requestStatus !== 'quoted') throw new AppError('Yêu cầu này chưa được báo giá hoặc đã trả lời rồi');

  if (req.body.accept === true) {
    item.requestStatus = 'accepted'; // cộng phụ thu vào tổng
  } else if (req.body.accept === false) {
    item.requestStatus = 'rejected'; // không phụ thu, cửa hàng làm theo mẫu gốc
    item.requestFee = 0;
  } else throw new AppError('Vui lòng chọn Đồng ý hoặc Từ chối');

  recalcTotal(order);
  await order.save();
  res.json({
    success: true,
    message: item.requestStatus === 'accepted' ? 'Đã đồng ý báo giá' : 'Đã từ chối, cửa hàng sẽ làm theo mẫu gốc',
    data: order,
  });
});

// GET /api/orders/:id - Chi tiết đơn (chủ đơn hoặc admin)
exports.detail = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'fullName email phone');
  if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
  if (req.user.role !== 'admin' && order.user._id.toString() !== req.user._id.toString())
    throw new AppError('Bạn không có quyền xem đơn này', 403);
  res.json({ success: true, data: order });
});

// PUT /api/orders/:id/cancel - Khách huỷ đơn (chỉ khi đang chờ xác nhận)
exports.cancelByUser = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
  if (order.status !== 'pending') throw new AppError('Chỉ huỷ được đơn đang chờ xác nhận');
  order.status = 'cancelled';
  order.cancelReason = req.body.reason || 'Khách hàng huỷ';
  await order.save();
  await restock(order);
  res.json({ success: true, message: 'Đã huỷ đơn hàng', data: order });
});

// ===== ADMIN =====
// GET /api/orders?status=&paymentStatus=unpaid|paid&request=waiting_quote|quoted&sort=asc|desc&q=&page=
// Mặc định sắp xếp cũ → mới (asc): khách đặt trước được xác nhận trước
exports.adminList = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaging(req.query, 15);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (['unpaid', 'paid'].includes(req.query.paymentStatus)) filter.paymentStatus = req.query.paymentStatus;
  if (['waiting_quote', 'quoted'].includes(req.query.request)) filter['items.requestStatus'] = req.query.request;
  if (req.query.q) {
    const r = { $regex: escapeRegex(req.query.q), $options: 'i' };
    filter.$or = [{ code: r }, { receiverName: r }, { receiverPhone: r }];
  }
  const sort = { createdAt: req.query.sort === 'desc' ? -1 : 1 };
  const [data, total] = await Promise.all([
    Order.find(filter).populate('user', 'fullName email').sort(sort).skip(skip).limit(limit),
    Order.countDocuments(filter),
  ]);
  res.json({ success: true, data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

// Luồng trạng thái hợp lệ
const FLOW = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipping', 'cancelled'],
  shipping: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

// PUT /api/orders/:id/status  { status, cancelReason, paymentStatus }
exports.adminUpdateStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
  const { status, cancelReason, paymentStatus } = req.body;

  if (status && status !== order.status) {
    if (!FLOW[order.status].includes(status))
      throw new AppError(`Không thể chuyển từ "${order.status}" sang "${status}"`);
    // Còn yêu cầu chưa báo giá / khách chưa trả lời thì chưa được xác nhận đơn
    if (status === 'confirmed' && order.items.some((i) => ['waiting_quote', 'quoted'].includes(i.requestStatus)))
      throw new AppError('Đơn còn yêu cầu của khách chưa báo giá hoặc khách chưa trả lời báo giá, chưa thể xác nhận');
    order.status = status;
    if (status === 'cancelled') {
      order.cancelReason = cancelReason || 'Cửa hàng huỷ';
      await restock(order);
    }
    if (status === 'completed' && order.paymentMethod === 'COD') order.paymentStatus = 'paid';
  }
  if (paymentStatus) order.paymentStatus = paymentStatus;
  await order.save();
  res.json({ success: true, message: 'Cập nhật đơn hàng thành công', data: order });
});

// PUT /api/orders/:id/items/:itemId/quote  { requestFee, adminNote } - Cửa hàng báo giá yêu cầu của khách
exports.adminQuote = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
  if (order.status !== 'pending') throw new AppError('Chỉ báo giá được cho đơn đang chờ xác nhận');
  const item = order.items.id(req.params.itemId);
  if (!item) throw new AppError('Không tìm thấy sản phẩm trong đơn', 404);
  if (!['waiting_quote', 'quoted'].includes(item.requestStatus))
    throw new AppError('Sản phẩm này không có yêu cầu cần báo giá hoặc khách đã trả lời');

  const fee = Number(req.body.requestFee);
  if (!Number.isFinite(fee) || fee < 0) throw new AppError('Phụ thu phải là số không âm');
  item.requestFee = Math.round(fee);
  item.adminNote = String(req.body.adminNote || '').trim().slice(0, 500);
  item.requestStatus = 'quoted';

  recalcTotal(order);
  await order.save();
  res.json({ success: true, message: 'Đã gửi báo giá cho khách', data: order });
});
