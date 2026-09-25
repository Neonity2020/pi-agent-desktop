import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./SessionSidebar.tsx", import.meta.url), "utf8");
const searchSource = await readFile(new URL("./SessionSearch.tsx", import.meta.url), "utf8");
const routeSource = await readFile(new URL("../app/api/sessions/search/route.ts", import.meta.url), "utf8");

// The full-text session search was fully implemented upstream (component + API
// route) but the fork's rewritten sidebar never mounted it, so the feature sat
// unreachable: the search box only filtered project-tree titles. These pins keep
// the wiring attached — a merge that drops the import or the wrapper brings back
// a search box that silently searches nothing.
test("the sidebar mounts the content-search wrapper around the project tree", () => {
  assert.match(source, /import \{ SessionSearch \} from "\.\/SessionSearch"/);
  assert.match(source, /<SessionSearch\s+open=\{contentSearch\}/);
  assert.match(source, /query=\{sessionQuery\}/);
  assert.match(source, /onSelectSession=\{handleSelectSessionFromList\}/);
  // The tree must stay the wrapper's child, not a sibling the results replace.
  assert.match(source, /<SessionSearch[\s\S]{0,400}?<div className="sidebar-project-tree" onScroll=\{handleListScroll\}>/);
});

test("the search row toggles between the title filter and content search", () => {
  assert.match(source, /const \[contentSearch, setContentSearch\] = useState\(false\)/);
  assert.match(source, /className=\{`sidebar-search-mode\$\{contentSearch \? " is-active" : ""\}`\}/);
  assert.match(source, /aria-pressed=\{contentSearch\}/);
  assert.match(source, /t\("sidebar\.toggleSessionSearch"\)/);
});

test("selecting a result carries the entry id so the chat can jump to the match", () => {
  // SessionSearch hands (session, entryId, blockIndex) to the sidebar, which
  // forwards them to AppShell.handleSelectSession -> setSearchTarget.
  assert.match(searchSource, /onSelectSession\(session, entryId, blockIndex\)/);
  assert.match(source, /onSelectSession\(s, false, entryId, blockIndex\)/);
  assert.match(routeSource, /searchSessionContents\(sessions, query, request\.signal\)/);
});
