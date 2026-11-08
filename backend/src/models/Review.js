// ĐÁNH GIÁ / BÌNH LUẬN sản phẩm
// (Use case "Bình luận" & "Đánh giá đơn hàng" có nhưng ERD CHƯA có bảng này -> cần bổ sung vào ERD)
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    rating: { type: Number, min: 1, max: 5, required: [true, 'Vui lòng chọn số sao'] },
    comment: { type: String, trim: true, default: '' },
    status: { type: Boolean, default: true }, // admin có thể ẩn
  },
  { timestamps: true }
);

reviewSchema.index({ user: 1, product: 1 }, { unique: true }); // mỗi người 1 đánh giá / sản phẩm

module.exports = mongoose.model('Review', reviewSchema);
