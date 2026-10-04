import os
import django

# Setup Django Environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from perpustakaan.models import CustomUser

def generate_users():
    start_nim = 2509106001
    end_nim = 2509106100
    created_count = 0

    print("Memproses pembuatan data dummy user...")

    for nim in range(start_nim, end_nim + 1):
        username = str(nim)
        email = f"{username}@student.ac.id"
        password = username # Password disamakan dengan Username

        if not CustomUser.objects.filter(username=username).exists():
            CustomUser.objects.create_user(
                username=username,
                email=email,
                password=password,
                is_member=True,
                is_admin=False
            )
            created_count += 1

    print(f"✅ Selesai! Berhasil menambahkan {created_count} user dummy ke database.")
    print(f"Contoh Akun -> Username: 2509106001 | Password: 2509106001")

if __name__ == '__main__':
    generate_users()