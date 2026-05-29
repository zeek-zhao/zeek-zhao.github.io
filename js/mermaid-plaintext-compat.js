(function () {
  const DIAGRAM_HEAD_RE = /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|quadrantChart|requirementDiagram|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|sankey-beta|xychart-beta|block-beta)\b/;
  const MAX_WAIT_RETRY = 20;

  function normalizeText(text) {
    return String(text || "")
      .replace(/\u00A0/g, " ")
      .replace(/\r\n/g, "\n")
      .trim();
  }

  function isMermaidDefinition(text) {
    const lines = normalizeText(text)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) return false;

    const first = lines[0].replace(/^%%\{init:.*\}%%\s*/, "").trim();
    return DIAGRAM_HEAD_RE.test(first);
  }

  function convertPlaintextBlocks() {
    const blocks = document.querySelectorAll("#article-container figure.highlight.plaintext");
    let changed = 0;

    blocks.forEach((figure) => {
      if (figure.dataset.mermaidCompatDone === "1") return;
      const codePre = figure.querySelector("td.code > pre");
      if (!codePre) return;

      const lines = Array.from(codePre.querySelectorAll("span.line")).map((line) => line.textContent || "");
      const rawText = lines.length ? lines.join("\n") : codePre.textContent;
      const raw = normalizeText(rawText);
      if (!isMermaidDefinition(raw)) return;

      const pre = document.createElement("pre");
      const code = document.createElement("code");
      code.className = "mermaid";
      code.textContent = raw;
      pre.appendChild(code);

      figure.replaceWith(pre);
      changed += 1;
    });

    return changed;
  }

  function renderMermaid(retry = 0) {
    if (!window.mermaid || typeof window.mermaid.run !== "function") {
      if (retry < MAX_WAIT_RETRY) {
        window.setTimeout(() => renderMermaid(retry + 1), 200);
      }
      return;
    }

    window.mermaid
      .run({ querySelector: "#article-container .mermaid" })
      .catch(() => {
        // Keep rendering resilient even if one diagram fails.
      });
  }

  function runCompat() {
    const changed = convertPlaintextBlocks();
    if (changed > 0) {
      renderMermaid();
    }
  }

  document.addEventListener("DOMContentLoaded", runCompat);
  document.addEventListener("pjax:complete", runCompat);
})();
