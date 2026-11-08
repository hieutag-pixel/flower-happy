// ===== Trang quản trị Flowers Happy =====
// Mỗi tab là một hàm render vào #view. Form thêm/sửa dùng chung hộp thoại #modal.

const TABS = {
  dashboard: ['Báo cáo & thống kê', renderDashboard],
  orders: ['Quản lý đơn hàng', renderOrders],
  products: ['Quản lý sản phẩm', renderProducts],
  categories: ['Loại sản phẩm (thẻ)', renderCategories],
  flowers: ['Loại hoa', renderFlowers],
  discounts: ['Mã giảm giá', renderDiscounts],
  users: ['Người dùng', renderUsers],
  posts: ['Bài viết', renderPosts],
};
const view = () => $('#view');
const yes = (b) => (b ? '<span class="status completed">Hiển thị</span>' : '<span class="status cancelled">Ẩn</span>');

// ---------- Hộp thoại dùng chung ----------
let modalSubmit = null;
function openModal(title, html, onSubmit, submitText = 'Lưu') {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = html;
  $('#modalSubmit').textContent = submitText;
  $('#modalSubmit').classList.toggle('hidden', !onSubmit);
  modalSubmit = onSubmit;
  $('#modal').showModal();
}
function closeModal() { $('#modal').close(); }
$('#modalForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!modalSubmit) return closeModal();
  const btn = $('#modalSubmit');
  btn.disabled = true;
  try {
    await modalSubmit(new FormData($('#modalForm')));
    closeModal();
  } catch (err) { toast(err.message, 'err'); }
  btn.disabled = false;
});

const input = (name, label, value = '', attrs = '') =>
  `<div class="field"><label>${label}</label><input name="${name}" value="${esc(value ?? '')}" ${attrs}></div>`;
const checkbox = (name, label, checked) =>
  `<label style="font-weight:400;display:flex;gap:8px;align-items:center"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''} style="width:auto"> ${label}</label>`;
const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

// ================= DASHBOARD =================
async function renderDashboard() {
  view().innerHTML = `<div class="bar">
      <select id="period"><option value="day">Theo ngày</option><option value="month">Theo tháng</option><option value="year">Theo năm</option></select>
      <label style="margin:0">Từ</label><input type="date" id="from"><label style="margin:0">đến</label><input type="date" id="to">
      <button class="btn btn-sm" id="statBtn">Xem</button></div><div id="statBody">Đang tải...</div>`;
  const load = async () => {
    const p = new URLSearchParams({ period: $('#period').value });
    if ($('#from').value) p.set('from', $('#from').value);
    if ($('#to').value) p.set('to', $('#to').value);
    const { data } = await adminApi(`/admin/stats?${p}`);
    const s = data.summary;
    const max = Math.max(...data.revenue.map((r) => r.revenue), 1);
    $('#statBody').innerHTML = `
      <div class="stat-cards">
        <div class="stat"><small>Doanh thu (đơn hoàn thành)</small><b>${money(s.revenue)}</b></div>
        <div class="stat"><small>Đơn hoàn thành</small><b>${s.completedOrders}</b></div>
        <div class="stat"><small>Khách hàng</small><b>${s.totalUsers}</b></div>
        <div class="stat"><small>Sản phẩm</small><b>${s.totalProducts}</b></div>
        <div class="stat"><small>Mã giảm giá đang chạy</small><b>${s.activeDiscounts}</b></div>
      </div>
      <div class="panel"><h3>Doanh thu</h3>
        ${data.revenue.length ? `<div class="chart">${data.revenue.map((r) => `<div class="col" title="${r._id}: ${money(r.revenue)} (${r.orders} đơn)">
          <div class="fill" style="height:${(r.revenue / max) * 100}%"></div><div class="lbl">${r._id.slice(data.range.period === 'day' ? 5 : 0)}</div></div>`).join('')}</div>`
          : '<p class="muted">Chưa có doanh thu trong khoảng thời gian này.</p>'}
      </div>
      <div class="stat-cards" style="margin-top:20px">
        ${Object.entries(ORDER_STATUS).map(([k, v]) => `<div class="stat"><small>${v}</small><b>${data.statusCount[k] || 0}</b></div>`).join('')}
      </div>
      <div class="grid2">
        <div class="panel"><h3>Top bán chạy</h3><table class="table">
          ${data.bestSellers.map((p) => `<tr><td><img src="${p.thumbnail}" alt=""></td><td>${esc(p.name)}</td><td>Đã bán <b>${p.sold}</b></td></tr>`).join('')}</table></div>
        <div class="panel"><h3>Sắp hết hàng (≤ 5)</h3><table class="table">
          ${data.lowStock.length ? data.lowStock.map((p) => `<tr><td><img src="${p.thumbnail}" alt=""></td><td>${esc(p.name)}</td><td>Tồn <b>${p.stock}</b></td></tr>`).join('') : '<tr><td class="muted">Không có</td></tr>'}</table></div>
      </div>`;
  };
  $('#statBtn').onclick = () => load().catch((e) => toast(e.message, 'err'));
  await load();
}

