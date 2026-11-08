// So sánh sản phẩm (tối đa 4)
async function renderCompare() {
  const ids = Compare.ids;
  if (!ids.length) {
    $('#compare').innerHTML = '<div class="empty">Chưa chọn sản phẩm nào. Bấm "+ So sánh" trên thẻ sản phẩm để thêm.<br><a class="btn" style="margin-top:14px" href="/products.html">Xem sản phẩm</a></div>';
    return;
  }
  const { data } = await api(`/products/compare?ids=${ids.join(',')}`);
  const row = (label, fn) => `<tr><th>${label}</th>${data.map((p) => `<td>${fn(p)}</td>`).join('')}</tr>`;
  $('#compare').innerHTML = `<table class="table compare-table">
    ${row('', (p) => `<img src="${p.thumbnail}" alt="" style="width:160px;height:190px"><br><a href="/product.html?slug=${p.slug}"><b>${esc(p.name)}</b></a>`)}
    ${row('Giá bán', (p) => `<span class="price">${money(p.price)}</span>`)}
    ${row('Giá gốc', (p) => money(p.originalPrice))}
    ${row('Dịp / kiểu', (p) => p.categories.map((c) => `<span class="tag">${esc(c.name)}</span>`).join(''))}
    ${row('Thành phần', (p) => p.components.map((c) => `${c.stems} ${esc(c.flowerType?.name || '')}`).join('<br>'))}
    ${row('Tăng giảm số cành', (p) => (p.components.some((c) => c.adjustable) ? 'Có' : 'Không'))}
    ${row('Tồn kho', (p) => p.stock)}
    ${row('Đã bán', (p) => p.sold)}
    ${row('', (p) => `<button class="btn btn-sm" onclick="addToCart('${p._id}')" ${p.stock < 1 ? 'disabled' : ''}>Thêm vào giỏ</button>
      <button class="btn btn-outline btn-sm" onclick="Compare.toggle('${p._id}');renderCompare()">Bỏ</button>`)}
  </table>`;
}
document.addEventListener('DOMContentLoaded', () => renderCompare().catch((e) => toast(e.message, 'err')));
