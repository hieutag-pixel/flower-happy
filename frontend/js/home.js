// Trang chủ
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const [cats, best, newest, posts] = await Promise.all([
      api('/categories?type=occasion'),
      api('/products?sort=best&limit=4'),
      api('/products?sort=newest&limit=8'),
      api('/posts?limit=3'),
    ]);
    $('#occasions').innerHTML = cats.data
      .map((c) => `<a class="chip" href="/products.html?category=${c.slug}">${esc(c.name)}</a>`)
      .join('');
    $('#best').innerHTML = best.data.map(productCard).join('');
    $('#newest').innerHTML = newest.data.map(productCard).join('');
    $('#posts').innerHTML = posts.data.map(postCard).join('');
  } catch (e) {
    document.querySelector('main').insertAdjacentHTML(
      'afterbegin',
      `<div class="container empty">Không tải được dữ liệu: ${esc(e.message)}.<br>Kiểm tra server và MongoDB đã chạy, và đã chạy <b>npm run seed</b> chưa.</div>`
    );
  }
});

function postCard(p) {
  return `<a class="card post-card" href="/post.html?slug=${p.slug}">
    <img src="${p.thumbnail || '/images/logo-sm.png'}" alt="${esc(p.title)}" loading="lazy">
    <div class="body"><h3>${esc(p.title)}</h3><p class="muted" style="margin:0;font-size:14px">${esc(p.summary || '')}</p></div>
  </a>`;
}
