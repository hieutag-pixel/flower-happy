// Bảng ĐỊA CHỈ (1 người dùng - n địa chỉ)
const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // mã người dùng
    receiverName: { type: String, required: [true, 'Thiếu tên người nhận'], trim: true },
    receiverPhone: { type: String, required: [true, 'Thiếu SĐT người nhận'], trim: true },
    province: { type: String, required: [true, 'Thiếu tỉnh/thành phố'] },
    ward: { type: String, required: [true, 'Thiếu phường/xã'] },
    detail: { type: String, required: [true, 'Thiếu địa chỉ chi tiết'] },
    isDefault: { type: Boolean, default: false }, // mặc định
  },
  { timestamps: true }
);

module.exports = mongoose.model('Address', addressSchema);
