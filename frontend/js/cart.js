// Trang giỏ hàng
function renderCart(cart) {
  $('#subTotal').textContent = money(cart.subTotal);
  $('#toCheckout').classList.toggle('hidden', !cart.items.length);
  if (!cart.items.length) {
    $('#cartBox').innerHTML = '<div class="empty">Giỏ hàng đang trống<br><a class="btn" style="margin-top:14px" href="/products.html">Chọn hoa ngay</a></div>';
    return;
  }
  $('#cartBox').innerHTML = `<table class="table">
    <tr><th>Sản phẩm</th><th>Đơn giá</th><th>Số lượng</th><th>Thành tiền</th><th></th></tr>
    ${cart.items.map((i) => `<tr data-id="${i._id}">
      <td><div style="display:flex;gap:12px;align-items:center"><img src="${i.product.thumbnail}" alt="">
        <div><a href="/product.html?slug=${i.product.slug}"><b>${esc(i.product.name)}</b></a>
        ${stemChangesHtml(i)}
        ${i.customerRequest ? `<div class="request-box">Yêu cầu: ${esc(i.customerRequest)}<div class="hint">Cửa hàng sẽ báo giá phụ thu (nếu có) trước khi xác nhận đơn.</div></div>` : ''}
        ${!i.available ? `<div style="color:var(--danger);font-size:13px">${esc(i.warning || 'Không đủ hàng / ngừng bán')}</div>` : ''}</div></div></td>
      <td>${money(i.unitPrice)}${i.adjustAmount ? `<div class="hint">Giá gốc ${money(i.price)}</div>` : ''}</td>
      <td><div class="qty"><button class="dec">−</button><input class="q" type="number" min="1" value="${i.quantity}"><button class="inc">+</button></div></td>
      <td><b>${money(i.lineTotal)}</b></td>
      <td><button class="btn btn-outline btn-sm del">Xoá</button></td>
    </tr>`).join('')}
  </table>`;

  document.querySelectorAll('tr[data-id]').forEach((row) => {
    const id = row.dataset.id;
    const input = row.querySelector('.q');
    const update = async (q) => {
      try { renderCart((await api(`/cart/items/${id}`, { method: 'PUT', body: { quantity: q } })).data); updateCartCount(); }
      catch (e) { toast(e.message, 'err'); input.value = input.defaultValue; }
    };
    row.querySelector('.dec').onclick = () => input.value > 1 && update(Number(input.value) - 1);
    row.querySelector('.inc').onclick = () => update(Number(input.value) + 1);
    input.onchange = () => update(Number(input.value));
    row.querySelector('.del').onclick = async () => {
      renderCart((await api(`/cart/items/${id}`, { method: 'DELETE' })).data);
      updateCartCount();
    };
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  Auth.require();
  try { renderCart((await api('/cart')).data); }
  catch (e) { $('#cartBox').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
});
