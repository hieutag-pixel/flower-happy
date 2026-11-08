// Bảng NGƯỜI DÙNG
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: [true, 'Vui lòng nhập họ tên'], trim: true }, // họ tên
    email: {
      type: String,
      required: [true, 'Vui lòng nhập email'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Email không hợp lệ'],
    },
    password: { type: String, required: true, minlength: [6, 'Mật khẩu tối thiểu 6 ký tự'], select: false }, // mật khẩu (đã mã hoá)
    phone: { type: String, trim: true }, // số điện thoại
    role: { type: String, enum: ['client', 'admin'], default: 'client' }, // vai trò
    status: { type: Boolean, default: true }, // trạng thái (false = bị khoá)
  },
  { timestamps: true } // createdAt = ngày tạo
);

// Mã hoá mật khẩu trước khi lưu
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

// Không trả mật khẩu ra ngoài
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
