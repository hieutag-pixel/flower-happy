// Trang danh sách sản phẩm: tìm kiếm, lọc theo thẻ, khoảng giá, sắp xếp, phân trang
const state = {
  q: qs('q') || '',
  category: qs('category') || '',
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
  const item = (c) => `<a href="#" data-slug="${c.slug}" class="${state.category === c.slug ? 'active' : ''}">${esc(c.name)}</a>`;
  const all = `<a href="#" data-slug="" class="${!state.category ? 'active' : ''}">Tất cả</a>`;
  $('#occasionList').innerHTML = all + categories.filter((c) => c.type === 'occasion').map(item).join('');
  $('#styleList').innerHTML = categories.filter((c) => c.type === 'style').map(item).join('');
  document.querySelectorAll('.filter-box a[data-slug]').forEach((a) => {
    a.onclick = (e) => { e.preventDefault(); state.category = a.dataset.slug; state.page = 1; load(); };
  });
}

async function load() {
  syncUrl();
  renderFilters();
  const cat = categories.find((c) => c.slug === state.category);
  $('#title').textContent = state.q ? `Kết quả cho "${state.q}"` : cat ? cat.name : 'Tất cả sản phẩm';
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
  load();
});
