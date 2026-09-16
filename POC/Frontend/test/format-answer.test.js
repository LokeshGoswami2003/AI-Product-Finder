import assert from "node:assert/strict";
import test from "node:test";

import {
  parseAnswerBlocks,
  presentAnswerHeading,
} from "../src/lib/format-answer.js";

test("assistant answer formatting preserves headings, bullets, and paragraphs", () => {
  const blocks = parseAnswerBlocks(
    "AdapT 100 is the strongest match.\n\n### Why it fits\n- Selective H2S removal\n- Low energy requirements\n\n### Next step\nConfirm the feed gas composition.",
  );

  assert.deepEqual(blocks, [
    { type: "paragraph", text: "AdapT 100 is the strongest match." },
    { type: "heading", text: "Why it fits" },
    {
      type: "list",
      items: ["Selective H2S removal", "Low energy requirements"],
    },
    { type: "heading", text: "Next step" },
    { type: "paragraph", text: "Confirm the feed gas composition." },
  ]);
});

test("next-step headings use a friendlier conversational label", () => {
  assert.equal(presentAnswerHeading("Next step"), "Keep exploring");
  assert.equal(presentAnswerHeading("NEXT STEP"), "Keep exploring");
  assert.equal(presentAnswerHeading("Why it fits"), "Why it fits");
});

test("technical comparison tables parse into head and body rows", () => {
  const blocks = parseAnswerBlocks(
    "### Put them side by side\n| Property | Test method |\n| --- | --- |\n| Notched Izod impact | ASTM D256 |\n| Heat deflection temperature | ASTM D648 |\n\nConfirm the values in each TDS.",
  );

  assert.deepEqual(blocks, [
    { type: "heading", text: "Put them side by side" },
    {
      type: "table",
      head: ["Property", "Test method"],
      body: [
        ["Notched Izod impact", "ASTM D256"],
        ["Heat deflection temperature", "ASTM D648"],
      ],
    },
    { type: "paragraph", text: "Confirm the values in each TDS." },
  ]);
});
