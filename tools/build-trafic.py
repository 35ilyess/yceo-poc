#!/usr/bin/env python3
"""
Recupere les infos trafic Ycéo depuis le site officiel -> assets/trafic.json
Usage: python3 -I tools/build-trafic.py <dossier_sortie_assets>

Les perturbations sont regroupees par ligne dans des modales (badge data-modal -> id modale).
On associe chaque perturbation a ses lignes et on liste les lignes globalement concernees.
"""
import html, json, re, ssl, sys, urllib.request
from collections import OrderedDict
from datetime import datetime

URL = "https://www.yceo-mobilite.fr/mon-trajet-en-bus/infos-trafic/"
OUT = sys.argv[1] if len(sys.argv) > 1 else "src/assets"

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
page = urllib.request.urlopen(req, context=ctx, timeout=30).read().decode("utf-8", "replace")

strip = lambda s: html.unescape(re.sub(r"<[^>]+>", " ", s))
clean = lambda s: re.sub(r"\s+", " ", strip(s)).strip()


def parse_items(blob):
    out = []
    for chunk in re.split(r"yit-perturbation-item", blob)[1:]:
        mt = re.search(r"yit-item-title[^>]*>(.*?)</h3>", chunk, re.S)
        if not mt:
            continue
        times = re.findall(r'datetime="([^"]+)"', chunk)
        md = re.search(r"yit-modal-date[^>]*>(.*?)</p>", chunk, re.S)
        mb = re.search(r"yit-modal-body[^>]*>(.*?)(?:</div>\s*</div>|yit-perturbation-item)", chunk, re.S)
        out.append(
            {
                "title": clean(mt.group(1)),
                "period": clean(md.group(1)) if md else "",
                "start": times[0] if len(times) > 0 else None,
                "end": times[1] if len(times) > 1 else None,
                "body": clean(mb.group(1))[:400] if mb else "",
            }
        )
    return out


# badge -> (id modale, nom de ligne)
badges = re.findall(
    r'data-modal="(yit-1-modal-[^"]+)"[^>]*aria-label="Ligne\s+([^:"]+?)\s*:',
    page,
)
affected = list(OrderedDict((name.strip(), None) for _, name in badges).keys())

# perturbations dedupliquees par titre, avec leurs lignes
perts = OrderedDict()
for modal_id, line in badges:
    m = re.search(re.escape('id="' + modal_id + '"') + r"(.*?)(?=id=\"yit-1-modal-|</body>)", page, re.S)
    if not m:
        continue
    for it in parse_items(m.group(1)):
        key = it["title"]
        if key not in perts:
            perts[key] = {**it, "lines": []}
        if line.strip() not in perts[key]["lines"]:
            perts[key]["lines"].append(line.strip())

alerts = list(perts.values())
# repli : si le decoupage par modale n'a rien donne, on prend la liste a plat
if not alerts:
    alerts = [{**it, "lines": []} for it in parse_items(page)]

json.dump(
    {
        "source": URL,
        "fetchedAt": datetime.now().isoformat(timespec="minutes"),
        "affectedLines": affected,
        "alerts": alerts,
    },
    open(f"{OUT}/trafic.json", "w"),
    ensure_ascii=False,
    separators=(",", ":"),
)
print(f"trafic.json: {len(alerts)} perturbations | lignes concernees: {affected}")
