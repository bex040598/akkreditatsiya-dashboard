# Akkreditatsiya dashboard (KAO260075)

Hisobotlarni to‘ldirish holati — new.atmu.uz ko‘rinishidagi **live** dashboard.
Maʼlumot to‘g‘ridan-to‘g‘ri **accreditation.nqaae.uz** portalidan olinadi.

## Qanday ishlaydi

```
Portal (siz kirgan brauzer)  ──►  Tampermonkey skripti (har 10 daqiqada)  ──►  Render server  ──►  Dashboard
      izoh, hujjatlar,              46 dastur + kompleks hisobotni               /api/push           ochiq sahifa o'zi
      qo'shimcha fayllar            portalning o'z JSON'idan o'qiydi                                  yangilanadi
```

Portal OneID bilan kiriladi, shuning uchun server o‘zi portalga kira olmaydi — maʼlumotni
sizning brauzeringizdagi skript (portalga kirgan holda) yig‘ib yuboradi. Portal ochiq bo‘lmagan
paytda dashboard oxirgi yuborilgan holatni ko‘rsatib turadi.

## 1. Render'ga joylash

1. render.com → **New +** → **Web Service** → `bex040598/akkreditatsiya-dashboard`
2. Runtime **Node** · Build `echo ok` · Start `node server.js` · Instance **Free**
3. **Environment**:
   - `PUSH_TOKEN` — maxfiy so‘z (masalan `atmu-2026-maxfiy`)
   - `DEADLINE` — `2026-09-29T23:59:00+05:00`
   - `SEED_URL` — `https://new.atmu.uz/` (portal ulanmaguncha boshlang‘ich maʼlumot)
4. **Create Web Service** → `https://<nom>.onrender.com`

## 2. Portal → dashboard ulash (bir marta)

1. Chrome'ga **Tampermonkey** kengaytmasini o‘rnating (chrome web store).
2. `https://<nom>.onrender.com/akk.user.js` ni oching → **Install**.
3. accreditation.nqaae.uz ga kiring. O‘ng pastda **“Dashboard”** tugmasi chiqadi,
   birinchi marta `PUSH_TOKEN` ni so‘raydi.
4. Tayyor: portal tabi ochiq bo‘lsa, har 10 daqiqada avtomatik yuboradi. Tugmani bossangiz — darhol.
   (Shift + bosish — tokenni o‘zgartirish.)

## Holat qanday hisoblanadi

| Holat | Shart |
|---|---|
| To‘liq | izoh yozilgan **va** barcha asosiy hujjat kataklari to‘ldirilgan |
| Bo‘sh | izoh ham, hujjat ham yo‘q |
| Qisman | qolgan hollar |

## API

`GET /api/version` · `GET /api/data` · `POST /api/push` (`x-token`) · `POST /api/reseed` (`x-token`) · `GET /akk.user.js`

> Render Free: 15 daqiqa foydalanilmasa uxlaydi (birinchi ochilish ~30 s). Qayta ishga tushganda
> xotira tozalanadi — portal tabi ochiq bo‘lsa, 10 daqiqa ichida yana to‘liq maʼlumot keladi.
