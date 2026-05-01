# Phase 1 Discussion Log

**Date:** 2026-05-01
**Phase:** 1 — Temel Altyapı
**Areas discussed:** 4

---

## Tenant Onboarding

**Q:** Yeni üniversite/klinik sisteme nasıl eklenir?
**Options:** Elle oluştur (superadmin) / Kendileri kayıt olur / Davet sistemi
**Selected:** Elle oluştur (superadmin)

**Q:** Superadmin rolü olmalı mı?
**Options:** Evet, superadmin paneli / Hayır, Clerk dashboard yeterli
**Selected:** Evet, superadmin paneli

---

## Giriş Sayfası Yapısı

**Q:** Kullanıcılar nasıl giriş yapar?
**Options:** Tek merkezi login / Tenant-özel subdomain / Tenant kodu girişi
**Selected:** Tenant-özel subdomain (`{tenant}.anamnezal.com`)

**Q:** Login sayfasının görünümü?
**Options:** Clerk hosted UI / Tam custom
**Selected:** Tüm frontend/design kararları impeccable + frontend-design ajanlarına ertelendi

---

## KVKK Baseline Kapsamı

**Q:** Faz 1'de KVKK baseline ne kapsamında?
**Options:** Sadece teknik katman / Teknik + kullanıcı onayı
**Selected:** Sadece teknik katman (RLS, şifreleme, Frankfurt DB)

**Q:** Faz 1'de audit log gerekli mi?
**Options:** Evet / Hayır, sonra
**Selected:** Evet — login audit (kim, ne zaman) Phase 1'de kurulur

---

## Oturum Güvenliği

**Q:** Oturum ne zaman sona ermeli?
**Options:** Sabit süre (timeout) / Manuel çıkış yeterli / Seans bazı oturum
**Selected:** Manuel çıkış yeterli

**Q:** Paylaşımlı PC senaryosu var mı?
**Options:** Evet, hızlı geçiş / Hayır, kişisel cihazlar
**Selected:** Hayır, kişisel cihazlar — timeout gereksiz

---

*Generated: 2026-05-01*
