import { Fragment } from "react";

function emphasis(text: string) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, index) => {
    if (part.startsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    return part;
  });
}

export function LegalMarkdown({ content }: { content: string }) {
  return content.trim().split(/\n[ \t]*\n/).map((block, index) => {
    if (block.startsWith("### ")) {
      return <h3 key={index}>{emphasis(block.slice(4))}</h3>;
    }
    if (block.startsWith("- ")) {
      return (
        <ul key={index}>
          {block.split("\n").map(line => <li key={line}>{emphasis(line.slice(2))}</li>)}
        </ul>
      );
    }
    return (
      <p key={index}>
        {block.split(/ {2}\n/).map((line, lineIndex) => (
          <Fragment key={lineIndex}>
            {lineIndex > 0 && <br />}
            {emphasis(line)}
          </Fragment>
        ))}
      </p>
    );
  });
}