// ================= ĐƠN HÀNG =================
const NEXT = { pending: ['confirmed', 'cancelled'], confirmed: ['shipping', 'cancelled'], shipping: ['completed', 'cancelled'], completed: [], cancelled: [] };
// Yêu cầu của khách chưa chốt (chưa báo giá / khách chưa trả lời) -> chưa cho xác nhận đơn
const OPEN_REQUEST = ['waiting_quote', 'quoted'];
let orderPage = 1;
async function renderOrders(page = orderPage) {
  if (!$('#oq')) {
    page = 1; // mới mở tab: về trang 1
    view().innerHTML = `<div class="bar"><input id="oq" class="grow" placeholder="Tìm mã đơn, tên, SĐT người nhận">
      <select id="ost"><option value="">Tất cả trạng thái</option>${Object.entries(ORDER_STATUS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      <select id="opay"><option value="">Thanh toán: Tất cả</option><option value="unpaid">Chưa thanh toán</option><option value="paid">Đã thanh toán</option></select>
      <select id="oreq"><option value="">Yêu cầu KH: Tất cả</option><option value="waiting_quote">Chờ báo giá</option><option value="quoted">Chờ khách trả lời</option></select>
      <select id="osort"><option value="asc">Đặt trước xử lý trước (cũ → mới)</option><option value="desc">Mới nhất trước</option></select>
      <button class="btn btn-sm" id="ofind">Lọc</button></div><div class="panel table-wrap" id="otable"></div><div class="pagination" id="opager"></div>`;
    $('#ofind').onclick = () => renderOrders(1);
    ['#ost', '#opay', '#oreq', '#osort'].forEach((s) => ($(s).onchange = () => renderOrders(1)));
  }
  orderPage = page;
  const p = new URLSearchParams({ page, q: $('#oq').value, status: $('#ost').value, paymentStatus: $('#opay').value, request: $('#oreq').value, sort: $('#osort').value });
  const res = await adminApi(`/orders?${p}`);
  const requestTag = (o) => {
    if (o.items.some((i) => i.requestStatus === 'waiting_quote')) return '<br><span class="status waiting_quote">Chờ báo giá</span>';
    if (o.items.some((i) => i.requestStatus === 'quoted')) return '<br><span class="status quoted">Chờ khách trả lời</span>';
    return '';
  };
  $('#otable').innerHTML = `<table class="table orders-table"><tr><th>Mã đơn</th><th>Ngày đặt</th><th>Người nhận</th><th>Tổng tiền</th><th>Thanh toán</th><th>Trạng thái</th><th></th></tr>
    ${res.data.map((o) => `<tr class="${o.status === 'pending' ? 'row-pending' : ''}"><td><b>${o.code}</b></td><td>${fmtDateTime(o.createdAt)}</td>
      <td>${esc(o.receiverName)}<br><small class="muted">${esc(o.receiverPhone)}</small></td><td><b>${money(o.total)}</b></td>
      <td>${o.paymentMethod}<br><small class="muted">${o.paymentStatus === 'paid' ? 'Đã TT' : 'Chưa TT'}</small></td>
      <td><span class="status ${o.status}">${ORDER_STATUS[o.status]}</span>${requestTag(o)}</td>
      <td><button class="btn btn-outline btn-sm" onclick="orderDetail('${o._id}')">Chi tiết</button></td></tr>`).join('') || '<tr><td colspan="7" class="muted">Không có đơn</td></tr>'}</table>`;
  pagination($('#opager'), res.pagination, renderOrders);
}

