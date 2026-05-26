# lazynet

Terminal UI for managing C# .NET solutions — inspired by lazygit, built with pure Node.js.

```
 ◈ lazynet                                                        ⌂ ~/Projects/MyApp
╭──────  Solution Explorer  ──────╮│╭──────  Output  ───────────────────────────────────╮
│ ◈ MyApp.sln                     ││  Welcome to lazynet!                               │
│   ▾ ⬡ MyApp.Api                 ││  Opened solution: MyApp.sln                        │
│   │   net8.0  WebApplication    ││    3 project(s) found                              │
│   │   ▸ Packages (3)            ││    • MyApp.Api     [net8.0]                        │
│   │   ▾ References (1)          ││    • MyApp.Core    [net8.0]                        │
│   │ │   ⊸ MyApp.Core            ││    • MyApp.Tests   [net8.0]                        │
│   ▸ ⬡ MyApp.Core                ││                                                    │
│   ▸ ⬡ MyApp.Tests               ││  ✔ Build done                                      │
╰─────────────────────────────────╯│╰────────────────────────────────────────────────────╯
█ NORMAL ▐ Debug │ MyApp.sln          ✔ Opened: MyApp.sln           ▌ ? help  :cmd  n NuGet
```

## Features

- **Zero npm dependencies** — pure Node.js, no bloat
- **Vim-style modal keybindings** — Normal / Command / NuGet modes
- **Solution Explorer** — full tree with indent guides, expand/collapse
- **Build system** — build, rebuild, clean, run, test, publish, restore
- **NuGet manager** — search nuget.org, version picker, install, remove
- **Project references** — view and manage with visual tree
- **Tokyo Night theme** — modern dark color palette
- **Powerline status bar** — mode pill, config, solution name
- **.NET 5–10 support** — SDK-style `.csproj` projects
- **JSON config** — persists recent solutions and build config

## Installation

```bash
git clone <repo> lazynet
cd lazynet
make install
```

After install the source directory can be safely deleted — files are copied to
`~/.local/share/lazynet/` and the binary is linked at `/usr/local/bin/lazynet`.

**Requirements:**
- Node.js 16+
- .NET SDK 5.0+ (for build/run features)
- Linux or macOS

### Other install options

```bash
make install      # copy to ~/.local/share/lazynet + /usr/local/bin/lazynet
make update       # re-build from source into the installed location
make uninstall    # remove binary + installed files
make link         # npm link  (symlink-based, stays tied to source dir)
```

## Usage

```bash
lazynet                    # auto-detect .sln in current directory
lazynet MySolution.sln     # open a specific solution
lazynet /path/to/project   # search directory for .sln files
```

## Keybindings

### Navigation

| Key | Action |
|-----|--------|
| `h j k l` / arrow keys | Move cursor |
| `Enter` / `l` | Expand / collapse tree node |
| `h` / `←` | Collapse / go to parent |
| `Tab` / `Shift+Tab` | Switch panel (Tree ↔ Output) |
| `g g` | Go to top |
| `G` | Go to bottom |
| `Ctrl+U` / `Ctrl+D` | Page up / down |

### Build & Run

| Key | Action |
|-----|--------|
| `b` | Build selected project |
| `B` | Build entire solution |
| `R` | Rebuild (no-incremental) |
| `c` | Clean |
| `r` | Run project |
| `t` | Test (xUnit / NUnit / MSTest) |
| `p` | Publish (Release config) |
| `e` | Restore packages |
| `Ctrl+K` | Kill running process |
| `C` | Toggle Debug / Release |

### NuGet Package Manager

| Key | Action |
|-----|--------|
| `n` | Open NuGet popup for selected project |
| type | Search packages (live, debounced) |
| `↑ ↓` | Navigate results |
| `Enter` | Open version picker |
| `Enter` on version | Install package |
| `d d` | Remove selected package (in tree) |
| `Escape` | Close / go back |

### References

| Key | Action |
|-----|--------|
| `A` | Add project reference |
| `D` | Remove selected project reference |

### Commands (`:` mode)

| Command | Action |
|---------|--------|
| `:open <path>` | Open a `.sln` file |
| `:find [dir]` | Find `.sln` files in directory |
| `:cd <path>` | Change working directory |
| `:clear` | Clear output panel |
| `:config Debug\|Release` | Set build configuration |
| `:q` / `:quit` | Quit |

### Global

| Key | Action |
|-----|--------|
| `?` | Toggle help overlay |
| `Escape` | Close overlay / cancel |
| `q` | Quit |
| `Ctrl+C` / `Ctrl+Q` | Force quit |

## NuGet Popup

The NuGet manager mirrors Visual Studio's Package Manager UI:

1. Press `n` on a project node
2. Type a package name → live search from nuget.org
3. `↑↓` to select a package
4. `Enter` to open version picker (newest stable first)
5. `↑↓` to pick version → `Enter` to install

Packages are installed via `dotnet add package` — the `.csproj` is updated
automatically and the tree refreshes.

## Config

Config is stored at `~/.config/lazynet/config.json`:

```json
{
  "recentSolutions": [
    { "path": "/home/user/MyApp/MyApp.sln", "name": "MyApp.sln", "lastOpened": "..." }
  ],
  "buildConfig": "Debug",
  "outputLines": 2000
}
```

## Architecture

```
index.js              Entry point, layout engine, app loop
src/
  core/
    ansi.js           ANSI escape engine
    screen.js         Screen renderer + Tokyo Night theme
    input.js          Raw keyboard + mouse parser
    solution.js       .sln / .csproj parser & editor
    runner.js         dotnet CLI wrapper (spawn)
    nuget.js          NuGet API client (nuget.org v3)
    config.js         JSON config persistence
  state.js            Central application state
  keybindings.js      Vim modal keybinding engine
  ui/
    tree.js           Solution Explorer renderer (indent guides)
    output.js         Output panel renderer
    nuget.js          NuGet popup renderer
    statusbar.js      Header bar, status bar, help overlay
```

## License

MIT
