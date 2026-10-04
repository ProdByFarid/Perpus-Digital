from django.contrib import admin
from .models import CustomUser, BukuDigital, Jurnal, Peminjaman

admin.site.register(CustomUser)
admin.site.register(BukuDigital)
admin.site.register(Jurnal)
admin.site.register(Peminjaman)