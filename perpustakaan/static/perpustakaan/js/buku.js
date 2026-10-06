// Katalog (infinite scroll), halaman detail, dan bookmark.
// Data buku diambil LANGSUNG dari browser ke Open Library. Django hanya menyimpan
// pinjam/bookmark. Dibungkus IIFE supaya tidak bentrok dengan nama di script.js.
(function () {
    'use strict';

    const OL = 'https://openlibrary.org';
    const FIELDS = 'key,title,author_name,first_publish_year,cover_i,ia,ratings_average,want_to_read_count';
    const NO_COVER = 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=300';

    // ---------- Util ----------
    function escHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    function getCookie(name) {
        const m = document.cookie.match('(?:^|; )' + name + '=([^;]*)');
        return m ? decodeURIComponent(m[1]) : '';
    }
    function readJson(id) {
        const el = document.getElementById(id);
        try { return el ? JSON.parse(el.textContent) : null; } catch (e) { return null; }
    }
    async function postForm(url, data) {
        const res = await fetch(url, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'X-CSRFToken': getCookie('csrftoken') },
            body: new URLSearchParams(data || {}),
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
    }

    // ---------- Klien Open Library ----------
    function coverUrl(id, size) {
        return id ? `https://covers.openlibrary.org/b/id/${id}-${size}.jpg` : '';
    }
    function normalize(doc) {
        return {
            olid: (doc.key || '').split('/').pop(),
            judul: doc.title || 'Tanpa judul',
            penulis: (doc.author_name || ['Unknown']).slice(0, 2).join(', '),
            tahun: doc.first_publish_year || '',
            cover: coverUrl(doc.cover_i, 'M'),
            cover_besar: coverUrl(doc.cover_i, 'L'),
            rating: doc.ratings_average ? Math.round(doc.ratings_average * 10) / 10 : null,
            want: doc.want_to_read_count || 0,
            ia: (doc.ia || [''])[0],
            deskripsi: '',
            subjek: [],
        };
    }
    async function olGet(path, params) {
        const res = await fetch(`${OL}${path}?${new URLSearchParams(params)}`);
        if (!res.ok) throw new Error('Open Library HTTP ' + res.status);
        return res.json(); // gagal kalau yang datang halaman verifikasi (HTML)
    }
    async function olSearch(q, page, limit, sort) {
        const params = { q, fields: FIELDS, limit, page };
        if (sort) params.sort = sort;
        const data = await olGet('/search.json', params);
        const books = (data.docs || []).map(normalize).filter(b => /^OL\d+W$/.test(b.olid));
        const total = data.numFound || data.num_found || 0;
        return { books, total, hasMore: page * limit < total };
    }
    function cleanDescription(d) {
        if (d && typeof d === 'object') d = d.value;
        if (typeof d !== 'string') return '';
        return d.split('----------')[0]
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/\(\[source\]\[\d+\]\)/g, '')
            .trim();
    }
    async function olBook(olid) {
        const r = await olSearch(`key:/works/${olid}`, 1, 1);
        if (!r.books.length) { const e = new Error('notfound'); e.notfound = true; throw e; }
        const book = r.books[0];
        try {
            const work = await olGet(`/works/${olid}.json`, {});
            book.deskripsi = cleanDescription(work.description);
            book.subjek = (work.subjects || []).filter(s => typeof s === 'string').slice(0, 8);
        } catch (e) { /* detail tetap tampil tanpa deskripsi */ }
        return book;
    }

    // ---------- Bookmark ----------
    const bookCache = new Map();                    // olid -> data buku, dikirim ke Django saat bookmark
    const tersimpan = new Set(readJson('tersimpan-ids') || []);

    function bookPayload(b) {
        return { judul: b.judul, penulis: b.penulis, tahun: b.tahun, cover: b.cover, ia: b.ia, deskripsi: b.deskripsi || '' };
    }
    function setHeart(el, on) {
        el.classList.toggle('active', on);
        el.classList.toggle('fas', on);
        el.classList.toggle('far', !on);
        el.title = on ? 'Hapus dari bookmark' : 'Simpan ke bookmark';
    }
    async function toggleHeart(el) {
        if (el.dataset.busy) return;
        el.dataset.busy = '1';
        const olid = el.closest('[data-olid]').dataset.olid;
        try {
            const data = await postForm(`/buku/${olid}/bookmark/`, bookPayload(bookCache.get(olid) || {}));
            setHeart(el, data.bookmarked);
            if (data.bookmarked) tersimpan.add(olid); else tersimpan.delete(olid);
        } catch (e) {
            alert('Bookmark gagal disimpan. Coba lagi sebentar lagi.');
        } finally {
            delete el.dataset.busy;
        }
    }

    // ---------- Klik kartu -> detail; klik hati -> bookmark ----------
    document.addEventListener('click', (e) => {
        const heart = e.target.closest('.heart[data-toggle-bookmark]');
        if (heart) { e.preventDefault(); e.stopPropagation(); toggleHeart(heart); return; }
        if (e.target.closest('.heart')) return; // hati lama (halaman bookmarks) punya handler sendiri
        const card = e.target.closest('.book-card[data-olid]');
        if (!card) return;
        const url = `/buku/${card.dataset.olid}/`;
        if (e.ctrlKey || e.metaKey) window.open(url, '_blank'); else window.location.href = url;
    });
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const card = e.target.closest && e.target.closest('.book-card[data-olid]');
        if (card && e.target === card) window.location.href = `/buku/${card.dataset.olid}/`;
    });

    function cardHtml(b, withHeart) {
        const rating = b.rating ? b.rating.toFixed(1) : '-';
        const tahun = b.tahun ? ` • ${escHtml(b.tahun)}` : '';
        const on = tersimpan.has(b.olid);
        return `
        <div class="book-card" data-olid="${escHtml(b.olid)}" tabindex="0" role="link" aria-label="${escHtml(b.judul)}">
            <img src="${escHtml(b.cover || NO_COVER)}" alt="Sampul ${escHtml(b.judul)}" class="book-cover" loading="lazy"
                 onerror="this.onerror=null;this.src='${NO_COVER}'">
            <div class="book-info">
                <p class="type">Buku Digital</p>
                <h3>${escHtml(b.judul)}</h3>
                <p class="author">${escHtml(b.penulis)}${tahun}</p>
                <span class="book-rating"><i class="fas fa-star"></i> ${rating} • <i class="fas fa-bookmark"></i> ${b.want}</span>
                ${withHeart ? `<i class="${on ? 'fas active' : 'far'} fa-heart heart" data-toggle-bookmark title="${on ? 'Hapus dari bookmark' : 'Simpan ke bookmark'}"></i>` : ''}
            </div>
        </div>`;
    }

    // ---------- Halaman detail ----------
    const page = document.getElementById('bd-page');
    if (page) initDetail(page.dataset.olid);

    function initDetail(olid) {
        const $ = (id) => document.getElementById(id);
        let current = null;

        const bmBtn = $('bm-btn');
        bmBtn.addEventListener('click', async () => {
            if (bmBtn.disabled) return;
            const aktif = bmBtn.classList.contains('active');
            if (!aktif && !current) { alert('Tunggu data buku selesai dimuat.'); return; }
            bmBtn.disabled = true;
            try {
                const data = await postForm(`/buku/${olid}/bookmark/`, current ? bookPayload(current) : {});
                bmBtn.classList.toggle('active', data.bookmarked);
                bmBtn.querySelector('i').className = (data.bookmarked ? 'fas' : 'far') + ' fa-heart';
                bmBtn.querySelector('span').textContent = data.bookmarked ? 'Tersimpan' : 'Simpan';
            } catch (e) {
                alert('Bookmark gagal disimpan. Coba lagi sebentar lagi.');
            } finally { bmBtn.disabled = false; }
        });

        function render(b) {
            current = b;
            document.title = b.judul;
            $('bd-title').textContent = b.judul;
            $('bd-author').textContent = b.penulis + (b.tahun ? `, pertama terbit ${b.tahun}` : '');
            const cover = $('bd-cover');
            cover.alt = 'Sampul ' + b.judul;
            if (b.cover_besar) { cover.onerror = () => { cover.onerror = null; cover.src = NO_COVER; }; cover.src = b.cover_besar; }

            $('bd-stats').innerHTML =
                `<span><i class="fas fa-star"></i> ${b.rating ? b.rating : 'Belum ada rating'}</span>` +
                `<span><i class="fas fa-bookmark"></i> ${b.want} orang ingin membaca</span>`;

            const desc = $('bd-desc');
            if (b.deskripsi) { desc.textContent = b.deskripsi; desc.style.whiteSpace = 'pre-line'; desc.classList.remove('bd-muted'); }
            else { desc.textContent = 'Open Library belum punya deskripsi untuk buku ini.'; }

            $('bd-dl-author').textContent = b.penulis;
            $('bd-dl-year').textContent = b.tahun || '-';

            if (b.subjek && b.subjek.length) {
                $('bd-tags').innerHTML = b.subjek.map(s => `<span>${escHtml(s)}</span>`).join('');
                $('bd-subjects-wrap').hidden = false;
            }
            if (b.ia && /^[A-Za-z0-9._-]+$/.test(b.ia)) {
                const a = $('bd-ia'); a.href = `https://archive.org/details/${b.ia}`; a.hidden = false;
            }

            const form = $('pinjam-form');
            if (form) {
                const p = bookPayload(b);
                Object.keys(p).forEach(k => { form.elements[k].value = p[k]; });
                $('pinjam-btn').disabled = false;
            }
        }

        async function loadRelated(b) {
            if (!b.subjek || !b.subjek.length) return;
            try {
                const subject = b.subjek[0].replace(/"/g, '');
                const r = await olSearch(`subject:"${subject}"`, 1, 6, 'rating');
                const list = r.books.filter(x => x.olid !== b.olid).slice(0, 5);
                if (!list.length) return;
                list.forEach(x => bookCache.set(x.olid, x));
                $('bd-related-grid').innerHTML = list.map(x => cardHtml(x, false)).join('');
                $('bd-related').hidden = false;
            } catch (e) { /* buku terkait hanya pelengkap */ }
        }

        (async () => {
            let book = null;
            try {
                book = await olBook(olid);
            } catch (e) {
                const db = readJson('buku-db');
                if (db) {
                    book = db;
                    $('bd-error').textContent = 'Data terbaru dari Open Library belum bisa dimuat. Menampilkan data yang tersimpan.';
                    $('bd-error').hidden = false;
                } else {
                    $('bd-title').textContent = e.notfound ? 'Buku tidak ditemukan' : 'Buku tidak bisa dimuat';
                    $('bd-author').textContent = '';
                    $('bd-desc').textContent = e.notfound
                        ? 'Open Library tidak punya buku dengan ID ini.'
                        : 'Open Library belum bisa dihubungi dari browsermu. Muat ulang halaman ini beberapa saat lagi.';
                    return;
                }
            }
            render(book);
            loadRelated(book);
        })();
    }

    // ---------- Halaman katalog ----------
    const grid = document.getElementById('katalog-grid');
    if (!grid) return;

    const statusEl = document.getElementById('grid-status');
    const titleEl = document.getElementById('grid-title');
    const sentinel = document.getElementById('grid-sentinel');
    const searchEl = document.getElementById('katalog-search');
    const langEl = document.getElementById('filter-bahasa');
    const chips = Array.from(document.querySelectorAll('#chip-row .chip'));
    const DEFAULT_KAT = grid.dataset.defaultKategori;
    const LIMIT = 20;

    const state = { q: '', kategori: DEFAULT_KAT, bahasa: '', page: 1, loading: false, done: false, failed: false };
    let token = 0; // naik setiap filter berubah, supaya respons lama diabaikan

    function buildQuery() {
        const parts = [];
        if (state.q) parts.push(state.q);
        if (state.kategori) parts.push(`subject:"${state.kategori.replace(/"/g, '')}"`);
        if (state.bahasa) parts.push(`language:${state.bahasa}`);
        return parts.join(' ');
    }
    function setStatus(html) { statusEl.innerHTML = html; }
    function updateTitle() {
        if (state.q) titleEl.textContent = `Hasil untuk "${state.q}"`;
        else {
            const active = chips.find(c => c.dataset.kategori === state.kategori);
            titleEl.textContent = active ? active.textContent : '';
        }
    }
    function nearBottom() { return sentinel.getBoundingClientRect().top < window.innerHeight + 500; }

    async function load(reset) {
        if (reset) {
            token++;
            state.page = 1; state.done = false; state.failed = false; state.loading = false;
            grid.innerHTML = '';
            updateTitle();
        }
        if (state.loading || state.done || state.failed) return;

        const mine = token;
        state.loading = true;
        setStatus('<span class="spinner"></span> Memuat buku...');
        try {
            // tanpa kata kunci = jelajah kategori, urutkan dari rating
            const r = await olSearch(buildQuery(), state.page, LIMIT, state.q ? null : 'rating');
            if (mine !== token) return;

            r.books.forEach(b => bookCache.set(b.olid, b));
            grid.insertAdjacentHTML('beforeend', r.books.map(b => cardHtml(b, true)).join(''));
            state.page += 1;
            state.done = !r.hasMore;

            if (!grid.children.length) setStatus('<strong>Buku tidak ditemukan.</strong><br>Coba kata kunci lain atau ganti kategori.');
            else if (state.done) setStatus('Semua hasil sudah ditampilkan.');
            else setStatus('');
        } catch (err) {
            if (mine !== token) return;
            state.failed = true;
            setStatus('Gagal memuat buku dari Open Library. <button type="button" class="link-btn" id="retry-btn">Coba lagi</button>');
            const retry = document.getElementById('retry-btn');
            if (retry) retry.addEventListener('click', () => { state.failed = false; load(false); });
        } finally {
            if (mine === token) {
                state.loading = false;
                setTimeout(() => { if (nearBottom()) load(false); }, 0); // layar belum penuh: muat lagi
            }
        }
    }

    new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) load(false);
    }, { rootMargin: '500px' }).observe(sentinel);

    chips.forEach(chip => chip.addEventListener('click', () => {
        searchEl.value = '';
        state.q = '';
        state.kategori = chip.dataset.kategori;
        chips.forEach(c => c.classList.toggle('active', c === chip));
        load(true);
    }));

    let timer;
    searchEl.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            const q = searchEl.value.trim();
            if (q === state.q) return;
            state.q = q;
            if (q) {
                state.kategori = '';
                chips.forEach(c => c.classList.remove('active'));
            } else {
                state.kategori = DEFAULT_KAT;
                chips.forEach(c => c.classList.toggle('active', c.dataset.kategori === DEFAULT_KAT));
            }
            load(true);
        }, 400);
    });

    document.getElementById('btn-filter').addEventListener('click', (e) => {
        const open = document.getElementById('filter-panel').classList.toggle('open');
        e.currentTarget.setAttribute('aria-expanded', open);
    });
    langEl.addEventListener('change', () => { state.bahasa = langEl.value; load(true); });

    load(true);
})();