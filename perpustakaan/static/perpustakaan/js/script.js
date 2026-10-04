// 1. FUNGSI UNTUK DASHBOARD (Buku dari Open Library)
async function fetchEngineeringBooks() {
    const container = document.getElementById('book-grid-container');
    if (!container) return; // Hanya jalan di Dashboard

    const apiUrl = 'https://openlibrary.org/search.json?q=computer+engineering&subject=engineering&limit=4';

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error('Gagal fetch API Open Library');
        const data = await response.json();
        const books = data.docs || [];

        if (books.length === 0) return;
        container.innerHTML = ''; // Hapus loading

        books.forEach(book => {
            const coverId = book.cover_i;
            const coverUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=300';
            const title = (book.title || 'Engineering Book').substring(0, 32);
            const author = (book.author_name ? book.author_name[0] : 'Engineering Author').substring(0, 22);

            container.innerHTML += `
                <div class="book-card">
                    <img src="${coverUrl}" alt="Cover" class="book-cover">
                    <div class="book-info">
                        <p class="type">Buku Digital</p>
                        <h3>${title}</h3>
                        <p class="author">${author}</p>
                        <span class="book-rating"><i class="fas fa-star"></i> 4.8 • <i class="fas fa-eye"></i> 1.2k</span>
                        <i class="fas fa-heart heart"></i>
                    </div>
                </div>
            `;
        });
    } catch (error) {
        console.error(error);
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