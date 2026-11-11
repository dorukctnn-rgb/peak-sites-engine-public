#!/usr/bin/env bash
# Herkese acik depoda GitHub Actions gunlugu herkese aciktir. Isletme adi (slug), adres, e-posta gunluge dusmesin diye:
#   bash hat/sessiz.sh <etiket> <komut> [arg...]
# Komutun TUM ciktisi calisma/log/<etiket>.txt dosyasina gider (is akisi bunu ozel veri deposuna kopyalar);
# gunluge yalniz ozet satirlari basilir (hat/sessiz-ozet.mjs: JSON sayaclari temizlenir, metin dizileri adede doner,
# slug/adres/e-posta benzeri deger "?" olur; test sayilari) ve cikis kodu.  Cikis kodu komutunkiyle ayni doner.
set -u
etiket="${1:?etiket gerekli}"; shift
mkdir -p calisma/log
dosya="calisma/log/${etiket}.txt"
"$@" > "$dosya" 2>&1 < /dev/null
kod=$?
node hat/sessiz-ozet.mjs "$dosya" || true
echo "[${etiket}] cikis kodu: ${kod} (ayrinti ozel veri deposunda: durum/log/)"
exit "$kod"
