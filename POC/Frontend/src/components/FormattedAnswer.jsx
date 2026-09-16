import { parseAnswerBlocks, presentAnswerHeading } from "../lib/format-answer";

function renderInlineText(text) {
  return text
    .split(/(\*\*[^*]+\*\*)/)
    .map((part, index) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>
      ) : (
        part
      ),
    );
}

export function FormattedAnswer({ content }) {
  const blocks = parseAnswerBlocks(content);

  return (
    <div className="message-content message-content--formatted">
      {blocks.map((block, index) => {
        const followsNextStep =
          index > 0 &&
          blocks[index - 1].type === "heading" &&
          /^next step$/i.test(blocks[index - 1].text.trim());

        if (block.type === "heading") {
          const isNextStep = /^next step$/i.test(block.text.trim());
          return (
            <h3
              className={isNextStep ? "follow-up-heading" : undefined}
              key={`${block.type}-${index}`}
            >
              {renderInlineText(presentAnswerHeading(block.text))}
            </h3>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={`${block.type}-${index}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>{renderInlineText(item)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p
            className={followsNextStep ? "follow-up-prompt" : undefined}
            key={`${block.type}-${index}`}
          >
            {renderInlineText(block.text)}
          </p>
        );
      })}
    </div>
  );
}
