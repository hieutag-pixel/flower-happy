// Trang chi tiết sản phẩm
let product;
const stems = {}; // số cành khách đang chọn theo từng loại hoa: { flowerTypeId: số cành }

async function loadReviews() {
  const { data } = await api(`/products/${product._id}/reviews`);
  $('#reviews').innerHTML = data.length
    ? data.map((r) => `<div class="review"><b>${esc(r.user?.fullName || 'Khách')}</b> <span class="stars">${stars(r.rating)}</span>
        <span class="muted" style="font-size:13px">• ${fmtDate(r.createdAt)}</span><p style="margin:4px 0 0">${esc(r.comment)}</p></div>`).join('')
    : '<p class="muted">Chưa có đánh giá nào.</p>';
}

// Tiền chênh lệch = Σ (số cành chọn − số cành mặc định) × giá mỗi cành
// (chỉ để hiển thị - server tự tính lại từ database khi thêm vào giỏ)
const adjustOf = () =>
  product.components.reduce((s, c) => (c.flowerType ? s + (stems[c.flowerType._id] - c.stems) * (c.flowerType.pricePerStem || 0) : s), 0);

// Danh sách loại hoa đã chỉnh để gửi lên server
const stemChangesPayload = () =>
  product.components
    .filter((c) => c.flowerType && stems[c.flowerType._id] !== c.stems)
    .map((c) => ({ flowerType: c.flowerType._id, stems: stems[c.flowerType._id] }));

// Cập nhật giá + số cành trên giao diện
function refreshPrice() {
  const adj = adjustOf();
  const onSale = product.salePrice != null && product.salePrice < product.originalPrice;
  $('#price').innerHTML = `${money(Math.max(product.price + adj, 0))}${onSale ? `<del>${money(product.originalPrice + adj)}</del>` : ''}`;
  $('#adjustLine').innerHTML = adj
    ? `Điều chỉnh: <b>${moneySigned(adj)}</b> so với mẫu gốc <a id="resetStems">Đặt lại</a>`
    : '';
  if (adj) $('#resetStems').onclick = () => { product.components.forEach((c) => c.flowerType && (stems[c.flowerType._id] = c.stems)); refreshPrice(); };
  product.components.forEach((c) => {
    if (!c.flowerType || !c.adjustable) return;
    const id = c.flowerType._id;
    const box = document.querySelector(`.stem-ctrl[data-id="${id}"]`);
    box.querySelector('b').textContent = stems[id];
    box.querySelector('.dec').disabled = stems[id] <= c.minStems;
    box.querySelector('.inc').disabled = stems[id] >= c.maxStems;
    box.classList.toggle('changed', stems[id] !== c.stems);
  });
}

// ===== Yêu cầu thiết kế riêng (popup) =====
// Khách chọn thêm cành hoa + ghi chú; nội dung được gộp thành "Yêu cầu của khách hàng" gửi kèm sản phẩm.
// Sau khi đặt hàng, cửa hàng (trang quản trị) báo giá phụ thu và khách đồng ý / từ chối ở "Đơn hàng của tôi".
const custom = { extras: {}, note: '' }; // extras: { flowerTypeId: số cành thêm }
let flowerTypes = null; // danh sách loại hoa của cửa hàng (tải khi mở popup lần đầu)

const extraList = () => (flowerTypes || []).filter((f) => custom.extras[f._id] > 0);
function requestText() {
  const extras = extraList().map((f) => `${custom.extras[f._id]} ${f.name}`).join(', ');
  return [extras && `Thêm cành: ${extras}`, custom.note && `Ghi chú: ${custom.note}`].filter(Boolean).join('. ').slice(0, 500);
}

function renderCustomSummary() {
  const text = requestText();
  $('#openCustom span').textContent = text ? 'Sửa yêu cầu thiết kế riêng' : 'Đặt thiết kế theo yêu cầu riêng';
  $('#customSummary').innerHTML = text
    ? `<div class="request-box"><b>Yêu cầu của bạn:</b> ${esc(text)}
        <div class="hint">Gửi kèm khi đặt hàng – trạng thái "Chờ báo giá". <button type="button" class="link" id="clearCustom">Xoá yêu cầu</button></div></div>`
    : '';
  if (text) $('#clearCustom').onclick = () => { custom.extras = {}; custom.note = ''; renderCustomSummary(); };
}

