// 1. FUNGSI UNTUK DASHBOARD (Buku dari Open Library)
const OL_SEARCH = 'https://openlibrary.org/search.json';
const OL_FIELDS = 'key,title,author_name,first_publish_year,cover_i,ia,has_fulltext,ratings_average,want_to_read_count';
const NO_COVER = 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=300';

function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
        ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Cover lewat ID internal (tidak kena rate limit seperti ISBN)
function olCover(coverId, size = 'M') {
    return coverId ? `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg` : NO_COVER;
}

async function olSearch(params) {
    const qs = new URLSearchParams({ fields: OL_FIELDS, limit: 8, ...params });
    const res = await fetch(`${OL_SEARCH}?${qs}`);
    if (!res.ok) throw new Error('Open Library error ' + res.status);
    const data = await res.json();
    return data.docs || [];
}

function renderBooks(container, books) {
    if (!books.length) {
        container.innerHTML = '<p>Buku tidak ditemukan.</p>';
        return;
    }
    container.innerHTML = books.map(b => {
        const rating = b.ratings_average ? b.ratings_average.toFixed(1) : '-';
        const wants = b.want_to_read_count ?? 0;
        return `
        <div class="book-card" onclick="window.open('https://openlibrary.org${esc(b.key)}','_blank')">
            <img src="${olCover(b.cover_i)}" alt="Cover ${esc(b.title)}" class="book-cover">
            <div class="book-info">
                <p class="type">Buku Digital</p>
                <h3>${esc((b.title || 'Tanpa judul').substring(0, 40))}</h3>
                <p class="author">${esc((b.author_name?.[0] || 'Unknown').substring(0, 24))}</p>
                <span class="book-rating">
                    <i class="fas fa-star"></i> ${rating} • <i class="fas fa-bookmark"></i> ${wants}
                </span>
                <i class="fas fa-heart heart"></i>
            </div>
        </div>`;
    }).join('');
}

// Rekomendasi dashboard + search bar
async function fetchEngineeringBooks() {
    const container = document.getElementById('book-grid-container');
    if (!container) return; // hanya jalan di dashboard

    try {
        renderBooks(container, await olSearch({ q: 'subject:engineering', sort: 'rating' }));
    } catch (e) {
        console.error(e);
        container.innerHTML = '<p>Gagal memuat data dari Open Library.</p>';
    }

    const input = document.getElementById('hero-search');
    if (input) {
        input.addEventListener('keydown', async (e) => {
            if (e.key !== 'Enter') return;
            const q = input.value.trim();
            if (!q) return;
            document.getElementById('rec-title').textContent = `Hasil pencarian: "${q}"`;
            container.innerHTML = '<p>Mencari...</p>';
            try {
                renderBooks(container, await olSearch({ q }));
            } catch (err) {
                container.innerHTML = '<p>Gagal mencari.</p>';
            }
        });
    }
}

// 2. FUNGSI UNTUK E-JOURNAL (Artikel dari OpenAlex API)
async function fetchJournals() {
    const container = document.getElementById('journal-list-container');
    if (!container) return; // Hanya jalan di halaman E-Journal

    // API OpenAlex khusus artikel jurnal Engineering & Technology (Limit 5)
    const apiUrl = 'https://api.openalex.org/works?search=engineering+technology&filter=type:article&per-page=5';

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error('Gagal fetch API OpenAlex');
        const data = await response.json();
        const journals = data.results || [];

        if (journals.length === 0) {
            container.innerHTML = '<p>Tidak ada jurnal ditemukan.</p>';
            return;
        }

        container.innerHTML = ''; // Hapus Loading spinner

        journals.forEach(journal => {
            const title = journal.title ? journal.title : 'Jurnal Engineering Tanpa Judul';
            // Cari nama penulis pertama
            let author = "Unknown Author";
            if (journal.authorships && journal.authorships.length > 0) {
                author = journal.authorships[0].author.display_name;
            }
            const year = journal.publication_year || '2024';
            const link = journal.doi || journal.id || '#';

            // Jurnal asli jarang punya cover, kita beri gambar ilustrasi jurnal yang estetis
            const coverUrl = 'https://images.unsplash.com/photo-1580536203673-93e150937a54?w=300';

            container.innerHTML += `
                <div class="journal-card">
                    <img src="${coverUrl}" alt="Cover Jurnal" class="journal-cover">
                    <div class="journal-content">
                        <h3 class="journal-title">${title}</h3>
                        <hr class="journal-divider">
                        <div class="journal-footer">
                            <span class="journal-meta">Penulis: ${author} | Tahun: ${year}</span>
                            <a href="${link}" target="_blank" class="btn-baca">Baca Jurnal <i class="fas fa-arrow-right"></i></a>
                        </div>
                    </div>
                </div>
            `;
        });
    } catch (error) {
        console.error(error);
        container.innerHTML = `<div style="color:#dc2626; padding:20px;">Gagal memuat jurnal dari API OpenAlex. Periksa koneksi internet Anda.</div>`;
    }
}

