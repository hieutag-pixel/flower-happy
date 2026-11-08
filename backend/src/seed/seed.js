// Nạp dữ liệu mẫu vào MongoDB:  npm run seed
// CẢNH BÁO: script này XOÁ SẠCH dữ liệu cũ trong database rồi tạo lại.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');

const User = require('../models/User');
const Address = require('../models/Address');
const Category = require('../models/Category');
const FlowerType = require('../models/FlowerType');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Discount = require('../models/Discount');
const Post = require('../models/Post');
const Review = require('../models/Review');
const { slugify } = require('../utils/helpers');
const data = require('./data');

const IMG = (f) => `/images/products/${f}`;

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Đã kết nối', mongoose.connection.name, '- bắt đầu xoá dữ liệu cũ...');
    await Promise.all(
      [User, Address, Category, FlowerType, Product, Cart, Order, Discount, Post, Review].map((M) => M.deleteMany({}))
    );

    // 1. Người dùng
    const admin = await User.create(data.users.admin);
    const clients = [];
    for (const u of data.users.clients) clients.push(await User.create(u));
    await Address.create({ user: clients[0]._id, ...data.address, isDefault: true });

    // 2. Loại sản phẩm (thẻ) & loại hoa
    const cats = await Category.insertMany(data.categories.map((c) => ({ ...c, slug: slugify(c.name) })));
    const catBySlug = Object.fromEntries(cats.map((c) => [c.slug, c._id]));
    const flowers = await FlowerType.insertMany(data.flowerTypes);
    const flowerByName = Object.fromEntries(flowers.map((f) => [f.name, f._id]));

    // 3. Sản phẩm
    const products = await Product.insertMany(
      data.products.map((p, idx) => ({
        name: p.name,
        slug: slugify(p.name),
        description: p.description,
        originalPrice: p.originalPrice,
        salePrice: p.salePrice || null,
        stock: p.stock,
        sold: 0,
        thumbnail: IMG(p.images[0]),
        images: p.images.map((f, i) => ({ url: IMG(f), isMain: i === 0 })),
        categories: p.categories.map((s) => catBySlug[s]).filter(Boolean),
        components: p.components.map(([name, stems, adjustable, min, max]) => ({
          flowerType: flowerByName[name],
          stems,
          adjustable,
          minStems: min ?? (adjustable ? Math.max(1, Math.ceil(stems / 2)) : stems),
          maxStems: max ?? (adjustable ? stems * 2 : stems),
        })),
        createdAt: new Date(Date.now() - idx * 36e5),
      }))
    );

    // 4. Mã giảm giá
    const now = Date.now();
    const discounts = await Discount.insertMany(
      data.discounts.map((d) => ({
        ...d,
        startDate: new Date(now - 30 * 864e5),
        endDate: new Date(now + (d.days || 90) * 864e5),
      }))
    );

    // 5. Bài viết
    await Post.insertMany(
      data.posts.map((p, i) => ({ ...p, slug: slugify(p.title), author: admin._id, createdAt: new Date(now - i * 3 * 864e5) }))
    );

    // 6. Đơn hàng mẫu trong 30 ngày gần đây (để trang thống kê có số liệu)
    const statuses = ['completed', 'completed', 'completed', 'completed', 'shipping', 'confirmed', 'pending', 'cancelled'];
    const slots = ['08:00 - 10:00', '10:00 - 12:00', '14:00 - 16:00', '16:00 - 18:00'];
    const orders = [];
    for (let i = 0; i < 24; i++) {
      const user = clients[i % clients.length];
      const picks = [products[(i * 7) % products.length], products[(i * 3 + 5) % products.length]].slice(0, (i % 2) + 1);
      const status = statuses[i % statuses.length];
      const items = picks.map((p, k) => {
        const item = {
          product: p._id,
          name: p.name,
          thumbnail: p.thumbnail,
          price: p.price,
          stemChanges: [],
          adjustAmount: 0,
          quantity: k === 0 ? 1 + (i % 2) : 1,
          customerRequest: '',
          requestFee: 0,
          requestStatus: 'none',
          adminNote: '',
        };
        // Vài đơn mẫu có tăng số cành để demo tiền chênh lệch
        const comp = p.components.find((c) => c.adjustable && c.maxStems > c.stems);
        if (k === 0 && comp && i % 5 === 2) {
          const f = flowers.find((x) => x._id.equals(comp.flowerType));
          const stems = Math.min(comp.stems + 2, comp.maxStems);
          item.stemChanges = [{ flowerType: f._id, flowerName: f.name, defaultStems: comp.stems, stems, pricePerStem: f.pricePerStem }];
          item.adjustAmount = (stems - comp.stems) * f.pricePerStem;
        }
        return item;
      });
      // Đơn mẫu có "Yêu cầu của khách hàng": 1 đơn đã báo giá (khách@ thấy ngay), 1 đơn đang chờ báo giá
      if (i === 6) Object.assign(items[0], { customerRequest: 'Thêm thiệp lớn, gói giấy màu kem', requestFee: 30000, requestStatus: 'quoted', adminNote: 'Thiệp khổ A5 + giấy gói kem nhập khẩu' });
      if (i === 14) Object.assign(items[0], { customerRequest: 'Đổi hoa sang tông trắng, thêm nơ lụa', requestStatus: 'waiting_quote' });

      const subTotal = items.reduce((s, it) => s + (it.price + it.adjustAmount) * it.quantity, 0);
      const shippingFee = subTotal >= 500000 ? 0 : 30000;
      const createdAt = new Date(now - (i * 1.2 + 0.5) * 864e5);
      orders.push({
        code: `FH${String(100000 + i)}`,
        user: user._id,
        receiverName: user.fullName,
        receiverPhone: user.phone,
        shippingAddress: '12 Nguyễn Huệ, Phường Sài Gòn, TP. Hồ Chí Minh',
        deliveryDate: new Date(createdAt.getTime() + 864e5),
        deliveryTimeSlot: slots[i % slots.length],
        cardMessage: i % 3 === 0 ? 'Chúc mừng sinh nhật! Luôn vui vẻ nhé ❤' : '',
        items,
        subTotal,
        shippingFee,
        discountAmount: 0,
        requestFeeTotal: 0, // phụ thu chỉ cộng khi khách đồng ý
        total: subTotal + shippingFee,
        paymentMethod: 'COD',
        paymentStatus: status === 'completed' ? 'paid' : 'unpaid',
        status,
        cancelReason: status === 'cancelled' ? 'Khách đổi ý' : '',
        createdAt,
        updatedAt: createdAt,
      });
    }
    await Order.insertMany(orders, { timestamps: false });

    // Cập nhật "đã bán" và tồn kho theo các đơn không bị huỷ
    for (const o of orders.filter((x) => x.status !== 'cancelled')) {
      for (const it of o.items) {
        await Product.updateOne({ _id: it.product }, { $inc: { sold: it.quantity, stock: -it.quantity } });
      }
    }

    // 7. Đánh giá mẫu (từ các đơn đã hoàn thành)
    const reviewed = new Set();
    const reviews = [];
    orders
      .filter((o) => o.status === 'completed')
      .forEach((o, i) => {
        const key = `${o.user}-${o.items[0].product}`;
        if (reviewed.has(key)) return;
        reviewed.add(key);
        reviews.push({
          user: o.user,
          product: o.items[0].product,
          rating: i % 4 === 0 ? 4 : 5,
          comment: data.reviewComments[i % data.reviewComments.length],
        });
      });
    await Review.insertMany(reviews);

    console.log('✅ Seed xong:');
    console.log(`   ${cats.length} loại sản phẩm, ${flowers.length} loại hoa, ${products.length} sản phẩm`);
    console.log(`   ${discounts.length} mã giảm giá, ${data.posts.length} bài viết, ${orders.length} đơn hàng, ${reviews.length} đánh giá`);
    console.log('   Tài khoản admin :', data.users.admin.email, '/', data.users.admin.password);
    console.log('   Tài khoản khách :', data.users.clients[0].email, '/', data.users.clients[0].password);
  } catch (err) {
    console.error('❌ Seed lỗi:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
