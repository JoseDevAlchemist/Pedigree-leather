import { Fragment } from "react";

function emphasis(text: string) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, index) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (/^\*[^*]+\*$/.test(part)) return <em key={index}>{part.slice(1, -1)}</em>;
    return part;
  });
}

export function LegalMarkdown({ content }: { content: string }) {
  if (!content.trim()) return null;
  return content.replace(/\r\n/g, "\n").trim().split(/\n[ \t]*\n/).map((block, index) => {
    if (block === "---") return <hr key={index} className="border-border" />;
    const heading = /^(#{1,6}) ([^\n]+)(?:\n([\s\S]*))?$/.exec(block);
    if (heading) {
      const Heading = heading[1].length <= 2 ? "h2" : heading[1].length === 3 ? "h3" : "h4";
      return (
        <Fragment key={index}>
          <Heading>{emphasis(heading[2])}</Heading>
          {heading[3] && <LegalMarkdown content={heading[3]} />}
        </Fragment>
      );
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
