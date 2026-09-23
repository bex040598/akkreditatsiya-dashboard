# Akkreditatsiya dashboard (KAO260075)

Hisobotlarni to‘ldirish holati — new.atmu.uz ko‘rinishidagi live dashboard.

- **Umumiy ko‘rinish**, **Dasturlar** (kartochkalar), **Kompleks hisobot**, **Takroriy bo‘shliqlar**
- Har bir dastur: tayyorlik halqasi, hujjat/izoh/qo‘shimcha fayllar KPI, ogohlantirishlar, boblar, indikatorlar xaritasi, “Nima qilish kerak” jadvali
- **Live**: server maʼlumotni har 5 daqiqada yangilaydi, ochiq sahifa yangi maʼlumot kelganda o‘zi qayta yuklanadi

## Render'ga joylash

1. render.com → **New +** → **Web Service** → GitHub'dan `bex040598/akkreditatsiya-dashboard` ni tanlang
2. Sozlamalar:
   - Runtime: **Node**
   - Build Command: `echo ok`
   - Start Command: `node server.js`
   - Instance: **Free**
3. **Environment** bo‘limida:
   - `PUSH_TOKEN` — o‘zingiz o‘ylab topgan maxfiy so‘z (masalan `atmu-2026-xyz`)
   - `SEED_URL` — `https://new.atmu.uz/` (maʼlumot manbai)
   - `DEADLINE` — `2026-09-28T23:59:00+05:00`
4. **Create Web Service** → bir-ikki daqiqada `https://akkreditatsiya-dashboard.onrender.com` tayyor bo‘ladi.

(Yoki **New + → Blueprint** orqali repo'dagi `render.yaml` ni avtomatik ishlatish mumkin.)

## Maʼlumot qayerdan keladi

| Manba | Qanday |
|---|---|
| `SEED_URL` (new.atmu.uz) | Server har 5 daqiqada o‘qiydi, o‘zgargan bo‘lsa yangilaydi |
| `POST /api/push` | Portal (accreditation.nqaae.uz) dan to‘g‘ridan-to‘g‘ri yuborish, `x-token: PUSH_TOKEN` sarlavhasi bilan |

API: `GET /api/version` — oxirgi yangilanish vaqti, `GET /api/data` — to‘liq maʼlumot, `POST /api/reseed` — manbadan darhol qayta o‘qish (token bilan).

> Render Free rejimida servis 15 daqiqa foydalanilmasa uxlaydi va birinchi ochilishda ~30 soniya kutadi — bu normal.
