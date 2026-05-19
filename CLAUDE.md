# PC Control — Claude Code Setup (Windows)

This repository configures Claude Code to manage your Windows PC on command.
Claude can install/uninstall software, clear the desktop, and perform other
system tasks. All destructive actions ask for confirmation before proceeding.

## What Claude can do

| Command (say it naturally)                      | What happens                                          |
|-------------------------------------------------|-------------------------------------------------------|
| "Clear my desktop"                              | Moves all desktop files to `Desktop\Archive` folder  |
| "Hide desktop icons"                            | Toggles desktop icon visibility off                  |
| "Install \<app\>"                               | Runs `winget install` for the named app               |
| "Uninstall \<app\>"                             | Runs `winget uninstall` for the named app             |
| "List installed software"                       | Shows all apps via winget                             |
| "Open \<app\>"                                  | Launches an application by name                       |
| "Show system info"                              | CPU, RAM, disk, OS version                           |
| "Kill process \<name\>"                         | Terminates a running process                          |
| "Empty recycle bin"                             | Clears the Recycle Bin                                |
| "Restart" / "Shut down" / "Sleep"               | Power actions (always asks to confirm)                |

## Safety rules Claude follows

- Always confirm before uninstalling software or deleting files permanently.
- Never force-kill system-critical processes (lsass, csrss, winlogon, etc.).
- Power actions (restart/shutdown) require explicit confirmation in the same turn.
- Destructive operations are logged to `logs\pc-control.log`.

## Scripts

All scripts live in `scripts\`. Run them directly or let Claude call them.

| Script                    | Purpose                                      |
|---------------------------|----------------------------------------------|
| `clear-desktop.ps1`       | Archive or hide desktop contents             |
| `install-software.ps1`    | Install a package via winget                 |
| `uninstall-software.ps1`  | Uninstall a package via winget               |
| `list-software.ps1`       | List installed software                      |
| `open-app.ps1`            | Open an application                          |
| `system-info.ps1`         | Show system information                      |
| `kill-process.ps1`        | Terminate a process by name                  |
| `power-action.ps1`        | Restart, shut down, or sleep                 |

## Setup (first time on a new Windows PC)

1. Install [Claude Code CLI](https://claude.ai/code) on your Windows PC.
2. Install winget if not present (ships with Windows 10 1809+ / Windows 11).
3. Clone this repository: `git clone https://github.com/chillipops/hello-world`
4. Open the cloned folder in Claude Code: `claude .`
5. Start talking — Claude now has full PC control.

## Permissions

Configured in `.claude\settings.json`. The allow-list covers the PowerShell,
winget, and system commands Claude needs. Expand it there if you want Claude to
run additional commands automatically without prompting.
