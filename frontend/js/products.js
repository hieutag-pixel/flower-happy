// Trang danh sách sản phẩm: tìm kiếm, lọc theo thẻ, khoảng giá, sắp xếp, phân trang
const state = {
  q: qs('q') || '',
  category: qs('category') || '', // dịp tặng
  style: qs('style') || '', // kiểu dáng (lọc cùng lúc với dịp tặng)
  sort: qs('sort') || 'newest',
  minPrice: qs('minPrice') || '',
  maxPrice: qs('maxPrice') || '',
  page: Number(qs('page')) || 1,
};
let categories = [];

function syncUrl() {
  const p = new URLSearchParams();
  Object.entries(state).forEach(([k, v]) => v && !(k === 'page' && v === 1) && p.set(k, v));
  history.replaceState(null, '', `?${p}`);
}

function renderFilters() {
  // Hai nhóm lọc độc lập: chọn "Sinh nhật" rồi chọn "Giỏ hoa" sẽ ra giỏ hoa sinh nhật
  const group = (key, type) => {
    const item = (c) => `<a href="#" data-key="${key}" data-slug="${c.slug}" class="${state[key] === c.slug ? 'active' : ''}">${esc(c.name)}</a>`;
    return `<a href="#" data-key="${key}" data-slug="" class="${!state[key] ? 'active' : ''}">Tất cả</a>` + categories.filter((c) => c.type === type).map(item).join('');
  };
  $('#occasionList').innerHTML = group('category', 'occasion');
  $('#styleList').innerHTML = group('style', 'style');
  document.querySelectorAll('.filter-box a[data-slug]').forEach((a) => {
    a.onclick = (e) => { e.preventDefault(); state[a.dataset.key] = a.dataset.slug; state.page = 1; load(); };
  });
}

async function load() {
  syncUrl();
  renderFilters();
  const picked = [state.category, state.style].map((s) => categories.find((c) => c.slug === s)).filter(Boolean);
  $('#title').textContent = state.q ? `Kết quả cho "${state.q}"` : picked.length ? picked.map((c) => c.name).join(' · ') : 'Tất cả sản phẩm';
  const params = new URLSearchParams({ ...state, limit: 12 });
  [...params.keys()].forEach((k) => !params.get(k) && params.delete(k));
  $('#list').innerHTML = '<p class="muted">Đang tải...</p>';
  try {
    const res = await api(`/products?${params}`);
    $('#resultInfo').textContent = `${res.pagination.total} sản phẩm`;
    $('#list').innerHTML = res.data.length ? res.data.map(productCard).join('') : '<div class="empty">Không tìm thấy sản phẩm phù hợp</div>';
    pagination($('#pager'), res.pagination, (p) => { state.page = p; load(); scrollTo({ top: 0, behavior: 'smooth' }); });
  } catch (e) {
    $('#list').innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  $('#sort').value = state.sort;
  $('#minPrice').value = state.minPrice;
  $('#maxPrice').value = state.maxPrice;
  $('#sort').onchange = (e) => { state.sort = e.target.value; state.page = 1; load(); };
  $('#applyPrice').onclick = () => { state.minPrice = $('#minPrice').value; state.maxPrice = $('#maxPrice').value; state.page = 1; load(); };
  try { categories = (await api('/categories')).data; } catch { /* vẫn hiển thị sản phẩm */ }
  // Link cũ dạng ?category=<kiểu dáng> (VD ?category=gio-hoa) -> chuyển sang nhóm kiểu dáng
  if (categories.find((c) => c.slug === state.category)?.type === 'style' && !state.style) { state.style = state.category; state.category = ''; }
  load();
});
