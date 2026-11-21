// Các hàm tiện ích dùng chung

// Lỗi có mã HTTP
class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// Bọc controller async để lỗi tự chuyển tới middleware xử lý lỗi
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// "Hoa Hồng Đỏ" -> "hoa-hong-do"
const slugify = (text = '') =>
  text
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

// Escape ký tự đặc biệt khi tìm kiếm bằng RegExp
const escapeRegex = (s = '') => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Lấy page/limit từ query
const getPaging = (query, defaultLimit = 12) => {
  const page = Math.max(parseInt(query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit) || defaultLimit, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};

// ===== Mã đơn hàng: FH-<ngày><tháng><năm>-<số thứ tự trong ngày> =====
// Ví dụ FH-14112026-003: FH = Flower Happy, 14112026 = đặt ngày 14/11/2026 (giờ Việt Nam), 003 = đơn thứ 3 của ngày đó.
const orderCodePrefix = (date = new Date()) => {
  const d = new Date(date.getTime() + 7 * 36e5); // đổi sang giờ Việt Nam (UTC+7)
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `FH-${dd}${mm}${d.getUTCFullYear()}-`;
};
const orderCode = (date, seq) => `${orderCodePrefix(date)}${String(seq).padStart(3, '0')}`;

module.exports = { AppError, asyncHandler, slugify, escapeRegex, getPaging, orderCodePrefix, orderCode };
