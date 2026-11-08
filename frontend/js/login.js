// Đăng nhập & đăng ký (trang khách). Đăng nhập ở đây LUÔN là phiên khách,
// trang quản trị có trang đăng nhập riêng: /admin/login.html
function afterLogin({ token, data }) {
  Auth.save(token, data);
  toast(`Xin chào ${data.fullName}!`);
  const next = qs('next');
  // Chỉ cho chuyển tới trang nội bộ của web khách, tránh next trỏ ra ngoài hoặc vào /admin/
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/admin') ? next : '/';
  setTimeout(() => (location.href = safeNext), 600);
}

document.addEventListener('DOMContentLoaded', () => {
  const login = $('#loginForm');
  if (login) login.onsubmit = async (e) => {
    e.preventDefault();
    try { afterLogin(await api('/auth/login', { method: 'POST', body: Object.fromEntries(new FormData(login)) })); }
    catch (err) { toast(err.message, 'err'); }
  };

  const reg = $('#registerForm');
  if (reg) reg.onsubmit = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(reg));
    if (body.password !== body.confirm) return toast('Mật khẩu nhập lại không khớp', 'err');
    delete body.confirm;
    try { afterLogin(await api('/auth/register', { method: 'POST', body })); }
    catch (err) { toast(err.message, 'err'); }
  };
});
