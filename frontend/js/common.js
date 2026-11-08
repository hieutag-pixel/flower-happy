// ===== Dùng chung cho mọi trang: gọi API, đăng nhập, header/footer, giỏ hàng, so sánh =====
const API = '/api';

// Tạo đối tượng quản lý phiên đăng nhập. Trang khách và trang quản trị dùng key localStorage RIÊNG,
// nên cùng một trình duyệt có thể vừa đăng nhập khách (tab 1) vừa đăng nhập admin (tab 2).
function createAuth({ tokenKey, userKey, loginPage, afterLogout }) {
  return {
    get token() { return localStorage.getItem(tokenKey); },
    get user() { try { return JSON.parse(localStorage.getItem(userKey)); } catch { return null; } },
    save(token, user) { localStorage.setItem(tokenKey, token); localStorage.setItem(userKey, JSON.stringify(user)); },
    clear() { localStorage.removeItem(tokenKey); localStorage.removeItem(userKey); },
    logout() { this.clear(); location.href = afterLogout; },
    require() {
      if (!this.token) { location.href = `${loginPage}?next=${encodeURIComponent(location.pathname + location.search + location.hash)}`; throw new Error('login'); }
    },
  };
}

// Phiên khách hàng
const Auth = createAuth({ tokenKey: 'fh_token', userKey: 'fh_user', loginPage: '/login.html', afterLogout: '/' });

// Gọi API với token của một phiên (auth). onUnauthorized: xử lý khi token hết hạn / không đủ quyền
async function requestApi(auth, path, opts = {}, onUnauthorized) {
  const headers = { ...(opts.headers || {}) };
  if (auth && auth.token) headers.Authorization = `Bearer ${auth.token}`;
  let body = opts.body;
  if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
  const res = await fetch(API + path, { method: opts.method || 'GET', headers, body });
  const json = await res.json().catch(() => ({ success: false, message: 'Máy chủ trả về dữ liệu không hợp lệ' }));
  if (onUnauthorized && auth && auth.token) onUnauthorized(res.status);
  if (!res.ok || json.success === false) throw new Error(json.message || `Lỗi ${res.status}`);
  return json;
}

// Gọi API phía khách: api('/products'), api('/cart/items', { method: 'POST', body: {...} })
function api(path, opts = {}) {
  return requestApi(Auth, path, opts, (status) => { if (status === 401) Auth.logout(); });
}

// Tiện ích
const money = (n) => `${Number(n || 0).toLocaleString('vi-VN')}đ`;
const moneySigned = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${money(Math.abs(n || 0))}`; // +30.000đ / −15.000đ
const qs = (k) => new URLSearchParams(location.search).get(k);
const $ = (s, el = document) => el.querySelector(s);
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('vi-VN') : '');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('vi-VN') : '');
const stars = (n) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
const priceOf = (p) => (p.salePrice != null && p.salePrice < p.originalPrice ? p.salePrice : p.originalPrice);

const ORDER_STATUS = { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', shipping: 'Đang giao', completed: 'Hoàn thành', cancelled: 'Đã huỷ' };
const PAYMENT = { COD: 'Thanh toán khi nhận hàng', BANKING: 'Chuyển khoản', MOMO: 'Ví MoMo' };
const REQUEST_STATUS = {
  none: '',
  waiting_quote: 'Chờ báo giá',
  quoted: 'Đã báo giá – chờ khách trả lời',
  accepted: 'Khách đã đồng ý phụ thu',
  rejected: 'Khách từ chối – làm theo mẫu gốc',
};

// ===== Bộ icon SVG nét mảnh (phong cách Lucide/Feather), không dùng thư viện ngoài =====
const svgIcon = (paths) =>
  `<svg class="ico" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const ICONS = {
  search: svgIcon('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  bag: svgIcon('<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>'),
  user: svgIcon('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  users: svgIcon('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  menu: svgIcon('<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>'),
  chevronDown: svgIcon('<path d="m6 9 6 6 6-6"/>'),
  mapPin: svgIcon('<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>'),
  phone: svgIcon('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>'),
  mail: svgIcon('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>'),
  truck: svgIcon('<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>'),
  flower: svgIcon('<circle cx="12" cy="12" r="3"/><path d="M12 16.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 1 1 4.5 4.5 4.5 4.5 0 1 1-4.5 4.5"/><path d="M12 7.5V9"/><path d="M7.5 12H9"/><path d="M16.5 12H15"/><path d="M12 16.5V15"/>'),
  gift: svgIcon('<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>'),
  sliders: svgIcon('<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/>'),
  chart: svgIcon('<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>'),
  clipboard: svgIcon('<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>'),
  package: svgIcon('<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>'),
  tag: svgIcon('<path d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r="1"/>'),
  ticket: svgIcon('<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>'),
  fileText: svgIcon('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>'),
  arrowLeft: svgIcon('<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>'),
  logout: svgIcon('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>'),
  check: svgIcon('<path d="M20 6 9 17l-5-5"/>'),
  plus: svgIcon('<path d="M5 12h14"/><path d="M12 5v14"/>'),
  alert: svgIcon('<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>'),
};
// Gắn icon vào các phần tử HTML tĩnh có thuộc tính data-icon="tên"
function fillIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    if (ICONS[el.dataset.icon] && !el.querySelector('svg')) el.insertAdjacentHTML('afterbegin', ICONS[el.dataset.icon]);
  });
}

