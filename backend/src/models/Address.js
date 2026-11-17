// Bảng ĐỊA CHỈ (1 người dùng - n địa chỉ)
const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // mã người dùng
    receiverName: { type: String, required: [true, 'Thiếu tên người nhận'], trim: true },
    receiverPhone: { type: String, required: [true, 'Thiếu SĐT người nhận'], trim: true },
    // Trang thanh toán chỉ còn 1 ô địa chỉ nên phường/xã, tỉnh/thành không bắt buộc (địa chỉ cũ vẫn giữ nguyên)
    province: { type: String, default: '', trim: true },
    ward: { type: String, default: '', trim: true },
    detail: { type: String, required: [true, 'Thiếu địa chỉ chi tiết'], trim: true },
    isDefault: { type: Boolean, default: false }, // mặc định
  },
  { timestamps: true }
);

module.exports = mongoose.model('Address', addressSchema);
