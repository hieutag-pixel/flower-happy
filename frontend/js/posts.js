// Danh sách bài viết & chi tiết bài viết
document.addEventListener('DOMContentLoaded', async () => {
  try {
    if ($('#posts')) {
      const { data } = await api('/posts');
      $('#posts').innerHTML = data.length
        ? data.map((p) => `<a class="card post-card" href="/post.html?slug=${p.slug}">
            <img src="${p.thumbnail || '/images/logo-sm.png'}" alt="${esc(p.title)}" loading="lazy">
            <div class="body"><small class="muted">${fmtDate(p.createdAt)}</small><h3>${esc(p.title)}</h3>
            <p class="muted" style="margin:0;font-size:14px">${esc(p.summary || '')}</p></div></a>`).join('')
        : '<div class="empty">Chưa có bài viết.</div>';
    }
    if ($('#post')) {
      const { data: p } = await api(`/posts/${encodeURIComponent(qs('slug'))}`);
      document.title = `${p.title} | Flowers Happy`;
      // Nội dung bài viết do admin nhập (HTML) nên được hiển thị trực tiếp
      $('#post').innerHTML = `<p class="muted" style="margin-top:32px">${fmtDate(p.createdAt)} • ${esc(p.author?.fullName || 'Flowers Happy')}</p>
        <h1 style="font-size:40px">${esc(p.title)}</h1>
        ${p.thumbnail ? `<img src="${p.thumbnail}" alt="" style="border-radius:16px;margin:18px 0;width:100%;max-height:440px;object-fit:cover">` : ''}
        <p style="font-size:19px" class="muted">${esc(p.summary || '')}</p>
        <div>${p.content}</div>
        <p style="margin-top:32px"><a class="btn btn-outline" href="/posts.html">${ICONS.arrowLeft}Tất cả bài viết</a></p>`;
    }
  } catch (e) {
    ($('#posts') || $('#post')).innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
});
