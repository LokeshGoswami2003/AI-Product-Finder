export function parseAnswerBlocks(content) {
  const blocks = [];
  let paragraph = [];
  let bullets = [];
  let tableRows = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }
  };
  const flushBullets = () => {
    if (bullets.length > 0) {
      blocks.push({ type: "list", items: bullets });
      bullets = [];
    }
  };
  const flushTable = () => {
    if (tableRows.length > 0) {
      const [head, ...body] = tableRows;
      blocks.push({ type: "table", head, body });
      tableRows = [];
    }
  };

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushBullets();
      flushTable();
      continue;
    }

    if (line.startsWith("|") && line.endsWith("|")) {
      flushParagraph();
      flushBullets();
      const cells = line
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim());
      // The dashed separator row carries no content.
      if (!cells.every((cell) => /^:?-{2,}:?$/.test(cell))) {
        tableRows.push(cells);
      }
      continue;
    }
    flushTable();

    const heading = line.match(/^#{1,3}\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushBullets();
      blocks.push({ type: "heading", text: heading[1] });
      continue;
    }

    const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      bullets.push(bullet[1]);
      continue;
    }

    flushBullets();
    paragraph.push(line);
  }

  flushParagraph();
  flushBullets();
  flushTable();
  return blocks;
}

export function presentAnswerHeading(text) {
  return /^next step$/i.test(text.trim()) ? "Keep exploring" : text;
}
