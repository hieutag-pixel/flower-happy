// Bảng LOẠI HOA (Hoa hồng, Cúc tana, Lavender...)
const mongoose = require('mongoose');

const flowerTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Thiếu tên loại hoa'], trim: true, unique: true },
    color: { type: String }, // màu sắc
    image: { type: String }, // ảnh
    pricePerStem: { type: Number, default: 0, min: [0, 'Giá mỗi cành không được âm'] }, // giá mỗi cành (dùng khi khách tăng/giảm số cành)
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FlowerType', flowerTypeSchema);
