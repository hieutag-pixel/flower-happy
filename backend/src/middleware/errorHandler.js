// Middleware xử lý lỗi tập trung
const notFound = (req, res) => {
  res.status(404).json({ success: false, message: `Không tìm thấy đường dẫn ${req.originalUrl}` });
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message || 'Lỗi máy chủ';

  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Mã (ID) không hợp lệ';
  } else if (err.code === 11000) {
    status = 400;
    message = `Giá trị đã tồn tại: ${Object.keys(err.keyValue || {}).join(', ')}`;
  } else if (err.code === 'LIMIT_FILE_SIZE') {
    status = 400;
    message = 'Ảnh quá lớn (tối đa 5MB)';
  }

  if (status >= 500) console.error(err);
  res.status(status).json({ success: false, message });
};

module.exports = { notFound, errorHandler };