function toast(msg, type = 'ok') {
  let box = $('#toast');
  if (!box) { box = document.createElement('div'); box.id = 'toast'; document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

// Hiển thị các loại hoa khách đã chỉnh số cành + tiền chênh lệch (dùng ở giỏ, thanh toán, đơn hàng, admin)
function stemChangesHtml(item) {
  if (!item.stemChanges || !item.stemChanges.length) return '';
  return `<div class="stem-changes">${item.stemChanges.map((c) => `<div>${esc(c.flowerName)}: ${c.defaultStems} → <b>${c.stems}</b> cành
      <span class="muted">(${moneySigned((c.stems - c.defaultStems) * c.pricePerStem)})</span></div>`).join('')}
    <div>Điều chỉnh: <b>${moneySigned(item.adjustAmount)}</b> / sản phẩm</div></div>`;
}

// ===== Header & Footer =====
function renderLayout() {
  fillIcons();
  if (window.ADMIN_PAGE) return; // trang admin có giao diện riêng
  const page = location.pathname.split('/').pop() || 'index.html';
  const link = (href, text) => `<a href="${href}" class="${page === href.slice(1) ? 'active' : ''}">${text}</a>`;
  const user = Auth.user;
  const header = document.createElement('div');
  header.innerHTML = `
    <div class="topbar">Giao hoa nhanh 2 giờ nội thành <span class="sep">•</span> Miễn phí giao hàng cho đơn từ 500.000đ <span class="sep">•</span> Tặng thiệp viết tay</div>
    <header class="header"><div class="container">
      <button class="menu-toggle icon-btn" aria-label="Menu" onclick="document.querySelector('.nav').classList.toggle('open')">${ICONS.menu}</button>
      <a href="/" class="logo"><img src="/images/logo-sm.png" alt="Flowers Happy"></a>
      <nav class="nav">
        ${link('/index.html', 'Trang chủ')}
        ${link('/products.html', 'Sản phẩm')}
        ${link('/posts.html', 'Bài viết')}
        ${link('/compare.html', 'So sánh')}
      </nav>
      <form class="search" action="/products.html">
        <input name="q" placeholder="Tìm bó hoa..." value="${esc(qs('q') || '')}" aria-label="Tìm kiếm">
        <button aria-label="Tìm">${ICONS.search}</button>
      </form>
      <div class="header-actions">
        <a href="/cart.html" class="icon-link" aria-label="Giỏ hàng" title="Giỏ hàng">${ICONS.bag}<span class="badge hidden" id="cartCount">0</span></a>
        ${user ? `
          <div class="user-menu" tabindex="0">
            <span class="user-trigger"><span class="icon-link">${ICONS.user}<span class="dot hidden" id="quoteDot"></span></span>
              <span class="user-name">${esc(user.fullName.split(' ').pop())}</span>${ICONS.chevronDown}</span>
            <div class="dropdown">
              <a href="/account.html">Tài khoản của tôi</a>
              <a href="/orders.html" class="with-dot">Đơn hàng của tôi <span class="dot-inline hidden" id="quoteDotMenu"></span></a>
              <button onclick="Auth.logout()">Đăng xuất</button>
            </div>
          </div>` : '<a href="/login.html" class="btn btn-sm">Đăng nhập</a>'}
      </div>
    </div></header>`;
  document.body.prepend(...header.children);

  const footer = document.createElement('footer');
  footer.className = 'footer';
  footer.innerHTML = `<div class="container">
    <div class="cols">
      <div><h4>Flowers Happy</h4><p>Tiệm hoa tươi gửi trọn yêu thương trong từng đoá hoa. Thiết kế theo yêu cầu, giao nhanh trong ngày.</p></div>
      <div><h4>Mua sắm</h4><a href="/products.html">Tất cả sản phẩm</a><a href="/products.html?category=sinh-nhat">Hoa sinh nhật</a><a href="/products.html?category=tinh-yeu">Hoa tình yêu</a><a href="/products.html?category=khai-truong">Hoa khai trương</a></div>
      <div><h4>Liên hệ</h4><ul class="contact">
        <li>${ICONS.mapPin}<span>Địa chỉ cửa hàng (cập nhật)</span></li>
        <li>${ICONS.phone}<span>Hotline (cập nhật)</span></li>
        <li>${ICONS.mail}<span>Email (cập nhật)</span></li></ul></div>
    </div>
    <div class="copy">© ${new Date().getFullYear()} Flowers Happy – Dự án tốt nghiệp <a href="/admin/login.html" class="admin-link">Quản trị</a></div>
  </div>`;
  document.body.appendChild(footer);
  updateCartCount();
  updateQuoteNotice();
  renderCompareBar();
}

async function updateCartCount() {
  const el = $('#cartCount');
  if (!el || !Auth.token) return;
  try {
    const { data } = await api('/cart');
    el.textContent = data.count;
    el.classList.toggle('hidden', !data.count);
  } catch { /* bỏ qua */ }
}

// Chấm đỏ ở mục "Đơn hàng của tôi" khi cửa hàng đã báo giá, chờ khách trả lời
async function updateQuoteNotice() {
  if (!Auth.token || !$('#quoteDot')) return;
  try {
    const { data } = await api('/orders/my/quote-count');
    ['#quoteDot', '#quoteDotMenu'].forEach((s) => $(s)?.classList.toggle('hidden', !data.count));
    if (data.count) $('#quoteDot').title = `${data.count} đơn có báo giá cần bạn trả lời`;
  } catch { /* bỏ qua */ }
}

// Thêm vào giỏ. options: { customerRequest, stemChanges: [{ flowerType, stems }] }. Trả về true nếu thành công
async function addToCart(productId, quantity = 1, options = {}) {
  if (!Auth.token) { toast('Vui lòng đăng nhập để thêm vào giỏ', 'err'); setTimeout(() => Auth.require(), 800); return false; }
  try {
    await api('/cart/items', { method: 'POST', body: { productId, quantity, customerRequest: options.customerRequest || '', stemChanges: options.stemChanges || [] } });
    toast('Đã thêm vào giỏ hàng');
    updateCartCount();
    return true;
  } catch (e) { toast(e.message, 'err'); return false; }
}

// ===== So sánh sản phẩm (lưu trên trình duyệt, tối đa 4) =====
const compareLabel = (on) => `${on ? ICONS.check : ICONS.plus}<span>So sánh</span>`;
const Compare = {
  get ids() { try { return JSON.parse(localStorage.getItem('fh_compare')) || []; } catch { return []; } },
  set ids(v) { localStorage.setItem('fh_compare', JSON.stringify(v)); renderCompareBar(); },
  toggle(id, btn) {
    let ids = this.ids;
    if (ids.includes(id)) ids = ids.filter((x) => x !== id);
    else { if (ids.length >= 4) return toast('Chỉ so sánh tối đa 4 sản phẩm', 'err'); ids.push(id); }
    this.ids = ids;
    if (btn) { btn.classList.toggle('on', ids.includes(id)); btn.innerHTML = compareLabel(ids.includes(id)); }
  },
};
function renderCompareBar() {
  let bar = $('.compare-bar');
  const n = Compare.ids.length;
  if (!n || location.pathname.endsWith('compare.html')) { bar?.remove(); return; }
  if (!bar) { bar = document.createElement('div'); bar.className = 'compare-bar'; document.body.appendChild(bar); }
  bar.innerHTML = `<span>Đã chọn ${n} sản phẩm để so sánh</span><a class="btn btn-sm" href="/compare.html">So sánh ngay</a>`;
}

// Thẻ sản phẩm dùng chung
function productCard(p) {
  const price = p.price ?? priceOf(p);
  const onSale = p.salePrice != null && p.salePrice < p.originalPrice;
  const inCompare = Compare.ids.includes(p._id);
  return `<div class="card">
    <div class="thumb">
      <a href="/product.html?slug=${p.slug}"><img src="${p.thumbnail}" alt="${esc(p.name)}" loading="lazy"></a>
      ${onSale ? `<span class="sale">-${Math.round((1 - p.salePrice / p.originalPrice) * 100)}%</span>` : ''}
      <button class="compare-btn ${inCompare ? 'on' : ''}" onclick="Compare.toggle('${p._id}', this)">${compareLabel(inCompare)}</button>
    </div>
    <div class="body">
      <a href="/product.html?slug=${p.slug}"><h3>${esc(p.name)}</h3></a>
      <div class="price">${money(price)}${onSale ? `<del>${money(p.originalPrice)}</del>` : ''}</div>
      <div class="actions">
        ${p.stock > 0 ? `<button class="btn" onclick="addToCart('${p._id}')">Thêm vào giỏ</button>` : '<button class="btn" disabled>Hết hàng</button>'}
      </div>
    </div>
  </div>`;
}

function pagination(el, { page, totalPages }, onGo) {
  if (!totalPages || totalPages <= 1) { el.innerHTML = ''; return; }
  el.innerHTML = Array.from({ length: totalPages }, (_, i) => `<button class="${i + 1 === page ? 'active' : ''}" data-p="${i + 1}">${i + 1}</button>`).join('');
  el.querySelectorAll('button').forEach((b) => (b.onclick = () => onGo(Number(b.dataset.p))));
}

document.addEventListener('DOMContentLoaded', renderLayout);
