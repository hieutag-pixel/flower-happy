// Trang thanh toán
let appliedCode = '';
let hasRequest = false; // giỏ có "Yêu cầu của khách hàng" -> cửa hàng sẽ báo giá sau

async function refreshTotals() {
  const { data } = await api('/orders/preview', { method: 'POST', body: { discountCode: appliedCode } });
  $('#sSub').textContent = money(data.subTotal);
  $('#sShip').textContent = data.shippingFee ? money(data.shippingFee) : 'Miễn phí';
  $('#sDisc').textContent = data.discountAmount ? `-${money(data.discountAmount)}` : '0đ';
  $('#sTotal').textContent = money(data.total);
  loadVouchers();
}

// Áp dụng / bỏ một mã giảm giá rồi tính lại tổng tiền
async function useCode(code) {
  const old = appliedCode;
  appliedCode = code;
  try {
    await refreshTotals();
    $('#discountCode').value = code;
    toast(code ? `Đã áp dụng mã ${code}` : 'Đã bỏ mã giảm giá');
  } catch (e) { appliedCode = old; toast(e.message, 'err'); }
}

// Ví mã giảm giá của tài khoản: mỗi tài khoản có mã riêng, số lượt giới hạn.
// Mã đủ điều kiện thì có nút "Dùng"; mã chưa đủ thì báo cần mua thêm bao nhiêu.
const voucherText = (v) =>
  `${v.type === 'percentage' ? `Giảm ${v.value}%${v.maxDiscount ? `, tối đa ${money(v.maxDiscount)}` : ''}` : `Giảm ${money(v.value)}`} · Đơn từ ${money(v.minOrder)}`;

async function loadVouchers() {
  let list = [];
  try { list = (await api('/discounts/my')).data; } catch { return; } // không tải được ví mã thì vẫn nhập tay được
  const best = list.find((v) => v.eligible);
  const near = list.find((v) => !v.eligible && (!best || v.potential > best.amount));
  const tip = $('#voucherTip');
  let tipHtml = '';
  if (!appliedCode && best) tipHtml = `Đơn của bạn dùng được mã <b>${esc(best.code)}</b>, giảm <b>${money(best.amount)}</b>. <button type="button" class="link" data-code="${esc(best.code)}">Dùng ngay</button>`;
  else if (near) tipHtml = `Mua thêm <b>${money(near.missing)}</b> để dùng mã <b>${esc(near.code)}</b> (giảm ${money(near.potential)}). <a href="/products.html">Chọn thêm hoa</a>`;
  tip.innerHTML = tipHtml;
  tip.classList.toggle('hidden', !tipHtml);

  $('#vouchers').innerHTML = list.length
    ? `<div class="vouchers-title">Mã giảm giá của bạn</div>${list.map((v) => {
        const on = v.code === appliedCode;
        return `<div class="voucher ${v.eligible ? '' : 'locked'} ${on ? 'on' : ''}">
          <div class="voucher-info">
            <div><b>${esc(v.code)}</b>${v.personal ? '<span class="variant custom">Dành riêng cho bạn</span>' : ''}</div>
            <div class="composition">${v.description ? `${esc(v.description)} · ` : ''}${voucherText(v)}</div>
            <div class="composition">Còn ${v.remaining} lượt · HSD ${fmtDate(v.endDate)}${v.eligible ? '' : ` · <span class="need">Mua thêm ${money(v.missing)}</span>`}</div>
          </div>
          ${on ? '<button type="button" class="btn btn-outline btn-sm" data-code="">Bỏ mã</button>'
            : `<button type="button" class="btn btn-sm" data-code="${esc(v.code)}" ${v.eligible ? '' : 'disabled'}>Dùng</button>`}
        </div>`;
      }).join('')}`
    : '';
  document.querySelectorAll('#vouchers [data-code], #voucherTip [data-code]').forEach((b) => (b.onclick = () => useCode(b.dataset.code)));
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
      <span>${esc(i.product.name)} × ${i.quantity} ${variantHtml(i)}
        ${i.customerRequest ? `<div class="hint">Yêu cầu: ${esc(i.customerRequest)} – chờ cửa hàng báo giá</div>` : ''}</span>
      <span style="white-space:nowrap">${money(i.lineTotal)}</span></div>`).join('');
    hasRequest = cart.items.some((i) => i.customerRequest);

    // Tự điền địa chỉ từ sổ địa chỉ của tài khoản: ưu tiên địa chỉ mặc định, không có thì lấy địa chỉ đầu tiên
    // Địa chỉ cũ lưu tách phường/tỉnh, địa chỉ mới chỉ có 1 dòng -> ghép những phần có dữ liệu
    const full = (a) => [a.detail, a.ward, a.province].filter(Boolean).join(', ');
    const fill = (a) => {
      selectedAddr = a;
      if (a) {
        form.receiverName.value = a.receiverName; form.receiverPhone.value = a.receiverPhone;
        form.detail.value = full(a);
      } else {
        form.receiverName.value = me.fullName || ''; form.receiverPhone.value = me.phone || '';
        form.detail.value = '';
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

  $('#applyCode').onclick = () => useCode($('#discountCode').value.trim().toUpperCase());

  form.onsubmit = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(form));
    const addr = { detail: body.detail.trim() }; // một ô địa chỉ duy nhất, không tách phường/xã, tỉnh/thành
    body.shippingAddress = addr.detail;
    delete body.detail;
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
