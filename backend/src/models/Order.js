// Bảng ĐƠN HÀNG + CHI TIẾT ĐƠN HÀNG (nhúng vào mảng items)
const mongoose = require('mongoose');

// Loại hoa khách đã chỉnh số cành - lưu lại tên + giá cành tại thời điểm mua
const stemChangeSchema = new mongoose.Schema(
  {
    flowerType: { type: mongoose.Schema.Types.ObjectId, ref: 'FlowerType', required: true }, // mã loại hoa
    flowerName: { type: String, required: true }, // tên loại hoa lúc mua
    defaultStems: { type: Number, required: true }, // số cành mặc định
    stems: { type: Number, required: true }, // số cành khách chọn
    pricePerStem: { type: Number, default: 0 }, // giá mỗi cành lúc mua
  },
  { _id: false }
);

// Trạng thái "Yêu cầu của khách hàng"
// none: không có yêu cầu | waiting_quote: chờ cửa hàng báo giá | quoted: đã báo giá, chờ khách trả lời
// accepted: khách đồng ý phụ thu | rejected: khách từ chối, làm theo mẫu gốc
const REQUEST_STATUS = ['none', 'waiting_quote', 'quoted', 'accepted', 'rejected'];

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true }, // mã sản phẩm
  name: { type: String, required: true }, // tên sản phẩm tại thời điểm mua
  thumbnail: { type: String },
  price: { type: Number, required: true }, // giá bán (chưa tính chỉnh số cành)
  stemChanges: [stemChangeSchema], // các loại hoa đã tăng/giảm số cành
  adjustAmount: { type: Number, default: 0 }, // tiền chênh lệch do chỉnh số cành / 1 sản phẩm (có thể âm)
  quantity: { type: Number, required: true, min: 1 }, // số lượng
  customerRequest: { type: String, default: '' }, // yêu cầu của khách hàng
  requestFee: { type: Number, default: 0, min: 0 }, // phụ thu cửa hàng báo giá cho yêu cầu (tính cho cả dòng)
  requestStatus: { type: String, enum: REQUEST_STATUS, default: 'none' }, // trạng thái báo giá
  adminNote: { type: String, default: '' }, // ghi chú của cửa hàng khi báo giá
});

const ORDER_STATUS = ['pending', 'confirmed', 'shipping', 'completed', 'cancelled'];

const orderSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true }, // mã đơn (FH...)
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // mã người dùng
    discount: { type: mongoose.Schema.Types.ObjectId, ref: 'Discount', default: null }, // mã giảm giá
    discountCode: { type: String, default: '' },
    receiverName: { type: String, required: [true, 'Thiếu tên người nhận'] },
    receiverPhone: { type: String, required: [true, 'Thiếu SĐT người nhận'] },
    shippingAddress: { type: String, required: [true, 'Thiếu địa chỉ giao hàng'] },
    deliveryDate: { type: Date }, // ngày giao
    deliveryTimeSlot: { type: String, default: '' }, // khung giờ giao
    cardMessage: { type: String, default: '' }, // lời nhắn trên thiệp
    items: { type: [orderItemSchema], validate: [(v) => v.length > 0, 'Đơn hàng trống'] },
    subTotal: { type: Number, required: true }, // tạm tính
    shippingFee: { type: Number, default: 0 }, // phí giao hàng
    discountAmount: { type: Number, default: 0 }, // tiền giảm
    requestFeeTotal: { type: Number, default: 0 }, // tổng phụ thu các yêu cầu khách đã đồng ý
    total: { type: Number, required: true }, // tổng tiền = subTotal + shippingFee - discountAmount + requestFeeTotal
    paymentMethod: { type: String, enum: ['COD', 'BANKING', 'MOMO'], default: 'COD' },
    paymentStatus: { type: String, enum: ['unpaid', 'paid'], default: 'unpaid' },
    status: { type: String, enum: ORDER_STATUS, default: 'pending' }, // trạng thái đơn
    cancelReason: { type: String, default: '' }, // lý do huỷ đơn
    note: { type: String, default: '' }, // ghi chú
  },
  { timestamps: true }
);

orderSchema.statics.STATUS = ORDER_STATUS;
orderSchema.statics.REQUEST_STATUS = REQUEST_STATUS;

module.exports = mongoose.model('Order', orderSchema);