// Khung báo giá cho 1 sản phẩm có "Yêu cầu của khách hàng"
function quoteBox(o, i) {
  if (!i.customerRequest || i.requestStatus === 'none') return '';
  const canQuote = o.status === 'pending' && OPEN_REQUEST.includes(i.requestStatus);
  return `<div class="request-box">
    <div><b>Yêu cầu của khách:</b> ${esc(i.customerRequest)} <span class="status ${i.requestStatus}">${REQUEST_STATUS[i.requestStatus]}</span></div>
    ${i.requestStatus !== 'waiting_quote' ? `<div>Phụ thu đã báo: <b>${money(i.requestFee)}</b>${i.adminNote ? ` – ${esc(i.adminNote)}` : ''}</div>` : ''}
    ${canQuote ? `<div class="quote-form">
      <input type="number" min="0" step="1000" id="fee-${i._id}" value="${i.requestFee || 0}" placeholder="Phụ thu (đ)" title="Phụ thu cho cả dòng sản phẩm">
      <input id="note-${i._id}" value="${esc(i.adminNote || '')}" placeholder="Ghi chú cho khách (VD: thiệp A5 + giấy gói kem)">
      <button type="button" class="btn btn-sm" onclick="sendQuote('${o._id}','${i._id}')">${i.requestStatus === 'quoted' ? 'Gửi lại báo giá' : 'Gửi báo giá'}</button></div>` : ''}
  </div>`;
}
async function sendQuote(orderId, itemId) {
  try {
    const r = await adminApi(`/orders/${orderId}/items/${itemId}/quote`, {
      method: 'PUT',
      body: { requestFee: Number($(`#fee-${itemId}`).value || 0), adminNote: $(`#note-${itemId}`).value },
    });
    toast(r.message);
    closeModal();
    await orderDetail(orderId);
    renderOrders();
  } catch (e) { toast(e.message, 'err'); }
}

async function orderDetail(id) {
  const { data: o } = await adminApi(`/orders/${id}`);
  const openReq = o.items.some((i) => OPEN_REQUEST.includes(i.requestStatus));
  // Còn yêu cầu chưa chốt thì không cho chọn "Đã xác nhận"
  const next = NEXT[o.status].filter((s) => !(s === 'confirmed' && openReq));
  openModal(`Đơn ${o.code}`, `
    <p><span class="status ${o.status}">${ORDER_STATUS[o.status]}</span> • Đặt lúc ${fmtDateTime(o.createdAt)}</p>
    <p><b>Khách:</b> ${esc(o.user?.fullName || '')} (${esc(o.user?.email || '')})<br>
    <b>Người nhận:</b> ${esc(o.receiverName)} – ${esc(o.receiverPhone)}<br><b>Địa chỉ:</b> ${esc(o.shippingAddress)}<br>
    <b>Giao:</b> ${fmtDate(o.deliveryDate)} ${esc(o.deliveryTimeSlot)}<br>
    ${o.cardMessage ? `<b>Lời nhắn thiệp:</b> “${esc(o.cardMessage)}”<br>` : ''}${o.note ? `<b>Ghi chú:</b> ${esc(o.note)}<br>` : ''}
    ${o.cancelReason ? `<b>Lý do huỷ:</b> ${esc(o.cancelReason)}<br>` : ''}</p>
    <table class="table">${o.items.map((i) => `<tr><td><img src="${i.thumbnail}" alt=""></td><td>${esc(i.name)}${stemChangesHtml(i)}${quoteBox(o, i)}</td>
      <td style="white-space:nowrap">${money(i.price + i.adjustAmount)} × ${i.quantity}</td><td style="white-space:nowrap">${money((i.price + i.adjustAmount) * i.quantity)}</td></tr>`).join('')}</table>
    <p style="text-align:right">Tạm tính ${money(o.subTotal)} + Ship ${money(o.shippingFee)} − Giảm ${money(o.discountAmount)} ${o.discountCode ? `(${o.discountCode})` : ''}
      ${o.requestFeeTotal ? `+ Phụ thu yêu cầu ${money(o.requestFeeTotal)}` : ''}<br><b class="price">Tổng: ${money(o.total)}</b></p>
    ${openReq && o.status === 'pending' ? '<p class="hint" style="color:var(--danger)">Đơn còn yêu cầu chưa báo giá hoặc khách chưa trả lời báo giá – chưa thể xác nhận đơn.</p>' : ''}
    ${next.length ? `<div class="row"><div class="field"><label>Chuyển trạng thái</label><select name="status"><option value="">-- Giữ nguyên --</option>
      ${next.map((s) => `<option value="${s}">${ORDER_STATUS[s]}</option>`).join('')}</select></div>
      <div class="field hidden" id="cancelReasonBox"><label>Lý do huỷ</label><input name="cancelReason" placeholder="Bỏ trống: Cửa hàng huỷ"></div></div>` : ''}
    ${checkbox('paid', 'Đã thanh toán', o.paymentStatus === 'paid')}`,
  async (f) => {
    const body = { paymentStatus: f.get('paid') ? 'paid' : 'unpaid' };
    if (f.get('status')) { body.status = f.get('status'); body.cancelReason = f.get('cancelReason'); }
    await adminApi(`/orders/${id}/status`, { method: 'PUT', body });
    toast('Đã cập nhật đơn hàng');
    renderOrders();
  }, 'Cập nhật');

  // Chỉ hiện ô "Lý do huỷ" khi chọn chuyển sang "Đã huỷ"
  const statusSel = $('#modalBody [name=status]');
  if (statusSel) statusSel.onchange = () => {
    const isCancel = statusSel.value === 'cancelled';
    $('#cancelReasonBox').classList.toggle('hidden', !isCancel);
    if (isCancel) $('#modalBody [name=cancelReason]').focus();
    else $('#modalBody [name=cancelReason]').value = '';
  };
}

