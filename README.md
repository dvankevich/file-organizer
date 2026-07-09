# File Organizer CLI

An asynchronous, event-driven Node.js command-line tool designed to rescue your directories (like that chaotic `Downloads` folder) from absolute madness. It scans for deep metadata statistics, discovers binary duplicates using stream-based SHA-256 hashing, auto-categorizes files into neat folders, and safely cleans up expired data with a protective Dry Run validation stage.

## 🚀 Key Features

* **Recursive Metadata Scanner:** Deep-scans directories to compile strict metrics on file counts, total sizing, and age distribution profiles.
* **Stream-Driven Duplicate Finder:** Uses cryptographic SHA-256 hashes via Node.js chunks/streams to accurately catch content duplicates without overloading RAM on files $\ge$ 10 MB.
* **Smart Categorizer:** Copies and sorts files by target structures (`Documents`, `Images`, `Archives`, `Code`, `Videos`, `Other`) with automatic filename conflict resolution (e.g., `file(1).pdf`).
* **Safe Expiration Purge:** Targets and removes files older than a user-defined threshold, boasting an interactive confirmation flag and a visual dry-run verification screen.

---

## 🏗️ Architectural Core

The app separates business logic from terminal rendering. Every heavy processing engine is built as an isolated class extending Node's native `EventEmitter`. 

The core modules emit state transitions (`scan-start`, `file-processed`, `copy-error`, etc.), allowing the CLI orchestration handlers to paint smooth, non-flickering ASCII progress bars using `readline` streams without polluting the computational functions.

---

## 📦 Project Directory Structure

```text
file-organizer/
├── file-organizer.js    # Global CLI Router/Entrypoint (Commander setup)
├── package.json         # Package configuration ("type": "module" required)
└── lib/
    ├── utils.js         # Shared mathematical utilities & progress bar drawings
    ├── scanner.js       # Processing engine & view handlers for 'scan'
    ├── duplicates.js    # Processing engine & view handlers for 'duplicates'
    ├── organizer.js     # Processing engine & view handlers for 'organize'
    └── cleanup.js       # Processing engine & view handlers for 'cleanup'

```

---

## 🛠️ Installation & Setup

1. **Clone the Repository:**
Clone the project from GitHub and navigate into the project directory:
```bash
git clone [https://github.com/dvankevich/file-organizer.git](https://github.com/dvankevich/file-organizer.git)
cd file-organizer

```


2. **Install Dependencies:**
This project relies on `commander` for robust CLI argument parsing. Install the required packages via npm:
```bash
npm install

```


3. **Node.js Requirement:**
Ensure you are running **Node.js v18.17+ or v20+** for native asynchronous recursive directory parsing.

---

## 💻 Usage & Commands

You can run this application directly using **Node.js** or via **NPM scripts**.

> ⚠️ **NPM Note:** When using `npm run`, you **must** pass a double dash (`--`) before your arguments. This prevents NPM from stealing your custom flags (like `--output` or `--older-than`) and safely passes them to the underlying script.

### 1. Scan Directory Metrics

Scans a target folder recursively and prints comprehensive breakdowns covering extensions, file sizing, and file age deltas.

```bash
# Using direct Node execution
node file-organizer.js scan ~/Downloads

# Using NPM Script
npm run scan -- ~/Downloads

```

### 2. Discover Content Duplicates

Calculates SHA-256 fingerprints to expose identical data copies across various subfolders, displaying exact disk space wasting aggregates.

```bash
# Using direct Node execution
node file-organizer.js duplicates ~/Downloads

# Using NPM Script
npm run duplicates -- ~/Downloads

```

### 3. Categorize & Organize Files

Copies files from a source root into classified destination folders based on strict extension mapping without touching the original files.

```bash
# Using direct Node execution
node file-organizer.js organize ~/Downloads --output ~/Organized

# Using NPM Script
npm run organize -- ~/Downloads --output ~/Organized

```

### 4. Expired Data Cleanup

Locates files matching modifications older than a specified number of days.

#### Dry Run Mode (Safe Preview)

```bash
# Using direct Node execution
node file-organizer.js cleanup ~/Downloads --older-than 90

# Using NPM Script
npm run cleanup -- ~/Downloads --older-than 90

```

#### Confirmed Purge Mode (Permanent Erasure)

```bash
# Using direct Node execution
node file-organizer.js cleanup ~/Downloads --older-than 90 --confirm

# Using NPM Script
npm run cleanup -- ~/Downloads --older-than 90 --confirm

```

---

## 🛡️ Error Handling Boundaries

All filesystem operations are heavily guarded within granular `try...catch` blocks to protect execution health. System runtime errors translate technical system indicators into explicit user warnings:

* `ENOENT` → The requested path or target directory profile cannot be found.
* `EACCES` → The application lacks adequate kernel privileges or filesystem lock security rights.
* Unhandled system interruptions return explicit issue tracking logs before cleanly triggering an OS process drop exit status code (`process.exit(1)`).

