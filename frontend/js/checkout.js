// Trang thanh toán
let appliedCode = '';
let hasRequest = false; // giỏ có "Yêu cầu của khách hàng" -> cửa hàng sẽ báo giá sau

async function refreshTotals() {
  const { data } = await api('/orders/preview', { method: 'POST', body: { discountCode: appliedCode } });
  $('#sSub').textContent = money(data.subTotal);
  $('#sShip').textContent = data.shippingFee ? money(data.shippingFee) : 'Miễn phí';
  $('#sDisc').textContent = data.discountAmount ? `-${money(data.discountAmount)}` : '0đ';
  $('#sTotal').textContent = money(data.total);
}

document.addEventListener('DOMContentLoaded', async () => {
  Auth.require();
  const form = $('#checkoutForm');
  const user = Auth.user;
  form.receiverName.value = user.fullName || '';
  form.receiverPhone.value = user.phone || '';
  let selectedAddr = null; // địa chỉ đang chọn từ sổ địa chỉ (null = nhập địa chỉ mới)
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  form.deliveryDate.min = new Date().toISOString().slice(0, 10);
  form.deliveryDate.value = tomorrow;

  try {
    const [{ data: cart }, { data: addrs }, { data: me }] = await Promise.all([api('/cart'), api('/addresses'), api('/auth/me')]);
    if (!cart.items.length) { location.href = '/cart.html'; return; }
    // Thông tin tài khoản lấy mới từ server (tránh dữ liệu cũ trong trình duyệt)
    form.receiverName.value = me.fullName || '';
    form.receiverPhone.value = me.phone || '';
    $('#items').innerHTML = cart.items.map((i) => `<div class="summary-line" style="gap:10px">
      <span>${esc(i.product.name)} × ${i.quantity}${stemChangesHtml(i)}
        ${i.customerRequest ? `<div class="hint">Yêu cầu: ${esc(i.customerRequest)} – chờ cửa hàng báo giá</div>` : ''}</span>
      <span style="white-space:nowrap">${money(i.lineTotal)}</span></div>`).join('');
    hasRequest = cart.items.some((i) => i.customerRequest);

    // Tự điền địa chỉ từ sổ địa chỉ của tài khoản: ưu tiên địa chỉ mặc định, không có thì lấy địa chỉ đầu tiên
    const full = (a) => `${a.detail}, ${a.ward}, ${a.province}`;
    const fill = (a) => {
      selectedAddr = a;
      if (a) {
        form.receiverName.value = a.receiverName; form.receiverPhone.value = a.receiverPhone;
        form.detail.value = a.detail; form.ward.value = a.ward; form.province.value = a.province;
      } else {
        form.receiverName.value = me.fullName || ''; form.receiverPhone.value = me.phone || '';
        form.detail.value = ''; form.ward.value = ''; form.province.value = '';
      }
      $('#saveAddrBox').classList.toggle('hidden', !!a); // chỉ hỏi lưu khi nhập địa chỉ mới
    };
    if (addrs.length) {
      $('#addrPick').innerHTML = `<label>Chọn địa chỉ đã lưu</label><select id="addrSel">
        ${addrs.map((a, i) => `<option value="${i}">${esc(a.receiverName)} – ${esc(full(a))}${a.isDefault ? ' (mặc định)' : ''}</option>`).join('')}
        <option value="">+ Nhập địa chỉ mới</option></select>`;
      $('#addrSel').onchange = (e) => fill(e.target.value === '' ? null : addrs[e.target.value]);
      const def = Math.max(addrs.findIndex((a) => a.isDefault), 0);
      $('#addrSel').value = def;
      fill(addrs[def]);
    } else fill(null);
    await refreshTotals();
  } catch (e) { toast(e.message, 'err'); }

  $('#applyCode').onclick = async () => {
    const code = $('#discountCode').value.trim().toUpperCase();
    const old = appliedCode;
    appliedCode = code;
    try { await refreshTotals(); toast(code ? `Đã áp dụng mã ${code}` : 'Đã bỏ mã giảm giá'); }
    catch (e) { appliedCode = old; toast(e.message, 'err'); }
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(form));
    const addr = { detail: body.detail.trim(), ward: body.ward.trim(), province: body.province.trim() };
    body.shippingAddress = `${addr.detail}, ${addr.ward}, ${addr.province}`;
    ['detail', 'ward', 'province'].forEach((k) => delete body[k]);
    body.discountCode = appliedCode;
    const btn = form.querySelector('button:not([type=button])');
    btn.disabled = true;
    try {
      // Địa chỉ mới -> lưu vào sổ địa chỉ (địa chỉ đầu tiên tự thành mặc định), lần sau tự điền
      if (!selectedAddr && $('#saveAddr').checked) {
        // Gán selectedAddr để nếu đặt hàng lỗi và bấm lại thì không lưu trùng địa chỉ
        selectedAddr = await api('/addresses', { method: 'POST', body: { receiverName: body.receiverName, receiverPhone: body.receiverPhone, ...addr } })
          .then((r) => r.data)
          .catch(() => null); // lưu địa chỉ lỗi thì vẫn cho đặt hàng
      }
      const { data } = await api('/orders', { method: 'POST', body });
      toast(hasRequest ? 'Đặt hàng thành công. Cửa hàng sẽ báo giá yêu cầu của bạn sớm' : 'Đặt hàng thành công!');
      setTimeout(() => (location.href = `/orders.html?new=${data.code}`), 900);
    } catch (err) { toast(err.message, 'err'); btn.disabled = false; }
  };
});
