// Bảng MÃ GIẢM GIÁ
const mongoose = require('mongoose');

const discountSchema = new mongoose.Schema(
  {
    code: { type: String, required: [true, 'Thiếu mã khuyến mãi'], unique: true, uppercase: true, trim: true },
    type: { type: String, enum: ['percentage', 'fixed'], required: true }, // loại giảm: % hoặc số tiền
    value: { type: Number, required: true, min: 0 }, // giá trị giảm
    maxDiscount: { type: Number, default: null }, // giảm tối đa (cho loại %)
    minOrder: { type: Number, default: 0 }, // đơn tối thiểu
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    maxUsage: { type: Number, default: 100 }, // số lượt tối đa
    usedCount: { type: Number, default: 0 }, // số lượt đã dùng
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Kiểm tra mã có dùng được cho đơn có tạm tính subTotal không. Trả về số tiền giảm.
discountSchema.methods.calculate = function (subTotal) {
  const now = new Date();
  if (!this.status) throw new Error('Mã giảm giá đã bị vô hiệu');
  if (now < this.startDate) throw new Error('Mã giảm giá chưa đến thời gian áp dụng');
  if (now > this.endDate) throw new Error('Mã giảm giá đã hết hạn');
  if (this.usedCount >= this.maxUsage) throw new Error('Mã giảm giá đã hết lượt sử dụng');
  if (subTotal < this.minOrder)
    throw new Error(`Đơn tối thiểu ${this.minOrder.toLocaleString('vi-VN')}đ để dùng mã này`);

  let amount = this.type === 'percentage' ? Math.round((subTotal * this.value) / 100) : this.value;
  if (this.type === 'percentage' && this.maxDiscount) amount = Math.min(amount, this.maxDiscount);
  return Math.min(amount, subTotal);
};

module.exports = mongoose.model('Discount', discountSchema);
