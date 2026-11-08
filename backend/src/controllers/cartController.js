const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { AppError, asyncHandler } = require('../utils/helpers');

// Thông tin sản phẩm cần lấy kèm khi tính giá (thành phần + giá mỗi cành của loại hoa)
const PRODUCT_FIELDS = 'name slug thumbnail originalPrice salePrice stock status deleted components';
const FLOWER_POPULATE = { path: 'components.flowerType', select: 'name pricePerStem' };

// Tính các loại hoa đã chỉnh số cành + tiền chênh lệch.
// LUÔN lấy giá mỗi cành và giới hạn min/max từ DATABASE, client chỉ gửi { flowerType, stems }.
// product phải được populate components.flowerType.
const calcStemChanges = (product, requested = []) => {
  if (!Array.isArray(requested)) throw new AppError('Dữ liệu số cành không hợp lệ');
  const stemChanges = [];
  const seen = new Set();
  for (const r of requested) {
    const ftId = String((r && (r.flowerType?._id || r.flowerType)) || '');
    if (seen.has(ftId)) throw new AppError('Một loại hoa bị gửi trùng');
    seen.add(ftId);
    const comp = product.components.find((c) => c.flowerType && String(c.flowerType._id || c.flowerType) === ftId);
    if (!comp) throw new AppError('Loại hoa không thuộc thành phần của sản phẩm');
    const name = comp.flowerType.name || 'Loại hoa';
    const stems = Number(r.stems);
    if (!Number.isInteger(stems)) throw new AppError(`Số cành "${name}" phải là số nguyên`);
    if (stems === comp.stems) continue; // không đổi thì không cần lưu
    if (!comp.adjustable) throw new AppError(`"${name}" không cho phép tăng giảm số cành`);
    if (stems < comp.minStems || stems > comp.maxStems)
      throw new AppError(`Số cành "${name}" phải từ ${comp.minStems} đến ${comp.maxStems}`);
    stemChanges.push({
      flowerType: comp.flowerType._id,
      flowerName: name,
      defaultStems: comp.stems,
      stems,
      pricePerStem: comp.flowerType.pricePerStem || 0,
    });
  }
  // Tăng thì cộng tiền, giảm thì trừ tiền
  const adjustAmount = stemChanges.reduce((s, c) => s + (c.stems - c.defaultStems) * c.pricePerStem, 0);
  return { stemChanges, adjustAmount };
};

// Khoá so sánh 2 dòng giỏ có cùng cấu hình số cành hay không
const stemKey = (changes = []) =>
  changes
    .map((c) => `${c.flowerType}:${c.stems}`)
    .sort()
    .join(',');

const getOrCreateCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  return cart;
};

// Trả giỏ hàng kèm thông tin sản phẩm và tạm tính.
// Tiền chênh lệch được tính lại từ giá hiện tại trong database mỗi lần đọc giỏ.
const buildCartResponse = async (cart) => {
  await cart.populate({ path: 'items.product', select: PRODUCT_FIELDS, populate: FLOWER_POPULATE });
  const items = cart.items
    .filter((i) => i.product) // sản phẩm đã bị xoá hẳn
    .map((i) => {
      const p = i.product;
      let stemChanges = [];
      let adjustAmount = 0;
      let warning = '';
      try {
        ({ stemChanges, adjustAmount } = calcStemChanges(p, i.stemChanges));
      } catch (e) {
        warning = `Tuỳ chỉnh số cành không còn hợp lệ: ${e.message}`;
      }
      const unitPrice = Math.max(p.price + adjustAmount, 0);
      const inStock = p.status && !p.deleted && p.stock >= i.quantity;
      return {
        _id: i._id,
        product: { _id: p._id, name: p.name, slug: p.slug, thumbnail: p.thumbnail, stock: p.stock },
        quantity: i.quantity,
        price: p.price, // giá sản phẩm
        stemChanges,
        adjustAmount, // chênh lệch / 1 sản phẩm
        unitPrice, // đơn giá sau khi chỉnh số cành
        customerRequest: i.customerRequest,
        lineTotal: unitPrice * i.quantity,
        available: inStock && !warning,
        warning,
      };
    });
  const subTotal = items.reduce((s, i) => s + i.lineTotal, 0);
  return { _id: cart._id, items, subTotal, count: items.reduce((s, i) => s + i.quantity, 0) };
};

// GET /api/cart
exports.getCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  res.json({ success: true, data: await buildCartResponse(cart) });
});

// POST /api/cart/items  { productId, quantity, customerRequest, stemChanges: [{ flowerType, stems }] }
exports.addItem = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  const customerRequest = String(req.body.customerRequest || '').trim().slice(0, 500);
  const quantity = Math.max(parseInt(req.body.quantity) || 1, 1);
  const product = await Product.findOne({ _id: productId, status: true, deleted: false }).populate(FLOWER_POPULATE);
  if (!product) throw new AppError('Sản phẩm không tồn tại hoặc đã ngừng bán', 404);

  // Kiểm tra min/max và tính tiền từ database
  const { stemChanges, adjustAmount } = calcStemChanges(product, req.body.stemChanges || []);

  const cart = await getOrCreateCart(req.user._id);
  const existing = cart.items.find(
    (i) =>
      i.product.toString() === String(productId) &&
      (i.customerRequest || '') === customerRequest &&
      stemKey(i.stemChanges) === stemKey(stemChanges)
  );
  const sameProductQty = cart.items.filter((i) => i.product.toString() === String(productId)).reduce((s, i) => s + i.quantity, 0);
  if (sameProductQty + quantity > product.stock) throw new AppError(`Chỉ còn ${product.stock} sản phẩm trong kho`);

  if (existing) existing.quantity += quantity;
  else cart.items.push({ product: productId, quantity, customerRequest, stemChanges, adjustAmount });
  await cart.save();
  res.status(201).json({ success: true, message: 'Đã thêm vào giỏ hàng', data: await buildCartResponse(cart) });
});

// PUT /api/cart/items/:itemId  { quantity, customerRequest }
exports.updateItem = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  const item = cart.items.id(req.params.itemId);
  if (!item) throw new AppError('Không tìm thấy sản phẩm trong giỏ', 404);
  if (req.body.quantity !== undefined) {
    const qty = parseInt(req.body.quantity);
    if (!qty || qty < 1) throw new AppError('Số lượng phải lớn hơn 0');
    const product = await Product.findById(item.product);
    const others = cart.items
      .filter((i) => i.product.toString() === item.product.toString() && i._id.toString() !== item._id.toString())
      .reduce((s, i) => s + i.quantity, 0);
    if (product && qty + others > product.stock) throw new AppError(`Chỉ còn ${product.stock} sản phẩm trong kho`);
    item.quantity = qty;
  }
  if (req.body.customerRequest !== undefined) item.customerRequest = String(req.body.customerRequest).trim().slice(0, 500);
  await cart.save();
  res.json({ success: true, data: await buildCartResponse(cart) });
});

// DELETE /api/cart/items/:itemId
exports.removeItem = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  cart.items.pull({ _id: req.params.itemId });
  await cart.save();
  res.json({ success: true, message: 'Đã xoá khỏi giỏ', data: await buildCartResponse(cart) });
});

// DELETE /api/cart
exports.clear = asyncHandler(async (req, res) => {
  await Cart.updateOne({ user: req.user._id }, { items: [] });
  res.json({ success: true, message: 'Đã làm trống giỏ hàng' });
});

exports.getOrCreateCart = getOrCreateCart;
exports.buildCartResponse = buildCartResponse;
exports.calcStemChanges = calcStemChanges;
