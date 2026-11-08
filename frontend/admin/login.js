// Đăng nhập trang quản trị - chỉ chấp nhận tài khoản role 'admin', lưu vào phiên admin riêng
document.addEventListener('DOMContentLoaded', () => {
  const next = qs('next');
  const goAdmin = () => (location.href = next && next.startsWith('/admin/') ? next : '/admin/');

  // Đã đăng nhập admin rồi thì vào thẳng trang quản trị
  if (AdminAuth.token && AdminAuth.user?.role === 'admin') return goAdmin();
  if (qs('expired')) toast('Phiên quản trị đã hết hạn hoặc không đủ quyền, vui lòng đăng nhập lại', 'err');

  const form = $('#adminLoginForm');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button');
    btn.disabled = true;
    try {
      // Gọi API không kèm token (null) để không dùng nhầm phiên khách
      const { token, data } = await requestApi(null, '/auth/login', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
      if (data.role !== 'admin') throw new Error('Tài khoản không có quyền quản trị');
      AdminAuth.save(token, data);
      toast(`Xin chào ${data.fullName}`);
      setTimeout(goAdmin, 500);
    } catch (err) {
      toast(err.message, 'err');
      btn.disabled = false;
    }
  };
});
