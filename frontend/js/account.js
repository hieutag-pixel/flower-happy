// Trang tài khoản: thông tin cá nhân, đổi mật khẩu, sổ địa chỉ
async function loadAddresses() {
  const { data } = await api('/addresses');
  $('#addresses').innerHTML = data.length
    ? data.map((a) => `<div style="border:1px solid var(--line);border-radius:10px;padding:12px;margin-bottom:10px">
        <b>${esc(a.receiverName)}</b> – ${esc(a.receiverPhone)} ${a.isDefault ? '<span class="tag">Mặc định</span>' : ''}<br>
        <span class="muted">${esc(a.detail)}, ${esc(a.ward)}, ${esc(a.province)}</span>
        <div style="margin-top:8px;display:flex;gap:8px">
          ${a.isDefault ? '' : `<button class="btn btn-outline btn-sm" onclick="setDefault('${a._id}')">Đặt mặc định</button>`}
          <button class="btn btn-outline btn-sm" onclick="removeAddr('${a._id}')">Xoá</button>
        </div></div>`).join('')
    : '<p class="muted">Chưa có địa chỉ nào.</p>';
}
async function setDefault(id) { await api(`/addresses/${id}`, { method: 'PUT', body: { isDefault: true } }); loadAddresses(); }
async function removeAddr(id) { if (confirm('Xoá địa chỉ này?')) { await api(`/addresses/${id}`, { method: 'DELETE' }); loadAddresses(); } }

document.addEventListener('DOMContentLoaded', async () => {
  Auth.require();
  const info = $('#infoForm');
  const { data: me } = await api('/auth/me');
  info.email.value = me.email;
  info.fullName.value = me.fullName;
  info.phone.value = me.phone || '';

  info.onsubmit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api('/auth/me', { method: 'PUT', body: { fullName: info.fullName.value, phone: info.phone.value } });
      Auth.save(Auth.token, data);
      toast('Đã lưu thông tin');
    } catch (err) { toast(err.message, 'err'); }
  };

  $('#pwForm').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api('/auth/password', { method: 'PUT', body: Object.fromEntries(new FormData(e.target)) });
      toast('Đổi mật khẩu thành công');
      e.target.reset();
    } catch (err) { toast(err.message, 'err'); }
  };

  $('#addrForm').onsubmit = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    body.isDefault = !!body.isDefault;
    try { await api('/addresses', { method: 'POST', body }); toast('Đã thêm địa chỉ'); e.target.reset(); loadAddresses(); }
    catch (err) { toast(err.message, 'err'); }
  };
  loadAddresses();
});
