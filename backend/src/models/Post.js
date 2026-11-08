// Bảng BÀI VIẾT
const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // mã tác giả
    title: { type: String, required: [true, 'Thiếu tiêu đề'], trim: true },
    slug: { type: String, required: true, unique: true },
    summary: { type: String, default: '' },
    content: { type: String, default: '' }, // nội dung (HTML đơn giản)
    thumbnail: { type: String }, // ảnh đại diện
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Post', postSchema);