// 3. JALANKAN SEMUA FUNGSI SAAT HALAMAN DIMUAT
document.addEventListener('DOMContentLoaded', () => {
    fetchEngineeringBooks();
    fetchJournals();
});

// 4. FUNGSI KONFIRMASI PENGEMBALIAN BUKU
function confirmReturn(event, bookTitle) {
    event.preventDefault(); // Hentikan aksi klik sementara
    const url = event.currentTarget.getAttribute('href'); // Ambil link tujuan
    
    // Tampilkan Pop Up Konfirmasi bawaan browser
    if (confirm(`Apakah Anda yakin ingin menyelesaikan dan mengembalikan buku "${bookTitle}"?\n\nAnda akan mendapatkan +50 EXP jika dikembalikan.`)) {
        window.location.href = url; // Lanjutkan jika pilih OK
    }
}


// 5. FUNGSI HAPUS BOOKMARK DENGAN AJAX
async function removeBookmark(element) {
    const bookmarkId = element.dataset.id; // Ambil ID dari atribut data-id
    const bookCard = element.closest('.book-card');
    
    try {
        const response = await fetch(`/hapus-bookmark/${bookmarkId}/`);
        
        if (response.ok) {
            bookCard.style.transition = "opacity 0.3s, transform 0.3s";
            bookCard.style.opacity = "0";
            bookCard.style.transform = "scale(0.9)";
            
            setTimeout(() => {
                bookCard.remove();
                
                const countEl = document.getElementById('bookmark-counter');
                if (countEl) {
                    let current = parseInt(countEl.innerText);
                    countEl.innerText = Math.max(0, current - 1);
                }
            }, 300);
        }
    } catch (error) {
        console.error("Gagal menghapus bookmark", error);
    }
}

// 6. FUNGSI MODAL DETAIL RIWAYAT
function openDetailModal(element) {
    // Ambil semua data dari atribut data-* pada link yang diklik
    document.getElementById('modal-judul').innerText = element.dataset.judul;
    document.getElementById('modal-penulis').innerText = element.dataset.penulis;
    document.getElementById('modal-pinjam').innerText = element.dataset.pinjam;
    document.getElementById('modal-kembali').innerText = element.dataset.kembali;
    document.getElementById('modal-progress').innerText = element.dataset.progress + "%";
    document.getElementById('modal-exp').innerText = "+" + element.dataset.exp + " EXP";

    // Tampilkan modal
    document.getElementById('detail-modal').classList.add('show');
}

function closeDetailModal() {
    document.getElementById('detail-modal').classList.remove('show');
}

// Tutup modal jika klik di area gelap di luar kotak
window.addEventListener('click', function(event) {
    const modal = document.getElementById('detail-modal');
    if (modal && event.target === modal) {
        closeDetailModal();
    }
});

// 6. FUNGSI TOGGLE LIHAT PASSWORD (Halaman Profil)
function togglePassword(inputId, iconElement) {
    const input = document.getElementById(inputId);
    if (input.type === "password") {
        input.type = "text";
        iconElement.classList.remove("fa-eye");
        iconElement.classList.add("fa-eye-slash");
    } else {
        input.type = "password";
        iconElement.classList.remove("fa-eye-slash");
        iconElement.classList.add("fa-eye");
    }
}

async function searchInsideBook(iaId, query) {
    const meta = await (await fetch(`https://archive.org/metadata/${iaId}`)).json();
    const host = meta.d1, path = meta.dir;
    if (!host || !path) throw new Error('Server buku tidak ditemukan');

    return new Promise((resolve, reject) => {
        const cb = 'olInside_' + Date.now();
        const s = document.createElement('script');
        window[cb] = (data) => { delete window[cb]; s.remove(); resolve(data); };
        s.onerror = () => { delete window[cb]; s.remove(); reject(new Error('Gagal memuat')); };
        s.src = `https://${host}/fulltext/inside.php?item_id=${iaId}&doc=${iaId}` +
                `&path=${encodeURIComponent(path)}&q=${encodeURIComponent(query)}&callback=${cb}`;
        document.body.appendChild(s);
    });
}

// Contoh pemakaian: tampilkan cuplikan dengan kata yang di-highlight
async function tampilkanHasil(iaId, q) {
    const data = await searchInsideBook(iaId, q);
    return (data.matches || []).slice(0, 5).map(m =>
        esc(m.text).replace(/\{\{\{/g, '<mark>').replace(/\}\}\}/g, '</mark>')
    );
}