// ================= SẢN PHẨM =================
let cacheCats = [];
let cacheFlowers = [];
async function renderProducts(page = 1) {
  if (!$('#pq')) {
    view().innerHTML = `<div class="bar"><input id="pq" class="grow" placeholder="Tìm tên sản phẩm">
      <select id="pst"><option value="all">Tất cả</option><option value="active">Đang hiển thị</option><option value="hidden">Đang ẩn</option></select>
      <button class="btn btn-sm" id="pfind">Lọc</button><button class="btn btn-sm" onclick="productForm()">${ICONS.plus}Thêm sản phẩm</button></div>
      <div class="panel table-wrap" id="ptable"></div><div class="pagination" id="ppager"></div>`;
    $('#pfind').onclick = () => renderProducts(1);
  }
  const p = new URLSearchParams({ page, limit: 10, q: $('#pq').value, status: $('#pst').value });
  const res = await adminApi(`/products?${p}`);
  $('#ptable').innerHTML = `<table class="table"><tr><th></th><th>Tên</th><th>Giá gốc</th><th>Giá KM</th><th>Tồn</th><th>Đã bán</th><th>Trạng thái</th><th></th></tr>
    ${res.data.map((x) => `<tr><td><img src="${x.thumbnail}" alt=""></td><td><b>${esc(x.name)}</b><br><small class="muted">${x.categories.map((c) => c.name).join(', ')}</small></td>
      <td>${money(x.originalPrice)}</td><td>${x.salePrice != null ? money(x.salePrice) : '—'}</td><td>${x.stock}</td><td>${x.sold}</td>
      <td class="switch" onclick="toggleProduct('${x._id}', ${!x.status})" title="Bấm để ẩn/hiện">${yes(x.status)}</td>
      <td style="white-space:nowrap"><button class="btn btn-outline btn-sm" onclick="productForm('${x._id}')">Sửa</button>
      <button class="btn btn-danger btn-sm" onclick="deleteProduct('${x._id}')">Xoá</button></td></tr>`).join('') || '<tr><td colspan="8" class="muted">Không có sản phẩm</td></tr>'}</table>`;
  pagination($('#ppager'), res.pagination, renderProducts);
}
async function toggleProduct(id, status) {
  await adminApi(`/products/${id}`, { method: 'PUT', body: { status } });
  renderProducts();
}
async function deleteProduct(id) {
  if (!confirm('Xoá sản phẩm này? (xoá mềm – dữ liệu đơn hàng cũ vẫn giữ nguyên)')) return;
  await adminApi(`/products/${id}`, { method: 'DELETE' });
  toast('Đã xoá sản phẩm');
  renderProducts();
}
async function productForm(id) {
  [cacheCats, cacheFlowers] = await Promise.all([adminApi('/categories?limit=100').then((r) => r.data), adminApi('/flower-types?limit=100').then((r) => r.data)]);
  const p = id ? (await adminApi(`/products/${id}`)).data : { images: [], components: [], categories: [], status: true };
  const catIds = p.categories.map((c) => c._id || c);
  let images = p.images.map((i) => i.url);

  // Mỗi dòng thành phần: loại hoa – số cành mặc định – min – max – cho tăng giảm
  const compRow = (c = {}) => {
    const stems = c.stems || 1;
    return `<div class="comp-row">
    <select name="cf">${cacheFlowers.map((f) => `<option value="${f._id}" ${(c.flowerType?._id || c.flowerType) === f._id ? 'selected' : ''}>${esc(f.name)}${f.pricePerStem ? ` (${money(f.pricePerStem)}/cành)` : ''}</option>`).join('')}</select>
    <input name="cs" type="number" min="0" value="${stems}" title="Số cành mặc định">
    <input name="cmin" type="number" min="0" value="${c.minStems ?? 1}" title="Số cành tối thiểu">
    <input name="cmax" type="number" min="0" value="${c.maxStems ?? stems * 2}" title="Số cành tối đa">
    <select name="cw"><option value="0">Cố định</option><option value="1" ${c.adjustable ? 'selected' : ''}>Cho tăng giảm</option></select>
    <button type="button" class="btn btn-outline btn-sm" onclick="this.parentElement.remove()" aria-label="Xoá dòng">×</button></div>`;
  };

  openModal(id ? 'Sửa sản phẩm' : 'Thêm sản phẩm', `
    ${input('name', 'Tên sản phẩm *', p.name, 'required')}
    <div class="row">${input('originalPrice', 'Giá gốc *', p.originalPrice, 'type="number" min="0" required')}
      ${input('salePrice', 'Giá khuyến mãi (bỏ trống nếu không giảm)', p.salePrice ?? '', 'type="number" min="0"')}</div>
    <div class="row">${input('stock', 'Tồn kho', p.stock ?? 0, 'type="number" min="0"')}<div class="field"><label>Trạng thái</label>${checkbox('status', 'Hiển thị trên web', p.status)}</div></div>
    <div class="field"><label>Mô tả</label><textarea name="description" rows="3">${esc(p.description || '')}</textarea></div>
    <div class="field"><label>Loại sản phẩm</label><div class="checks">${cacheCats.map((c) => `<label><input type="checkbox" name="cat" value="${c._id}" ${catIds.includes(c._id) ? 'checked' : ''}>${esc(c.name)}</label>`).join('')}</div></div>
    <div class="field"><label>Ảnh (ảnh đầu tiên là ảnh chính)</label><div class="img-list" id="imgList"></div>
      <div style="display:flex;gap:8px"><input id="imgUrl" placeholder="Dán đường dẫn ảnh, ví dụ /images/products/kisses-1.jpg">
      <button type="button" class="btn btn-outline btn-sm" id="addUrl">Thêm</button></div>
      <input type="file" id="imgFile" accept="image/*" style="margin-top:8px"></div>
    <div class="field"><label>Thành phần</label>
      <div class="comp-row comp-head"><span>Loại hoa</span><span>Số cành</span><span>Min cành</span><span>Max cành</span><span>Tăng giảm</span><span></span></div>
      <div id="comps">${p.components.map(compRow).join('')}</div>
      <button type="button" class="btn btn-outline btn-sm" id="addComp">${ICONS.plus}Thêm thành phần</button>
      <div class="hint">Khách được tăng/giảm số cành trong khoảng Min – Max nếu chọn "Cho tăng giảm". Tiền chênh lệch = số cành thay đổi × giá mỗi cành của loại hoa.</div></div>`,
  async (f) => {
    const comps = [...document.querySelectorAll('#comps .comp-row')].map((r) => ({
      flowerType: r.querySelector('[name=cf]').value,
      stems: Number(r.querySelector('[name=cs]').value),
      minStems: Number(r.querySelector('[name=cmin]').value),
      maxStems: Number(r.querySelector('[name=cmax]').value),
      adjustable: r.querySelector('[name=cw]').value === '1',
    }));
    const bad = comps.find((c) => c.adjustable && (c.minStems > c.stems || c.stems > c.maxStems));
    if (bad) throw new Error('Số cành mặc định phải nằm trong khoảng Min – Max cành');
    const body = {
      name: f.get('name'), originalPrice: Number(f.get('originalPrice')), salePrice: f.get('salePrice') ? Number(f.get('salePrice')) : null,
      stock: Number(f.get('stock')), status: !!f.get('status'), description: f.get('description'),
      categories: f.getAll('cat'), images, thumbnail: images[0] || '', components: comps,
    };
    await adminApi(id ? `/products/${id}` : '/products', { method: id ? 'PUT' : 'POST', body });
    toast(id ? 'Đã cập nhật sản phẩm' : 'Đã thêm sản phẩm');
    renderProducts();
  });

  const drawImgs = () => {
    $('#imgList').innerHTML = images.map((u, i) => `<div><img src="${u}" alt=""><button type="button" data-i="${i}">×</button></div>`).join('');
    $('#imgList').querySelectorAll('button').forEach((b) => (b.onclick = () => { images.splice(b.dataset.i, 1); drawImgs(); }));
  };
  drawImgs();
  $('#addUrl').onclick = () => { const u = $('#imgUrl').value.trim(); if (u) { images.push(u); $('#imgUrl').value = ''; drawImgs(); } };
  $('#imgFile').onchange = async (e) => {
    const fd = new FormData();
    fd.append('image', e.target.files[0]);
    try { const r = await adminApi('/upload', { method: 'POST', body: fd }); images.push(r.url); drawImgs(); toast('Đã tải ảnh lên'); }
    catch (err) { toast(err.message, 'err'); }
    e.target.value = '';
  };
  $('#addComp').onclick = () => $('#comps').insertAdjacentHTML('beforeend', compRow());
}

