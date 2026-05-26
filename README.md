# dotnet-tui

Terminal UI for managing C# .NET projects — built with zero npm dependencies, pure Node.js.

```
╭── Solution Explorer ─────╮ ╭── Output ────────────────────────────────────────────╮
│ ◈ MyApp.sln              │ │                                                      │
│  ▾ ⬡ MyApp.Api           │ │ ▶ dotnet build MyApp.Api/MyApp.Api.csproj -c Debug  │
│    net8.0  WebApplication│ │ ────────────────────────────────────────────────────  │
│    ▸ Packages (3)        │ │ Build succeeded.                                     │
│    ▾ References (1)      │ │  0 Error(s)                                          │
│      ⊸ MyApp.Core        │ │  0 Warning(s)                                        │
│  ▸ ⬡ MyApp.Core          │ │                                                      │
│  ▸ ⬡ MyApp.Tests         │ │ ✔ Build done                                         │
╰──────────────────────────╯ ╰──────────────────────────────────────────────────────╯
 NORMAL   Debug   MyApp.sln                                  ? help  :cmd  n NuGet
```

## Features

- **Zero npm dependencies** — only Node.js built-ins
- **Vim-style modal keybindings** — Normal / Command / NuGet modes
- **Solution Explorer** — full tree with expand/collapse
- **Build system** — build, rebuild, clean, run, test, publish, restore
- **NuGet manager** — search, version picker, install, remove (Visual Studio-style)
- **Project references** — view and manage with visual tree
- **.NET 5–10 support** — SDK-style projects
- **JSON config** — persists recent solutions, build config

## Installation

```bash
git clone <repo> dotnet-tui
cd dotnet-tui
chmod +x install.sh
./install.sh
```

**Requirements:**
- Node.js 16+
- .NET SDK 5.0+ (for build/run features)
- Linux, macOS (any terminal emulator)

## Usage

```bash
dotnet-tui                    # auto-detect .sln in current directory
dotnet-tui MySolution.sln     # open specific solution
dotnet-tui /path/to/project   # search directory for .sln
```

## Keybindings

### Navigation (Normal mode)

| Key | Action |
|-----|--------|
| `h j k l` / arrow keys | Move cursor |
| `Enter` / `l` | Expand/collapse tree node |
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
4. `Enter` to open version picker (newest stable versions first)
5. `↑↓` to select version, `Enter` to install

Packages are installed via `dotnet add package` — the project file is
automatically updated and the tree refreshes.

## Config

Config is stored at `~/.config/dotnet-tui/config.json`:

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
    ansi.js           ANSI escape engine (blessed replacement)
    screen.js         Screen renderer + theme
    input.js          Raw keyboard + mouse parser
    solution.js       .sln/.csproj parser & editor
    runner.js         dotnet CLI wrapper (spawn)
    nuget.js          NuGet API client (https, no deps)
    config.js         JSON config persistence
  state.js            Central application state
  keybindings.js      Vim modal keybinding engine
  ui/
    tree.js           Solution Explorer renderer
    output.js         Output panel renderer
    nuget.js          NuGet popup renderer
    statusbar.js      Status bar + help overlay
```
