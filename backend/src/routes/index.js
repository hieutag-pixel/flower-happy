// Khai báo toàn bộ đường dẫn API
const express = require('express');
const path = require('path');
const multer = require('multer');
const { protect, optionalAuth, adminOnly } = require('../middleware/auth');
const { AppError } = require('../utils/helpers');

const auth = require('../controllers/authController');
const product = require('../controllers/productController');
const cart = require('../controllers/cartController');
const order = require('../controllers/orderController');
const admin = require('../controllers/adminController');
const crud = require('../controllers/crudFactory');

const Category = require('../models/Category');
const FlowerType = require('../models/FlowerType');
const Discount = require('../models/Discount');
const Post = require('../models/Post');

const router = express.Router();
const isAdmin = [protect, adminOnly];

// ---------- Tài khoản ----------
router.post('/auth/register', auth.register);
router.post('/auth/login', auth.login);
router.get('/auth/me', protect, auth.me);
router.put('/auth/me', protect, auth.updateMe);
router.put('/auth/password', protect, auth.changePassword);

router.get('/addresses', protect, auth.listAddresses);
router.post('/addresses', protect, auth.createAddress);
router.put('/addresses/:id', protect, auth.updateAddress);
router.delete('/addresses/:id', protect, auth.deleteAddress);

// ---------- Sản phẩm ----------
router.get('/products', optionalAuth, product.list);
router.get('/products/compare', product.compare);
router.get('/products/:slug', optionalAuth, product.detail);
router.post('/products', isAdmin, product.create);
router.put('/products/:id', isAdmin, product.update);
router.delete('/products/:id', isAdmin, product.remove);
router.get('/products/:id/reviews', product.listReviews);
router.post('/products/:id/reviews', protect, product.createReview);

// ---------- Loại sản phẩm (thẻ) ----------
const categoryCrud = crud(Category, { slugFrom: 'name', defaultSort: { type: 1, name: 1 }, queryFilters: { type: 'type' } });
router.get('/categories', optionalAuth, categoryCrud.list);
router.get('/categories/:id', optionalAuth, categoryCrud.detail);
router.post('/categories', isAdmin, categoryCrud.create);
router.put('/categories/:id', isAdmin, categoryCrud.update);
router.delete('/categories/:id', isAdmin, categoryCrud.remove);

// ---------- Loại hoa ----------
const flowerCrud = crud(FlowerType, { defaultSort: { name: 1 } });
router.get('/flower-types', optionalAuth, flowerCrud.list);
router.post('/flower-types', isAdmin, flowerCrud.create);
router.put('/flower-types/:id', isAdmin, flowerCrud.update);
router.delete('/flower-types/:id', isAdmin, flowerCrud.remove);

// ---------- Mã giảm giá (admin) ----------
const discountCrud = crud(Discount, { searchField: 'code' });
router.get('/discounts', isAdmin, discountCrud.list);
router.post('/discounts', isAdmin, discountCrud.create);
router.put('/discounts/:id', isAdmin, discountCrud.update);

// ---------- Bài viết ----------
const postCrud = crud(Post, {
  searchField: 'title',
  slugFrom: 'title',
  populate: { path: 'author', select: 'fullName' },
  beforeCreate: (data, req) => ({ ...data, author: req.user._id }),
  hardDelete: true,
});
router.get('/posts', optionalAuth, postCrud.list);
router.get('/posts/:id', optionalAuth, postCrud.detail);
router.post('/posts', isAdmin, postCrud.create);
router.put('/posts/:id', isAdmin, postCrud.update);
router.delete('/posts/:id', isAdmin, postCrud.remove);

// ---------- Giỏ hàng ----------
router.get('/cart', protect, cart.getCart);
router.post('/cart/items', protect, cart.addItem);
router.put('/cart/items/:itemId', protect, cart.updateItem);
router.delete('/cart/items/:itemId', protect, cart.removeItem);
router.delete('/cart', protect, cart.clear);

// ---------- Đơn hàng ----------
router.post('/orders/preview', protect, order.preview);
router.post('/orders', protect, order.create);
router.get('/orders/my', protect, order.myOrders);
router.get('/orders/my/quote-count', protect, order.myQuoteCount);
router.get('/orders', isAdmin, order.adminList);
router.get('/orders/:id', protect, order.detail);
router.put('/orders/:id/cancel', protect, order.cancelByUser);
router.put('/orders/:id/status', isAdmin, order.adminUpdateStatus);
// Báo giá "Yêu cầu của khách hàng": admin báo giá -> khách đồng ý / từ chối
router.put('/orders/:id/items/:itemId/quote', isAdmin, order.adminQuote);
router.put('/orders/:id/items/:itemId/quote-response', protect, order.respondQuote);

// ---------- Quản trị ----------
router.get('/admin/users', isAdmin, admin.listUsers);
router.put('/admin/users/:id/status', isAdmin, admin.toggleUserStatus);
router.get('/admin/stats', isAdmin, admin.stats);

// ---------- Upload ảnh (admin) ----------
const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '..', '..', 'uploads'),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype) ? cb(null, true) : cb(new AppError('Chỉ chấp nhận file ảnh')),
});
router.post('/upload', isAdmin, upload.single('image'), (req, res) => {
  if (!req.file) throw new AppError('Chưa chọn ảnh');
  res.status(201).json({ success: true, url: `/uploads/${req.file.filename}` });
});

module.exports = router;