// ================= CRUD đơn giản (Loại SP, Loại hoa, Mã giảm giá, Bài viết) =================
function simpleCrud({ endpoint, columns, fields, toBody, canDelete = true, searchPlaceholder = 'Tìm kiếm' }) {
  const render = async (page = 1) => {
    if (!$('#sq')) {
      view().innerHTML = `<div class="bar"><input id="sq" class="grow" placeholder="${searchPlaceholder}"><button class="btn btn-sm" id="sfind">Tìm</button>
        <button class="btn btn-sm" id="sadd">${ICONS.plus}Thêm mới</button></div><div class="panel table-wrap" id="stable"></div><div class="pagination" id="spager"></div>`;
      $('#sfind').onclick = () => render(1);
      $('#sadd').onclick = () => form();
    }
    const res = await adminApi(`${endpoint}?${new URLSearchParams({ page, limit: 15, q: $('#sq').value })}`);
    window._rows = res.data;
    $('#stable').innerHTML = `<table class="table"><tr>${columns.map((c) => `<th>${c[0]}</th>`).join('')}<th></th></tr>
      ${res.data.map((r, i) => `<tr>${columns.map((c) => `<td>${c[1](r)}</td>`).join('')}<td style="white-space:nowrap">
        <button class="btn btn-outline btn-sm" data-edit="${i}">Sửa</button>
        ${canDelete ? `<button class="btn btn-danger btn-sm" data-del="${r._id}">Xoá</button>` : ''}</td></tr>`).join('') || '<tr><td class="muted">Chưa có dữ liệu</td></tr>'}</table>`;
    pagination($('#spager'), res.pagination, render);
    document.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => form(window._rows[b.dataset.edit])));
    document.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
      if (!confirm('Bạn chắc chắn muốn xoá?')) return;
      try { const r = await adminApi(`${endpoint}/${b.dataset.del}`, { method: 'DELETE' }); toast(r.message); render(); } catch (e) { toast(e.message, 'err'); }
    }));
  };
  const form = (row) => openModal(row ? 'Sửa' : 'Thêm mới', fields(row || {}), async (f) => {
    await adminApi(row ? `${endpoint}/${row._id}` : endpoint, { method: row ? 'PUT' : 'POST', body: toBody(f) });
    toast('Đã lưu');
    render();
  });
  return render;
}

