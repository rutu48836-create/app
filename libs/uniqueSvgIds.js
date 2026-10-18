
export function uniqueSvgIds(xml, uid) {
  if (typeof xml !== 'string') return xml;

  const ids = new Set();
  xml.replace(/\sid="([^"]+)"/g, (_, id) => {
    ids.add(id);
    return '';
  });

  let out = xml;

  ids.forEach((id) => {
    const next = `${uid}-${id}`;
    out = out
      .split(`id="${id}"`).join(`id="${next}"`)
      .split(`url(#${id})`).join(`url(#${next})`)
      .split(`url('#${id}')`).join(`url('#${next}')`)
      .split(`url("#${id}")`).join(`url("#${next}")`)
      .split(`href="#${id}"`).join(`href="#${next}"`);
  });

  return out;
}