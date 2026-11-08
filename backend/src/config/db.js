const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ Thiếu MONGODB_URI trong file .env (xem .env.example)');
    process.exit(1);
  }
  try {
    await mongoose.connect(uri);
    console.log('✅ Kết nối MongoDB thành công:', mongoose.connection.name);
  } catch (error) {
    console.error('❌ Kết nối MongoDB thất bại:', error.message);
    console.error('   → Kiểm tra MongoDB đã chạy chưa (mở MongoDB Compass thử kết nối).');
    process.exit(1);
  }
};

module.exports = connectDB;
