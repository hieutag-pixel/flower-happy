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
        <div class="field"><label for="custom">Yêu cầu của khách hàng</label>
          <textarea id="custom" rows="2" maxlength="500" placeholder="Thêm thiệp lớn, gói giấy màu kem, đổi hoa sang tông trắng..."></textarea>
          <div class="hint">Cửa hàng sẽ báo giá phụ thu (nếu có) trước khi xác nhận đơn.</div></div>
        <p class="muted">Còn lại: <b>${product.stock}</b> sản phẩm</p>
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <div class="qty"><button type="button" id="minus">−</button><input id="qty" value="1" type="number" min="1" max="${product.stock}"><button type="button" id="plus">+</button></div>
          <button class="btn" id="addBtn" ${product.stock < 1 ? 'disabled' : ''}>${product.stock < 1 ? 'Hết hàng' : 'Thêm vào giỏ'}</button>
          <button class="btn btn-outline" id="buyBtn" ${product.stock < 1 ? 'disabled' : ''}>Mua ngay</button>
          <button class="btn btn-outline btn-sm" onclick="Compare.toggle('${product._id}', this)">${compareLabel(Compare.ids.includes(product._id))}</button>
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
    $('#minus').onclick = () => (qty.value = Math.max(1, qty.value - 1));
    $('#plus').onclick = () => (qty.value = Math.min(product.stock, Number(qty.value) + 1));
    const options = () => ({ customerRequest: $('#custom').value.trim(), stemChanges: stemChangesPayload() });
    $('#addBtn').onclick = () => addToCart(product._id, Number(qty.value), options());
    $('#buyBtn').onclick = async () => { if (await addToCart(product._id, Number(qty.value), options())) location.href = '/cart.html'; };

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
