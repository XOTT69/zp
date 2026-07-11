export function getRatingZones(calculators, type) {
  return calculators[type]?.ratingZones?.length ? calculators[type].ratingZones : [1, 2, 3, 4, 5];
}

export function clampRatingZone(calculators, zone, type) {
  const zones = getRatingZones(calculators, type);
  const numberZone = Number(zone);
  return zones.includes(numberZone) ? numberZone : zones.at(-1) ?? 1;
}

export function ratingButtonsHtml(calculators, type, activeZone) {
  return getRatingZones(calculators, type)
    .map((zone) => {
      const tone = ratingZoneTone(zone, type);
      const toneLabel = ratingZoneToneLabel(tone);
      return `
        <button
          class="segment rating-zone rating-zone--${tone} ${zone === activeZone ? "is-active" : ""}"
          data-zone="${zone}"
          data-zone-tone="${tone}"
          type="button"
          aria-pressed="${zone === activeZone}"
          aria-label="${zone} зона, ${toneLabel}"
          title="${zone} зона — ${toneLabel}"
        >${zone}</button>
      `;
    })
    .join("");
}

function ratingZoneTone(zone, type) {
  if (type === "level4") return ({ 1: "green", 2: "yellow", 3: "red" })[zone] ?? "red";
  return ({ 1: "green", 2: "lime", 3: "yellow", 4: "pink", 5: "red" })[zone] ?? "red";
}

function ratingZoneToneLabel(tone) {
  return ({
    green: "зелена",
    lime: "салатова",
    yellow: "жовта",
    pink: "рожева",
    red: "червона"
  })[tone] ?? "зона рейтингу";
}