async function openCustomDialog() {
  if (!flowerTypes) {
    try { flowerTypes = (await api('/flower-types?limit=100')).data; }
    catch (e) { toast(e.message, 'err'); return; }
  }
  let dlg = $('#customDialog');
  if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'customDialog'; dlg.className = 'dialog'; document.body.appendChild(dlg); }
  const draft = { ...custom.extras }; // chỉ ghi vào custom khi bấm "Lưu yêu cầu"
  dlg.innerHTML = `<form method="dialog" id="customForm">
    <div class="dialog-head"><h3>Yêu cầu thiết kế riêng</h3><button type="button" class="dialog-close" aria-label="Đóng">×</button></div>
    <ol class="steps"><li>Bạn gửi yêu cầu</li><li>Cửa hàng báo giá</li><li>Bạn đồng ý mới tính phụ thu</li></ol>
    <h4>Thêm cành hoa</h4>
    <div class="extra-list">${flowerTypes.map((f) => `<div class="extra-row" data-id="${f._id}">
      <div><b>${esc(f.name)}</b><div class="composition">${f.pricePerStem ? `${money(f.pricePerStem)} / cành` : 'Cửa hàng báo giá'}</div></div>
      <div class="stem-ctrl"><button type="button" class="dec" aria-label="Bớt ${esc(f.name)}">−</button><b>0</b><button type="button" class="inc" aria-label="Thêm ${esc(f.name)}">+</button></div>
    </div>`).join('') || '<p class="muted">Chưa có loại hoa nào.</p>'}</div>
    <div class="field" style="margin-top:14px"><label for="customNote">Yêu cầu khác</label>
      <textarea id="customNote" rows="2" maxlength="300" placeholder="Ví dụ: gói giấy màu kem, đổi sang tông trắng, thêm nơ lụa">${esc(custom.note)}</textarea></div>
    <div class="composition" id="customEstimate" aria-live="polite"></div>
    <div class="dialog-actions"><button type="button" class="btn btn-outline" id="customCancel">Huỷ</button><button class="btn" value="save">Lưu yêu cầu</button></div>
  </form>`;
  const paint = () => {
    let total = 0;
    dlg.querySelectorAll('.extra-row').forEach((row) => {
      const f = flowerTypes.find((x) => x._id === row.dataset.id);
      const n = draft[f._id] || 0;
      row.querySelector('.stem-ctrl b').textContent = n;
      row.querySelector('.dec').disabled = n <= 0;
      row.querySelector('.inc').disabled = n >= 50;
      row.querySelector('.stem-ctrl').classList.toggle('changed', n > 0);
      total += n * (f.pricePerStem || 0);
    });
    $('#customEstimate').innerHTML = total
      ? `Giá tham khảo cho phần cành thêm: <b>${money(total)}</b> / sản phẩm. Phụ thu chính thức do cửa hàng báo.`
      : 'Phụ thu (nếu có) do cửa hàng báo sau khi nhận yêu cầu.';
  };
  dlg.querySelectorAll('.extra-row').forEach((row) => {
    const id = row.dataset.id;
    row.querySelector('.dec').onclick = () => { draft[id] = Math.max((draft[id] || 0) - 1, 0); paint(); };
    row.querySelector('.inc').onclick = () => { draft[id] = Math.min((draft[id] || 0) + 1, 50); paint(); };
  });
  paint();
  dlg.querySelector('.dialog-close').onclick = $('#customCancel').onclick = () => dlg.close();
  dlg.onclick = (e) => { if (e.target === dlg) dlg.close(); }; // bấm ra nền mờ để đóng
  $('#customForm').onsubmit = () => {
    custom.extras = draft;
    custom.note = $('#customNote').value.trim();
    renderCustomSummary();
    if (requestText()) toast('Đã ghi yêu cầu. Cửa hàng sẽ báo giá sau khi bạn đặt hàng');
  };
  dlg.showModal();
}

function componentRow(c) {
  const f = c.flowerType;
  const stemCell = c.adjustable
    ? `<div class="stem-ctrl" data-id="${f._id}"><button type="button" class="dec" aria-label="Giảm">−</button><b>${c.stems}</b><button type="button" class="inc" aria-label="Tăng">+</button></div>
       <small>Từ ${c.minStems} đến ${c.maxStems} cành</small>`
    : `${c.stems}<small>Cố định</small>`;
  return `<tr><td>${esc(f.name)}</td><td>${f.pricePerStem ? money(f.pricePerStem) : '—'}</td><td>${stemCell}</td></tr>`;
}