function renderCategories() {
  return simpleCrud({
    endpoint: '/categories',
    columns: [['Tên thẻ', (r) => `<b>${esc(r.name)}</b>`], ['Slug', (r) => r.slug], ['Loại thẻ', (r) => (r.type === 'occasion' ? 'Dịp tặng' : 'Kiểu dáng')], ['Trạng thái', (r) => yes(r.status)]],
    fields: (r) => `${input('name', 'Tên thẻ *', r.name, 'required')}
      <div class="field"><label>Loại thẻ</label><select name="type"><option value="occasion">Dịp tặng</option><option value="style" ${r.type === 'style' ? 'selected' : ''}>Kiểu dáng</option></select></div>
      ${checkbox('status', 'Hiển thị', r.status !== false)}`,
    toBody: (f) => ({ name: f.get('name'), type: f.get('type'), status: !!f.get('status') }),
  })();
}

function renderFlowers() {
  return simpleCrud({
    endpoint: '/flower-types',
    columns: [['Tên loại hoa', (r) => `<b>${esc(r.name)}</b>`], ['Màu sắc', (r) => esc(r.color || '')], ['Giá mỗi cành', (r) => money(r.pricePerStem)], ['Trạng thái', (r) => yes(r.status)]],
    fields: (r) => `${input('name', 'Tên loại hoa *', r.name, 'required')}
      <div class="row">${input('color', 'Màu sắc', r.color)}${input('pricePerStem', 'Giá mỗi cành (đ)', r.pricePerStem ?? 0, 'type="number" min="0" step="1000"')}</div>
      ${input('image', 'Đường dẫn ảnh', r.image)}${checkbox('status', 'Đang sử dụng', r.status !== false)}`,
    toBody: (f) => ({ name: f.get('name'), color: f.get('color'), pricePerStem: Number(f.get('pricePerStem') || 0), image: f.get('image'), status: !!f.get('status') }),
  })();
}

