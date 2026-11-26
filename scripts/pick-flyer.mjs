function text(value) {
  return String(value || '').trim();
}

function withoutExtension(value) {
  return text(value).replace(/\.[^/.]+$/, '').toLowerCase();
}

function sameFile(left, right) {
  const a = text(left);
  const b = text(right);
  return !!a && !!b && (a === b || withoutExtension(a) === withoutExtension(b));
}

export function pickFlyer(festival, edition, editions = [], resolveImagePath = (value) => text(value)) {
  const editionFlyer = text(edition?.FLYER);
  if (editionFlyer) {
    const resolved = text(resolveImagePath(editionFlyer));
    if (resolved) return { src: resolved, edition: edition?.EDITION || '' };
  }
  const brandFlyer = text(festival?.flyer);
  if (!brandFlyer) return { src: '', edition: '' };
  const resolvedBrand = text(resolveImagePath(brandFlyer));
  const ownedByOtherEdition = (editions || []).some((other) => {
    if (other === edition) return false;
    if (edition?.EDITION_ID && other?.EDITION_ID && other.EDITION_ID === edition.EDITION_ID) return false;
    const otherFlyer = text(other?.FLYER);
    if (!otherFlyer) return false;
    const resolvedOther = text(resolveImagePath(otherFlyer));
    return [brandFlyer, resolvedBrand].some((candidate) => sameFile(candidate, otherFlyer) || sameFile(candidate, resolvedOther));
  });
  return ownedByOtherEdition ? { src: '', edition: '' } : { src: brandFlyer, edition: '' };
}
