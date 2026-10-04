from datetime import timedelta
import requests
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, logout, authenticate
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from .models import CustomUser, BukuDigital, Jurnal, Peminjaman, Bookmark
from django.contrib.auth import update_session_auth_hash


# ==========================================
# 1. AUTENTIKASI (LOGIN, REGISTER, LOGOUT)
# ==========================================
def login_view(request):
    if request.user.is_authenticated:
        return redirect('dashboard')

    if request.method == 'POST':
        username_input = request.POST.get('username')
        password_input = request.POST.get('password')
        user = authenticate(request, username=username_input, password=password_input)

        if user is not None:
            login(request, user)
            if user.is_staff or user.is_admin:
                return redirect('/admin/')
            return redirect('dashboard')
        else:
            messages.error(request, "Username/Email atau Password salah!")

    return render(request, 'perpustakaan/login.html')


def register_view(request):
    if request.user.is_authenticated:
        return redirect('dashboard')

    if request.method == 'POST':
        username = request.POST.get('username')
        email = request.POST.get('email')
        password = request.POST.get('password')
        confirm_password = request.POST.get('confirm_password')

        if password != confirm_password:
            messages.error(request, "Konfirmasi password tidak cocok!")
            return render(request, 'perpustakaan/register.html')

        if CustomUser.objects.filter(username=username).exists():
            messages.error(request, "Username/NIM sudah terdaftar!")
            return render(request, 'perpustakaan/register.html')

        user = CustomUser.objects.create_user(
            username=username,
            email=email,
            password=password,
            is_member=True,
            is_admin=False
        )
        login(request, user)
        messages.success(request, "Registrasi berhasil!")
        return redirect('dashboard')

    return render(request, 'perpustakaan/register.html')


def logout_view(request):
    logout(request)
    return redirect('login')


# ==========================================
# 2. DASHBOARD
# ==========================================
@login_required(login_url='login')
def dashboard(request):
    user = request.user
    sedang_dipinjam = Peminjaman.objects.filter(user=user, status='Dibaca').count()
    total_dibaca = Peminjaman.objects.filter(user=user, status='Selesai').count()
    bacaan_terakhir = Peminjaman.objects.filter(user=user, status='Dibaca').last()

    context = {
        'user': user,
        'sedang_dipinjam': sedang_dipinjam,
        'total_dibaca': total_dibaca,
        'bookmarks': Bookmark.objects.filter(user=user).count(),
        'bacaan_terakhir': bacaan_terakhir,
    }
    return render(request, 'perpustakaan/dashboard.html', context)


# ==========================================
# 3. KATALOG & E-JOURNAL
# ==========================================
@login_required(login_url='login')
def katalog_view(request):
    buku_list = BukuDigital.objects.all().order_by('-tahun_terbit')
    return render(request, 'perpustakaan/katalog.html', {'user': request.user, 'buku_list': buku_list})


@login_required(login_url='login')
def ejournal_view(request):
    return render(request, 'perpustakaan/ejournal.html', {'user': request.user})


# ==========================================
# 4. PEMINJAMAN & AKSI KEMBALIKAN
# ==========================================
@login_required(login_url='login')
def peminjaman_view(request):
    daftar_pinjaman = Peminjaman.objects.filter(user=request.user, status='Dibaca').order_by('-tanggal_pinjam')
    
    for pinjaman in daftar_pinjaman:
        pinjaman.jatuh_tempo = pinjaman.tanggal_pinjam + timedelta(days=14)

    context = {
        'user': request.user,
        'daftar_pinjaman': daftar_pinjaman,
        'total_pinjaman': daftar_pinjaman.count(),
    }
    return render(request, 'perpustakaan/peminjaman.html', context)


@login_required(login_url='login')
def kembalikan_buku(request, pinjaman_id):
    pinjaman = get_object_or_404(Peminjaman, id=pinjaman_id, user=request.user)
    
    if pinjaman.status == 'Dibaca':
        pinjaman.status = 'Selesai'
        pinjaman.progress_baca = 100
        pinjaman.save()
        request.user.add_exp(50)
        
    return redirect('peminjaman')


