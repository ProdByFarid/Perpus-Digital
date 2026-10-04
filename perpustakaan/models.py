from django.db import models
from django.contrib.auth.models import AbstractUser

# ====================== USER + GAMIFIKASI ======================
class CustomUser(AbstractUser):
    is_admin = models.BooleanField(default=False)
    is_member = models.BooleanField(default=True)
    
    # Fitur Gamifikasi
    exp = models.IntegerField(default=0)
    streak_days = models.IntegerField(default=0)
    last_read_date = models.DateField(null=True, blank=True)
    max_loans = models.IntegerField(default=5)  # Batas akses simultan

    def add_exp(self, points):
        self.exp += points
        self.save()

    def __str__(self):
        return self.username


# ====================== ABSTRACT CLASS ======================
class ItemKatalog(models.Model):
    id_item = models.CharField(max_length=20, unique=True, primary_key=True)
    judul = models.CharField(max_length=255)
    penulis = models.CharField(max_length=255)
    tahun_terbit = models.CharField(max_length=4)
    cover = models.URLField(blank=True, null=True)  # URL gambar sampul

    class Meta:
        abstract = True  # Pilar Abstraction OOP


# ====================== BUKU DIGITAL ======================
class BukuDigital(ItemKatalog):
    link_unduh = models.URLField(default="https://example.com")
    ukuran_file = models.FloatField(default=2.5, help_text="dalam MB")
    format_file = models.CharField(max_length=10, default="PDF")

    def __str__(self):
        return f"[Digital] {self.judul}"


# ====================== JURNAL ======================
class Jurnal(ItemKatalog):
    volume = models.CharField(max_length=50, blank=True)
    bidang_ilmu = models.CharField(max_length=100, blank=True)
    link_akses = models.URLField(default="https://example.com")

    def __str__(self):
        return f"[Jurnal] {self.judul}"


# ====================== PEMINJAMAN / RIWAYAT BACA ======================
class Peminjaman(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    
    buku_digital = models.ForeignKey(BukuDigital, null=True, blank=True, on_delete=models.SET_NULL)
    jurnal = models.ForeignKey(Jurnal, null=True, blank=True, on_delete=models.SET_NULL)
    
    tanggal_pinjam = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, default="Dibaca")  # Dibaca / Selesai
    progress_baca = models.IntegerField(default=0)  # 0 - 100%

    def __str__(self):
        item = self.buku_digital or self.jurnal
        return f"{self.user.username} - {item} ({self.status})"

class Bookmark(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    buku_digital = models.ForeignKey(BukuDigital, null=True, blank=True, on_delete=models.CASCADE)
    jurnal = models.ForeignKey(Jurnal, null=True, blank=True, on_delete=models.CASCADE)
    tanggal_disimpan = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        item = self.buku_digital or self.jurnal
        return f"{self.user.username} saved {item}"

class Peminjaman(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    
    buku_digital = models.ForeignKey(BukuDigital, null=True, blank=True, on_delete=models.SET_NULL)
    jurnal = models.ForeignKey(Jurnal, null=True, blank=True, on_delete=models.SET_NULL)
    
    tanggal_pinjam = models.DateTimeField(auto_now_add=True)
    tanggal_kembali = models.DateTimeField(null=True, blank=True)  # <-- TAMBAHKAN BARIS INI
    status = models.CharField(max_length=20, default="Dibaca")
    progress_baca = models.IntegerField(default=0)

    def __str__(self):
        item = self.buku_digital or self.jurnal
        return f"{self.user.username} - {item} ({self.status})"