function renderDiscounts() {
  return simpleCrud({
    endpoint: '/discounts',
    canDelete: false, // use case: chỉ Thêm, Sửa
    searchPlaceholder: 'Tìm mã',
    columns: [
      ['Mã', (r) => `<b>${esc(r.code)}</b>`],
      ['Giảm', (r) => (r.type === 'percentage' ? `${r.value}%${r.maxDiscount ? ` (tối đa ${money(r.maxDiscount)})` : ''}` : money(r.value))],
      ['Đơn tối thiểu', (r) => money(r.minOrder)],
      ['Thời gian', (r) => `${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}`],
      ['Đã dùng', (r) => `${r.usedCount}/${r.maxUsage}`],
      ['Trạng thái', (r) => (r.status ? '<span class="status completed">Bật</span>' : '<span class="status cancelled">Tắt</span>')],
    ],
    fields: (r) => `${input('code', 'Mã khuyến mãi *', r.code, 'required style="text-transform:uppercase"')}
      <div class="row"><div class="field"><label>Loại giảm</label><select name="type"><option value="percentage">Theo %</option><option value="fixed" ${r.type === 'fixed' ? 'selected' : ''}>Số tiền cố định</option></select></div>
      ${input('value', 'Giá trị giảm *', r.value, 'type="number" min="0" required')}</div>
      <div class="row">${input('maxDiscount', 'Giảm tối đa (cho loại %)', r.maxDiscount ?? '', 'type="number" min="0"')}${input('minOrder', 'Đơn tối thiểu', r.minOrder ?? 0, 'type="number" min="0"')}</div>
      <div class="row">${input('startDate', 'Ngày bắt đầu *', toDateInput(r.startDate), 'type="date" required')}${input('endDate', 'Ngày kết thúc *', toDateInput(r.endDate), 'type="date" required')}</div>
      ${input('maxUsage', 'Số lượt tối đa', r.maxUsage ?? 100, 'type="number" min="1"')}${checkbox('status', 'Đang bật', r.status !== false)}`,
    toBody: (f) => ({
      code: f.get('code'), type: f.get('type'), value: Number(f.get('value')), maxDiscount: f.get('maxDiscount') ? Number(f.get('maxDiscount')) : null,
      minOrder: Number(f.get('minOrder') || 0), startDate: f.get('startDate'), endDate: `${f.get('endDate')}T23:59:59`, maxUsage: Number(f.get('maxUsage') || 100), status: !!f.get('status'),
    }),
  })();
}