document.addEventListener('DOMContentLoaded', async () => {
  const slug = qs('slug');
  try {
    const res = await api(`/products/${encodeURIComponent(slug)}`);
    product = res.data;
    product.components = product.components.filter((c) => c.flowerType);
    product.components.forEach((c) => (stems[c.flowerType._id] = c.stems));
    document.title = `${product.name} | Flowers Happy`;
    const canAdjust = product.components.some((c) => c.adjustable);
    $('#detail').innerHTML = `
      <div class="gallery">
        <img class="main" id="mainImg" src="${product.thumbnail}" alt="${esc(product.name)}">
        <div class="thumbs">${product.images.map((im, i) => `<img src="${im.url}" class="${i === 0 ? 'active' : ''}" alt="">`).join('')}</div>
      </div>
      <div>
        <div>${product.categories.map((c) => `<a class="tag" href="/products.html?category=${c.slug}">${esc(c.name)}</a>`).join('')}</div>
        <h1>${esc(product.name)}</h1>
        <p><span class="stars">${stars(res.rating.average)}</span> <span class="muted">${res.rating.average || 0}/5 (${res.rating.count} đánh giá) • Đã bán ${product.sold}</span></p>
        <div class="price" id="price"></div>
        <div class="adjust-line" id="adjustLine"></div>
        <p>${esc(product.description)}</p>
        <h4>Thành phần</h4>
        ${canAdjust ? '<p class="hint" style="margin-top:-6px">Bấm − / + để tăng giảm số cành, giá cập nhật theo giá mỗi cành.</p>' : ''}
        <table class="components"><tr><th>Loại hoa</th><th>Giá mỗi cành</th><th>Số cành</th></tr>
          ${product.components.map(componentRow).join('')}
        </table>
        <div class="custom-order">
          <button type="button" class="custom-link" id="openCustom">${ICONS.sliders}<span>Đặt thiết kế theo yêu cầu riêng</span></button>
          <div class="hint">Thêm cành hoa, đổi tông màu, giấy gói... Cửa hàng báo giá trước, bạn đồng ý mới tính phụ thu.</div>
          <div id="customSummary"></div>
        </div>
        <p class="muted">Còn lại: <b>${product.stock}</b> sản phẩm</p>
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <div class="qty"><button type="button" id="minus">−</button><input id="qty" value="1" type="number" min="1" max="${product.stock}"><button type="button" id="plus">+</button></div>
          <button class="btn" id="addBtn" ${product.stock < 1 ? 'disabled' : ''}>${product.stock < 1 ? 'Hết hàng' : 'Thêm vào giỏ'}</button>
          <button class="btn btn-outline" id="buyBtn" ${product.stock < 1 ? 'disabled' : ''}>Mua ngay</button>
          <button class="btn btn-outline btn-sm" data-compare="${product._id}" onclick="Compare.toggle('${product._id}', this)">${compareLabel(Compare.ids.includes(product._id))}</button>
        </div>
      </div>`;

    // Nút − / + số cành
    product.components.filter((c) => c.adjustable).forEach((c) => {
      const id = c.flowerType._id;
      const box = document.querySelector(`.stem-ctrl[data-id="${id}"]`);
      box.querySelector('.dec').onclick = () => { stems[id] = Math.max(c.minStems, stems[id] - 1); refreshPrice(); };
      box.querySelector('.inc').onclick = () => { stems[id] = Math.min(c.maxStems, stems[id] + 1); refreshPrice(); };
    });
    refreshPrice();

    document.querySelectorAll('.thumbs img').forEach((img) => (img.onclick = () => {
      $('#mainImg').src = img.src;
      document.querySelectorAll('.thumbs img').forEach((x) => x.classList.remove('active'));
      img.classList.add('active');
    }));
    const qty = $('#qty');
    // Số lượng phải là số nguyên từ 1 đến số còn trong kho. Gõ sai (0, số âm, số lẻ, để trống) thì báo lỗi và đưa về giá trị hợp lệ
    const validQty = () => {
      const n = Number(qty.value);
      if (qty.value.trim() === '' || !Number.isInteger(n) || n < 1) {
        toast('Số lượng phải là số nguyên từ 1 trở lên', 'err');
        qty.value = Math.min(Math.max(Math.floor(n) || 1, 1), product.stock);
        return null;
      }
      if (n > product.stock) { toast(`Chỉ còn ${product.stock} sản phẩm trong kho`, 'err'); qty.value = product.stock; return null; }
      return n;
    };
    qty.onchange = validQty;
    $('#minus').onclick = () => (qty.value = Math.max(1, (Math.floor(Number(qty.value)) || 1) - 1));
    $('#plus').onclick = () => (qty.value = Math.min(product.stock, (Math.floor(Number(qty.value)) || 0) + 1));
    $('#openCustom').onclick = openCustomDialog;
    const options = () => ({ customerRequest: requestText(), stemChanges: stemChangesPayload() });
    $('#addBtn').onclick = () => { const n = validQty(); if (n) addToCart(product._id, n, options()); };
    $('#buyBtn').onclick = async () => { const n = validQty(); if (n && (await addToCart(product._id, n, options()))) location.href = '/checkout.html'; }; // Mua ngay: đi thẳng tới trang thanh toán

    $('#related').innerHTML = res.related.map(productCard).join('');
    loadReviews();
  } catch (e) {
    $('#detail').innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }

  $('#reviewForm').onsubmit = async (e) => {
    e.preventDefault();
    if (!Auth.token) return Auth.require();
    const f = new FormData(e.target);
    try {
      await api(`/products/${product._id}/reviews`, { method: 'POST', body: { rating: Number(f.get('rating')), comment: f.get('comment') } });
      toast('Cảm ơn bạn đã đánh giá!');
      e.target.reset();
      loadReviews();
    } catch (err) { toast(err.message, 'err'); }
  };
});
