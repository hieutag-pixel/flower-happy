// Bảng LOẠI SẢN PHẨM (thẻ). Quan hệ n-n với Sản phẩm qua mảng product.categories
// (thay cho bảng trung gian SẢN PHẨM - LOẠI trong ERD)
const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Thiếu tên thẻ'], trim: true }, // tên thẻ
    slug: { type: String, required: true, unique: true },
    // loại thẻ: occasion = Dịp tặng (Sinh nhật, Tình yêu...), style = Kiểu dáng (Bó, Giỏ, Bình...)
    type: { type: String, enum: ['occasion', 'style'], default: 'occasion' },
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Category', categorySchema);
