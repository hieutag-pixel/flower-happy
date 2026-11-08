// Điểm khởi động server Flower Happy
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const apiRoutes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

if (!process.env.JWT_SECRET) {
  console.error('❌ Thiếu JWT_SECRET trong file .env (xem .env.example)');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
// Express 5: req.body = undefined khi request không có body -> gán {} cho an toàn
app.use((req, res, next) => {
  if (!req.body) req.body = {};
  next();
});

// API
app.use('/api', apiRoutes);
app.use('/api', notFound);

// Ảnh admin upload
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Giao diện (thư mục frontend)
app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🌸 Flower Happy đang chạy tại: http://localhost:${PORT}`);
    console.log(`   Trang quản trị:            http://localhost:${PORT}/admin/login.html`);
  });
});
