import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createJiti } from "jiti";

// Features whose code survived an upstream merge while the wiring that made
// them reachable did not. Each check fails if the wiring is dropped again.
const jiti = createJiti(import.meta.url, { jsx: { runtime: "automatic" }, tsconfigPaths: true });
const React = await jiti.import("react");
const { renderToStaticMarkup } = await jiti.import("react-dom/server");
const { ModelScopeWarningBanner } = await jiti.import("./ChatInput.tsx");
const { I18nProvider } = await jiti.import("@/hooks/useI18n");
const read = (file) => readFile(new URL(file, import.meta.url), "utf8");

test("model scope warnings can be dismissed and link to provider setup (#48)", async () => {
  const html = renderToStaticMarkup(React.createElement(I18nProvider, null,
    React.createElement(ModelScopeWarningBanner, {
      warnings: [{ code: "unauthenticated-provider", pattern: "acme/*", message: "", unauthenticatedProviders: ["acme"] }],
      onDismiss() {},
      dismissLabel: "Dismiss",
      onOpenModelsConfig() {},
    })));
  assert.match(html, /aria-label="Dismiss"/);
  assert.match(html, /Configure providers/);

  const chatInput = await read("./ChatInput.tsx");
  assert.match(chatInput, /<ModelScopeWarningBanner\s+warnings=\{modelScopeWarnings\}\s+onDismiss=\{onDismissModelScopeWarnings\}\s+dismissLabel=\{t\("chat\.modelScopeDismiss"\)\}\s+onOpenModelsConfig=\{onOpenModelsConfig\}/);
  const hook = await read("../hooks/useAgentSession.ts");
  assert.match(hook, /modelScopeWarnings: visibleModelScopeWarnings,/, "dismissed warnings must be filtered out");
});

test("patch diffs in chat follow the diff display setting", async () => {
  const messageView = await read("./MessageView.tsx");
  const splitPatch = messageView.slice(messageView.indexOf("function SplitPatchView("), messageView.indexOf("function SplitFilesView("));
  assert.match(splitPatch, /const \{ mode \} = useDiffViewMode\(\);/);
  assert.match(splitPatch, /<SplitFilesView files=\{files\} mode=\{mode\} \/>/);
});

test("the file panel's actions menu copies the active file's path and contents", async () => {
  const appShell = await read("./AppShell.tsx");
  const strip = appShell.slice(appShell.indexOf('<div className="right-panel-tab-strip">'));
  assert.match(strip, /className="file-actions-menu-anchor" ref=\{fileActionsMenuRef\}/);
  assert.match(strip, /\["path", "contextPanel\.copyPath", copyActiveFilePath\]/);
  assert.match(strip, /\["contents", "contextPanel\.copyContents", copyActiveFileContent\]/);
  // copyText() covers the Tauri clipboard; navigator.clipboard alone does not.
  const copyFns = appShell.slice(appShell.indexOf("const copyActiveFilePath"), appShell.indexOf("const activeCwdName"));
  assert.doesNotMatch(copyFns, /navigator\.clipboard/);
  assert.equal((copyFns.match(/await copyText\(/g) ?? []).length, 2);
});