function renderPosts() {
  return simpleCrud({
    endpoint: '/posts',
    searchPlaceholder: 'Tìm tiêu đề',
    columns: [['', (r) => (r.thumbnail ? `<img src="${r.thumbnail}" alt="">` : '')], ['Tiêu đề', (r) => `<b>${esc(r.title)}</b>`], ['Ngày tạo', (r) => fmtDate(r.createdAt)], ['Trạng thái', (r) => yes(r.status)]],
    fields: (r) => `${input('title', 'Tiêu đề *', r.title, 'required')}${input('thumbnail', 'Ảnh đại diện (đường dẫn)', r.thumbnail)}
      <div class="field"><label>Tóm tắt</label><textarea name="summary" rows="2">${esc(r.summary || '')}</textarea></div>
      <div class="field"><label>Nội dung (cho phép HTML: &lt;p&gt;, &lt;b&gt;, &lt;ul&gt;...)</label><textarea name="content" rows="8">${esc(r.content || '')}</textarea></div>
      ${checkbox('status', 'Hiển thị', r.status !== false)}`,
    toBody: (f) => ({ title: f.get('title'), thumbnail: f.get('thumbnail'), summary: f.get('summary'), content: f.get('content'), status: !!f.get('status') }),
  })();
}

// ================= NGƯỜI DÙNG =================
async function renderUsers(page = 1) {
  if (!$('#uq')) {
    view().innerHTML = `<div class="bar"><input id="uq" class="grow" placeholder="Tìm tên, email, SĐT">
      <select id="urole"><option value="">Tất cả vai trò</option><option value="client">Khách hàng</option><option value="admin">Admin</option></select>
      <button class="btn btn-sm" id="ufind">Tìm</button></div><div class="panel table-wrap" id="utable"></div><div class="pagination" id="upager"></div>`;
    $('#ufind').onclick = () => renderUsers(1);
  }
  const res = await adminApi(`/admin/users?${new URLSearchParams({ page, q: $('#uq').value, role: $('#urole').value })}`);
  $('#utable').innerHTML = `<table class="table"><tr><th>Họ tên</th><th>Email</th><th>SĐT</th><th>Vai trò</th><th>Ngày tạo</th><th>Trạng thái</th><th></th></tr>
    ${res.data.map((u) => `<tr><td><b>${esc(u.fullName)}</b></td><td>${esc(u.email)}</td><td>${esc(u.phone || '')}</td><td>${u.role}</td><td>${fmtDate(u.createdAt)}</td>
      <td>${u.status ? '<span class="status completed">Hoạt động</span>' : '<span class="status cancelled">Đã khoá</span>'}</td>
      <td>${u.role !== 'admin' ? `<button class="btn btn-outline btn-sm" onclick="toggleUser('${u._id}')">${u.status ? 'Khoá' : 'Mở khoá'}</button>` : ''}</td></tr>`).join('')}</table>`;
  pagination($('#upager'), res.pagination, renderUsers);
}
async function toggleUser(id) {
  try { const r = await adminApi(`/admin/users/${id}/status`, { method: 'PUT', body: {} }); toast(r.message); renderUsers(); }
  catch (e) { toast(e.message, 'err'); }
}

// ================= Khởi động =================
function go(tab) {
  if (!TABS[tab]) tab = 'dashboard';
  location.hash = tab;
  document.querySelectorAll('#menu a').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));
  $('#tabTitle').textContent = TABS[tab][0];
  view().innerHTML = '<p class="muted">Đang tải...</p>';
  Promise.resolve(TABS[tab][1]()).catch((e) => { view().innerHTML = `<div class="panel empty">${esc(e.message)}</div>`; });
}

document.addEventListener('DOMContentLoaded', () => {
  // Dùng phiên admin riêng (AdminAuth), không phụ thuộc phiên khách
  const u = AdminAuth.user;
  if (!AdminAuth.token || !u || u.role !== 'admin') {
    AdminAuth.clear();
    location.href = `/admin/login.html?next=${encodeURIComponent('/admin/' + location.hash)}`;
    return;
  }
  $('#adminName').innerHTML = `${ICONS.user}<span>${esc(u.fullName)}</span>`;
  document.querySelectorAll('#menu a').forEach((a) => (a.onclick = () => go(a.dataset.tab)));
  go(location.hash.slice(1));
});
