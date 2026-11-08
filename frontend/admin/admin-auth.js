// ===== Phiên đăng nhập TRANG QUẢN TRỊ (tách riêng với phiên khách hàng) =====
// Dùng key localStorage riêng 'fh_admin_token' / 'fh_admin_user' nên không ảnh hưởng tài khoản khách đang đăng nhập.
const AdminAuth = createAuth({
  tokenKey: 'fh_admin_token',
  userKey: 'fh_admin_user',
  loginPage: '/admin/login.html',
  afterLogout: '/admin/login.html',
});

// Gọi API bằng token admin. Khi 401/403 chỉ xoá phiên admin rồi về trang đăng nhập quản trị, KHÔNG đụng phiên khách
function adminApi(path, opts = {}) {
  return requestApi(AdminAuth, path, opts, (status) => {
    if (status === 401 || status === 403) {
      AdminAuth.clear();
      location.href = `/admin/login.html?expired=1`;
    }
  });
}