# ==========================================
# 5. BOOKMARKS & API HAPUS BOOKMARK
# ==========================================
@login_required(login_url='login')
def bookmarks_view(request):
    daftar_bookmark = Bookmark.objects.filter(user=request.user).order_by('-tanggal_disimpan')
    context = {
        'user': request.user,
        'bookmarks': daftar_bookmark,
        'total_tersimpan': daftar_bookmark.count(),
    }
    return render(request, 'perpustakaan/bookmarks.html', context)


@login_required(login_url='login')
def hapus_bookmark_api(request, bookmark_id):
    try:
        bookmark = Bookmark.objects.get(id=bookmark_id, user=request.user)
        bookmark.delete()
        return JsonResponse({'status': 'success'})
    except Bookmark.DoesNotExist:
        return JsonResponse({'status': 'error'}, status=404)


# ==========================================
# 6. RIWAYAT PEMINJAMAN
# ==========================================
@login_required(login_url='login')
def riwayat_view(request):
    riwayat_list = Peminjaman.objects.filter(user=request.user).order_by('-tanggal_pinjam')
    
    for item in riwayat_list:
        item.tanggal_kembali = item.tanggal_pinjam + timedelta(days=14)

    context = {
        'user': request.user,
        'riwayat_list': riwayat_list,
        'total_aktivitas': riwayat_list.count(),
    }
    return render(request, 'perpustakaan/riwayat.html', context)

@login_required(login_url='login')
def leaderboard_view(request):
    # Ambil semua member, urutkan berdasarkan EXP terbanyak
    semua_user = CustomUser.objects.filter(is_member=True).order_by('-exp')

    # Pisahkan Top 3 dan sisanya (Rank 4 sampai 10)
    top_3 = semua_user[:3]
    other_users = semua_user[3:10]

    # Cari EXP tertinggi untuk menghitung persentase Progress Bar di list bawah
    max_exp = top_3[0].exp if top_3 else 1 # Hindari pembagian dengan nol

    # Siapkan data untuk Rank 4 ke bawah
    list_users = []
    for index, u in enumerate(other_users, start=4):
        percentage = (u.exp / max_exp) * 100 if max_exp > 0 else 0
        list_users.append({
            'rank': index,
            'user': u,
            'percentage': percentage
        })

    # Susun urutan podium: Kiri (Rank 2), Tengah (Rank 1), Kanan (Rank 3)
    podium = {
        'rank2': top_3[1] if len(top_3) > 1 else None,
        'rank1': top_3[0] if len(top_3) > 0 else None,
        'rank3': top_3[2] if len(top_3) > 2 else None,
    }

    context = {
        'user': request.user,
        'podium': podium,
        'list_users': list_users,
    }
    return render(request, 'perpustakaan/leaderboard.html', context)

@login_required(login_url='login')
def profil_view(request):
    user = request.user
    total_dibaca = Peminjaman.objects.filter(user=user, status='Selesai').count()

    if request.method == 'POST':
        email_baru = request.POST.get('email')
        pass_lama = request.POST.get('password_lama')
        pass_baru = request.POST.get('password_baru')

        # Update Email
        if email_baru and email_baru != user.email:
            user.email = email_baru
            user.save()
            messages.success(request, "Email berhasil diperbarui!")

        # Update Password
        if pass_lama and pass_baru:
            if user.check_password(pass_lama):
                user.set_password(pass_baru)
                user.save()
                update_session_auth_hash(request, user) # Mencegah user ter-logout setelah ganti password
                messages.success(request, "Password berhasil diperbarui!")
            else:
                messages.error(request, "Gagal: Password lama salah!")
                
        return redirect('profil')

    context = {
        'user': user,
        'total_dibaca': total_dibaca,
    }
    return render(request, 'perpustakaan/profil.html', context)