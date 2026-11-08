// Bảng GIỎ HÀNG (mỗi người dùng 1 giỏ, nhiều dòng sản phẩm)
const mongoose = require('mongoose');

// Loại hoa khách đã chỉnh số cành (chỉ lưu những loại khác số cành mặc định)
const stemChangeSchema = new mongoose.Schema(
  {
    flowerType: { type: mongoose.Schema.Types.ObjectId, ref: 'FlowerType', required: true }, // mã loại hoa
    flowerName: { type: String }, // tên loại hoa
    defaultStems: { type: Number }, // số cành mặc định của sản phẩm
    stems: { type: Number, required: true }, // số cành khách chọn
    pricePerStem: { type: Number, default: 0 }, // giá mỗi cành
  },
  { _id: false }
);

const cartItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true }, // mã sản phẩm
  quantity: { type: Number, required: true, min: 1, default: 1 }, // số lượng
  stemChanges: [stemChangeSchema], // các loại hoa đã tăng/giảm số cành
  adjustAmount: { type: Number, default: 0 }, // tiền chênh lệch do chỉnh số cành (có thể âm) - server tự tính lại
  customerRequest: { type: String, default: '' }, // yêu cầu của khách hàng (cửa hàng báo giá sau)
});

const cartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true }, // mã người dùng
    items: [cartItemSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Cart', cartSchema);
