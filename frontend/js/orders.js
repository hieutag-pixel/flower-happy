// Lịch sử đơn hàng: xem, lọc theo trạng thái, huỷ đơn, trả lời báo giá, đánh giá
let currentStatus = '';

// Khung "Yêu cầu của khách hàng" + báo giá của cửa hàng
function requestHtml(o, i) {
  if (!i.customerRequest || i.requestStatus === 'none') return '';
  const canAnswer = o.status === 'pending' && i.requestStatus === 'quoted';
  return `<div class="request-box">
    <div>Yêu cầu: ${esc(i.customerRequest)} <span class="status ${i.requestStatus}">${REQUEST_STATUS[i.requestStatus]}</span></div>
    ${['quoted', 'accepted'].includes(i.requestStatus) ? `<div style="margin-top:4px">Phụ thu cửa hàng báo: <b>${money(i.requestFee)}</b>${i.adminNote ? ` – ${esc(i.adminNote)}` : ''}</div>` : ''}
    ${i.requestStatus === 'rejected' && i.adminNote ? `<div class="hint">Ghi chú cửa hàng: ${esc(i.adminNote)}</div>` : ''}
    ${i.requestStatus === 'waiting_quote' ? '<div class="hint">Cửa hàng sẽ báo giá phụ thu (nếu có) trước khi xác nhận đơn.</div>' : ''}
    ${canAnswer ? `<div class="hint">Nếu đồng ý, tổng đơn sẽ là <b>${money(o.total + i.requestFee)}</b>. Nếu từ chối, cửa hàng làm theo mẫu gốc.</div>
      <div class="actions"><button class="btn btn-sm" onclick="answerQuote('${o._id}','${i._id}',true)">Đồng ý</button>
      <button class="btn btn-outline btn-sm" onclick="answerQuote('${o._id}','${i._id}',false)">Từ chối</button></div>` : ''}
  </div>`;
}

async function loadOrders() {
  const { data } = await api(`/orders/my${currentStatus ? `?status=${currentStatus}` : ''}`);
  if (!data.length) { $('#orders').innerHTML = '<div class="panel empty">Chưa có đơn hàng nào.</div>'; return; }
  $('#orders').innerHTML = data.map((o) => `
    <div class="panel" style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div><b>Đơn ${o.code}</b> <span class="muted">• ${fmtDateTime(o.createdAt)}</span></div>
        <span class="status ${o.status}">${ORDER_STATUS[o.status]}</span>
      </div>
      <table class="table" style="margin:10px 0">
        ${o.items.map((i) => `<tr><td style="width:80px"><img src="${i.thumbnail}" alt=""></td>
          <td>${esc(i.name)} × ${i.quantity}${stemChangesHtml(i)}${requestHtml(o, i)}</td>
          <td style="text-align:right;white-space:nowrap">${money((i.price + i.adjustAmount) * i.quantity)}</td>
          <td style="text-align:right;width:120px">${o.status === 'completed' ? `<a class="btn btn-outline btn-sm" href="/product.html?slug=${i.product}#reviewForm">Đánh giá</a>` : ''}</td></tr>`).join('')}
      </table>
      <div class="muted" style="font-size:14px">
        Người nhận: <b>${esc(o.receiverName)}</b> – ${esc(o.receiverPhone)} – ${esc(o.shippingAddress)}<br>
        Giao: ${fmtDate(o.deliveryDate)} ${esc(o.deliveryTimeSlot)} • ${PAYMENT[o.paymentMethod]} (${o.paymentStatus === 'paid' ? 'đã thanh toán' : 'chưa thanh toán'})
        ${o.cardMessage ? `<br>Lời nhắn thiệp: “${esc(o.cardMessage)}”` : ''}
        ${o.cancelReason ? `<br>Lý do huỷ: ${esc(o.cancelReason)}` : ''}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;flex-wrap:wrap;gap:8px">
        <div>Tạm tính ${money(o.subTotal)} + Ship ${money(o.shippingFee)}${o.discountAmount ? ` − Giảm ${money(o.discountAmount)} (${o.discountCode})` : ''}${o.requestFeeTotal ? ` + Phụ thu yêu cầu ${money(o.requestFeeTotal)}` : ''}
          = <b class="price">${money(o.total)}</b></div>
        ${o.status === 'pending' ? `<button class="btn btn-outline btn-sm" onclick="cancelOrder('${o._id}')">Huỷ đơn</button>` : ''}
      </div>
    </div>`).join('');
}

async function answerQuote(orderId, itemId, accept) {
  if (!accept && !confirm('Từ chối báo giá? Cửa hàng sẽ làm theo mẫu gốc, không tính phụ thu.')) return;
  try {
    const r = await api(`/orders/${orderId}/items/${itemId}/quote-response`, { method: 'PUT', body: { accept } });
    toast(r.message);
    loadOrders();
    updateQuoteNotice();
  } catch (e) { toast(e.message, 'err'); }
}

async function cancelOrder(id) {
  const reason = prompt('Lý do huỷ đơn?', 'Tôi muốn đổi sản phẩm khác');
  if (reason === null) return;
  try { await api(`/orders/${id}/cancel`, { method: 'PUT', body: { reason } }); toast('Đã huỷ đơn hàng'); loadOrders(); updateQuoteNotice(); }
  catch (e) { toast(e.message, 'err'); }
}

document.addEventListener('DOMContentLoaded', () => {
  Auth.require();
  if (qs('new')) toast(`Đơn ${qs('new')} đã được tạo. Cửa hàng sẽ liên hệ xác nhận sớm!`);
  const tabs = { '': 'Tất cả', ...ORDER_STATUS };
  $('#statusTabs').innerHTML = Object.entries(tabs).map(([k, v]) => `<button class="chip ${k === '' ? 'active' : ''}" data-s="${k}">${v}</button>`).join('');
  document.querySelectorAll('#statusTabs .chip').forEach((b) => (b.onclick = () => {
    document.querySelectorAll('#statusTabs .chip').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    currentStatus = b.dataset.s;
    loadOrders();
  }));
  loadOrders().catch((e) => toast(e.message, 'err'));
});
