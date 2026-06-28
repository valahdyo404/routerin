# routerin

Route your CLI coding tools through [AgentRouter](https://agentrouter.org) in one command. Zero dependencies. Works on Node ≥18 and Bun.

Supports **Claude Code**, **opencode**, **Codex**, and **pi**.

## Use it

1. Get your API key (`sk-...`) from the [AgentRouter](https://agentrouter.org) dashboard.

2. Run:

```bash
npx routerin
```

3. Answer the prompts:
   - **paste your key** — skipped if a key is already saved (re-run never asks again)
   - **pick a model** — type a number, or just paste any model id (e.g. `glm-5.2`, `gpt-5.5`)
   - **pick your tools**

4. Start your tool — it now runs through AgentRouter:

```bash
claude        # Claude Code
opencode
codex
pi
```

## Install once, run anywhere

So you can type `routerin` from any folder:

```bash
# Option A — global (needs Node)
npm install -g .

# Option B — standalone binary (needs Bun, no Node required)
npm run build
mv routerin /usr/local/bin/      # now `routerin` works everywhere
```

## Other commands

```bash
routerin test            # check the connection works
routerin status          # show your current config
routerin restore         # undo everything — revert all tool configs to before routerin
routerin run -- <cmd>    # launch any other tool through AgentRouter
```

`restore` puts every tool's config back exactly as it was (from the backup routerin made), deletes files routerin created, and clears your saved key.

Non-interactive:

```bash
routerin setup --yes --key sk-... --model glm-5.2 --targets claude,opencode,codex,pi
```

## Models

`claude-opus-4-8` · `claude-opus-4-7` · `claude-opus-4-6` · `glm-5.2` — or paste any id AgentRouter offers.

## OS support

Works on **macOS, Linux, and Windows** (pure Node/Bun, no shell scripts). On Windows, configs go under your user profile (`%USERPROFILE%\.claude`, `.codex`, etc.). `routerin run` works on all three.

## Notes

- Requests pass through AgentRouter's gateway (non-profit, infra in Singapore, no SLA).
- Your key is stored locally at `~/.routerin/config.json`. Each tool's config is backed up (`*.routerin.bak`) before editing — `routerin restore` uses it.

## License

MIT
