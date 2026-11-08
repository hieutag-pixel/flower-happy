// Bảng SẢN PHẨM
// - ẢNH SẢN PHẨM      -> nhúng vào mảng images
// - SẢN PHẨM - LOẠI   -> mảng categories (ref Category)
// - THÀNH PHẦN SẢN PHẨM -> nhúng vào mảng components
const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true }, // đường dẫn ảnh
    isMain: { type: Boolean, default: false }, // là ảnh chính
  },
  { _id: true }
);

const componentSchema = new mongoose.Schema(
  {
    flowerType: { type: mongoose.Schema.Types.ObjectId, ref: 'FlowerType', required: true }, // mã loại hoa
    stems: {
      type: Number,
      default: 1,
      min: 0,
      // Số cành mặc định phải nằm trong khoảng min – max (chỉ kiểm tra khi cho tăng giảm)
      validate: {
        validator(v) {
          return !this.adjustable || (v >= this.minStems && v <= this.maxStems);
        },
        message: 'Số cành mặc định phải nằm trong khoảng Min – Max cành',
      },
    }, // số cành mặc định
    minStems: { type: Number, default: 1, min: 0 }, // số cành tối thiểu khách được chọn
    maxStems: {
      type: Number,
      min: 0,
      default() {
        return (this.stems || 1) * 2;
      },
    }, // số cành tối đa (mặc định = gấp đôi số cành mặc định)
    adjustable: { type: Boolean, default: false }, // cho phép khách tăng/giảm số cành
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Thiếu tên sản phẩm'], trim: true },
    slug: { type: String, required: true, unique: true },
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    description: { type: String, default: '' },
    originalPrice: { type: Number, required: [true, 'Thiếu giá gốc'], min: 0 }, // giá gốc
    salePrice: { type: Number, min: 0, default: null }, // giá khuyến mãi (null = không giảm)
    stock: { type: Number, default: 0, min: 0 }, // tồn kho
    sold: { type: Number, default: 0 }, // đã bán (phục vụ thống kê bán chạy)
    thumbnail: { type: String }, // ảnh đại diện
    images: [imageSchema],
    components: [componentSchema],
    status: { type: Boolean, default: true }, // true = hiển thị, false = ẩn
    deleted: { type: Boolean, default: false }, // xoá mềm
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Giá bán thực tế
productSchema.virtual('price').get(function () {
  return this.salePrice != null && this.salePrice < this.originalPrice ? this.salePrice : this.originalPrice;
});

productSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Product', productSchema);
